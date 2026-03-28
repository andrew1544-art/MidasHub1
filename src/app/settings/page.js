'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { PLATFORM_LIST, AVATAR_OPTIONS, THEMES } from '@/lib/constants';

export default function SettingsPage() {
  const { user, profile, updateProfile, logout, setShowAuth, theme, setTheme, showToast } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '', bio: profile.bio || '', location: profile.location || '',
        website: profile.website || '', avatar_emoji: profile.avatar_emoji || '😎',
        link_facebook: profile.link_facebook || '', link_instagram: profile.link_instagram || '',
        link_twitter: profile.link_twitter || '', link_tiktok: profile.link_tiktok || '',
        link_snapchat: profile.link_snapchat || '', link_youtube: profile.link_youtube || '',
        link_linkedin: profile.link_linkedin || '', link_whatsapp: profile.link_whatsapp || '',
      });
    }
  }, [profile]);

  if (!user) return (
    <AppShell><div className="max-w-2xl mx-auto px-4 py-16 text-center"><div className="text-5xl mb-3">⚙️</div><h2 className="text-xl font-bold mb-2">Log in to access settings</h2><button onClick={() => setShowAuth(true)} className="btn-primary mt-3">Log In</button></div></AppShell>
  );

  const handleSave = async () => {
    setSaving(true);
    await updateProfile(form);
    setSaving(false);
    showToast('Settings saved ✓');
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-black mb-5">⚙️ Settings</h1>

        {/* Theme selector */}
        <div className="glass-light rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-base mb-3">🎨 Theme</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(THEMES).map((t) => (
              <button key={t.key} onClick={() => setTheme(t.key)}
                className={`p-3 rounded-xl text-center transition-all ${theme === t.key ? 'ring-2 ring-[var(--accent)] scale-[1.02]' : 'hover:scale-[1.02]'}`}
                style={{ background: t.bg, border: `1px solid ${t.border}` }}>
                <div className="text-2xl mb-1">{t.icon}</div>
                <div className="text-xs font-semibold" style={{ color: t.accent }}>{t.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Profile */}
        <div className="glass-light rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-base mb-4">Profile</h2>
          <div className="text-center mb-4">
            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)} className="text-5xl hover:scale-110 transition-transform">{form.avatar_emoji}</button>
            <div className="text-[11px] text-white/20 mt-1">Tap to change</div>
            {showAvatarPicker && (
              <div className="grid grid-cols-10 gap-1 mt-2 p-3 rounded-xl bg-white/5 max-w-xs mx-auto">
                {AVATAR_OPTIONS.map((e) => (
                  <button key={e} onClick={() => { setForm({ ...form, avatar_emoji: e }); setShowAvatarPicker(false); }}
                    className={`text-xl p-1 rounded transition ${form.avatar_emoji === e ? 'bg-white/20 scale-110' : 'hover:bg-white/10'}`}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div><label className="text-xs text-white/30 mb-1 block">Display Name</label><input value={form.display_name || ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="input-field" maxLength={50} /></div>
            <div><label className="text-xs text-white/30 mb-1 block">Bio</label><textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} className="input-field resize-none h-20" maxLength={300} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/30 mb-1 block">Location</label><input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" placeholder="City, Country" /></div>
              <div><label className="text-xs text-white/30 mb-1 block">Website</label><input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })} className="input-field" placeholder="https://" /></div>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="glass-light rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-base mb-1">🔗 Social Links</h2>
          <p className="text-xs text-white/20 mb-4">Link your other profiles</p>
          <div className="space-y-2.5">
            {PLATFORM_LIST.map(([key, p]) => (
              <div key={key} className="flex items-center gap-2.5">
                <span className="text-lg w-7 text-center">{p.icon}</span>
                <input value={form[`link_${key}`] || ''} onChange={(e) => setForm({ ...form, [`link_${key}`]: e.target.value })}
                  placeholder={`${p.name} URL`} className="input-field flex-1 text-sm py-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="glass-light rounded-2xl p-5 mb-4">
          <h2 className="font-bold text-base mb-3">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-white/30">Username</span><span>@{profile?.username}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Email</span><span className="truncate ml-4">{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Verified</span><span className="text-green-400">✓ Email verified</span></div>
            <div className="flex justify-between"><span className="text-white/30">Joined</span><span>{new Date(profile?.created_at).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-3 disabled:opacity-50">
            {saving ? '⏳ Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => logout()} className="px-5 py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition">
            Log Out
          </button>
        </div>
      </div>
    </AppShell>
  );
}
