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

export function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function timeAgo(date) {
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
