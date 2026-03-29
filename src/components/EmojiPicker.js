'use client';
import { useState } from 'react';

const EMOJI_CATEGORIES = {
  '😊 Smileys': ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','🥴','😇','🥳','🥺','🤠','🤡','🤥','🤫','🤭','🧐','🤓'],
  '👋 Hands': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','💪'],
  '❤️ Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟'],
  '🔥 Popular': ['🔥','💯','✨','⭐','🌟','💫','⚡','💥','💢','💦','💨','🎉','🎊','🎈','🎁','🏆','🥇','🥈','🥉','🎯','💰','💸','💵','🤑','📱','💻','🎮','🎵','🎶','📸','🎥','✅','❌','⚠️','🔒','🛡️','🚀','💎','👑','🦁'],
};

export default function EmojiPicker({ onSelect, onClose }) {
  const [cat, setCat] = useState(Object.keys(EMOJI_CATEGORIES)[0]);
  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 glass rounded-xl shadow-2xl z-30 p-2 max-h-64 overflow-hidden flex flex-col">
      <div className="flex gap-1 mb-2 overflow-x-auto no-scrollbar pb-1">
        {Object.keys(EMOJI_CATEGORIES).map(c => (
          <button key={c} onClick={() => setCat(c)}
            className={`shrink-0 px-2 py-1 rounded-lg text-[10px] ${cat === c ? 'bg-white/10 text-white' : 'text-white/30'}`}>
            {c.split(' ')[0]}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[cat].map(e => (
            <button key={e} onClick={() => onSelect(e)} className="text-xl p-1 rounded hover:bg-white/10 transition">{e}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
