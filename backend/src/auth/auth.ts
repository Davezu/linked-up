import 'dotenv/config';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const ACCOUNTS_TABLE = process.env.ACCOUNTS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRY = (process.env.JWT_EXPIRY || '30d') as SignOptions['expiresIn'];

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required');
}

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function isValidAccessChar(c: string): boolean {
    return ACCESS_CODE_ALPHABET.includes(c);
}

/** Accept 8TD-SBW-3QK or 8TDSBW3QK (exactly 9 characters, dashes optional) */
export function extractAccessCode(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) throw new Error('Invalid login code');

    const alphanumeric = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (alphanumeric.length !== 9 || !alphanumeric.split('').every(isValidAccessChar)) {
        throw new Error('Invalid login code');
    }

    return `${alphanumeric.slice(0, 3)}-${alphanumeric.slice(3, 6)}-${alphanumeric.slice(6)}`;
}

/* random code generate */
export function generateAccessCode(): string {
    const raw = Array.from(randomBytes(9))
        .map(b => ACCESS_CODE_ALPHABET[b & 31])
        .join('');

    return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
}

/* register account */
export async function registerAccount(): Promise<{ accessCode: string }> {
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
        ConditionExpression: 'attribute_not_exists(accountId)',
    }));

    return { accessCode };
}

export async function loginWithCode(inputCredential: string): Promise<{ token: string }> {
    const accessCode = extractAccessCode(inputCredential);
    const accountId = `acc-${accessCode.replace(/-/g, '')}`;

    const result = await dynamo.send(new GetCommand({
        TableName: ACCOUNTS_TABLE,
        Key: { accountId },
    }));

    if (result.Item?.codeHash) {
        const valid = await bcrypt.compare(accessCode, result.Item.codeHash);
        if (valid) {
            const token = jwt.sign({ accountId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
            return { token };
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
