const TOKEN_KEY = 'lo_auth_token'

export function getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
    if (!token) { throw new Error('Token cannot be empty') }
    localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY)
}

export function hasToken(): boolean {
    return !!getToken()
}

export function authHeaders(): HeadersInit {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
}