import { randomUUID } from 'crypto'
import { QueryCommand, PutCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo, LINKS_TABLE } from '../services/dynamo'
import { HttpError } from '../utils/errors'
import { parseBody } from '../utils/response'

const linkKey = (id: string) => `LINK#${id}`

/* List Links — filtered to authenticated user's items only */
export async function listLinks(accountId: string) {
    const result = await dynamo.send(new QueryCommand({
        TableName: LINKS_TABLE,
        KeyConditionExpression: 'accountId = :accountId AND begins_with(itemKey, :prefix)',
        ExpressionAttributeValues: {
            ':accountId': accountId,
            ':prefix': 'LINK#',
        },
    }))

    return (result.Items ?? []).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
}

/* Create Link */
export async function createLink(accountId: string, body: string | null) {
    const payload = parseBody<Record<string, any>>(body)

    if (!payload.url || !String(payload.url).trim()) {
        throw new HttpError(400, 'url is required')
    }
    try {
        new URL(payload.url)
    } catch {
        throw new HttpError(400, 'Invalid url')
    }

    const id = randomUUID()
    const record = {
        accountId,
        itemKey: linkKey(id),
        id,
        url: payload.url,
        title: payload.title || payload.url,
        description: payload.description || '',
        image: payload.image || null,
        category: payload.category || '📎 Uncategorized',
        summary: payload.summary || '',
        tags: payload.tags || [],
        created_at: new Date().toISOString(),
        ai_provider: payload.provider || 'unknown',
        status: payload.status || 'To Watch',
    }

    await dynamo.send(new PutCommand({ TableName: LINKS_TABLE, Item: record }))
    return { success: true, record }
}

/* Hard-delete link — permanently removes from DynamoDB.
 * Idempotent: succeeds even if already deleted.
 * NOTE: Soft delete (deletedAt + TTL) is reserved for the future Notes feature. */
export async function deleteLink(accountId: string, body: string | null, queryId?: string) {
    let id: string | undefined
    try {
        id = parseBody<{ id?: string }>(body).id
    } catch {
        // body may legitimately be empty when id is passed as a query param
    }
    id ??= queryId

    if (!id) throw new HttpError(400, 'Missing id')

    const key = { accountId, itemKey: linkKey(id) }
    await dynamo.send(new DeleteCommand({ TableName: LINKS_TABLE, Key: key }))
    return { success: true, id }
}

/* Update Link Status */
export async function updateLinkStatus(accountId: string, body: string | null) {
    const { id, status } = parseBody<{ id?: string; status?: string }>(body)
    if (!id || !status) throw new HttpError(400, 'Missing id or status')

    const key = { accountId, itemKey: linkKey(id) }
    const existing = await dynamo.send(new GetCommand({ TableName: LINKS_TABLE, Key: key }))
    if (!existing.Item) throw new HttpError(404, 'Not found')

    await dynamo.send(new UpdateCommand({
        TableName: LINKS_TABLE,
        Key: key,
        UpdateExpression: 'set #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':status': status },
    }))

    return { success: true, id, status }
}