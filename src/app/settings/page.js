'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { PLATFORM_LIST, AVATAR_OPTIONS } from '@/lib/constants';

export default function SettingsPage() {
  const { user, profile, updateProfile, logout, setShowAuth, showToast, theme, setTheme } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showAvatars, setShowAvatars] = useState(false);

  useEffect(() => {
    if (profile) setForm({
      display_name: profile.display_name || '', bio: profile.bio || '',
      location: profile.location || '', website: profile.website || '',
      avatar_emoji: profile.avatar_emoji || '😎',
      ...Object.fromEntries(PLATFORM_LIST.map(([k]) => [`link_${k}`, profile[`link_${k}`] || ''])),
    });
  }, [profile]);

  if (!user) return <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-6xl mb-4">⚙️</div><h2 className="text-2xl font-bold mb-3">Log in to access settings</h2><button onClick={() => setShowAuth(true)} className="btn-primary mt-4 px-8 py-3">Log In</button></div></AppShell>;

  const save = async () => { setSaving(true); await updateProfile(form); setSaving(false); showToast('Settings saved!'); };

  return (
    <AppShell>
      <div className="max-w-lg mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-6"><span className="text-3xl">⚙️</span><h1 className="text-2xl sm:text-3xl font-black">Settings</h1></div>

        {/* Profile */}
        <div className="glass-light rounded-2xl p-5 sm:p-6 mb-4">
          <h2 className="font-bold text-base mb-5">Profile</h2>
          <div className="text-center mb-5">
            <button onClick={() => setShowAvatars(!showAvatars)} className="text-5xl hover:scale-110 transition-transform">{form.avatar_emoji || '😎'}</button>
            <div className="text-xs text-white/25 mt-1">Tap to change</div>
            {showAvatars && (
              <div className="grid grid-cols-10 gap-1 mt-3 p-3 rounded-xl bg-white/5 max-w-xs mx-auto">
                {AVATAR_OPTIONS.map(e => (
                  <button key={e} onClick={() => { setForm({...form, avatar_emoji: e}); setShowAvatars(false); }}
                    className={`text-xl p-1 rounded-lg transition ${form.avatar_emoji === e ? 'bg-yellow-500/20 scale-110' : 'hover:bg-white/10'}`}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div><label className="text-xs text-white/30 mb-1 block">Display Name</label><input value={form.display_name||''} onChange={e=>setForm({...form,display_name:e.target.value})} className="input-field" maxLength={50}/></div>
            <div><label className="text-xs text-white/30 mb-1 block">Bio</label><textarea value={form.bio||''} onChange={e=>setForm({...form,bio:e.target.value})} className="input-field resize-none h-20" maxLength={300}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/30 mb-1 block">Location</label><input value={form.location||''} onChange={e=>setForm({...form,location:e.target.value})} className="input-field" placeholder="City, Country"/></div>
              <div><label className="text-xs text-white/30 mb-1 block">Website</label><input value={form.website||''} onChange={e=>setForm({...form,website:e.target.value})} className="input-field" placeholder="https://"/></div>
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="glass-light rounded-2xl p-5 sm:p-6 mb-4">
          <h2 className="font-bold text-base mb-2">Social Links</h2>
          <p className="text-xs text-white/25 mb-4">Link your profiles so people can find you everywhere</p>
          <div className="space-y-2.5">
            {PLATFORM_LIST.map(([key, p]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="text-lg w-7 text-center shrink-0">{p.icon}</span>
                <input value={form[`link_${key}`]||''} onChange={e=>setForm({...form,[`link_${key}`]:e.target.value})}
                  placeholder={`${p.name} profile URL`} className="input-field flex-1 text-sm py-2.5"/>
              </div>
            ))}
          </div>
        </div>

        {/* Theme */}
        <div className="glass-light rounded-2xl p-5 sm:p-6 mb-4">
          <h2 className="font-bold text-base mb-4">Theme</h2>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'default', label: 'Gold', colors: ['#FFD700','#1a0a2e','#0a0a0f'] },
              { key: 'ocean', label: 'Ocean', colors: ['#38bdf8','#0c1e3a','#040d1a'] },
              { key: 'ember', label: 'Ember', colors: ['#f97316','#2a0a0a','#120808'] },
            ].map(t => (
              <button key={t.key} onClick={() => setTheme(t.key)}
                className={`p-3 rounded-xl text-center transition ${theme === t.key ? 'ring-2 ring-[var(--accent)] bg-white/5' : 'bg-white/3 hover:bg-white/5'}`}>
                <div className="flex justify-center gap-1 mb-2">
                  {t.colors.map((c,i) => <div key={i} className="w-4 h-4 rounded-full" style={{background:c}}/>)}
                </div>
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Account */}
        <div className="glass-light rounded-2xl p-5 sm:p-6 mb-4">
          <h2 className="font-bold text-base mb-4">Account</h2>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-white/30">Username</span><span>@{profile?.username}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Email</span><span className="truncate ml-4">{user?.email}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Verified</span><span className="text-green-400">✓ Verified</span></div>
            <div className="flex justify-between"><span className="text-white/30">Joined</span><span>{new Date(profile?.created_at).toLocaleDateString()}</span></div>
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 py-3 disabled:opacity-40">
            {saving ? '⏳ Saving...' : 'Save Changes'}
          </button>
          <button onClick={() => { logout(); router.push('/'); }}
            className="px-6 py-3 rounded-xl bg-red-500/10 text-red-400 font-semibold text-sm hover:bg-red-500/20 transition">
            Log Out
          </button>
        </div>
      </div>
    </AppShell>
  );
}
