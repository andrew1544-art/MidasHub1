'use client';
import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/constants';

function ChatPageInner() {
  const { user, profile, setShowAuth } = useStore();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState([]);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [otherUser, setOtherUser] = useState(null);
  const messagesEnd = useRef(null);
  const supabase = createClient();

  useEffect(() => { if (!user) { setLoading(false); return; } loadConversations(); }, [user]);
  useEffect(() => { const t = searchParams.get('user'); if (t && user) startOrOpenChat(t); }, [searchParams, user]);

  const loadConversations = async () => {
    const { data: memberships } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
    if (!memberships?.length) { setConversations([]); setLoading(false); return; }
    const convos = [];
    for (const m of memberships) {
      const { data: members } = await supabase.from('conversation_members').select('*, profiles(*)').eq('conversation_id', m.conversation_id);
      const { data: lastMsg } = await supabase.from('messages').select('*').eq('conversation_id', m.conversation_id).order('created_at', { ascending: false }).limit(1).single();
      const other = (members || []).find((x) => x.user_id !== user.id);
      const me = (members || []).find((x) => x.user_id === user.id);
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', m.conversation_id).neq('sender_id', user.id).gt('created_at', me?.last_read_at || '1970-01-01');
      convos.push({ id: m.conversation_id, otherUser: other?.profiles, lastMessage: lastMsg, unread: count || 0 });
    }
    convos.sort((a, b) => (b.lastMessage?.created_at || '').localeCompare(a.lastMessage?.created_at || ''));
    setConversations(convos); setLoading(false);
  };

  const startOrOpenChat = async (targetUserId) => {
    const { data: my } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user.id);
    const { data: their } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', targetUserId);
    const myIds = new Set((my || []).map((c) => c.conversation_id));
    const shared = (their || []).find((c) => myIds.has(c.conversation_id));
    if (shared) { openConversation(shared.conversation_id, targetUserId); } else {
      const { data: convo } = await supabase.from('conversations').insert({ is_group: false }).select().single();
      if (convo) {
        await supabase.from('conversation_members').insert([{ conversation_id: convo.id, user_id: user.id }, { conversation_id: convo.id, user_id: targetUserId }]);
        openConversation(convo.id, targetUserId); loadConversations();
      }
    }
  };

  const openConversation = async (convoId, targetUserId = null) => {
    setActiveConvo(convoId);
    if (targetUserId) { const { data } = await supabase.from('profiles').select('*').eq('id', targetUserId).single(); setOtherUser(data); }
    else { const c = conversations.find((x) => x.id === convoId); setOtherUser(c?.otherUser); }
    const { data: msgs } = await supabase.from('messages').select('*, profiles(*)').eq('conversation_id', convoId).order('created_at', { ascending: true });
    setMessages(msgs || []);
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() }).match({ conversation_id: convoId, user_id: user.id });
    setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  useEffect(() => {
    if (!activeConvo) return;
    const ch = supabase.channel(`chat-${activeConvo}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeConvo}` }, async (p) => {
      const { data } = await supabase.from('messages').select('*, profiles(*)').eq('id', p.new.id).single();
      if (data) { setMessages((prev) => [...prev, data]); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
    }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeConvo]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;
    setSending(true);
    await supabase.from('messages').insert({ conversation_id: activeConvo, sender_id: user.id, content: messageText.trim() });
    setMessageText(''); setSending(false);
  };

  if (!user) return (
    <AppShell><div className="max-w-2xl mx-auto px-4 py-16 text-center"><div className="text-5xl mb-3">💬</div><h2 className="text-xl font-bold mb-2">Log in to chat</h2><p className="text-white/30 text-sm mb-5">Message anyone on MidasHub</p><button onClick={() => setShowAuth(true)} className="btn-primary">Join MidasHub ⚡</button></div></AppShell>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="glass-light rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 130px)' }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={`w-full md:w-72 border-r border-white/5 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-3 border-b border-white/5"><h2 className="font-bold">💬 Messages</h2></div>
              <div className="flex-1 overflow-y-auto">
                {loading ? <div className="p-4 space-y-2">{[1,2,3].map((i) => <div key={i} className="flex gap-2.5 p-2.5"><div className="w-9 h-9 rounded-full skeleton" /><div className="flex-1 space-y-1.5"><div className="h-3.5 w-20 skeleton" /><div className="h-3 w-32 skeleton" /></div></div>)}</div> :
                conversations.length === 0 ? <div className="p-6 text-center text-white/20 text-sm">No conversations yet</div> :
                conversations.map((c) => (
                  <button key={c.id} onClick={() => openConversation(c.id)}
                    className={`w-full flex items-center gap-2.5 p-3 text-left transition hover:bg-white/5 ${activeConvo === c.id ? 'bg-white/5' : ''}`}>
                    <span className="text-2xl">{c.otherUser?.avatar_emoji || '😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between"><span className="font-semibold text-sm truncate">{c.otherUser?.display_name || 'User'}</span><span className="text-[10px] text-white/20 shrink-0">{c.lastMessage ? timeAgo(c.lastMessage.created_at) : ''}</span></div>
                      <div className="text-xs text-white/30 truncate mt-0.5">{c.lastMessage?.content || 'Start chatting!'}</div>
                    </div>
                    {c.unread > 0 && <span className="w-4.5 h-4.5 rounded-full accent-gradient text-black text-[9px] font-bold flex items-center justify-center shrink-0" style={{width:18,height:18}}>{c.unread}</span>}
                  </button>
                ))}
              </div>
            </div>
            {/* Chat area */}
            <div className={`flex-1 flex flex-col ${!activeConvo ? 'hidden md:flex' : 'flex'}`}>
              {!activeConvo ? <div className="flex-1 flex items-center justify-center text-white/15 text-sm">Select a conversation</div> : (
                <>
                  <div className="flex items-center gap-2.5 p-3 border-b border-white/5">
                    <button onClick={() => setActiveConvo(null)} className="md:hidden text-white/30 text-lg">←</button>
                    <Link href={`/profile/${otherUser?.username}`} className="flex items-center gap-2.5 hover:opacity-80 transition">
                      <span className="text-2xl">{otherUser?.avatar_emoji || '😎'}</span>
                      <div><div className="font-bold text-sm">{otherUser?.display_name}</div><div className="text-[10px] text-cyan-400">● Online</div></div>
                    </Link>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${msg.sender_id === user.id ? 'accent-gradient text-black rounded-br-md' : 'bg-white/8 text-white/85 rounded-bl-md'}`}>
                          {msg.content}
                          <div className={`text-[10px] mt-0.5 ${msg.sender_id === user.id ? 'text-black/40' : 'text-white/20'}`}>{timeAgo(msg.created_at)}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEnd} />
                  </div>
                  <div className="p-3 border-t border-white/5 flex gap-2">
                    <input value={messageText} onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="Type a message..." className="input-field flex-1 py-2.5" />
                    <button onClick={sendMessage} disabled={!messageText.trim() || sending} className="btn-primary px-4 py-2.5 disabled:opacity-30">→</button>
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
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}><ChatPageInner /></Suspense>;
}
