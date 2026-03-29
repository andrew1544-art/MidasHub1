'use client';
import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { StartTradeButton, TradeCard } from '@/components/TradeBox';
import EmojiPicker from '@/components/EmojiPicker';
import VoiceRecorder from '@/components/VoiceRecorder';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/constants';
import { playMessageSound } from '@/lib/sounds';

function ChatInner() {
  const { user, profile, setShowAuth, showToast } = useStore();
  const searchParams = useSearchParams();
  const [convos, setConvos] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const [trades, setTrades] = useState([]);
  const [showTrades, setShowTrades] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef(null);
  const startedRef = useRef(false);
  const fileRef = useRef(null);

  const getSupabase = useCallback(() => createClient(), []);

  const loadConvos = useCallback(async () => {
    const sb = getSupabase();
    try {
      const { data: memberships } = await sb.from('conversation_members').select('conversation_id').eq('user_id', user.id);
      if (!memberships?.length) { setConvos([]); setLoading(false); return; }
      const list = [];
      for (const m of memberships) {
        try {
          const { data: members } = await sb.from('conversation_members').select('*, profiles(*)').eq('conversation_id', m.conversation_id);
          const { data: last } = await sb.from('messages').select('*').eq('conversation_id', m.conversation_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
          const other = (members||[]).find(x => x.user_id !== user.id);
          const me = (members||[]).find(x => x.user_id === user.id);
          const { count } = await sb.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', m.conversation_id).neq('sender_id', user.id).gt('created_at', me?.last_read_at || '1970-01-01');
          let activeTrades = 0;
          try { const { count: tc } = await sb.from('trades').select('*', { count: 'exact', head: true }).eq('conversation_id', m.conversation_id).in('status', ['pending','accepted','paid','delivered','disputed']); activeTrades = tc||0; } catch(e){}
          list.push({ id: m.conversation_id, otherUser: other?.profiles, lastMessage: last, unread: count||0, activeTrades });
        } catch(e){}
      }
      list.sort((a,b) => (b.lastMessage?.created_at||'0').localeCompare(a.lastMessage?.created_at||'0'));
      setConvos(list);
    } catch(e){}
    setLoading(false);
  }, [user, getSupabase]);

  const openConvo = useCallback(async (convoId, targetId = null) => {
    const sb = getSupabase();
    setActiveConvo(convoId); setShowEmoji(false);
    if (targetId) { const { data } = await sb.from('profiles').select('*').eq('id', targetId).maybeSingle(); setOtherUser(data); }
    else { const c = convos.find(c => c.id === convoId); if (c?.otherUser) setOtherUser(c.otherUser); else { const { data: mem } = await sb.from('conversation_members').select('*, profiles(*)').eq('conversation_id', convoId); setOtherUser((mem||[]).find(x => x.user_id !== user.id)?.profiles||null); } }
    const { data: msgs } = await sb.from('messages').select('*, profiles(*)').eq('conversation_id', convoId).order('created_at', { ascending: true });
    setMessages(msgs||[]);
    await sb.from('conversation_members').update({ last_read_at: new Date().toISOString() }).match({ conversation_id: convoId, user_id: user.id });
    try { const { data: td } = await sb.from('trades').select('*').eq('conversation_id', convoId).order('created_at', { ascending: false }); setTrades(td||[]); if ((td||[]).some(t => !['completed','cancelled','resolved'].includes(t.status))) setShowTrades(true); } catch(e) { setTrades([]); }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [user, convos, getSupabase]);

  const startChat = useCallback(async (targetId) => {
    if (!targetId||!user) return;
    const sb = getSupabase();
    try {
      const { data: my } = await sb.from('conversation_members').select('conversation_id').eq('user_id', user.id);
      const { data: their } = await sb.from('conversation_members').select('conversation_id').eq('user_id', targetId);
      const mySet = new Set((my||[]).map(c => c.conversation_id));
      const shared = (their||[]).find(c => mySet.has(c.conversation_id));
      if (shared) { await openConvo(shared.conversation_id, targetId); return; }
      const { data: convo, error } = await sb.from('conversations').insert({ is_group: false }).select().single();
      if (error||!convo) return;
      await sb.from('conversation_members').insert([{ conversation_id: convo.id, user_id: user.id },{ conversation_id: convo.id, user_id: targetId }]);
      await openConvo(convo.id, targetId); loadConvos();
    } catch(e){}
  }, [user, getSupabase, openConvo, loadConvos]);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    (async () => { await loadConvos(); const t = searchParams.get('user'); if (t&&!startedRef.current) { startedRef.current = true; await startChat(t); } })();
  }, [user]);

  useEffect(() => { const t = searchParams.get('user'); if (t&&user&&startedRef.current) startChat(t); }, [searchParams]);

  const loadTrades = async () => { if (!activeConvo) return; try { const sb = getSupabase(); const { data } = await sb.from('trades').select('*').eq('conversation_id', activeConvo).order('created_at', { ascending: false }); setTrades(data||[]); } catch(e){} };

  // Realtime messages
  useEffect(() => {
    if (!activeConvo) return;
    const sb = getSupabase();
    const ch = sb.channel(`chat-live-${activeConvo}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvo}` }, async (p) => {
        try { const { data } = await sb.from('messages').select('*, profiles(*)').eq('id', p.new.id).maybeSingle(); if (data) { setMessages(prev => [...prev, data]); if (data.sender_id !== user.id) playMessageSound(); setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); } } catch(e){}
      }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [activeConvo, getSupabase]);

  const send = async () => {
    if (!text.trim()||sending) return;
    setSending(true);
    try { const sb = getSupabase(); await sb.from('messages').insert({ conversation_id: activeConvo, sender_id: user.id, content: text.trim() }); setText(''); } catch(e){}
    setSending(false);
  };

  // Upload media to chat
  const sendMedia = async (file) => {
    if (!file||!activeConvo) return;
    setUploading(true);
    try {
      const sb = getSupabase();
      const ext = file.name.split('.').pop();
      const path = `chat/${user.id}/${Date.now()}.${ext}`;
      const { data, error } = await sb.storage.from('media').upload(path, file);
      if (data&&!error) {
        const { data: u } = sb.storage.from('media').getPublicUrl(data.path);
        const isVid = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        const prefix = isVid ? '🎬 ' : isAudio ? '🎤 ' : '📷 ';
        await sb.from('messages').insert({ conversation_id: activeConvo, sender_id: user.id, content: `${prefix}${u.publicUrl}`, media_url: u.publicUrl, media_type: isVid ? 'video' : isAudio ? 'audio' : 'image' });
      } else { showToast?.('Upload failed'); }
    } catch(e) { showToast?.('Upload failed'); }
    setUploading(false);
  };

  // Voice message handler
  const sendVoice = async (blob) => {
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    await sendMedia(file);
  };

  // Check if message is media
  const isMediaMsg = (msg) => msg.media_url || /^(📷|🎬|🎤)\s?https?:\/\//.test(msg.content);
  const getMediaUrl = (msg) => msg.media_url || msg.content.replace(/^(📷|🎬|🎤)\s?/, '');
  const getMediaType = (msg) => {
    if (msg.media_type) return msg.media_type;
    const url = getMediaUrl(msg);
    if (/\.(mp4|webm|mov)$/i.test(url)) return 'video';
    if (/\.(webm|ogg|mp3|wav)$/i.test(url) || msg.content.startsWith('🎤')) return 'audio';
    return 'image';
  };

  if (!user) return (
    <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-6xl mb-4">💬</div><h2 className="text-2xl font-bold mb-3">Log in to chat</h2><p className="text-white/30 mb-6 text-sm">Create an account to message anyone</p><button onClick={() => setShowAuth(true)} className="btn-primary px-8 py-3">Join MidasHub ⚡</button></div></AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass-light rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 140px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))', minHeight: 400 }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={`w-full md:w-80 border-r border-white/5 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-white/5"><h2 className="font-bold text-lg">💬 Messages</h2></div>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {loading ? <div className="p-4 space-y-3">{[1,2,3].map(i=><div key={i} className="flex gap-3 p-3"><div className="w-10 h-10 rounded-full skeleton"/><div className="flex-1 space-y-2"><div className="h-4 w-24 skeleton"/><div className="h-3 w-36 skeleton"/></div></div>)}</div>
                : convos.length === 0 ? <div className="p-8 text-center text-white/20 text-sm"><div className="text-4xl mb-3">🗨️</div>No conversations<br/><Link href="/people" className="text-[var(--accent)] hover:underline mt-2 inline-block">Find people →</Link></div>
                : convos.map(c => (
                  <button key={c.id} onClick={() => openConvo(c.id)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition hover:bg-white/5 ${activeConvo === c.id ? 'bg-white/5' : ''}`}>
                    <span className="text-3xl shrink-0">{c.otherUser?.avatar_emoji||'😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate">{c.otherUser?.display_name||'User'}</span>
                          {c.otherUser?.trade_count >= 2 && <span className="text-[9px]" title="Verified Trader">✅</span>}
                        </div>
                        <span className="text-[10px] text-white/20 shrink-0">{c.lastMessage ? timeAgo(c.lastMessage.created_at) : ''}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-white/30 truncate flex-1">
                          {c.lastMessage?.content?.startsWith('📷') ? '📷 Photo' : c.lastMessage?.content?.startsWith('🎬') ? '🎬 Video' : c.lastMessage?.content?.startsWith('🎤') ? '🎤 Voice' : c.lastMessage?.content || 'Start chatting!'}
                        </span>
                        {c.activeTrades > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold shrink-0">🔒</span>}
                      </div>
                    </div>
                    {c.unread > 0 && <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: 'var(--accent)', color: '#000' }}>{c.unread}</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className={`flex-1 flex flex-col ${!activeConvo ? 'hidden md:flex' : 'flex'}`}>
              {!activeConvo ? (
                <div className="flex-1 flex items-center justify-center text-white/15 text-sm"><div className="text-center"><div className="text-5xl mb-3">💬</div><p>Select a conversation</p></div></div>
              ) : (
                <>
                  {/* Header */}
                  <div className="flex items-center gap-3 p-3 border-b border-white/5">
                    <button onClick={() => { setActiveConvo(null); setOtherUser(null); setShowEmoji(false); }} className="md:hidden text-white/40 text-lg">←</button>
                    <Link href={`/profile/${otherUser?.username}`} className="flex items-center gap-3 hover:opacity-80 transition flex-1 min-w-0">
                      <span className="text-2xl">{otherUser?.avatar_emoji||'😎'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm truncate">{otherUser?.display_name||'User'}</span>
                          {otherUser?.trade_count >= 2 && <span className="text-xs" title="Verified Trader">✅</span>}
                          {otherUser?.total_reviews > 0 && <span className="text-[10px] text-yellow-400">{parseFloat(otherUser.trade_rating||0).toFixed(1)}⭐</span>}
                        </div>
                        {(() => {
                          const ls = otherUser?.last_seen ? new Date(otherUser.last_seen) : null;
                          const on = ls && (Date.now() - ls.getTime() < 30*60*1000);
                          return on ? <div className="text-[11px] text-green-400">● Online</div> : <div className="text-[11px] text-white/25">{ls ? `Last seen ${timeAgo(otherUser.last_seen)}` : '● Offline'}</div>;
                        })()}
                      </div>
                    </Link>
                    <div className="flex items-center gap-2 shrink-0">
                      {trades.length > 0 && <button onClick={() => setShowTrades(!showTrades)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${showTrades ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/40'}`}>🔒 Trades</button>}
                      <StartTradeButton conversationId={activeConvo} otherUserId={otherUser?.id} onTradeCreated={loadTrades} />
                    </div>
                  </div>

                  {/* Trades panel */}
                  {showTrades && trades.length > 0 && (
                    <div className="border-b border-white/5 p-3 space-y-2 max-h-[50vh] overflow-y-auto overscroll-contain">
                      <div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-white/40">🔒 TRADES ({trades.filter(t=>t.status==='completed').length} completed, {trades.filter(t=>['cancelled','disputed'].includes(t.status)).length} cancelled/disputed)</span><button onClick={() => setShowTrades(false)} className="text-[10px] text-white/25">Hide</button></div>
                      {trades.map(t => <TradeCard key={t.id} trade={t} onUpdate={loadTrades} />)}
                    </div>
                  )}

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2 overscroll-contain">
                    <div className="text-center mb-3"><div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/60">🔒 Trading? Use <strong className="text-yellow-300/80">Start Trade</strong> for escrow</div></div>
                    {messages.length === 0 && <div className="text-center text-white/15 text-sm py-10">Say hi to {otherUser?.display_name?.split(' ')[0]||'them'}! 👋</div>}
                    {messages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl text-sm leading-relaxed ${msg.sender_id === user.id ? 'accent-gradient text-black rounded-br-md' : 'bg-white/8 text-white/90 rounded-bl-md'} ${isMediaMsg(msg) ? 'p-1' : 'px-4 py-2.5'}`}>
                          {isMediaMsg(msg) ? (
                            <div>
                              {getMediaType(msg) === 'image' && (
                                <img src={getMediaUrl(msg)} alt="" className="rounded-xl max-w-full max-h-64 object-cover cursor-pointer" onClick={() => window.open(getMediaUrl(msg), '_blank')} loading="lazy" />
                              )}
                              {getMediaType(msg) === 'video' && (
                                <video src={getMediaUrl(msg)} controls className="rounded-xl max-w-full max-h-64" preload="metadata" />
                              )}
                              {getMediaType(msg) === 'audio' && (
                                <div className="px-3 py-2">
                                  <div className="text-xs mb-1 opacity-70">🎤 Voice message</div>
                                  <audio src={getMediaUrl(msg)} controls className="w-full h-8" style={{ filter: msg.sender_id === user.id ? 'invert(1)' : 'none' }} />
                                </div>
                              )}
                              <div className={`text-[10px] px-2 pb-1 ${msg.sender_id === user.id ? 'text-black/40' : 'text-white/20'}`}>{timeAgo(msg.created_at)}</div>
                            </div>
                          ) : (
                            <>
                              {msg.content}
                              <div className={`text-[10px] mt-1 ${msg.sender_id === user.id ? 'text-black/40' : 'text-white/20'}`}>{timeAgo(msg.created_at)}</div>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={endRef}/>
                  </div>

                  {/* Input area */}
                  <div className="p-3 border-t border-white/5 relative">
                    {showEmoji && <EmojiPicker onSelect={(e) => { setText(t => t + e); }} onClose={() => setShowEmoji(false)} />}
                    {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-xl"><span className="text-white/60 text-sm">⏳ Uploading...</span></div>}
                    <div className="flex gap-2 items-end">
                      {/* Media upload */}
                      <input type="file" ref={fileRef} accept="image/*,video/*" className="hidden" onChange={(e) => { if (e.target.files[0]) sendMedia(e.target.files[0]); e.target.value = ''; }} />
                      <button onClick={() => fileRef.current?.click()} className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-lg hover:bg-white/10 transition shrink-0" title="Send photo/video">📷</button>

                      {/* Emoji toggle */}
                      <button onClick={() => setShowEmoji(!showEmoji)} className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg transition shrink-0 ${showEmoji ? 'bg-[var(--accent)]/15 border-[var(--accent)]/30' : 'bg-white/5 border-white/8 hover:bg-white/10'}`}>😊</button>

                      {/* Text input */}
                      <input value={text} onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                        onFocus={() => setShowEmoji(false)}
                        placeholder="Type a message..." className="input-field flex-1 py-2.5" style={{ fontSize: '16px' }} />

                      {/* Voice recorder or send button */}
                      {text.trim() ? (
                        <button onClick={send} disabled={sending} className="btn-primary px-4 py-2.5 disabled:opacity-30 shrink-0">{sending ? '⏳' : '→'}</button>
                      ) : (
                        <VoiceRecorder onRecorded={sendVoice} />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}><ChatInner/></Suspense>;
}
