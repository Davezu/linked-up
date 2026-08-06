import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

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

function generateAccountId(): string {
    return `acc-${randomBytes(8).toString('hex')}`;
}

/* register account */
export async function registerAccount(): Promise<{ accountId: string; combinedCredential: string }> {
    const accountId = generateAccountId();
    const accessCode = generateAccessCode();
    const codeHash = await bcrypt.hash(accessCode, 12);

    await dynamo.send(new PutCommand({
        TableName: ACCOUNTS_TABLE,
        Item: {
            accountId,
            codeHash,
            createdAt: new Date().toISOString(),
        },
        // Guard against accountId collisions - fails instead of overwriting
        ConditionExpression: 'attribute_not_exists(accountId)',
    }));

    const combinedCredential = `LO-${accountId}-${accessCode}`;
    return { accountId, combinedCredential };
}

const CREDENTIAL_PATTERN = /^LO-(acc-[a-f0-9]+)-([A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3})$/;

export async function loginWithCode(combinedCredential: string): Promise<{ token: string; accountId: string }> {
    const match = combinedCredential.match(CREDENTIAL_PATTERN);
    if (!match) throw new Error('Invalid credential format');
    const [, accountId, accessCode] = match;

    const result = await dynamo.send(new GetCommand({
        TableName: ACCOUNTS_TABLE,
        Key: { accountId },
    }));
    if (!result.Item) throw new Error('Account not found');

    const valid = await bcrypt.compare(accessCode, result.Item.codeHash);
    if (!valid) throw new Error('Invalid credentials');

    const token = jwt.sign({ accountId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    return { token, accountId };
}

/**
 * Verifies a JWT and returns the accountId embedded in it.
 * Throws if the token is invalid or expired.
 */
export function verifyToken(token: string): { accountId: string } {
    const payload = jwt.verify(token, JWT_SECRET) as { accountId: string };
    return { accountId: payload.accountId };
}