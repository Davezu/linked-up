import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { verifyToken } from './auth/auth'
import { HttpError } from './utils/errors'
import { ok, err, CORS } from './utils/response'
import { handleRegister, handleLogin } from './handlers/auth'
import { listLinks, createLink, deleteLink, updateLinkStatus } from './handlers/links'
import { listNotes, createNote, updateNote, deleteNote } from './handlers/notes'

type LambdaEvent = APIGatewayProxyEvent & {
  rawPath?: string
  requestContext?: APIGatewayProxyEvent['requestContext'] & {
    http?: { method?: string; path?: string; sourceIp?: string }
    resourcePath?: string
  }
}

function getMethod(event: LambdaEvent): string {
  return event.httpMethod ?? event.requestContext?.http?.method ?? ''
}

function getPath(event: LambdaEvent): string {
  return (
    event.rawPath ??
    event.path ??
    event.requestContext?.http?.path ??
    event.requestContext?.resourcePath ??
    ''
  )
}

function getSourceIp(event: LambdaEvent): string {
  return event.requestContext?.http?.sourceIp ?? event.requestContext?.identity?.sourceIp ?? 'unknown'
}

function endsWith(path: string, suffix: string): boolean {
  return path.replace(/\/+$/, '').endsWith(suffix)
}

/**
 * Matches '/links' or bare stage path (e.g. '/link-organizer')
 * supported for backwards compatibility with legacy frontend API_BASE calls.
 */
function isLinksListPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, '')
  return normalized.endsWith('/links') || normalized.endsWith('/link-organizer')
}

/** Extracts and verifies the accountId from the Authorization header. */
function requireAccountId(event: LambdaEvent): string {
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) throw new HttpError(401, 'Missing Authorization token')

  try {
    return verifyToken(token).accountId
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }
}

async function route(event: LambdaEvent): Promise<APIGatewayProxyResult> {
  const method = getMethod(event)
  const path = getPath(event)
  const body = event.body ?? null

  if (method === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' }

  /* Auth Routes */
  if (method === 'POST' && endsWith(path, '/auth/register')) { return ok(await handleRegister()) }
  if (method === 'POST' && endsWith(path, '/auth/login')) { return ok(await handleLogin(body, getSourceIp(event))) }

  /* Links Routes */
  const accountId = requireAccountId(event)

  if (method === 'GET' && isLinksListPath(path)) { return ok(await listLinks(accountId)) }
  if (method === 'POST' && isLinksListPath(path)) { return ok(await createLink(accountId, body)) }
  if (method === 'DELETE' && isLinksListPath(path)) { return ok(await deleteLink(accountId, body, event.queryStringParameters?.id)) }
  if (method === 'PUT' && isLinksListPath(path)) { return ok(await updateLinkStatus(accountId, body)) }

  /* Notes Routes */
  if (method === 'GET' && endsWith(path, '/notes')) { return ok(await listNotes(accountId)) }
  if (method === 'POST' && endsWith(path, '/notes')) { return ok(await createNote(accountId, body)) }
  if (method === 'PUT' && endsWith(path, '/notes')) { return ok(await updateNote(accountId, body)) }
  if (method === 'DELETE' && endsWith(path, '/notes')) { return ok(await deleteNote(accountId, body, event.queryStringParameters?.id)) }

  throw new HttpError(404, 'Not Found')
}

/**
 * Single global error boundary. Route handlers and services (auth, links,
 * notes) throw HttpError for expected failures (bad input, not found,
 * unauthorized, rate limited); anything else is logged and returned as a
 * generic 500 so callers never see internal error details.
 */
export const handler = async (event: LambdaEvent): Promise<APIGatewayProxyResult> => {
  try {
    return await route(event)
  } catch (e) {
    const statusCode = (e as any)?.statusCode
    if (typeof statusCode === 'number') {
      return err(statusCode, (e as Error).message)
    }
    console.error('[handler] Unhandled error:', e)
    return err(500, 'Internal server error')
  }
}