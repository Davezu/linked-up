import { API_BASE } from '../constants'
import { normalizeLoginCode } from './normalizeLoginCode.ts'

async function parseError(res: Response): Promise<string> {
    const body = await res.json().catch(() => null)
    return body?.message ?? 'Something went wrong'
}

export async function registerAccount(): Promise<{ accessCode: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, { method: 'POST' })
    if (!res.ok) {
        throw new Error(await parseError(res))
    }
    return res.json()
}

export async function loginWithCredential(credential: string): Promise<{ token: string }> {
    const loginCode = normalizeLoginCode(credential)
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginCode }),
    })
    if (!res.ok) {
        throw new Error(await parseError(res))
    }
    return res.json()
}