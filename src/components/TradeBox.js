'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { sendNotification } from '@/lib/notifications';
import { timeAgo, formatCount } from '@/lib/constants';

const STATUS_CONFIG = {
  pending:   { label: 'Waiting for buyer', color: '#f59e0b', icon: '⏳', step: 1 },
  accepted:  { label: 'Accepted — pay now', color: '#3b82f6', icon: '🤝', step: 2 },
  paid:      { label: 'Paid — in escrow', color: '#8b5cf6', icon: '💰', step: 3 },
  delivered: { label: 'Delivered — confirm', color: '#f97316', icon: '📦', step: 4 },
  completed: { label: 'Completed ✓', color: '#22c55e', icon: '🎉', step: 5 },
  disputed:  { label: 'Disputed', color: '#ef4444', icon: '⚠️', step: 0 },
  resolved:  { label: 'Resolved', color: '#6b7280', icon: '⚖️', step: 0 },
  cancelled: { label: 'Cancelled', color: '#6b7280', icon: '❌', step: 0 },
};

const STEPS = ['Proposed', 'Accepted', 'Paid', 'Delivered', 'Complete'];

export function StartTradeButton({ conversationId, otherUserId, onTradeCreated }) {
  const { user } = useStore();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(null); // 'seller' | 'buyer'
  const [form, setForm] = useState({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!form.title.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      setError('Title and a valid amount are required'); return;
    }
    setCreating(true); setError('');
    try {
      const supabase = createClient();
      const sellerId = role === 'seller' ? user.id : otherUserId;
      const buyerId = role === 'buyer' ? user.id : otherUserId;
      const { data, error: insertErr } = await supabase.from('trades').insert({
        conversation_id: conversationId,
        seller_id: sellerId,
        buyer_id: buyerId,
        title: form.title.trim(),
        description: form.description.trim(),
        amount: parseFloat(form.amount),
        currency: form.currency,
        payment_method: form.paymentMethod.trim(),
      }).select().single();

      if (insertErr) { setError(insertErr.message); setCreating(false); return; }

      // System message in trade
      await supabase.from('trade_messages').insert({
        trade_id: data.id,
        content: `🔒 Trade created: "${form.title}" for ${form.currency} ${parseFloat(form.amount).toFixed(2)} (+ 2% escrow fee). Waiting for ${role === 'seller' ? 'buyer' : 'seller'} to accept.`,
        is_system: true,
      });

      // Notify the other person
      sendNotification({
        toUserId: otherUserId, fromUserId: user.id,
        type: 'system', content: `started a trade: "${form.title}" — ${form.currency} ${parseFloat(form.amount).toFixed(2)}`
      });

      setOpen(false);
      setForm({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '' });
      setRole(null);
      onTradeCreated?.();
    } catch (e) { setError('Failed to create trade'); }
    setCreating(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition">
        🔒 Start Trade
      </button>
    );
  }

  return (
    <div className="glass-light rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm">🔒 New Trade</h4>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 text-sm">✕</button>
      </div>

      {/* Escrow warning */}
      <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300 leading-relaxed">
        ⚠️ <strong>Trade Protection:</strong> If this involves money or goods, always use escrow. MidasHub holds the payment until the buyer confirms delivery. We charge just <strong>2% escrow fee</strong> for your safety.
      </div>

      {/* Role selection */}
      {!role ? (
        <div>
          <div className="text-xs text-white/40 mb-2">What&apos;s your role?</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setRole('seller')}
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-green-500/30 hover:bg-green-500/5 transition text-center">
              <div className="text-2xl mb-1">🏪</div>
              <div className="text-xs font-bold">I&apos;m Selling</div>
              <div className="text-[10px] text-white/30 mt-0.5">I have something to sell</div>
            </button>
            <button onClick={() => setRole('buyer')}
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition text-center">
              <div className="text-2xl mb-1">🛒</div>
              <div className="text-xs font-bold">I&apos;m Buying</div>
              <div className="text-[10px] text-white/30 mt-0.5">I want to purchase</div>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>{role === 'seller' ? '🏪' : '🛒'}</span>
            <span>You are the <strong className="text-white/70">{role}</strong></span>
            <button onClick={() => setRole(null)} className="text-[var(--accent)] ml-auto text-[10px]">Change</button>
          </div>

          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
            placeholder="What are you trading? (e.g., iPhone 15, Logo Design, etc.)"
            className="input-field text-sm" style={{ fontSize: '16px' }} />

          <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
            placeholder="Describe the item/service, condition, delivery method..."
            className="input-field text-sm resize-none h-16" style={{ fontSize: '16px' }} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Amount</label>
              <input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
                placeholder="0.00" className="input-field text-sm" style={{ fontSize: '16px' }} min="0" step="0.01" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Currency</label>
              <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})}
                className="input-field text-sm" style={{ fontSize: '16px' }}>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="NGN">NGN (₦)</option>
                <option value="KES">KES (KSh)</option>
                <option value="BTC">BTC (₿)</option>
                <option value="USDT">USDT</option>
              </select>
            </div>
          </div>

          {form.amount && parseFloat(form.amount) > 0 && (
            <div className="p-2.5 rounded-lg bg-white/3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Item price</span><span>{form.currency} {parseFloat(form.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Escrow fee (2%)</span><span className="text-yellow-400">{form.currency} {(parseFloat(form.amount) * 0.02).toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t border-white/5 pt-1"><span>Total (buyer pays)</span><span className="text-[var(--accent)]">{form.currency} {(parseFloat(form.amount) * 1.02).toFixed(2)}</span></div>
            </div>
          )}

          <input value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}
            placeholder="Payment method: Bank transfer, PayPal, Crypto, Cash..."
            className="input-field text-sm" style={{ fontSize: '16px' }} />

          {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{error}</div>}

          <button onClick={handleCreate} disabled={creating}
            className="btn-primary w-full py-2.5 text-sm disabled:opacity-40 flex items-center justify-center gap-2">
            {creating ? '⏳ Creating...' : '🔒 Create Trade'}
          </button>
        </>
      )}
    </div>
  );
}

export function TradeCard({ trade, onUpdate }) {
  const { user, showToast } = useStore();
  const [tradeMessages, setTradeMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);
  const supabase = createClient();
  const isSeller = user?.id === trade.seller_id;
  const isBuyer = user?.id === trade.buyer_id;
  const config = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pending;
  const isActive = !['completed', 'cancelled', 'resolved'].includes(trade.status);

  // Load trade messages
  useEffect(() => {
    if (!expanded) return;
    const load = async () => {
      const { data } = await supabase.from('trade_messages')
        .select('*, profiles(*)')
        .eq('trade_id', trade.id)
        .order('created_at', { ascending: true });
      setTradeMessages(data || []);
      setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    load();

    // Realtime
    const ch = supabase.channel(`trade-${trade.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `trade_id=eq.${trade.id}` }, async (p) => {
        try {
          const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('id', p.new.id).maybeSingle();
          if (data) { setTradeMessages(prev => [...prev, data]); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50); }
        } catch (e) {}
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [expanded, trade.id]);

  const sendMsg = async () => {
    if (!msgText.trim()) return;
    await supabase.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: msgText.trim() });
    setMsgText('');
  };

  const updateStatus = async (newStatus) => {
    setLoading(true);
    try {
      await supabase.from('trades').update({ status: newStatus }).eq('id', trade.id);
      const otherUserId = isSeller ? trade.buyer_id : trade.seller_id;
      const msgs = {
        accepted: 'accepted the trade',
        paid: 'marked payment as sent 💰',
        delivered: 'marked item as delivered 📦',
        completed: 'confirmed receipt — trade complete! 🎉',
        disputed: 'raised a dispute ⚠️',
        cancelled: 'cancelled the trade',
      };
      sendNotification({ toUserId: otherUserId, fromUserId: user.id, type: 'system', content: `Trade "${trade.title}": ${msgs[newStatus] || newStatus}` });
      onUpdate?.();
    } catch (e) { showToast?.('Action failed'); }
    setLoading(false);
  };

  const disputeTrade = async () => {
    const reason = prompt('Describe the issue:');
    if (!reason) return;
    setLoading(true);
    try {
      await supabase.from('trades').update({ status: 'disputed', dispute_reason: reason, dispute_by: user.id }).eq('id', trade.id);
      await supabase.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: `⚠️ Dispute: ${reason}` });
      onUpdate?.();
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${config.color}30`, background: `${config.color}05` }}>
      {/* Header — always visible */}
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3 flex items-center gap-3">
        <span className="text-xl">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm truncate">{trade.title}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs font-semibold" style={{ color: config.color }}>{config.label}</span>
            <span className="text-[10px] text-white/20">•</span>
            <span className="text-xs text-white/30">{trade.currency} {parseFloat(trade.amount).toFixed(2)}</span>
          </div>
        </div>
        <div className="text-white/20 text-sm shrink-0">{expanded ? '▲' : '▼'}</div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Progress bar */}
          {isActive && (
            <div className="flex gap-1">
              {STEPS.map((step, i) => (
                <div key={i} className="flex-1">
                  <div className="h-1.5 rounded-full transition-all" style={{ background: i < config.step ? config.color : 'rgba(255,255,255,0.05)' }} />
                  <div className="text-[8px] text-white/20 text-center mt-0.5">{step}</div>
                </div>
              ))}
            </div>
          )}

          {/* Trade details */}
          <div className="p-2.5 rounded-lg bg-white/3 text-xs space-y-1.5">
            {trade.description && <div className="text-white/50 mb-2">{trade.description}</div>}
            <div className="flex justify-between"><span className="text-white/30">Price</span><span>{trade.currency} {parseFloat(trade.amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Escrow fee (2%)</span><span className="text-yellow-400">{trade.currency} {parseFloat(trade.escrow_fee || trade.amount * 0.02).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-[var(--accent)]">{trade.currency} {parseFloat(trade.total_amount || trade.amount * 1.02).toFixed(2)}</span></div>
            {trade.payment_method && <div className="flex justify-between"><span className="text-white/30">Payment</span><span>{trade.payment_method}</span></div>}
            <div className="flex justify-between"><span className="text-white/30">You are</span><span className="font-semibold">{isSeller ? '🏪 Seller' : '🛒 Buyer'}</span></div>
          </div>

          {/* Safety warning */}
          <div className="p-2.5 rounded-lg bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/70 leading-relaxed">
            🔒 <strong>Escrow Protected:</strong> Funds are held by MidasHub until the buyer confirms delivery. Never share personal banking details in chat. Report suspicious activity immediately.
          </div>

          {/* Action buttons based on status */}
          {isActive && (
            <div className="flex flex-wrap gap-2">
              {trade.status === 'pending' && isBuyer && (
                <>
                  <button onClick={() => updateStatus('accepted')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">🤝 Accept Trade</button>
                  <button onClick={() => updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">Cancel</button>
                </>
              )}
              {trade.status === 'pending' && isSeller && (
                <button onClick={() => updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">Cancel Trade</button>
              )}
              {trade.status === 'accepted' && isBuyer && (
                <button onClick={() => updateStatus('paid')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">💰 I&apos;ve Paid</button>
              )}
              {trade.status === 'paid' && isSeller && (
                <button onClick={() => updateStatus('delivered')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">📦 Mark Delivered</button>
              )}
              {trade.status === 'delivered' && isBuyer && (
                <>
                  <button onClick={() => updateStatus('completed')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">✅ Confirm Received</button>
                  <button onClick={disputeTrade} disabled={loading} className="text-xs text-red-400 px-3 py-2 bg-red-500/10 rounded-lg">⚠️ Dispute</button>
                </>
              )}
              {['paid', 'delivered'].includes(trade.status) && (
                <button onClick={disputeTrade} disabled={loading} className="text-[10px] text-red-300 hover:text-red-400 ml-auto">Report issue</button>
              )}
            </div>
          )}

          {/* Trade chat */}
          <div>
            <div className="text-[10px] text-white/30 font-semibold mb-2 uppercase tracking-wider">Trade Chat</div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 mb-2 overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              {tradeMessages.length === 0 && <div className="text-center text-white/15 text-xs py-3">No messages yet</div>}
              {tradeMessages.map(m => (
                <div key={m.id} className={`text-xs ${m.is_system ? 'text-center text-white/30 italic py-1' : ''}`}>
                  {m.is_system ? (
                    <span>{m.content}</span>
                  ) : (
                    <div className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] px-3 py-1.5 rounded-xl ${m.sender_id === user?.id ? 'bg-[var(--accent)]/20 text-white' : 'bg-white/5 text-white/70'}`}>
                        {m.content}
                        <div className="text-[9px] text-white/20 mt-0.5">{timeAgo(m.created_at)}</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEnd} />
            </div>
            {isActive && (
              <div className="flex gap-2">
                <input value={msgText} onChange={e => setMsgText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="Message about this trade..."
                  className="input-field flex-1 py-2 text-xs" style={{ fontSize: '16px' }} />
                <button onClick={sendMsg} disabled={!msgText.trim()} className="btn-primary py-2 px-3 text-xs disabled:opacity-30">Send</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
