import { APIGatewayProxyResult } from 'aws-lambda'
import { HttpError } from './errors'

export const CORS = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,GET,DELETE,PUT,OPTIONS',
}

export function ok(body: unknown): APIGatewayProxyResult {
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function err(status: number, message: string): APIGatewayProxyResult {
    return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) }
}

/**
 * Parses a JSON request body and throws a 400 HttpError on invalid JSON,
 * instead of every route wrapping its own try/catch around JSON.parse.
 */
export function parseBody<T = Record<string, unknown>>(body?: string | null): T {
    try {
        return JSON.parse(body || '{}') as T
    } catch {
        throw new HttpError(400, 'Invalid JSON body')
    }
}