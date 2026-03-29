'use client';

// Badge types available in MidasHub
export const BADGE_TYPES = {
  verified: { icon: '✔', label: 'Verified', color: '#3b82f6', bg: '#3b82f620', border: '#3b82f640', desc: 'Identity verified by MidasHub' },
  trader: { icon: '✅', label: 'Verified Trader', color: '#22c55e', bg: '#22c55e20', border: '#22c55e40', desc: '2+ successful trades' },
  creator: { icon: '⭐', label: 'Creator', color: '#f59e0b', bg: '#f59e0b20', border: '#f59e0b40', desc: 'Recognized content creator' },
  og: { icon: '💎', label: 'OG', color: '#a855f7', bg: '#a855f720', border: '#a855f740', desc: 'Early MidasHub member' },
  vip: { icon: '👑', label: 'VIP', color: '#FFD700', bg: '#FFD70020', border: '#FFD70040', desc: 'VIP member' },
};

// Blue verification tick (inline, small)
export function VerifiedTick({ size = 'sm' }) {
  const s = size === 'xs' ? 12 : size === 'sm' ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="inline-block shrink-0" style={{ verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="11" fill="#3b82f6" />
      <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Badge pill (for profile page)
export function BadgePill({ type }) {
  const b = BADGE_TYPES[type];
  if (!b) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ background: b.bg, color: b.color, borderColor: b.border }}
      title={b.desc}>
      {b.icon} {b.label}
    </span>
  );
}

// Inline badge icons (for post headers, chat, etc)
export function InlineBadges({ profile, showTrader = true }) {
  if (!profile) return null;
  const badges = [];
  if (profile.is_verified) badges.push('verified');
  if (showTrader && profile.trade_count >= 2) badges.push('trader');
  if (profile.badges) {
    try {
      const custom = typeof profile.badges === 'string' ? JSON.parse(profile.badges) : profile.badges;
      if (Array.isArray(custom)) custom.forEach(b => { if (!badges.includes(b)) badges.push(b); });
    } catch(e) {}
  }
  if (badges.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-0.5">
      {badges.includes('verified') && <VerifiedTick size="xs" />}
      {badges.filter(b => b !== 'verified').map(b => {
        const info = BADGE_TYPES[b];
        return info ? <span key={b} className="text-[10px]" title={info.label}>{info.icon}</span> : null;
      })}
    </span>
  );
}
