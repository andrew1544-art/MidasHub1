'use client';

// Badge types — ordered by progression (blue tick is LAST/hardest)
export const BADGE_TYPES = {
  trader: { icon: '✅', label: 'Verified Trader', color: '#22c55e', bg: '#22c55e20', border: '#22c55e40', desc: '2+ successful trades', tier: 0 },
  creator: { icon: '⭐', label: 'Creator', color: '#f59e0b', bg: '#f59e0b20', border: '#f59e0b40', desc: '15+ qualified referrals', tier: 1 },
  og: { icon: '💎', label: 'OG', color: '#a855f7', bg: '#a855f720', border: '#a855f740', desc: '30+ qualified referrals', tier: 2 },
  vip: { icon: '👑', label: 'VIP', color: '#FFD700', bg: '#FFD70020', border: '#FFD70040', desc: '50+ qualified referrals', tier: 3 },
  verified: { icon: '✔', label: 'Verified', color: '#3b82f6', bg: '#3b82f620', border: '#3b82f640', desc: 'Blue tick — 5+ qualified referrals or admin granted', tier: 4 },
};

// Blue verification tick SVG
export function VerifiedTick({ size = 'sm' }) {
  const s = size === 'xs' ? 12 : size === 'sm' ? 14 : 18;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" className="inline-block shrink-0" style={{ verticalAlign: 'middle' }}>
      <circle cx="12" cy="12" r="11" fill="#3b82f6" />
      <path d="M7 12.5l3 3 7-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Badge pill for profile page — shows ALL badges as progress
export function BadgePill({ type }) {
  const b = BADGE_TYPES[type];
  if (!b) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
      style={{ background: b.bg, color: b.color, borderColor: b.border }}
      title={b.desc}>
      {type === 'verified' ? <VerifiedTick size="xs" /> : b.icon} {b.label}
    </span>
  );
}

// Inline badges — shows ONLY the highest badge + blue tick if verified
export function InlineBadges({ profile, showTrader = true }) {
  if (!profile) return null;
  const badges = [];
  // Collect all badges
  if (showTrader && profile.trade_count >= 2) badges.push('trader');
  if (profile.badges) {
    try {
      const custom = typeof profile.badges === 'string' ? JSON.parse(profile.badges) : profile.badges;
      if (Array.isArray(custom)) custom.forEach(b => { if (!badges.includes(b) && b !== 'verified') badges.push(b); });
    } catch(e) {}
  }

  // Find highest non-verified badge
  const tierOrder = ['trader', 'creator', 'og', 'vip'];
  const highestBadge = tierOrder.reverse().find(b => badges.includes(b));

  if (!highestBadge && !profile.is_verified) return null;

  return (
    <span className="inline-flex items-center gap-0.5">
      {highestBadge && highestBadge !== 'verified' && (
        <span className="text-[10px]" title={BADGE_TYPES[highestBadge]?.label}>{BADGE_TYPES[highestBadge]?.icon}</span>
      )}
      {profile.is_verified && <VerifiedTick size="xs" />}
    </span>
  );
}
