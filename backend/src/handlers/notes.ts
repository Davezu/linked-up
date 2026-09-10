import { randomUUID } from 'crypto'
import { QueryCommand, PutCommand, GetCommand, DeleteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'
import { dynamo, LINKS_TABLE } from '../services/dynamo'
import { HttpError } from '../utils/errors'
import { parseBody } from '../utils/response'

const noteKey = (id: string) => `NOTE#${id}`
const MAX_CONTENT_LENGTH = 20000

function sanitizeTags(input: unknown): string[] {
    if (!Array.isArray(input)) return []
    return input
        .filter((t): t is string => typeof t === 'string')
        .map(t => t.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, 20)
}

/* List Notes — account-scoped, sorted newest-updated first */
export async function listNotes(accountId: string) {
    const result = await dynamo.send(new QueryCommand({
        TableName: LINKS_TABLE,
        KeyConditionExpression: 'accountId = :accountId AND begins_with(itemKey, :prefix)',
        ExpressionAttributeValues: {
            ':accountId': accountId,
            ':prefix': 'NOTE#',
        },
    }))

    return (result.Items ?? []).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
}

/* Create Note */
export async function createNote(accountId: string, body: string | null) {
    const payload = parseBody<Record<string, any>>(body)

    const contentStr = String(payload.content ?? '').trim()
    if (!contentStr) {
        throw new HttpError(400, 'content is required')
    }
    if (contentStr.length > MAX_CONTENT_LENGTH) {
        throw new HttpError(400, `content must be ${MAX_CONTENT_LENGTH} characters or fewer`)
    }

    const id = randomUUID()
    const now = new Date().toISOString()

    // Auto-derive title from first non-empty line if not provided
    const autoTitle = contentStr.split('\n').find(l => l.trim()) ?? ''
    const title = payload.title?.trim() || autoTitle.slice(0, 100)

    const record = {
        accountId,
        itemKey: noteKey(id),
        type: 'note',
        id,
        title,
        content: contentStr,
        tags: sanitizeTags(payload.tags),
        created_at: now,
        updated_at: now,
    }

    await dynamo.send(new PutCommand({ TableName: LINKS_TABLE, Item: record }))
    return { success: true, record }
}

/* Update Note — partial update of content, title, tags */
export async function updateNote(accountId: string, body: string | null) {
    const payload = parseBody<{ id?: string; content?: string; title?: string; tags?: string[] }>(body)
    if (!payload.id) throw new HttpError(400, 'Missing id')

    const key = { accountId, itemKey: noteKey(payload.id) }
    const existing = await dynamo.send(new GetCommand({ TableName: LINKS_TABLE, Key: key }))
    if (!existing.Item) throw new HttpError(404, 'Note not found')

    let newContent = existing.Item.content
    if (payload.content !== undefined) {
        const trimmed = String(payload.content).trim()
        if (!trimmed) {
            throw new HttpError(400, 'content cannot be empty')
        }
        if (trimmed.length > MAX_CONTENT_LENGTH) {
            throw new HttpError(400, `content must be ${MAX_CONTENT_LENGTH} characters or fewer`)
        }
        newContent = trimmed
    }

    const now = new Date().toISOString()
    const autoTitle = String(newContent).split('\n').find(l => l.trim()) ?? ''
    const newTitle = payload.title !== undefined
        ? (payload.title.trim() || autoTitle.slice(0, 100))
        : existing.Item.title
    const newTags = payload.tags !== undefined ? sanitizeTags(payload.tags) : existing.Item.tags

    await dynamo.send(new UpdateCommand({
        TableName: LINKS_TABLE,
        Key: key,
        UpdateExpression: 'set #content = :content, #title = :title, #tags = :tags, #updated_at = :updated_at',
        ExpressionAttributeNames: {
            '#content': 'content',
            '#title': 'title',
            '#tags': 'tags',
            '#updated_at': 'updated_at',
        },
        ExpressionAttributeValues: {
            ':content': newContent,
            ':title': newTitle,
            ':tags': newTags,
            ':updated_at': now,
        },
    }))

    return { success: true, id: payload.id, updated_at: now }
}

/* Delete Note — hard delete with 404 check */
export async function deleteNote(accountId: string, body: string | null, queryId?: string) {
    let id: string | undefined
    try {
        id = parseBody<{ id?: string }>(body).id
    } catch {}
    id ??= queryId

    if (!id) throw new HttpError(400, 'Missing id')

    const key = { accountId, itemKey: noteKey(id) }
    const existing = await dynamo.send(new GetCommand({ TableName: LINKS_TABLE, Key: key }))
    if (!existing.Item) throw new HttpError(404, 'Note not found')

    await dynamo.send(new DeleteCommand({ TableName: LINKS_TABLE, Key: key }))
    return { success: true, id }
}
