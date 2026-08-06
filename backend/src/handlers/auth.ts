import { registerAccount, loginWithCode } from '../auth/auth'
import { HttpError } from '../utils/errors'
import { parseBody } from '../utils/response'
import { enforceLoginRateLimit } from '../services/rateLimit'

export async function handleRegister() {
    return registerAccount()
}

export async function handleLogin(body: string | null, sourceIp: string) {
    await enforceLoginRateLimit(sourceIp)

    const { loginCode } = parseBody<{ loginCode?: string }>(body)
    if (!loginCode) throw new HttpError(400, 'loginCode is required')

    try {
        return await loginWithCode(loginCode)
    } catch {
        // Never leak *why* it failed (wrong code vs no such account) — both
        // read the same to a caller, which avoids account enumeration.
        throw new HttpError(401, 'Invalid login code')
    }
}