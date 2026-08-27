import { useState, useRef } from 'react'
import { ArrowLeft, Sun, Moon, Check, Copy, X, AlertCircle } from 'lucide-react'
import { registerAccount, loginWithCredential } from '../lib/auth/authService'
import { setToken } from '../lib/auth/tokenStorage'
import { AuthShowcase } from './AuthShowcase'
import DarkVeil from './react-bits/DarkVeil'

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
    const [copied, setCopied] = useState(false)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const themeBtnRef = useRef<HTMLButtonElement>(null)

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

    function handleCopyCode() {
        if (!generatedCode) return
        navigator.clipboard.writeText(generatedCode)
        setCopied(true)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), 4000)
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
        <div className="auth-gate" data-auth-theme={theme}>
            {/* DarkVeil animated background — dark mode only */}
            {theme === 'dark' && (
                <div className="auth-darkveil-bg" aria-hidden="true">
                    <DarkVeil
                        hueShift={0}
                        speed={0.4}
                        noiseIntensity={0.03}
                        warpAmount={0.25}
                        resolutionScale={0.85}
                    />
                </div>
            )}

            {/* Theme toggle */}
            <button
                ref={themeBtnRef}
                type="button"
                className="auth-theme-toggle-btn"
                onClick={() => onToggleTheme(themeBtnRef.current)}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
                {theme === 'dark'
                    ? <Sun size={16} strokeWidth={2} />
                    : <Moon size={16} strokeWidth={2} />
                }
            </button>

            <div className="auth-gate-shell">
                <section className="auth-gate-panel auth-gate-panel--form">
                    {/* Hero */}
                    <div className="auth-hero mb-6">
                        <h1 className="m-0 mb-4 text-[clamp(2.4rem,4vw,3.2rem)] font-extrabold tracking-[-0.03em] leading-[1.18] text-[var(--text-main)]">
                            Your library, organized beautifully
                        </h1>
                        <p className="m-0 text-[1.05rem] leading-[1.6] text-[var(--text-dim)]">
                            Save links, take notes, ask AI — all in one place.
                        </p>
                    </div>

                    {/* Form */}
                    <div className="flex flex-col gap-3 w-[min(100%,32rem)]">
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
                                    className="auth-btn-secondary"
                                >
                                    I already have a code
                                </button>
                            </>
                        )}

                        {mode === 'register' && !generatedCode && (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="m-0 text-[15px] font-semibold text-[var(--text-main)]">Create your account</p>
                                    <button
                                        type="button"
                                        onClick={() => setMode('choose')}
                                        className="auth-back-btn"
                                        aria-label="Back"
                                    >
                                        <ArrowLeft size={15} strokeWidth={2.2} />
                                        <span>Back</span>
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
                                {copied && (
                                    <div className="app-success-toast" data-auth-theme={theme} role="status">
                                        <div className="app-success-toast-icon">
                                            <Check size={13} strokeWidth={3} />
                                        </div>
                                        <div className="app-success-toast-content">
                                            <h4 className="app-success-toast-title">Success</h4>
                                            <p className="app-success-toast-msg">Code copied to clipboard successfully.</p>
                                        </div>
                                        <button
                                            type="button"
                                            className="app-success-toast-close"
                                            onClick={() => setCopied(false)}
                                            aria-label="Dismiss notification"
                                        >
                                            <X size={15} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                )}
                                <div className="flex items-center justify-between gap-3">
                                    <p className="m-0 text-[15px] font-semibold text-[var(--text-main)]">Save your code</p>
                                </div>
                                <p className="m-0 text-[15px] leading-[1.6] text-[var(--text-dim)]"><strong>Save this code now — it won&apos;t be shown again:</strong></p>
                                <code className="auth-code-display">{generatedCode}</code>
                                <button
                                    type="button"
                                    onClick={handleCopyCode}
                                    className={`auth-btn-secondary flex items-center justify-center gap-2 transition-all ${copied ? '!border-emerald-500/50 !text-emerald-400 !bg-emerald-500/10' : ''}`}
                                >
                                    {copied ? (
                                        <>
                                            <Check size={16} className="stroke-[2.5]" />
                                            <span>Copied to Clipboard!</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={16} strokeWidth={2} />
                                            <span>Copy Code</span>
                                        </>
                                    )}
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
                                    <button
                                        type="button"
                                        onClick={() => setMode('choose')}
                                        className="auth-back-btn"
                                        aria-label="Back"
                                    >
                                        <ArrowLeft size={15} strokeWidth={2.2} />
                                        <span>Back</span>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    inputMode="text"
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="auth-code-input"
                                    value={loginCode}
                                    onChange={e => { setLoginCode(e.target.value.toUpperCase()); setError(null) }}
                                    onKeyDown={e => { if (e.key === 'Enter') handleLoginSubmit() }}
                                    placeholder="ABC-123-DEF"
                                    autoFocus
                                />
                                <p className="auth-hint">Dashes optional — ABC123DEF works too.</p>
                                <button type="button" onClick={handleLoginSubmit} disabled={loading || !loginCode.trim()} className="auth-btn-primary">
                                    {loading ? 'Logging in…' : 'Log In'}
                                </button>
                            </>
                        )}

                        {error && (
                            <div className="auth-error-alert" data-auth-theme={theme} role="alert">
                                <AlertCircle size={16} strokeWidth={2.2} className="auth-error-alert-icon" />
                                <span className="auth-error-alert-text">{error}</span>
                            </div>
                        )}
                    </div>
                </section>

                <AuthShowcase />
            </div>
        </div>
    )
}

