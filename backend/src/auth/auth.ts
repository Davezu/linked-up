import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE || 'link-organizer-accounts';
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '30d') as SignOptions['expiresIn'];

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required');
}

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/* random code generate */
export function generateAccessCode(): string {
    const raw = Array.from(randomBytes(9))
        .map(b => ACCESS_CODE_ALPHABET[b & 31]) // alphabet intentionally has 32 chars
        .join('');

    return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
}

/** Standardize input: strip LO-, acc-, spaces, dashes -> format as XXX-YYY-ZZZ if 9 chars */
function normalizeCodeInput(input: string): { rawAccessCode: string; formattedAccessCode: string } {
    let clean = input.trim().toUpperCase()
    // Remove LO- or LO-ACC- prefixes if present
    clean = clean.replace(/^LO-/, '').replace(/^ACC-/, '')
    const alphanumeric = clean.replace(/[^A-Z0-9]/g, '')

    if (alphanumeric.length === 9) {
        const formatted = `${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 6)}-${alphanumeric.slice(6)}`
        return { rawAccessCode: alphanumeric, formattedAccessCode: formatted }
    }
    return { rawAccessCode: alphanumeric, formattedAccessCode: clean }
}

/* register account */
export async function registerAccount(): Promise<{ accountId: string; combinedCredential: string }> {
    const accessCode = generateAccessCode();
    const accountId = `acc-${accessCode.replace(/-/g, '')}`;
    const codeHash = await bcrypt.hash(accessCode, 12);

    await dynamo.send(new PutCommand({
        TableName: ACCOUNTS_TABLE,
        Item: {
            accountId,
            accessCode,
            codeHash,
            createdAt: new Date().toISOString(),
            itemCount: 0,
        },
        // Guard against accountId collisions - fails instead of overwriting
        ConditionExpression: 'attribute_not_exists(accountId)',
    }));

    // New clean credential format: just the access code (e.g. 8TD-SBW-3QK)
    return { accountId, combinedCredential: accessCode };
}

const LEGACY_CREDENTIAL_PATTERN = /^LO-(acc-[a-f0-9]+)-([A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3})$/i;

export async function loginWithCode(inputCredential: string): Promise<{ token: string; accountId: string }> {
    const trimmed = inputCredential.trim();

    // 1. Support legacy combined credential (LO-acc-xxx-yyy-zzz)
    const legacyMatch = trimmed.match(LEGACY_CREDENTIAL_PATTERN);
    if (legacyMatch) {
        const [, accountId, accessCode] = legacyMatch;
        const result = await dynamo.send(new GetCommand({
            TableName: ACCOUNTS_TABLE,
            Key: { accountId },
        }));
        if (result.Item && (await bcrypt.compare(accessCode.toUpperCase(), result.Item.codeHash))) {
            const token = jwt.sign({ accountId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
            return { token, accountId };
        }
    }

    // 2. Short Access Code login (e.g. 8TD-SBW-3QK or 8TDSBW3QK or LO-8TD-SBW-3QK)
    const { formattedAccessCode } = normalizeCodeInput(trimmed);
    const shortAccountId = `acc-${formattedAccessCode.replace(/-/g, '')}`;

    // Try direct lookup for new accountId format (acc-8TDSBW3QK)
    const directResult = await dynamo.send(new GetCommand({
        TableName: ACCOUNTS_TABLE,
        Key: { accountId: shortAccountId },
    }));

    if (directResult.Item) {
        const valid = await bcrypt.compare(formattedAccessCode, directResult.Item.codeHash);
        if (valid) {
            const token = jwt.sign({ accountId: shortAccountId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
            return { token, accountId: shortAccountId };
        }
    }

    // 3. Fallback scan for legacy accounts (e.g. acc-26aedfa6005d638f) using just their short code 8TD-SBW-3QK
    const scanResult = await dynamo.send(new ScanCommand({
        TableName: ACCOUNTS_TABLE,
        Limit: 200,
    }));

    for (const item of scanResult.Items ?? []) {
        if (item.codeHash && (await bcrypt.compare(formattedAccessCode, item.codeHash))) {
            const token = jwt.sign({ accountId: item.accountId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
            return { token, accountId: item.accountId };
        }
    }

    throw new Error('Invalid login code');
}

/**
 * Verifies a JWT and returns the accountId embedded in it.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token: string): { accountId: string } {
    const payload = jwt.verify(token, JWT_SECRET) as { accountId: string };
    return { accountId: payload.accountId };
}