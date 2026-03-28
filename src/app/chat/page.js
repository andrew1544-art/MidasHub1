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

  // Load conversations
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadConversations();
  }, [user]);

  // Handle ?user= param to start new chat
  useEffect(() => {
    const targetUserId = searchParams.get('user');
    if (targetUserId && user) {
      startOrOpenChat(targetUserId);
    }
  }, [searchParams, user]);

  const loadConversations = async () => {
    const { data: memberships } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convoIds = memberships.map((m) => m.conversation_id);

    // Get conversations with their members and last message
    const convos = [];
    for (const convoId of convoIds) {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('*, profiles(*)')
        .eq('conversation_id', convoId);

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const other = (members || []).find((m) => m.user_id !== user.id);

      // Count unread
      const memberRecord = (members || []).find((m) => m.user_id === user.id);
      const { count: unreadCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', convoId)
        .neq('sender_id', user.id)
        .gt('created_at', memberRecord?.last_read_at || '1970-01-01');

      convos.push({
        id: convoId,
        otherUser: other?.profiles,
        lastMessage: lastMsg,
        unread: unreadCount || 0,
      });
    }

    convos.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || '0';
      const bTime = b.lastMessage?.created_at || '0';
      return bTime.localeCompare(aTime);
    });

    setConversations(convos);
    setLoading(false);
  };

  const startOrOpenChat = async (targetUserId) => {
    // Check if conversation already exists
    const { data: myConvos } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user.id);

    const { data: theirConvos } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', targetUserId);

    const myIds = new Set((myConvos || []).map((c) => c.conversation_id));
    const sharedConvo = (theirConvos || []).find((c) => myIds.has(c.conversation_id));

    if (sharedConvo) {
      openConversation(sharedConvo.conversation_id, targetUserId);
    } else {
      // Create new conversation
      const { data: convo } = await supabase
        .from('conversations')
        .insert({ is_group: false })
        .select()
        .single();

      if (convo) {
        await supabase.from('conversation_members').insert([
          { conversation_id: convo.id, user_id: user.id },
          { conversation_id: convo.id, user_id: targetUserId },
        ]);
        openConversation(convo.id, targetUserId);
        loadConversations();
      }
    }
  };

  const openConversation = async (convoId, targetUserId = null) => {
    setActiveConvo(convoId);

    // Get other user info
    if (targetUserId) {
      const { data: userProfile } = await supabase.from('profiles').select('*').eq('id', targetUserId).single();
      setOtherUser(userProfile);
    } else {
      const convo = conversations.find((c) => c.id === convoId);
      setOtherUser(convo?.otherUser);
    }

    // Load messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('*, profiles(*)')
      .eq('conversation_id', convoId)
      .order('created_at', { ascending: true });

    setMessages(msgs || []);

    // Mark as read
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .match({ conversation_id: convoId, user_id: user.id });

    setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Real-time messages
  useEffect(() => {
    if (!activeConvo) return;
    const channel = supabase
      .channel(`chat-${activeConvo}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${activeConvo}`,
      }, async (payload) => {
        const { data } = await supabase.from('messages').select('*, profiles(*)').eq('id', payload.new.id).single();
        if (data) {
          setMessages((prev) => [...prev, data]);
          setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvo]);

  const sendMessage = async () => {
    if (!messageText.trim() || sending) return;
    setSending(true);
    await supabase.from('messages').insert({
      conversation_id: activeConvo,
      sender_id: user.id,
      content: messageText.trim(),
    });
    setMessageText('');
    setSending(false);
  };

  if (!user) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="text-6xl mb-4">💬</div>
          <h2 className="text-2xl font-bold mb-3">Log in to chat</h2>
          <p className="text-white/40 mb-6">Create an account to message anyone on MidasHub</p>
          <button onClick={() => setShowAuth(true)} className="btn-primary">Join MidasHub ⚡</button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="glass-light rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}>
          <div className="flex h-full">
            {/* Sidebar */}
            <div className={`w-full md:w-80 border-r border-white/5 flex flex-col ${activeConvo ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-white/5">
                <h2 className="font-bold text-lg">💬 Messages</h2>
              </div>

              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex gap-3 p-3">
                        <div className="w-10 h-10 rounded-full skeleton" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 w-24 rounded skeleton" />
                          <div className="h-3 w-40 rounded skeleton" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="p-8 text-center text-white/30 text-sm">
                    <div className="text-3xl mb-3">🗨️</div>
                    No conversations yet.<br />Visit People to start chatting!
                  </div>
                ) : conversations.map((convo) => (
                  <button key={convo.id}
                    onClick={() => openConversation(convo.id)}
                    className={`w-full flex items-center gap-3 p-4 text-left transition hover:bg-white/5 ${activeConvo === convo.id ? 'bg-white/5' : ''}`}
                  >
                    <span className="text-3xl">{convo.otherUser?.avatar_emoji || '😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm truncate">{convo.otherUser?.display_name || 'User'}</span>
                        <span className="text-[10px] text-white/25 shrink-0">{convo.lastMessage ? timeAgo(convo.lastMessage.created_at) : ''}</span>
                      </div>
                      <div className="text-xs text-white/40 truncate mt-0.5">
                        {convo.lastMessage?.content || 'Start chatting!'}
                      </div>
                    </div>
                    {convo.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-yellow-500 text-black text-[10px] font-bold flex items-center justify-center shrink-0">
                        {convo.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat area */}
            <div className={`flex-1 flex flex-col ${!activeConvo ? 'hidden md:flex' : 'flex'}`}>
              {!activeConvo ? (
                <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
                  Select a conversation to start chatting
                </div>
              ) : (
                <>
                  {/* Chat header */}
                  <div className="flex items-center gap-3 p-4 border-b border-white/5">
                    <button onClick={() => setActiveConvo(null)} className="md:hidden text-white/40 mr-1">←</button>
                    <Link href={`/profile/${otherUser?.username}`} className="flex items-center gap-3 hover:opacity-80 transition">
                      <span className="text-2xl">{otherUser?.avatar_emoji || '😎'}</span>
                      <div>
                        <div className="font-bold text-sm">{otherUser?.display_name}</div>
                        <div className="text-[11px] text-cyan-400">● Online</div>
                      </div>
                    </Link>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id}
                        className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          msg.sender_id === user.id
                            ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-br-md'
                            : 'bg-white/8 text-white/90 rounded-bl-md'
                        }`}>
                          {msg.content}
                          <div className={`text-[10px] mt-1 ${msg.sender_id === user.id ? 'text-white/50' : 'text-white/20'}`}>
                            {timeAgo(msg.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEnd} />
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-white/5 flex gap-3">
                    <input
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                      placeholder="Type a message..."
                      className="input-field flex-1 py-3"
                    />
                    <button onClick={sendMessage} disabled={!messageText.trim() || sending}
                      className="btn-primary px-5 py-3 disabled:opacity-40"
                    >
                      {sending ? '⏳' : '→'}
                    </button>
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
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-4xl animate-pulse">⚡</div></div>}>
      <ChatPageInner />
    </Suspense>
  );
}