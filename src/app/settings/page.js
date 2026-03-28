'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { PLATFORM_LIST, AVATAR_OPTIONS } from '@/lib/constants';

export default function SettingsPage() {
  const { user, profile, updateProfile, logout, setShowAuth } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
        website: profile.website || '',
        avatar_emoji: profile.avatar_emoji || '😎',
        link_facebook: profile.link_facebook || '',
        link_instagram: profile.link_instagram || '',
        link_twitter: profile.link_twitter || '',
        link_tiktok: profile.link_tiktok || '',
        link_snapchat: profile.link_snapchat || '',
        link_youtube: profile.link_youtube || '',
        link_linkedin: profile.link_linkedin || '',
        link_whatsapp: profile.link_whatsapp || '',
      });
    }
  }, [profile]);

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">⚙️</div>
          <h2 className="text-2xl font-bold mb-3">Log in to access settings</h2>
          <button onClick={() => setShowAuth(true)} className="btn-primary mt-4">Log In</button>
        </div>
      </AppShell>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    await updateProfile(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <AppShell>
      <div className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-black mb-6">⚙️ Settings</h1>

        {/* Profile section */}
        <div className="glass-light rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Profile</h2>

          {/* Avatar */}
          <div className="text-center mb-6">
            <button onClick={() => setShowAvatarPicker(!showAvatarPicker)}
              className="text-5xl hover:scale-110 transition-transform"
            >
              {form.avatar_emoji}
            </button>
            <div className="text-xs text-white/30 mt-1">Tap to change</div>
            {showAvatarPicker && (
              <div className="grid grid-cols-10 gap-1.5 mt-3 p-4 rounded-xl bg-white/5 max-w-sm mx-auto">
                {AVATAR_OPTIONS.map((e) => (
                  <button key={e} onClick={() => { setForm({ ...form, avatar_emoji: e }); setShowAvatarPicker(false); }}
                    className={`text-2xl p-1.5 rounded-lg transition ${form.avatar_emoji === e ? 'bg-yellow-500/20 scale-110' : 'hover:bg-white/10'}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1 block">Display Name</label>
              <input value={form.display_name || ''} onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                className="input-field" maxLength={50} />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1 block">Bio</label>
              <textarea value={form.bio || ''} onChange={(e) => setForm({ ...form, bio: e.target.value })}
                className="input-field resize-none h-20" maxLength={300} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Location</label>
                <input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="input-field" placeholder="City, Country" />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Website</label>
                <input value={form.website || ''} onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className="input-field" placeholder="https://" />
              </div>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="glass-light rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-2">🔗 Social Links</h2>
          <p className="text-xs text-white/30 mb-4">Link your other social profiles so people can find you everywhere</p>

          <div className="space-y-3">
            {PLATFORM_LIST.map(([key, p]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-lg w-8 text-center">{p.icon}</span>
                <input
                  value={form[`link_${key}`] || ''}
                  onChange={(e) => setForm({ ...form, [`link_${key}`]: e.target.value })}
                  placeholder={`Your ${p.name} profile URL`}
                  className="input-field flex-1 text-sm py-2.5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Account info */}
        <div className="glass-light rounded-2xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-white/40">Username</span>
              <span>@{profile?.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Email</span>
              <span>{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Verified</span>
              <span className="text-green-400">✓ Email verified</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Member since</span>
              <span>{new Date(profile?.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? '⏳ Saving...' : saved ? '✓ Saved!' : 'Save Changes'}
          </button>
          <button onClick={() => { logout(); router.push('/'); }}
            className="px-6 py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition"
          >
            Log Out
          </button>
        </div>

        {saved && <div className="toast">✓ Settings saved successfully!</div>}
      </div>
    </AppShell>
  );
}
