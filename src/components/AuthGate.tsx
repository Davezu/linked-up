import { useState } from 'react'
import { registerAccount } from '../lib/auth/authService'
import { setToken } from '../lib/auth/tokenStorage'
import { loginWithCredential } from '../lib/auth/authService'

export function AuthGate({ onSuccess }: { onSuccess: () => void }) {
    const [mode, setMode] = useState<'choose' | 'register' | 'login'>('choose')
    const [loginCode, setLoginCode] = useState('')
    const [generatedCode, setGeneratedCode] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [confirmedSaved, setConfirmedSaved] = useState(false)

    async function handleRegister() {
        setLoading(true); setError(null)
        try {
            const { accessCode } = await registerAccount()
            setGeneratedCode(accessCode)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create account. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    async function handleLoginSubmit() {
        if (!loginCode.trim()) return
        setLoading(true); setError(null)
        try {
            const { token } = await loginWithCredential(loginCode.trim())
            setToken(token)
            onSuccess()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Invalid code')
        } finally {
            setLoading(false)
        }
    }

    function handleContinueAfterRegister() {
        setMode('login')
        setLoginCode(generatedCode ?? '')
        setGeneratedCode(null)
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--color-bg)] text-[var(--text-main)] auth-gate">
            <div className="w-full max-w-md p-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl flex flex-col gap-5 text-center relative overflow-hidden backdrop-blur-xl auth-card">
                <h1 className="text-2xl font-bold font-[family-name:var(--font-display)] bg-[var(--auth-title-gradient)] bg-clip-text text-transparent m-0">Knowledge Vault</h1>

                {mode === 'choose' && (
                    <>
                        <p className="text-sm text-[var(--text-dim)] m-0 leading-relaxed">Save links, take notes, ask AI about your library.</p>
                        <button type="button" onClick={() => setMode('register')} className="auth-btn-primary">Create Account</button>
                        <button type="button" onClick={() => setMode('login')} className="auth-btn-secondary">I already have a code</button>
                    </>
                )}

                {mode === 'register' && !generatedCode && (
                    <>
                        <p className="text-sm text-[var(--text-dim)] m-0 leading-relaxed">We'll generate a login code for you. Save it somewhere safe — it's the only way to access your account, and we can't recover it if you lose it.</p>
                        <button type="button" onClick={handleRegister} disabled={loading} className="auth-btn-primary">
                            {loading ? 'Generating…' : 'Generate My Code'}
                        </button>
                        <button type="button" onClick={() => setMode('choose')} className="auth-btn-secondary">Back</button>
                    </>
                )}

                {mode === 'register' && generatedCode && (
                    <>
                        <p className="text-sm text-[var(--text-main)] m-0"><strong>Save this code now — it won't be shown again:</strong></p>
                        <code className="block p-4 my-1 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] font-mono text-sm tracking-wider break-all select-all text-[var(--accent-crimson)]">{generatedCode}</code>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(generatedCode) }} className="auth-btn-secondary">
                            Copy Code
                        </button>
                        <label className="flex items-center justify-center gap-2 text-xs text-[var(--text-dim)] cursor-pointer">
                            <input
                                type="checkbox"
                                checked={confirmedSaved}
                                onChange={e => setConfirmedSaved(e.target.checked)}
                                className="rounded accent-[var(--accent-crimson)] cursor-pointer"
                            />
                            I've saved this code somewhere safe
                        </label>
                        <button type="button" onClick={handleContinueAfterRegister} disabled={!confirmedSaved} className="auth-btn-primary">
                            Continue
                        </button>
                    </>
                )}

                {mode === 'login' && (
                    <>
                        <p className="text-sm text-[var(--text-dim)] m-0">Enter your 9-character login code:</p>
                        <input
                            type="text"
                            value={loginCode}
                            onChange={e => { setLoginCode(e.target.value.toUpperCase()); setError(null) }}
                            onKeyDown={e => { if (e.key === 'Enter') handleLoginSubmit() }}
                            placeholder="8TD-SBW-3QK"
                            autoFocus
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-main)] text-sm font-mono tracking-wider uppercase focus:border-[var(--accent-crimson)] focus:ring-2 focus:ring-[var(--focus-ring)] outline-none transition-all"
                        />
                        <p className="text-[11px] text-[var(--text-muted)] m-0">Dashes optional — 8TDSBW3QK works too.</p>
                        <button type="button" onClick={handleLoginSubmit} disabled={loading || !loginCode.trim()} className="auth-btn-primary">
                            {loading ? 'Logging in…' : 'Log In'}
                        </button>
                        <button type="button" onClick={() => setMode('choose')} className="auth-btn-secondary">Back</button>
                    </>
                )}

                {error && <p className="text-xs text-[var(--color-destructive-text)] bg-red-500/10 p-3 rounded-lg m-0 border border-red-500/20 auth-error" role="alert">{error}</p>}
            </div>
        </div>
    )
}
