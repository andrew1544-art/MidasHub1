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
  const [form, setForm] = useState({ email: '', password: '', username: '', displayName: '', dateOfBirth: '' });
  const [step, setStep] = useState(1);

  useEffect(() => { setMode(authMode); setStep(1); setError(''); setSuccess(''); }, [authMode, showAuth]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showAuth) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [showAuth]);

  if (!showAuth) return null;

  const handleSignup = async () => {
    setError('');
    if (step === 1) {
      if (!form.email) { setError('Email is required'); return; }
      if (!form.email.includes('@') || !form.email.includes('.')) { setError('Please enter a valid email address'); return; }
      if (!form.password) { setError('Password is required'); return; }
      if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
      setStep(2);
      return;
    }
    if (!form.displayName) { setError('Display name is required'); return; }
    if (!form.username) { setError('Username is required'); return; }
    if (form.username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) { setError('Username: only letters, numbers, and underscores'); return; }
    if (!form.dateOfBirth) { setError('Date of birth is required (you must be 15+)'); return; }

    setLoading(true);
    const result = await signup({ ...form, avatarEmoji: selectedAvatar });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    } else if (result.needsVerification) {
      setSuccess('We sent a verification link to ' + form.email + '. Please check your inbox (and spam folder) and click the link to activate your account.');
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!form.email) { setError('Email is required'); return; }
    if (!form.password) { setError('Password is required'); return; }

    setLoading(true);
    const result = await login({ identifier: form.email, password: form.password });
    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    }
    // If success, store auto-closes modal and redirects
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'login') handleLogin();
      else handleSignup();
    }
  };

  return (
    <div className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && setShowAuth(false)}>
      <div className="modal-content max-w-md overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚡</span>
            <span className="font-extrabold text-lg accent-text">MidasHub</span>
          </div>
          <button onClick={() => setShowAuth(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition text-sm">✕</button>
        </div>

        <div className="p-6 pt-4">
          {/* Success state after signup */}
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full accent-gradient flex items-center justify-center text-3xl mx-auto mb-4">📧</div>
              <h3 className="text-xl font-bold text-green-400 mb-3">Check Your Email!</h3>
              <p className="text-white/50 text-sm leading-relaxed mb-6">{success}</p>
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs mb-4 leading-relaxed">
                💡 After clicking the verification link, come back here and log in with your email and password.
              </div>
              <button onClick={() => { setSuccess(''); setMode('login'); setError(''); }} className="btn-primary w-full">
                Go to Login →
              </button>
            </div>

          ) : mode === 'signup' ? (
            <>
              {/* Tab switcher */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
                <button onClick={() => { setMode('signup'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'accent-gradient text-black' : 'text-white/40'}`}>Sign Up</button>
                <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'login' ? 'accent-gradient text-black' : 'text-white/40'}`}>Log In</button>
              </div>

              {/* Step indicator */}
              <div className="flex gap-2 mb-5">
                <div className={`h-1 flex-1 rounded-full transition-all ${step >= 1 ? 'accent-gradient' : 'bg-white/10'}`}/>
                <div className={`h-1 flex-1 rounded-full transition-all ${step >= 2 ? 'accent-gradient' : 'bg-white/10'}`}/>
              </div>

              <h2 className="text-xl font-bold mb-1">{step === 1 ? 'Create your account' : 'Set up your profile'}</h2>
              <p className="text-sm text-white/30 mb-5">{step === 1 ? 'Step 1: Your email and password' : 'Step 2: How people see you'}</p>

              {step === 1 ? (
                <div className="space-y-3" onKeyDown={handleKeyDown}>
                  <input type="email" placeholder="Email address" value={form.email}
                    onChange={e => setForm({...form, email: e.target.value})}
                    className="input-field" autoComplete="email" autoFocus/>
                  <div className="relative">
                    <input type={showPass ? 'text' : 'password'} placeholder="Password (min 6 characters)" value={form.password}
                      onChange={e => setForm({...form, password: e.target.value})}
                      className="input-field pr-16" autoComplete="new-password"/>
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs transition">
                      {showPass ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3" onKeyDown={handleKeyDown}>
                  <div className="text-center mb-2">
                    <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                      className="text-5xl hover:scale-110 transition-transform inline-block">{selectedAvatar}</button>
                    <div className="text-[11px] text-white/25 mt-1">Tap to pick avatar</div>
                    {showAvatarPicker && (
                      <div className="grid grid-cols-10 gap-1 mt-2 p-3 rounded-xl bg-white/5">
                        {AVATAR_OPTIONS.map(e => (
                          <button key={e} type="button" onClick={() => { setSelectedAvatar(e); setShowAvatarPicker(false); }}
                            className={`text-xl p-1 rounded transition ${selectedAvatar === e ? 'bg-white/20 scale-110' : 'hover:bg-white/10'}`}>{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="text" placeholder="Display Name" value={form.displayName}
                    onChange={e => setForm({...form, displayName: e.target.value})} className="input-field" maxLength={50} autoFocus/>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">@</span>
                    <input type="text" placeholder="username" value={form.username}
                      onChange={e => setForm({...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})}
                      className="input-field pl-8" maxLength={30}/>
                  </div>
                  <div>
                    <label className="text-xs text-white/30 mb-1 block">Date of Birth (must be 15+)</label>
                    <input type="date" value={form.dateOfBirth}
                      onChange={e => setForm({...form, dateOfBirth: e.target.value})}
                      className="input-field"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 15)).toISOString().split('T')[0]}/>
                  </div>
                </div>
              )}

              {error && <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">{error}</div>}

              <div className="flex gap-2 mt-5">
                {step === 2 && <button onClick={() => { setStep(1); setError(''); }} className="btn-secondary flex-1">← Back</button>}
                <button onClick={handleSignup} disabled={loading} className="btn-primary flex-1 flex items-center justify-center gap-2 py-3">
                  {loading ? <span className="animate-spin">⏳</span> : step === 1 ? 'Next →' : 'Create Account 🚀'}
                </button>
              </div>
              <p className="text-center text-[11px] text-white/15 mt-4">Free forever · No restrictions · Ages 15+</p>
            </>

          ) : (
            <>
              {/* LOGIN */}
              <div className="flex gap-1 p-1 rounded-xl bg-white/5 mb-6">
                <button onClick={() => { setMode('signup'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'signup' ? 'accent-gradient text-black' : 'text-white/40'}`}>Sign Up</button>
                <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition ${mode === 'login' ? 'accent-gradient text-black' : 'text-white/40'}`}>Log In</button>
              </div>

              <h2 className="text-xl font-bold mb-1">Welcome back</h2>
              <p className="text-sm text-white/30 mb-5">Log in with your email address</p>

              <div className="space-y-3" onKeyDown={handleKeyDown}>
                <input type="email" placeholder="Email address" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})}
                  className="input-field" autoComplete="email" autoFocus/>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} placeholder="Password" value={form.password}
                    onChange={e => setForm({...form, password: e.target.value})}
                    className="input-field pr-16" autoComplete="current-password"/>
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs transition">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {error && <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm leading-relaxed">{error}</div>}

              <button onClick={handleLogin} disabled={loading} className="btn-primary w-full mt-5 py-3 flex items-center justify-center gap-2">
                {loading ? <span className="animate-spin">⏳</span> : 'Log In ⚡'}
              </button>

              <p className="text-center text-xs text-white/20 mt-4">
                Don&apos;t have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); }} className="font-semibold hover:underline" style={{color:'var(--accent)'}}>Sign up free</button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
