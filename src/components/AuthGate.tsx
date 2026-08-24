import { useState } from 'react'
import { ArrowLeft, Moon, Sun } from 'lucide-react'
import { registerAccount, loginWithCredential } from '../lib/auth/authService'
import { setToken } from '../lib/auth/tokenStorage'
import { AuthShowcase } from './AuthShowcase'

export function AuthGate({
    onSuccess,
    theme,
    onToggleTheme,
}: {
    onSuccess: () => void
    theme: 'light' | 'dark'
    onToggleTheme: (originEl: HTMLElement | null) => void
}) {
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
        <div className="auth-gate">
            <button
                type="button"
                className="auth-theme-toggle theme-toggle"
                onClick={e => onToggleTheme(e.currentTarget)}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
                {theme === 'dark' ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
            </button>

            <div className="auth-gate-shell">
                <section className="auth-gate-panel auth-gate-panel--form">
                    <div className="auth-hero">
                        <h1 className="auth-hero-title">Your library, organized beautifully</h1>
                        <p className="auth-hero-subtitle">Save links, take notes, ask AI — all in one place.</p>
                    </div>

                    <div className="auth-form">
                        {mode === 'choose' && (
                            <>
                                <p className="auth-form-lead">Get started with a private login code — no email required.</p>
                                <button type="button" onClick={() => setMode('register')} className="auth-btn-primary">
                                    Create Account
                                </button>
                                <button type="button" onClick={() => setMode('login')} className="auth-btn-secondary">
                                    I already have a code
                                </button>
                            </>
                        )}

                        {mode === 'register' && !generatedCode && (
                            <>
                                <div className="auth-form-row">
                                    <p className="auth-form-label">Create your account</p>
                                    <button type="button" onClick={() => setMode('choose')} className="auth-back-btn" aria-label="Back">
                                        <ArrowLeft size={14} strokeWidth={2.2} />
                                        Back
                                    </button>
                                </div>
                                <p className="auth-form-copy">
                                    We&apos;ll generate a login code for you. Save it somewhere safe — it&apos;s the only way to access your account.
                                </p>
                                <button type="button" onClick={handleRegister} disabled={loading} className="auth-btn-primary">
                                    {loading ? 'Generating…' : 'Generate My Code'}
                                </button>
                            </>
                        )}

                        {mode === 'register' && generatedCode && (
                            <>
                                <div className="auth-form-row">
                                    <p className="auth-form-label">Save your code</p>
                                </div>
                                <p className="auth-form-copy"><strong>Save this code now — it won&apos;t be shown again:</strong></p>
                                <code className="auth-code-display">{generatedCode}</code>
                                <button type="button" onClick={() => { navigator.clipboard.writeText(generatedCode) }} className="auth-btn-secondary">
                                    Copy Code
                                </button>
                                <label className="auth-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={confirmedSaved}
                                        onChange={e => setConfirmedSaved(e.target.checked)}
                                    />
                                    I&apos;ve saved this code somewhere safe
                                </label>
                                <button type="button" onClick={handleContinueAfterRegister} disabled={!confirmedSaved} className="auth-btn-primary">
                                    Continue
                                </button>
                            </>
                        )}

                        {mode === 'login' && (
                            <>
                                <div className="auth-form-row">
                                    <p className="auth-form-label">Enter your login code:</p>
                                    <button type="button" onClick={() => setMode('choose')} className="auth-back-btn" aria-label="Back">
                                        <ArrowLeft size={14} strokeWidth={2.2} />
                                        Back
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="auth-input"
                                    value={loginCode}
                                    onChange={e => { setLoginCode(e.target.value.toUpperCase()); setError(null) }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleLoginSubmit() }}
                                    placeholder="8TD-SBW-3QK"
                                    autoFocus
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                                <p className="auth-hint">Dashes optional — 8TDSBW3QK works too.</p>
                                <button type="button" onClick={handleLoginSubmit} disabled={loading || !loginCode.trim()} className="auth-btn-primary">
                                    {loading ? 'Logging in…' : 'Log In'}
                                </button>
                            </>
                        )}

                        {error && <p className="auth-error" role="alert">{error}</p>}
                    </div>
                </section>

                <AuthShowcase />
            </div>
        </div>
    )
}
