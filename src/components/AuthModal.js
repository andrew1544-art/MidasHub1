'use client';
import { useState } from 'react';
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
  const [form, setForm] = useState({
    email: '', password: '', username: '', displayName: '', dateOfBirth: '',
  });

  if (!showAuth) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        if (!form.email || !form.password || !form.username || !form.displayName || !form.dateOfBirth) {
          setError('All fields are required');
          setLoading(false);
          return;
        }
        if (form.password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        if (form.username.length < 3) {
          setError('Username must be at least 3 characters');
          setLoading(false);
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
          setError('Username can only contain letters, numbers, and underscores');
          setLoading(false);
          return;
        }

        const result = await signup({
          ...form,
          avatarEmoji: selectedAvatar,
        });

        if (result.error) {
          setError(result.error.message);
        } else if (result.needsVerification) {
          setSuccess('Check your email! We sent you a verification link. Click it to activate your MidasHub account.');
        }
      } else {
        if (!form.email || !form.password) {
          setError('Email and password are required');
          setLoading(false);
          return;
        }
        const result = await login({ email: form.email, password: form.password });
        if (result.error) {
          setError(result.error.message);
        }
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && setShowAuth(false)}
    >
      <div className="w-full max-w-md glass rounded-3xl p-8 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⚡</div>
          <h2 className="text-3xl font-extrabold gold-gradient">
            {mode === 'signup' ? 'Join MidasHub' : 'Welcome Back'}
          </h2>
          <p className="text-white/40 text-sm mt-2">
            {mode === 'signup' ? 'All your socials. One place. Zero limits.' : 'Log in to your MidasHub account'}
          </p>
        </div>

        {success ? (
          <div className="text-center">
            <div className="text-6xl mb-4">📧</div>
            <h3 className="text-xl font-bold text-green-400 mb-2">Verification Email Sent!</h3>
            <p className="text-white/60 text-sm leading-relaxed mb-6">{success}</p>
            <button onClick={() => setShowAuth(false)} className="btn-primary w-full">
              Got it! ✓
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <>
                {/* Avatar picker */}
                <div className="text-center">
                  <button type="button" onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                    className="text-5xl hover:scale-110 transition-transform mx-auto block"
                  >
                    {selectedAvatar}
                  </button>
                  <div className="text-xs text-white/30 mt-1">Tap to change avatar</div>
                  {showAvatarPicker && (
                    <div className="grid grid-cols-10 gap-1 mt-3 p-3 rounded-xl bg-white/5">
                      {AVATAR_OPTIONS.map((e) => (
                        <button key={e} type="button"
                          onClick={() => { setSelectedAvatar(e); setShowAvatarPicker(false); }}
                          className={`text-2xl p-1 rounded-lg transition ${selectedAvatar === e ? 'bg-yellow-500/20 scale-110' : 'hover:bg-white/10'}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Display Name"
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    className="input-field"
                    maxLength={50}
                  />
                  <input
                    type="text"
                    placeholder="username"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="input-field"
                    maxLength={30}
                  />
                </div>

                <div>
                  <label className="text-xs text-white/40 mb-1 block">Date of Birth (must be 15+)</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                    className="input-field"
                    max={new Date(new Date().setFullYear(new Date().getFullYear() - 15)).toISOString().split('T')[0]}
                  />
                </div>
              </>
            )}

            <input
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="input-field"
            />

            <input
              type="password"
              placeholder="Password (min 6 characters)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="input-field"
            />

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : mode === 'signup' ? (
                <>Create Account 🚀</>
              ) : (
                <>Log In ⚡</>
              )}
            </button>

            <div className="text-center text-sm text-white/40">
              {mode === 'signup' ? (
                <span>Already have an account?{' '}
                  <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-yellow-400 font-semibold hover:underline">
                    Log In
                  </button>
                </span>
              ) : (
                <span>Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => { setMode('signup'); setError(''); }} className="text-yellow-400 font-semibold hover:underline">
                    Sign Up Free
                  </button>
                </span>
              )}
            </div>

            {mode === 'signup' && (
              <div className="text-center text-[11px] text-white/20 mt-4">
                By signing up you confirm you are 15 years or older.
                <br />Free forever • Your content, your rules
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
