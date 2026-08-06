import { API_BASE } from '../constants'

async function parseError(res: Response): Promise<string> {
    const body = await res.json().catch(() => null)
    return body?.message ?? 'Something went wrong'
}

export async function registerAccount(): Promise<{ accountId: string; combinedCredential: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST' })
    if (!res.ok) {
        throw new Error(await parseError(res))
    }
    return res.json()
}

export async function loginWithCredential(credential: string): Promise<{ token: string; accountId: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginCode: credential }),
    })
    if (!res.ok) {
        throw new Error(await parseError(res))
    }
    return res.json()
}