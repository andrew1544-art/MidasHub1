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
