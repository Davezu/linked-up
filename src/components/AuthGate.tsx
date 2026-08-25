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
                    {/* Hero */}
                    <div className="auth-hero">
                        <h1 className="m-0 mb-5 text-[clamp(2.5rem,4.5vw,3.6rem)] font-extrabold tracking-[-0.04em] leading-[1.05] text-[var(--text-main)]">
                            Your library, organized beautifully
                        </h1>
                        <p className="m-0 text-[1.125rem] leading-[1.55] text-[var(--text-dim)]">
                            Save links, take notes, ask AI — all in one place.
                        </p>
                    </div>

                    {/* Form */}
                    <div className="flex flex-col gap-5 w-[min(100%,26rem)]">
                        {mode === 'choose' && (
                            <>
                                <p className="m-0 text-[15px] leading-[1.6] text-[var(--text-dim)]">
                                    Get started with a private login code — no email required.
                                </p>
                                <button type="button" onClick={() => setMode('register')} className="auth-btn-primary">
                                    Create Account
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('login')}
                                    className="w-full min-h-[50px] px-4 rounded-[var(--radius-md)] text-[15px] font-semibold cursor-pointer border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-main)] transition-[background,color,border-color,filter] duration-200 hover:bg-[var(--chip-bg-hover)] hover:border-[color-mix(in_srgb,var(--border)_55%,var(--text-main))] disabled:opacity-45 disabled:cursor-not-allowed"
                                >
                                    I already have a code
                                </button>
                            </>
                        )}

                        {mode === 'register' && !generatedCode && (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="m-0 text-[15px] font-semibold text-[var(--text-main)]">Create your account</p>
                                    <button type="button" onClick={() => setMode('choose')} className="inline-flex items-center gap-[0.4rem] px-[0.85rem] py-[0.35rem] border border-[var(--border)] rounded-full bg-[var(--bg-input)] text-[var(--text-dim)] text-xs font-semibold cursor-pointer transition-[background,color,border-color] duration-150 hover:bg-[var(--chip-bg-hover)] hover:border-[var(--border-hover)] hover:text-[var(--text-main)]" aria-label="Back">
                                        <ArrowLeft size={14} strokeWidth={2.2} />
                                        Back
                                    </button>
                                </div>
                                <p className="m-0 text-[15px] leading-[1.6] text-[var(--text-dim)]">
                                    We&apos;ll generate a login code for you. Save it somewhere safe — it&apos;s the only way to access your account.
                                </p>
                                <button type="button" onClick={handleRegister} disabled={loading} className="auth-btn-primary">
                                    {loading ? 'Generating…' : 'Generate My Code'}
                                </button>
                            </>
                        )}

                        {mode === 'register' && generatedCode && (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="m-0 text-[15px] font-semibold text-[var(--text-main)]">Save your code</p>
                                </div>
                                <p className="m-0 text-[15px] leading-[1.6] text-[var(--text-dim)]"><strong>Save this code now — it won&apos;t be shown again:</strong></p>
                                <code className="auth-code-display">{generatedCode}</code>
                                <button type="button" onClick={() => { navigator.clipboard.writeText(generatedCode) }} className="w-full min-h-[50px] px-4 rounded-[var(--radius-md)] text-[15px] font-semibold cursor-pointer border border-[var(--border)] bg-[var(--bg-input)] text-[var(--text-main)] transition-[background,color,border-color,filter] duration-200 hover:bg-[var(--chip-bg-hover)] hover:border-[color-mix(in_srgb,var(--border)_55%,var(--text-main))] disabled:opacity-45 disabled:cursor-not-allowed">
                                    Copy Code
                                </button>
                                <label className="flex items-center gap-2 text-[13px] text-[var(--text-dim)] cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="accent-[var(--accent-crimson)] w-[14px] h-[14px] shrink-0"
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
                                <div className="flex items-center justify-between gap-3">
                                    <p className="m-0 text-[15px] font-semibold text-[var(--text-main)]">Enter your login code:</p>
                                    <button type="button" onClick={() => setMode('choose')} className="inline-flex items-center gap-[0.4rem] px-[0.85rem] py-[0.35rem] border border-[var(--border)] rounded-full bg-[var(--bg-input)] text-[var(--text-dim)] text-xs font-semibold cursor-pointer transition-[background,color,border-color] duration-150 hover:bg-[var(--chip-bg-hover)] hover:border-[var(--border-hover)] hover:text-[var(--text-main)]" aria-label="Back">
                                        <ArrowLeft size={14} strokeWidth={2.2} />
                                        Back
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="w-full px-[18px] py-[14px] bg-[var(--bg-input)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-main)] text-[15px] font-mono tracking-[0.04em] uppercase transition-[border-color,box-shadow,background] duration-200 focus:outline-none focus:border-[rgba(147,51,234,0.6)] focus:shadow-[0_0_0_3px_rgba(147,51,234,0.25)] placeholder:text-[var(--text-muted)] placeholder:normal-case placeholder:tracking-normal placeholder:font-sans"
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

                        {error && (
                            <p
                                className="m-0 px-[0.75rem] py-[0.65rem] rounded-[var(--radius-md)] text-[13px] text-[var(--color-destructive-text)] bg-[color-mix(in_srgb,var(--color-destructive)_12%,transparent)] border border-[color-mix(in_srgb,var(--color-destructive)_24%,transparent)]"
                                role="alert"
                            >
                                {error}
                            </p>
                        )}
                    </div>
                </section>

                <AuthShowcase />
            </div>
        </div>
    )
}
