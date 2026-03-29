'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/constants';

export default function AdminTradeChat({ trade, onClose }) {
  const { user } = useStore();
  const [messages, setMessages] = useState([]);
  const [regularMessages, setRegularMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [sellerProfile, setSellerProfile] = useState(null);
  const [buyerProfile, setBuyerProfile] = useState(null);
  const [tab, setTab] = useState('trade'); // 'trade' | 'chat'
  const endRef = useRef(null);
  const supabase = createClient();

  // Load profiles
  useEffect(() => {
    (async () => {
      try {
        const [{ data: s }, { data: b }] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', trade.seller_id).maybeSingle(),
          supabase.from('profiles').select('*').eq('id', trade.buyer_id).maybeSingle(),
        ]);
        setSellerProfile(s); setBuyerProfile(b);
      } catch (e) {}
    })();
  }, [trade]);

  // Load trade messages
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('trade_id', trade.id).order('created_at', { ascending: true });
        setMessages(data || []);
      } catch (e) {}
    };
    load();

    // Realtime
    const ch = supabase.channel(`admin-trade-${trade.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `trade_id=eq.${trade.id}` }, async () => {
        try {
          const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('trade_id', trade.id).order('created_at', { ascending: true });
          setMessages(data || []);
          setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        } catch (e) {}
      }).subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [trade.id]);

  // Load regular chat messages
  useEffect(() => {
    if (tab !== 'chat' || !trade.conversation_id) return;
    (async () => {
      try {
        const { data } = await supabase.from('messages').select('*, profiles(*)').eq('conversation_id', trade.conversation_id).order('created_at', { ascending: true }).limit(200);
        setRegularMessages(data || []);
      } catch (e) {}
    })();
  }, [tab, trade.conversation_id]);

  // Admin reveals themselves in trade chat
  const revealAdmin = async () => {
    setRevealed(true);
    await supabase.from('trade_messages').insert({
      trade_id: trade.id,
      content: '🛡️ Administrator has joined this trade chat. How can I help resolve this?',
      is_system: true,
    });
  };

  // Admin sends message
  const sendMsg = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await supabase.from('trade_messages').insert({
        trade_id: trade.id,
        sender_id: user.id,
        content: `🛡️ Admin: ${text.trim()}`,
      });
      setText('');
    } catch (e) {}
    setSending(false);
  };

  // Lock body
  useEffect(() => {
    const sy = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${sy}px`;
    document.body.style.width = '100%';
    return () => { document.body.style.position = ''; document.body.style.top = ''; document.body.style.width = ''; window.scrollTo(0, sy); };
  }, []);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content max-w-2xl" style={{ height: '85vh' }}>
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <button onClick={onClose} className="text-white/40 text-lg">←</button>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">🔒 {trade.title}</div>
            <div className="text-[10px] text-white/30">
              🏪 {sellerProfile?.display_name || 'Seller'} → 🛒 {buyerProfile?.display_name || 'Buyer'} · {trade.currency} {parseFloat(trade.amount).toFixed(2)} · <span style={{ color: trade.status === 'disputed' ? '#ef4444' : trade.status === 'completed' ? '#22c55e' : '#f59e0b' }}>{trade.status.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            {trade.status === 'disputed' && (
              <button onClick={async () => {
                const note = prompt('Resolution note:');
                if (!note) return;
                await supabase.from('trades').update({ status: 'resolved', admin_note: note, resolved_at: new Date().toISOString() }).eq('id', trade.id);
                await supabase.from('trade_messages').insert({ trade_id: trade.id, content: `⚖️ Admin resolved this dispute: ${note}`, is_system: true });
                onClose();
              }} className="btn-primary py-1.5 px-3 text-[10px]">⚖️ Resolve</button>
            )}
            {!['completed','cancelled','resolved'].includes(trade.status) && (
              <button onClick={async () => {
                if (!confirm('Force cancel this trade?')) return;
                await supabase.from('trades').update({ status: 'cancelled', admin_note: 'Cancelled by admin' }).eq('id', trade.id);
                await supabase.from('trade_messages').insert({ trade_id: trade.id, content: '❌ Trade cancelled by administrator.', is_system: true });
                onClose();
              }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400">Cancel Trade</button>
            )}
          </div>
        </div>

        {/* Tabs: Trade Chat | Regular Chat */}
        <div className="flex border-b border-white/5">
          <button onClick={() => setTab('trade')} className={`flex-1 py-2.5 text-xs font-semibold text-center transition ${tab === 'trade' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-white/30'}`}>🔒 Trade Chat</button>
          <button onClick={() => setTab('chat')} className={`flex-1 py-2.5 text-xs font-semibold text-center transition ${tab === 'chat' ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]' : 'text-white/30'}`}>💬 Regular Chat</button>
        </div>

        {/* Trade details bar */}
        <div className="px-4 py-2 bg-white/3 border-b border-white/5 flex flex-wrap gap-2 text-[10px] text-white/30">
          {trade.escrow_payment_ref && <span className="text-green-400">💰 Ref: {trade.escrow_payment_ref}</span>}
          {trade.dispute_reason && <span className="text-red-400">⚠️ {trade.dispute_reason}</span>}
          {trade.admin_note && <span className="text-blue-400">📋 {trade.admin_note}</span>}
          {trade.delivery_estimate && <span>📦 {trade.delivery_estimate}</span>}
          <span>🏪 KYC: {sellerProfile?.kyc_status || 'none'}</span>
          <span>🛒 KYC: {buyerProfile?.kyc_status || 'none'}</span>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 overscroll-contain" style={{ height: 'calc(100% - 220px)' }}>
          {tab === 'trade' ? (
            <>
              {/* Secret viewing notice */}
              {!revealed && (
                <div className="text-center mb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300">
                    👁️ You&apos;re viewing silently — users don&apos;t know you&apos;re here
                  </div>
                </div>
              )}
              {messages.length === 0 && <div className="text-center text-white/15 text-xs py-8">No trade messages yet</div>}
              {messages.map(m => (
                <div key={m.id} className={`text-xs ${m.is_system ? 'text-center text-white/30 italic py-1' : ''}`}>
                  {m.is_system ? (
                    <span>{m.content}</span>
                  ) : (
                    <div className={`flex ${m.sender_id === trade.seller_id ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] px-3 py-2 rounded-xl ${m.sender_id === trade.seller_id ? 'bg-green-500/10 border border-green-500/15' : 'bg-blue-500/10 border border-blue-500/15'}`}>
                        <div className="text-[9px] font-bold mb-0.5" style={{ color: m.sender_id === trade.seller_id ? '#22c55e' : '#3b82f6' }}>
                          {m.sender_id === trade.seller_id ? '🏪 Seller' : m.sender_id === trade.buyer_id ? '🛒 Buyer' : '🛡️ Admin'}: {m.profiles?.display_name || 'User'}
                        </div>
                        {m.content}
                        <div className="text-[9px] text-white/20 mt-0.5">{timeAgo(m.created_at)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={endRef} />
            </>
          ) : (
            <>
              <div className="text-center mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/60">
                  👁️ Regular chat between these users (read-only)
                </div>
              </div>
              {regularMessages.length === 0 && <div className="text-center text-white/15 text-xs py-8">No messages</div>}
              {regularMessages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === trade.seller_id ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${m.sender_id === trade.seller_id ? 'bg-white/5' : 'bg-white/8'}`}>
                    <div className="text-[9px] font-bold mb-0.5 text-white/40">{m.profiles?.display_name || 'User'}</div>
                    {m.content}
                    <div className="text-[9px] text-white/20 mt-0.5">{timeAgo(m.created_at)}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Admin input — only for trade chat tab */}
        {tab === 'trade' && (
          <div className="p-3 border-t border-white/5">
            {!revealed ? (
              <div className="flex gap-2">
                <button onClick={revealAdmin} className="btn-primary flex-1 py-2.5 text-sm flex items-center justify-center gap-2">
                  🛡️ Reveal & Join Chat
                </button>
                <div className="text-[9px] text-white/20 self-center">Users will be notified</div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="Send as Admin..."
                  className="input-field flex-1 py-2.5" style={{ fontSize: '16px' }} />
                <button onClick={sendMsg} disabled={!text.trim() || sending}
                  className="btn-primary px-4 py-2.5 disabled:opacity-30">{sending ? '⏳' : '→'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
