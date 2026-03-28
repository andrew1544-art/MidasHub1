'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { sendNotification } from '@/lib/notifications';
import { timeAgo } from '@/lib/constants';

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

// ===== KYC VERIFICATION FORM =====
function KYCForm({ onComplete }) {
  const { user, profile, updateProfile, showToast } = useStore();
  const [form, setForm] = useState({
    kyc_full_name: profile?.kyc_full_name || '',
    kyc_phone: profile?.kyc_phone || '',
    kyc_country: profile?.kyc_country || '',
    kyc_id_type: profile?.kyc_id_type || '',
    kyc_id_number: profile?.kyc_id_number || '',
  });
  const [idPhoto, setIdPhoto] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const idRef = useRef(null);
  const selfieRef = useRef(null);

  const handleSubmit = async () => {
    if (!form.kyc_full_name || !form.kyc_phone || !form.kyc_country || !form.kyc_id_type || !form.kyc_id_number) {
      setError('All fields are required for verification'); return;
    }
    setSaving(true); setError('');
    try {
      const supabase = createClient();
      let idPhotoUrl = profile?.kyc_id_photo_url || '';
      let selfieUrl = profile?.kyc_selfie_url || '';

      // Upload ID photo
      if (idPhoto) {
        const ext = idPhoto.name.split('.').pop();
        const path = `kyc/${user.id}/id-${Date.now()}.${ext}`;
        const { data } = await supabase.storage.from('media').upload(path, idPhoto);
        if (data) { const { data: u } = supabase.storage.from('media').getPublicUrl(data.path); idPhotoUrl = u.publicUrl; }
      }
      // Upload selfie
      if (selfie) {
        const ext = selfie.name.split('.').pop();
        const path = `kyc/${user.id}/selfie-${Date.now()}.${ext}`;
        const { data } = await supabase.storage.from('media').upload(path, selfie);
        if (data) { const { data: u } = supabase.storage.from('media').getPublicUrl(data.path); selfieUrl = u.publicUrl; }
      }

      await updateProfile({
        ...form,
        kyc_id_photo_url: idPhotoUrl,
        kyc_selfie_url: selfieUrl,
        kyc_status: 'pending',
        kyc_submitted_at: new Date().toISOString(),
      });

      showToast?.('Verification submitted! You can trade while we review.');
      onComplete?.();
    } catch (e) { setError('Failed to submit. Try again.'); }
    setSaving(false);
  };

  if (profile?.kyc_status === 'pending') {
    return (
      <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <div className="text-sm font-bold text-yellow-400 mb-1">Verification Pending</div>
        <p className="text-xs text-white/40">Your identity is being reviewed. You can still start trades — the other party will see your verification status.</p>
        <button onClick={onComplete} className="btn-primary mt-3 py-2 px-4 text-xs">Continue to Trade →</button>
      </div>
    );
  }

  if (profile?.kyc_status === 'verified') {
    onComplete?.();
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🛡️</span>
        <div>
          <div className="font-bold text-sm">Identity Verification Required</div>
          <div className="text-[10px] text-white/30">We need to verify your identity to protect both parties in a trade</div>
        </div>
      </div>

      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
        🔒 Your details are encrypted and only visible to MidasHub admins for dispute resolution. We never share your info with other users.
      </div>

      <input value={form.kyc_full_name} onChange={e => setForm({...form, kyc_full_name: e.target.value})}
        placeholder="Full legal name" className="input-field text-sm" style={{ fontSize: '16px' }} />

      <input value={form.kyc_phone} onChange={e => setForm({...form, kyc_phone: e.target.value})}
        placeholder="Phone number (with country code)" className="input-field text-sm" style={{ fontSize: '16px' }} type="tel" />

      <select value={form.kyc_country} onChange={e => setForm({...form, kyc_country: e.target.value})}
        className="input-field text-sm" style={{ fontSize: '16px' }}>
        <option value="">Select country</option>
        {['Nigeria','Kenya','South Africa','Ghana','United States','United Kingdom','Canada','Germany','France','India','Brazil','Mexico','Australia','Other'].map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      <select value={form.kyc_id_type} onChange={e => setForm({...form, kyc_id_type: e.target.value})}
        className="input-field text-sm" style={{ fontSize: '16px' }}>
        <option value="">Select ID type</option>
        <option value="national_id">National ID Card</option>
        <option value="passport">Passport</option>
        <option value="drivers_license">Driver&apos;s License</option>
        <option value="voters_card">Voter&apos;s Card</option>
        <option value="nin">NIN Slip</option>
      </select>

      <input value={form.kyc_id_number} onChange={e => setForm({...form, kyc_id_number: e.target.value})}
        placeholder="ID number" className="input-field text-sm" style={{ fontSize: '16px' }} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <input type="file" ref={idRef} accept="image/*" className="hidden" onChange={e => setIdPhoto(e.target.files[0])} />
          <button onClick={() => idRef.current?.click()}
            className="w-full p-3 rounded-xl bg-white/5 border border-dashed border-white/15 text-center hover:bg-white/8 transition">
            <div className="text-lg mb-1">{idPhoto ? '✅' : '📄'}</div>
            <div className="text-[10px] text-white/40">{idPhoto ? idPhoto.name.slice(0, 15) : 'Upload ID photo'}</div>
          </button>
        </div>
        <div>
          <input type="file" ref={selfieRef} accept="image/*" className="hidden" onChange={e => setSelfie(e.target.files[0])} />
          <button onClick={() => selfieRef.current?.click()}
            className="w-full p-3 rounded-xl bg-white/5 border border-dashed border-white/15 text-center hover:bg-white/8 transition">
            <div className="text-lg mb-1">{selfie ? '✅' : '🤳'}</div>
            <div className="text-[10px] text-white/40">{selfie ? selfie.name.slice(0, 15) : 'Upload selfie with ID'}</div>
          </button>
        </div>
      </div>

      {error && <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded-lg">{error}</div>}

      <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">
        {saving ? '⏳ Submitting...' : '🛡️ Submit Verification'}
      </button>
      <p className="text-[9px] text-white/15 text-center">Photos of ID are optional but speed up verification and build trust</p>
    </div>
  );
}

// ===== START TRADE BUTTON =====
export function StartTradeButton({ conversationId, otherUserId, onTradeCreated }) {
  const { user, profile } = useStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('kyc'); // 'kyc' | 'role' | 'details'
  const [role, setRole] = useState(null);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '', categoryId: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // Check KYC status on open
  useEffect(() => {
    if (open) {
      if (profile?.kyc_status === 'verified' || profile?.kyc_status === 'pending') {
        setStep('role');
      } else {
        setStep('kyc');
      }
      // Load categories
      const load = async () => {
        try {
          const supabase = createClient();
          const { data } = await supabase.from('trade_categories').select('*').eq('is_active', true).order('name');
          setCategories(data || []);
        } catch (e) {} // table might not exist
      };
      load();
    }
  }, [open, profile]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      setError('Title and valid amount are required'); return;
    }
    setCreating(true); setError('');
    try {
      const supabase = createClient();
      const sellerId = role === 'seller' ? user.id : otherUserId;
      const buyerId = role === 'buyer' ? user.id : otherUserId;
      const insertData = {
        conversation_id: conversationId, seller_id: sellerId, buyer_id: buyerId,
        title: form.title.trim(), description: form.description.trim(),
        amount: parseFloat(form.amount), currency: form.currency, payment_method: form.paymentMethod.trim(),
      };
      if (form.categoryId) insertData.category_id = form.categoryId;

      const { data, error: insertErr } = await supabase.from('trades').insert(insertData).select().single();
      if (insertErr) { setError(insertErr.message); setCreating(false); return; }

      await supabase.from('trade_messages').insert({
        trade_id: data.id,
        content: `🔒 Trade created: "${form.title}" for ${form.currency} ${parseFloat(form.amount).toFixed(2)} (+ 2% escrow fee). Waiting for ${role === 'seller' ? 'buyer' : 'seller'} to accept.`,
        is_system: true,
      });

      sendNotification({ toUserId: otherUserId, fromUserId: user.id, type: 'system', content: `started a trade: "${form.title}" — ${form.currency} ${parseFloat(form.amount).toFixed(2)}` });

      setOpen(false); setForm({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '', categoryId: '' }); setRole(null);
      onTradeCreated?.();
    } catch (e) { setError('Failed to create trade'); }
    setCreating(false);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition">
        🔒 Trade
      </button>
    );
  }

  return (
    <div className="glass-light rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm">🔒 New Trade</h4>
        <button onClick={() => setOpen(false)} className="text-white/30 hover:text-white/60 text-sm">✕</button>
      </div>

      {/* KYC Step */}
      {step === 'kyc' && <KYCForm onComplete={() => setStep('role')} />}

      {/* Role Selection */}
      {step === 'role' && (
        <>
          {/* Verification badge */}
          <div className="flex items-center gap-2 text-xs">
            {profile?.kyc_status === 'verified' ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-semibold">✅ Verified</span>
            ) : profile?.kyc_status === 'pending' ? (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-semibold">⏳ Verification pending</span>
            ) : null}
          </div>

          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300 leading-relaxed">
            ⚠️ <strong>Trade Protection:</strong> MidasHub holds payment until buyer confirms delivery. <strong>2% escrow fee</strong> for your safety.
          </div>

          <div className="text-xs text-white/40 mb-1">What&apos;s your role in this trade?</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setRole('seller'); setStep('details'); }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-green-500/30 hover:bg-green-500/5 transition text-center">
              <div className="text-3xl mb-1">🏪</div>
              <div className="text-sm font-bold">I&apos;m Selling</div>
              <div className="text-[10px] text-white/30 mt-0.5">I have goods/services</div>
            </button>
            <button onClick={() => { setRole('buyer'); setStep('details'); }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 transition text-center">
              <div className="text-3xl mb-1">🛒</div>
              <div className="text-sm font-bold">I&apos;m Buying</div>
              <div className="text-[10px] text-white/30 mt-0.5">I want to purchase</div>
            </button>
          </div>
        </>
      )}

      {/* Trade Details */}
      {step === 'details' && (
        <>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>{role === 'seller' ? '🏪' : '🛒'}</span>
            <span>You are the <strong className="text-white/70">{role}</strong></span>
            <button onClick={() => setStep('role')} className="text-[var(--accent)] ml-auto text-[10px]">← Back</button>
          </div>

          {/* Category selector */}
          {categories.length > 0 && (
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Category</label>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(c => (
                  <button key={c.id} onClick={() => setForm({...form, categoryId: c.id})}
                    className={`platform-pill text-[11px] ${form.categoryId === c.id ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
            placeholder="What are you trading? (e.g., iPhone 15, Logo Design)"
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
                <option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option>
                <option value="NGN">NGN (₦)</option><option value="KES">KES (KSh)</option><option value="BTC">BTC (₿)</option><option value="USDT">USDT</option>
              </select>
            </div>
          </div>

          {form.amount && parseFloat(form.amount) > 0 && (
            <div className="p-2.5 rounded-lg bg-white/3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-white/40">Item price</span><span>{form.currency} {parseFloat(form.amount).toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-white/40">Escrow fee (2%)</span><span className="text-yellow-400">{form.currency} {(parseFloat(form.amount) * 0.02).toFixed(2)}</span></div>
              <div className="flex justify-between font-bold border-t border-white/5 pt-1"><span>Buyer pays total</span><span className="text-[var(--accent)]">{form.currency} {(parseFloat(form.amount) * 1.02).toFixed(2)}</span></div>
            </div>
          )}

          <input value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}
            placeholder="Payment method: Bank, PayPal, Crypto, M-Pesa..."
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

// ===== TRADE CARD =====
export function TradeCard({ trade, onUpdate }) {
  const { user, profile, showToast } = useStore();
  const [tradeMessages, setTradeMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);
  const isSeller = user?.id === trade.seller_id;
  const isBuyer = user?.id === trade.buyer_id;
  const config = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pending;
  const isActive = !['completed', 'cancelled', 'resolved'].includes(trade.status);

  useEffect(() => {
    if (!expanded) return;
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('trade_id', trade.id).order('created_at', { ascending: true });
      setTradeMessages(data || []);
      setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };
    load();
    const ch = supabase.channel(`trade-${trade.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `trade_id=eq.${trade.id}` }, async (p) => {
        try { const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('id', p.new.id).maybeSingle(); if (data) { setTradeMessages(prev => [...prev, data]); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50); } } catch (e) {}
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [expanded, trade.id]);

  const sendMsg = async () => {
    if (!msgText.trim()) return;
    const supabase = createClient();
    await supabase.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: msgText.trim() });
    setMsgText('');
  };

  const updateStatus = async (newStatus) => {
    setLoading(true);
    try {
      const supabase = createClient();
      await supabase.from('trades').update({ status: newStatus }).eq('id', trade.id);
      const otherUserId = isSeller ? trade.buyer_id : trade.seller_id;
      const msgs = { accepted: 'accepted the trade 🤝', paid: 'marked payment as sent 💰', delivered: 'marked as delivered 📦', completed: 'confirmed receipt — trade complete! 🎉', disputed: 'raised a dispute ⚠️', cancelled: 'cancelled the trade' };
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
      const supabase = createClient();
      await supabase.from('trades').update({ status: 'disputed', dispute_reason: reason, dispute_by: user.id }).eq('id', trade.id);
      await supabase.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: `⚠️ Dispute raised: ${reason}` });
      onUpdate?.();
    } catch (e) {}
    setLoading(false);
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${config.color}30`, background: `${config.color}05` }}>
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
          {isActive && (
            <div className="flex gap-1">
              {STEPS.map((s, i) => (
                <div key={i} className="flex-1">
                  <div className="h-1.5 rounded-full transition-all" style={{ background: i < config.step ? config.color : 'rgba(255,255,255,0.05)' }} />
                  <div className="text-[8px] text-white/20 text-center mt-0.5">{s}</div>
                </div>
              ))}
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-white/3 text-xs space-y-1.5">
            {trade.description && <div className="text-white/50 mb-2">{trade.description}</div>}
            <div className="flex justify-between"><span className="text-white/30">Price</span><span>{trade.currency} {parseFloat(trade.amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Escrow (2%)</span><span className="text-yellow-400">{trade.currency} {(parseFloat(trade.amount) * 0.02).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-[var(--accent)]">{trade.currency} {(parseFloat(trade.amount) * 1.02).toFixed(2)}</span></div>
            {trade.payment_method && <div className="flex justify-between"><span className="text-white/30">Payment</span><span>{trade.payment_method}</span></div>}
            <div className="flex justify-between"><span className="text-white/30">Your role</span><span className="font-semibold">{isSeller ? '🏪 Seller' : '🛒 Buyer'}</span></div>
          </div>

          <div className="p-2.5 rounded-lg bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/70 leading-relaxed">
            🔒 <strong>Escrow Protected:</strong> Funds held until buyer confirms. Never share banking details. Report issues immediately.
          </div>

          {isActive && (
            <div className="flex flex-wrap gap-2">
              {trade.status === 'pending' && isBuyer && <>
                <button onClick={() => updateStatus('accepted')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">🤝 Accept Trade</button>
                <button onClick={() => updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">Cancel</button>
              </>}
              {trade.status === 'pending' && isSeller && <button onClick={() => updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">Cancel Trade</button>}
              {trade.status === 'accepted' && isBuyer && <button onClick={() => updateStatus('paid')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">💰 I&apos;ve Paid</button>}
              {trade.status === 'paid' && isSeller && <button onClick={() => updateStatus('delivered')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">📦 Mark Delivered</button>}
              {trade.status === 'delivered' && isBuyer && <>
                <button onClick={() => updateStatus('completed')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">✅ Confirm Received</button>
                <button onClick={disputeTrade} disabled={loading} className="text-xs text-red-400 px-3 py-2 bg-red-500/10 rounded-lg">⚠️ Dispute</button>
              </>}
              {['paid', 'delivered'].includes(trade.status) && <button onClick={disputeTrade} disabled={loading} className="text-[10px] text-red-300 hover:text-red-400 ml-auto">Report issue</button>}
            </div>
          )}

          {/* Trade chat */}
          <div>
            <div className="text-[10px] text-white/30 font-semibold mb-2 uppercase tracking-wider">Trade Chat</div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 mb-2 overscroll-contain">
              {tradeMessages.length === 0 && <div className="text-center text-white/15 text-xs py-3">No messages yet</div>}
              {tradeMessages.map(m => (
                <div key={m.id} className={`text-xs ${m.is_system ? 'text-center text-white/30 italic py-1' : ''}`}>
                  {m.is_system ? <span>{m.content}</span> : (
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
                  placeholder="Message about this trade..." className="input-field flex-1 py-2 text-xs" style={{ fontSize: '16px' }} />
                <button onClick={sendMsg} disabled={!msgText.trim()} className="btn-primary py-2 px-3 text-xs disabled:opacity-30">Send</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
