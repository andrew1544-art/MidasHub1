export const PLATFORMS = {
  midashub: {
    name: 'MidasHub',
    color: '#FFD700',
    icon: '⚡',
    bg: '#FFF8E1',
    postUrl: null,
    storyUrl: null,
  },
  facebook: {
    name: 'Facebook',
    color: '#1877F2',
    icon: '📘',
    bg: '#E7F3FF',
    postUrl: 'https://www.facebook.com/',
    storyUrl: 'https://www.facebook.com/stories/create',
  },
  instagram: {
    name: 'Instagram',
    color: '#E4405F',
    icon: '📸',
    bg: '#FFEEF2',
    postUrl: 'https://www.instagram.com/',
    storyUrl: 'https://www.instagram.com/',
  },
  snapchat: {
    name: 'Snapchat',
    color: '#FFFC00',
    icon: '👻',
    bg: '#FFFDE7',
    text: '#000',
    postUrl: 'https://www.snapchat.com/',
    storyUrl: 'https://www.snapchat.com/',
  },
  whatsapp: {
    name: 'WhatsApp',
    color: '#25D366',
    icon: '💬',
    bg: '#E8F5E9',
    postUrl: 'https://web.whatsapp.com/',
    storyUrl: 'https://web.whatsapp.com/',
  },
  twitter: {
    name: 'X (Twitter)',
    color: '#000000',
    icon: '𝕏',
    bg: '#F5F5F5',
    postUrl: 'https://twitter.com/compose/tweet',
    storyUrl: 'https://twitter.com/compose/tweet',
  },
  tiktok: {
    name: 'TikTok',
    color: '#010101',
    icon: '🎵',
    bg: '#F0F0F0',
    postUrl: 'https://www.tiktok.com/upload',
    storyUrl: 'https://www.tiktok.com/upload',
  },
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    icon: '▶️',
    bg: '#FFEBEE',
    postUrl: 'https://studio.youtube.com/',
    storyUrl: 'https://studio.youtube.com/',
  },
  linkedin: {
    name: 'LinkedIn',
    color: '#0A66C2',
    icon: '💼',
    bg: '#E8F0FE',
    postUrl: 'https://www.linkedin.com/feed/',
    storyUrl: 'https://www.linkedin.com/feed/',
  },
};

export const PLATFORM_LIST = Object.entries(PLATFORMS).filter(([k]) => k !== 'midashub');

export const AVATAR_OPTIONS = [
  '😎', '🤩', '😊', '🥰', '😏', '🤓', '😈', '👑', '🦁', '🐺',
  '🦊', '🐸', '🦋', '🌸', '🔥', '💎', '🎯', '🚀', '⭐', '🌍',
  '🎭', '🎨', '🎶', '💪', '🧠', '👁️', '🌙', '☀️', '🍀', '🦅',
];

export const THEMES = {
  midnight: {
    key: 'midnight',
    name: 'Midnight',
    icon: '🌙',
    bg: '#0a0a0f',
    card: '#13131d',
    cardHover: '#1a1a28',
    border: 'rgba(255,255,255,0.07)',
    accent: '#FFD700',
    accentAlt: '#FFA500',
    gradient: 'linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 40%, #0d1b2a 70%, #0a0a0f 100%)',
    orb1: 'rgba(99,102,241,0.1)',
    orb2: 'rgba(236,72,153,0.08)',
    orb3: 'rgba(34,211,238,0.06)',
  },
  ocean: {
    key: 'ocean',
    name: 'Ocean',
    icon: '🌊',
    bg: '#040d1a',
    card: '#0a1929',
    cardHover: '#0f2340',
    border: 'rgba(56,189,248,0.1)',
    accent: '#38bdf8',
    accentAlt: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #040d1a 0%, #0c1e3a 40%, #0a2540 70%, #040d1a 100%)',
    orb1: 'rgba(56,189,248,0.1)',
    orb2: 'rgba(14,165,233,0.08)',
    orb3: 'rgba(2,132,199,0.06)',
  },
  ember: {
    key: 'ember',
    name: 'Ember',
    icon: '🔥',
    bg: '#120808',
    card: '#1c0f0f',
    cardHover: '#2a1515',
    border: 'rgba(239,68,68,0.1)',
    accent: '#f97316',
    accentAlt: '#ef4444',
    gradient: 'linear-gradient(135deg, #120808 0%, #2a0a0a 40%, #1a0f05 70%, #120808 100%)',
    orb1: 'rgba(249,115,22,0.1)',
    orb2: 'rgba(239,68,68,0.08)',
    orb3: 'rgba(234,179,8,0.06)',
  },
};

export function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function timeAgo(date) {
  if (!date) return '';
  const now = new Date();
  const d = new Date(date);
  const seconds = Math.floor((now - d) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// ===== RANKING SYSTEM =====
// XP earned: post=10, receive_like=2, give_like=1, comment=5, receive_comment=3,
// repost=5, get_reposted=8, add_friend=5, friend_accepted=5, daily_login=15, go_viral=50, send_message=1

export const RANKS = [
  { level: 1,  name: 'Seedling',    icon: '🌱', color: '#8B9467', minXP: 0,      perk: 'Just planted — your journey begins' },
  { level: 2,  name: 'Spark',       icon: '✨', color: '#C0C0C0', minXP: 50,     perk: 'Starting to glow' },
  { level: 3,  name: 'Wave',        icon: '🌊', color: '#5B9BD5', minXP: 200,    perk: 'Making ripples' },
  { level: 4,  name: 'Flame',       icon: '🔥', color: '#FF6B35', minXP: 500,    perk: 'Heating up the feed' },
  { level: 5,  name: 'Bolt',        icon: '⚡', color: '#FFD700', minXP: 1200,   perk: 'Electrifying presence' },
  { level: 6,  name: 'Comet',       icon: '☄️', color: '#FF4500', minXP: 2500,   perk: 'Blazing through the hub' },
  { level: 7,  name: 'Titan',       icon: '🗿', color: '#9B59B6', minXP: 5000,   perk: 'Unmovable force' },
  { level: 8,  name: 'Phoenix',     icon: '🦅', color: '#E74C3C', minXP: 10000,  perk: 'Rising from the ordinary' },
  { level: 9,  name: 'Crown',       icon: '👑', color: '#F1C40F', minXP: 20000,  perk: 'Royalty of the hub' },
  { level: 10, name: 'Midas',       icon: '💎', color: '#FFD700', minXP: 50000,  perk: 'Everything you touch turns gold' },
  { level: 11, name: 'Eternal',     icon: '♾️', color: '#E8D5B7', minXP: 100000, perk: 'Legendary — forever remembered' },
];

export function getRank(xp = 0) {
  let rank = RANKS[0];
  for (const r of RANKS) {
    if (xp >= r.minXP) rank = r;
    else break;
  }
  const currentIndex = RANKS.indexOf(rank);
  const nextRank = RANKS[currentIndex + 1] || null;
  const xpInLevel = xp - rank.minXP;
  const xpNeeded = nextRank ? nextRank.minXP - rank.minXP : 0;
  const progress = nextRank ? Math.min(xpInLevel / xpNeeded, 1) : 1;
  return { ...rank, xp, xpInLevel, xpNeeded, nextRank, progress };
}

export const XP_VALUES = {
  post: 10,
  receive_like: 2,
  give_like: 1,
  comment: 5,
  receive_comment: 3,
  repost: 5,
  get_reposted: 8,
  add_friend: 5,
  friend_accepted: 5,
  daily_login: 15,
  go_viral: 50,
  send_message: 1,
};
