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
import { compressImage, checkVideoSize } from '@/lib/media';

function parseMedia(msg) {
  const url = msg.media_url || '';
  if (url) {
    if (/\.(mp4|webm|mov|avi)$/i.test(url) || msg.media_type === 'video') return { type: 'video', url };
    if (/\.(webm|ogg|mp3|wav|m4a)$/i.test(url) || msg.media_type === 'audio') return { type: 'audio', url };
    return { type: 'image', url };
  }
  const content = msg.content || '';
  if (/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(content.trim())) return { type: 'image', url: content.trim() };
  if (/^https?:\/\/.*\.(mp4|webm|mov)(\?.*)?$/i.test(content.trim())) return { type: 'video', url: content.trim() };
  const match = content.match(/(?:📷|🎬|🎤)\s?(https?:\/\/\S+)/);
  if (match) {
    const u = match[1];
    if (content.startsWith('🎬') || /\.mp4/i.test(u)) return { type: 'video', url: u };
    if (content.startsWith('🎤')) return { type: 'audio', url: u };
    return { type: 'image', url: u };
  }
  return null;
}

function MediaBubble({ msg, isMine }) {
  const media = parseMedia(msg);
  if (!media) return null;
  return (
    <div className={`max-w-[75%] rounded-2xl overflow-hidden ${isMine ? 'rounded-br-md' : 'rounded-bl-md'}`}>
      {media.type === 'image' && <img src={media.url} alt="" className="max-w-full max-h-64 rounded-xl object-cover cursor-pointer" onClick={() => window.open(media.url, '_blank')} loading="lazy" />}
      {media.type === 'video' && <video src={media.url} controls className="max-w-full max-h-64 rounded-xl" preload="metadata" playsInline />}
      {media.type === 'audio' && <div className="px-3 py-2"><div className="text-xs mb-1 opacity-60">🎤 Voice</div><audio src={media.url} controls className="w-48 h-8" /></div>}
      <div className={`text-[10px] px-2 py-1 ${isMine ? 'text-black/40' : 'text-white/20'}`}>{timeAgo(msg.created_at)}</div>
    </div>
  );
}

function ChatInner() {
  const { user, profile, setShowAuth, showToast } = useStore();
  const searchParams = useSearchParams();
  const [convos, setConvos] = useState([]); const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]); const [text, setText] = useState('');
  const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null); const [trades, setTrades] = useState([]);
  const [showTrades, setShowTrades] = useState(false); const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef(null); const startedRef = useRef(false); const fileRef = useRef(null);
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
          let preview = 'Start chatting!';
          if (last) { const media = parseMedia(last); preview = media ? (media.type === 'video' ? '🎬 Video' : media.type === 'audio' ? '🎤 Voice' : '📷 Photo') : (last.content||'').slice(0,40); }
          list.push({ id: m.conversation_id, otherUser: other?.profiles, lastMessage: last, preview, unread: count||0, activeTrades });
        } catch(e){}
      }
      list.sort((a,b) => (b.lastMessage?.created_at||'0').localeCompare(a.lastMessage?.created_at||'0'));
      setConvos(list);
    } catch(e){}
    setLoading(false);
  }, [user, getSupabase]);

  const openConvo = useCallback(async (convoId, targetId = null) => {
    const sb = getSupabase(); setActiveConvo(convoId); setShowEmoji(false);
    if (targetId) { const { data } = await sb.from('profiles').select('*').eq('id', targetId).maybeSingle(); setOtherUser(data); }
    else { const c = convos.find(c => c.id === convoId); if (c?.otherUser) setOtherUser(c.otherUser); else { const { data: mem } = await sb.from('conversation_members').select('*, profiles(*)').eq('conversation_id', convoId); setOtherUser((mem||[]).find(x => x.user_id !== user.id)?.profiles||null); } }
    const { data: msgs } = await sb.from('messages').select('*, profiles(*)').eq('conversation_id', convoId).order('created_at', { ascending: true });
    setMessages(msgs||[]);
    await sb.from('conversation_members').update({ last_read_at: new Date().toISOString() }).match({ conversation_id: convoId, user_id: user.id });
    try { const { data: td } = await sb.from('trades').select('*').eq('conversation_id', convoId).order('created_at', { ascending: false }); setTrades(td||[]); if ((td||[]).some(t => !['completed','cancelled','resolved'].includes(t.status))) setShowTrades(true); } catch(e) { setTrades([]); }
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [user, convos, getSupabase]);

  const startChat = useCallback(async (targetId) => {
    if (!targetId||!user) return; const sb = getSupabase();
    try { const { data: my } = await sb.from('conversation_members').select('conversation_id').eq('user_id', user.id); const { data: their } = await sb.from('conversation_members').select('conversation_id').eq('user_id', targetId); const mySet = new Set((my||[]).map(c => c.conversation_id)); const shared = (their||[]).find(c => mySet.has(c.conversation_id)); if (shared) { await openConvo(shared.conversation_id, targetId); return; } const { data: convo, error } = await sb.from('conversations').insert({ is_group: false }).select().single(); if (error||!convo) return; await sb.from('conversation_members').insert([{ conversation_id: convo.id, user_id: user.id },{ conversation_id: convo.id, user_id: targetId }]); await openConvo(convo.id, targetId); loadConvos(); } catch(e){}
  }, [user, getSupabase, openConvo, loadConvos]);

  useEffect(() => { if (!user) { setLoading(false); return; } (async () => { await loadConvos(); const t = searchParams.get('user'); if (t&&!startedRef.current) { startedRef.current = true; await startChat(t); } })(); }, [user]);
  useEffect(() => { const t = searchParams.get('user'); if (t&&user&&startedRef.current) startChat(t); }, [searchParams]);
  const loadTrades = async () => { if (!activeConvo) return; try { const { data } = await getSupabase().from('trades').select('*').eq('conversation_id', activeConvo).order('created_at', { ascending: false }); setTrades(data||[]); } catch(e){} };

  useEffect(() => {
    if (!activeConvo) return; const sb = getSupabase();
    const ch = sb.channel(`chat-live-${activeConvo}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvo}` }, async (p) => {
      try { const { data } = await sb.from('messages').select('*, profiles(*)').eq('id', p.new.id).maybeSingle(); if (data) { setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]); if (data.sender_id !== user.id) playMessageSound(); setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50); } } catch(e){}
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [activeConvo, getSupabase]);

  const send = async () => { if (!text.trim()||sending) return; setSending(true); try { await getSupabase().from('messages').insert({ conversation_id: activeConvo, sender_id: user.id, content: text.trim() }); setText(''); } catch(e){} setSending(false); };

  const sendMedia = async (rawFile) => {
    if (!rawFile||!activeConvo) return;
    // Check video size
    if (rawFile.type.startsWith('video/')) {
      const check = checkVideoSize(rawFile, 50);
      if (!check.ok) { showToast?.(`Video too large (${check.sizeMB}MB). Max 50MB.`); return; }
    }
    setUploading(true);
    try {
      // Compress images automatically
      const file = rawFile.type.startsWith('image/') ? await compressImage(rawFile) : rawFile;
      const sb = getSupabase(); const ext = file.name.split('.').pop().toLowerCase();
      const path = `chat/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2,6)}.${ext}`;
      const { data, error } = await sb.storage.from('media').upload(path, file, { contentType: file.type, cacheControl: '3600' });
      if (error) { showToast?.('Upload failed: ' + (error.message||'try smaller file')); setUploading(false); return; }
      const { data: u } = sb.storage.from('media').getPublicUrl(data.path);
      const isVid = file.type.startsWith('video/'); const isAudio = file.type.startsWith('audio/');
      await sb.from('messages').insert({ conversation_id: activeConvo, sender_id: user.id, content: isVid ? '🎬 Video' : isAudio ? '🎤 Voice' : '📷 Photo', media_url: u.publicUrl, media_type: isVid ? 'video' : isAudio ? 'audio' : 'image' });
    } catch(e) { showToast?.('Upload failed'); }
    setUploading(false);
  };
  const sendVoice = async (blob) => { await sendMedia(new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })); };

  if (!user) return (<AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-6xl mb-4">💬</div><h2 className="text-2xl font-bold mb-3">Log in to chat</h2><button onClick={() => setShowAuth(true)} className="btn-primary px-8 py-3">Join MidasHub ⚡</button></div></AppShell>);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass-light rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 140px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))', minHeight: 400 }}>
          <div className="flex h-full">
            <div className={`w-full md:w-80 border-r border-white/5 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-white/5"><h2 className="font-bold text-lg">💬 Messages</h2></div>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {loading ? <div className="p-4 space-y-3">{[1,2,3].map(i=><div key={i} className="flex gap-3 p-3"><div className="w-10 h-10 rounded-full skeleton"/><div className="flex-1 space-y-2"><div className="h-4 w-24 skeleton"/><div className="h-3 w-36 skeleton"/></div></div>)}</div>
                : convos.length===0 ? <div className="p-8 text-center text-white/20 text-sm"><div className="text-4xl mb-3">🗨️</div>No conversations<br/><Link href="/people" className="text-[var(--accent)] hover:underline mt-2 inline-block">Find people →</Link></div>
                : convos.map(c => (
                  <button key={c.id} onClick={() => openConvo(c.id)} className={`w-full flex items-center gap-3 p-4 text-left transition hover:bg-white/5 ${activeConvo===c.id ? 'bg-white/5' : ''}`}>
                    <span className="text-3xl shrink-0">{c.otherUser?.avatar_emoji||'😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center"><div className="flex items-center gap-1.5"><span className="font-semibold text-sm truncate">{c.otherUser?.display_name||'User'}</span>{c.otherUser?.trade_count>=2&&<span className="text-[9px]">✅</span>}</div><span className="text-[10px] text-white/20 shrink-0">{c.lastMessage ? timeAgo(c.lastMessage.created_at) : ''}</span></div>
                      <div className="flex items-center gap-2 mt-0.5"><span className="text-xs text-white/30 truncate flex-1">{c.preview}</span>{c.activeTrades>0&&<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold shrink-0">🔒</span>}</div>
                    </div>
                    {c.unread>0&&<span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{background:'var(--accent)',color:'#000'}}>{c.unread}</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className={`flex-1 flex flex-col ${!activeConvo ? 'hidden md:flex' : 'flex'}`}>
              {!activeConvo ? <div className="flex-1 flex items-center justify-center text-white/15 text-sm"><div className="text-center"><div className="text-5xl mb-3">💬</div><p>Select a conversation</p></div></div> : (<>
                <div className="flex items-center gap-3 p-3 border-b border-white/5">
                  <button onClick={() => { setActiveConvo(null); setOtherUser(null); setShowEmoji(false); }} className="md:hidden text-white/40 text-lg">←</button>
                  <Link href={`/profile/${otherUser?.username}`} className="flex items-center gap-3 hover:opacity-80 transition flex-1 min-w-0">
                    <span className="text-2xl">{otherUser?.avatar_emoji||'😎'}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5"><span className="font-bold text-sm truncate">{otherUser?.display_name||'User'}</span>{otherUser?.trade_count>=2&&<span className="text-xs">✅</span>}{otherUser?.total_reviews>0&&<span className="text-[10px] text-yellow-400">{parseFloat(otherUser.trade_rating||0).toFixed(1)}⭐</span>}</div>
                      {(()=>{ const ls=otherUser?.last_seen?new Date(otherUser.last_seen):null; const on=ls&&(Date.now()-ls.getTime()<30*60*1000); return on?<div className="text-[11px] text-green-400">● Online</div>:<div className="text-[11px] text-white/25">{ls?`Last seen ${timeAgo(otherUser.last_seen)}`:'● Offline'}</div>; })()}
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {trades.length>0&&<button onClick={()=>setShowTrades(!showTrades)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold ${showTrades?'bg-green-500/15 text-green-400':'bg-white/5 text-white/40'}`}>🔒 Trades</button>}
                    <StartTradeButton conversationId={activeConvo} otherUserId={otherUser?.id} onTradeCreated={loadTrades}/>
                  </div>
                </div>
                {showTrades&&trades.length>0&&(<div className="border-b border-white/5 p-3 space-y-2 max-h-[50vh] overflow-y-auto overscroll-contain"><div className="flex items-center justify-between mb-1"><span className="text-xs font-bold text-white/40">🔒 TRADES</span><button onClick={()=>setShowTrades(false)} className="text-[10px] text-white/25">Hide</button></div>{trades.map(t=><TradeCard key={t.id} trade={t} onUpdate={loadTrades}/>)}</div>)}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 overscroll-contain">
                  <div className="text-center mb-3"><div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/60">🔒 Trading? Use <strong className="text-yellow-300/80">Start Trade</strong> for escrow</div></div>
                  {messages.length===0&&<div className="text-center text-white/15 text-sm py-10">Say hi! 👋</div>}
                  {messages.map(msg => {
                    const isMine = msg.sender_id===user.id;
                    const media = parseMedia(msg);
                    return (
                      <div key={msg.id} className={`flex ${isMine?'justify-end':'justify-start'}`}>
                        {media ? (
                          <div className={`p-1 rounded-2xl ${isMine?'accent-gradient rounded-br-md':'bg-white/8 rounded-bl-md'}`}>
                            <MediaBubble msg={msg} isMine={isMine}/>
                          </div>
                        ) : (
                          <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMine?'accent-gradient text-black rounded-br-md':'bg-white/8 text-white/90 rounded-bl-md'}`}>
                            {msg.content}
                            <div className={`text-[10px] mt-1 ${isMine?'text-black/40':'text-white/20'}`}>{timeAgo(msg.created_at)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={endRef}/>
                </div>
                <div className="p-3 border-t border-white/5 relative">
                  {showEmoji&&<EmojiPicker onSelect={e=>setText(t=>t+e)} onClose={()=>setShowEmoji(false)}/>}
                  {uploading&&<div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded-xl"><span className="text-white/60 text-sm">⏳ Uploading...</span></div>}
                  <div className="flex gap-2 items-end">
                    <input type="file" ref={fileRef} accept="image/*,video/mp4,video/webm,video/mov" className="hidden" onChange={e=>{if(e.target.files[0])sendMedia(e.target.files[0]);e.target.value='';}}/>
                    <button onClick={()=>fileRef.current?.click()} className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-lg hover:bg-white/10 transition shrink-0">📷</button>
                    <button onClick={()=>setShowEmoji(!showEmoji)} className={`w-10 h-10 rounded-xl border flex items-center justify-center text-lg transition shrink-0 ${showEmoji?'bg-[var(--accent)]/15 border-[var(--accent)]/30':'bg-white/5 border-white/8'}`}>😊</button>
                    <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}}} onFocus={()=>setShowEmoji(false)} placeholder="Type a message..." className="input-field flex-1 py-2.5" style={{fontSize:'16px'}}/>
                    {text.trim() ? <button onClick={send} disabled={sending} className="btn-primary px-4 py-2.5 disabled:opacity-30 shrink-0">{sending?'⏳':'→'}</button> : <VoiceRecorder onRecorded={sendVoice}/>}
                  </div>
                </div>
              </>)}
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
