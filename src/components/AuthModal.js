'use client';
import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { AVATAR_OPTIONS } from '@/lib/constants';

export default function AuthModal() {
  const { showAuth, authMode, setShowAuth, signup, login } = useStore();
  const [mode, setMode] = useState(authMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('😎');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    email: '', password: '', username: '', displayName: '', dateOfBirth: '', identifier: '',
  });
  const [step, setStep] = useState(1); // signup steps: 1=basics, 2=profile

  useEffect(() => { setMode(authMode); setStep(1); setError(''); setSuccess(''); }, [authMode, showAuth]);

  if (!showAuth) return null;

  const handleSignup = async () => {
    if (step === 1) {
      if (!form.email || !form.password) { setError('Email and password are required'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
      if (!form.email.includes('@')) { setError('Enter a valid email address'); return; }
      setError('');
      setStep(2);
      return;
    }
    if (!form.username || !form.displayName || !form.dateOfBirth) {
      setError('All fields are required'); return;
    }
    if (form.username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError('Username: letters, numbers, underscores only'); return;
    }
    setLoading(true); setError('');
    const result = await signup({ ...form, avatarEmoji: selectedAvatar });
    if (result.error) setError(result.error.message);
    else if (result.needsVerification) setSuccess('Check your email! Click the verification link to activate your account.');
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!form.identifier || !form.password) { setError('All fields are required'); return; }
    setLoading(true); setError('');
    const result = await login({ identifier: form.identifier, password: form.password });
    if (result.error) setError(result.error.message);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && setShowAuth(false)}>
      <div className="w-full max-w-md glass rounded-3xl overflow-hidden animate-slide-up max-h-[92vh] overflow-y-auto">

        {/* Header bar */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="font-extrabold text-lg accent-text">MidasHub</span>
          </div>
          <button onClick={() => setShowAuth(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition text-sm">✕</button>
        </div>

        <div className="p-6 pt-4">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full accent-gradient flex items-center justify-center text-3xl mx-auto mb-4">📧</div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Verification Sent!</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-6">{success}</p>
              <button onClick={() => setShowAuth(false)} className="btn-primary w-full">Got it ✓</button>
            </div>
          ) : mode === 'signup' ? (
            <>
              {/* Tab switcher */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
                <button onClick={() => { setMode('signup'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'accent-gradient text-black' : 'text-white/40'}`}>
                  Sign Up
                </button>
                <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'login' ? 'accent-gradient text-black' : 'text-white/40'}`}>
                  Log In
                </button>
              </div>

              {/* Progress indicator */}
              <div className="flex gap-2 mb-5">
                <div className={`h-1 flex-1 rounded-full transition-all ${step >= 1 ? 'accent-gradient' : 'bg-white/10'}`} />
                <div className={`h-1 flex-1 rounded-full transition-all ${step >= 2 ? 'accent-gradient' : 'bg-white/10'}`} />
              </div>

              <h2 className="text-xl font-bold mb-1">{step === 1 ? 'Create your account' : 'Set up your profile'}</h2>
              <p className="text-sm text-white/30 mb-5">{step === 1 ? 'Step 1: Account credentials' : 'Step 2: How people will see you'}</p>

              {step === 1 ? (
                <div className="space-y-3">
                  <input type="email" placeholder="Email address" value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="input-field" autoComplete="email" />
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} placeholder="Password (min 6 characters)" value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="input-field pr-12" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs font-medium transition px-1">
                      {showPass ? '🙈 Hide' : '👁️ Show'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-center mb-4">
                    <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      className="text-5xl hover:scale-110 transition-transform inline-block">{selectedAvatar}</button>
                    <div className="text-[11px] text-white/25 mt-1">Tap to pick avatar</div>
                    {showAvatarPicker && (
                      <div className="grid grid-cols-10 gap-1 mt-2 p-3 rounded-xl bg-white/5">
                        {AVATAR_OPTIONS.map((e) => (
                          <button key={e} type="button" onClick={() => { setSelectedAvatar(e); setShowAvatarPicker(false); }}
                            className={`text-xl p-1 rounded transition ${selectedAvatar === e ? 'bg-white/20 scale-110' : 'hover:bg-white/10'}`}>{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="text" placeholder="Display Name" value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })} className="input-field" maxLength={50} />
                  <input type="text" placeholder="Username (letters, numbers, _)" value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="input-field" maxLength={30} />
                  <div>
                    <label className="text-xs text-white/30 mb-1 block">Date of Birth (15+ required)</label>
                    <input type="date" value={form.dateOfBirth}
                      onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                      className="input-field"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 15)).toISOString().split('T')[0]} />
                  </div>
                </div>
              )}

              {error && <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

              <div className="flex gap-2 mt-5">
                {step === 2 && (
                  <button onClick={() => { setStep(1); setError(''); }} className="btn-secondary flex-1">← Back</button>
                )}
                <button onClick={handleSignup} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {loading ? <span className="animate-spin">⏳</span> : step === 1 ? 'Next →' : 'Create Account 🚀'}
                </button>
              </div>

              <p className="text-center text-[11px] text-white/15 mt-4">Free forever · No restrictions · Ages 15+</p>
            </>
          ) : (
            <>
              {/* Login */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
                <button onClick={() => { setMode('signup'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'accent-gradient text-black' : 'text-white/40'}`}>
                  Sign Up
                </button>
                <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'login' ? 'accent-gradient text-black' : 'text-white/40'}`}>
                  Log In
                </button>
              </div>

              <h2 className="text-xl font-bold mb-1">Welcome back</h2>
              <p className="text-sm text-white/30 mb-5">Log in with your email or username</p>

              <div className="space-y-3">
                <input type="text" placeholder="Email or username" value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  className="input-field" autoComplete="username" />
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Password" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="input-field pr-12" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs font-medium transition px-1">
                    {showPass ? '🙈 Hide' : '👁️ Show'}
                  </button>
                </div>
              </div>

              {error && <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>}

              <button onClick={handleLogin} disabled={loading} className="btn-primary w-full mt-5 flex items-center justify-center gap-2">
                {loading ? <span className="animate-spin">⏳</span> : 'Log In ⚡'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
