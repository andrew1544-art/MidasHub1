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

const DELIVERY_OPTIONS = [
  { value: 'instant', label: '⚡ Instant', desc: 'Right away' },
  { value: '10min', label: '10 min', desc: 'Within 10 minutes' },
  { value: '30min', label: '30 min', desc: 'Within 30 minutes' },
  { value: '1hour', label: '1 hour', desc: 'Within 1 hour' },
  { value: '6hours', label: '6 hours', desc: 'Within 6 hours' },
  { value: '24hours', label: '24 hours', desc: 'Within 24 hours' },
  { value: '2days', label: '2 days', desc: 'Within 2 days' },
  { value: '3days', label: '3 days', desc: 'Within 3 days' },
  { value: '1week', label: '1 week', desc: 'Within 1 week' },
  { value: '2weeks', label: '2 weeks', desc: 'Within 2 weeks' },
  { value: 'custom', label: 'Custom', desc: 'I\'ll specify' },
];

// ===== MANDATORY KYC FORM =====
function KYCForm({ onComplete }) {
  const { user, profile, updateProfile, showToast } = useStore();
  const [form, setForm] = useState({ kyc_full_name: profile?.kyc_full_name || '', kyc_phone: profile?.kyc_phone || '', kyc_country: profile?.kyc_country || '', kyc_id_type: profile?.kyc_id_type || '', kyc_id_number: profile?.kyc_id_number || '' });
  const [idPhoto, setIdPhoto] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const idRef = useRef(null);
  const selfieRef = useRef(null);

  const handleSubmit = async () => {
    if (!form.kyc_full_name || !form.kyc_phone || !form.kyc_country || !form.kyc_id_type || !form.kyc_id_number) { setError('All fields are required'); return; }
    if (!idPhoto && !profile?.kyc_id_photo_url) { setError('Upload a photo of your ID — required for trade safety'); return; }
    if (!selfie && !profile?.kyc_selfie_url) { setError('Upload a selfie holding your ID — required for verification'); return; }
    setSaving(true); setError('');
    try {
      const supabase = createClient();
      let idPhotoUrl = profile?.kyc_id_photo_url || '';
      let selfieUrl = profile?.kyc_selfie_url || '';
      if (idPhoto) { const ext = idPhoto.name.split('.').pop(); const path = `kyc/${user.id}/id-${Date.now()}.${ext}`; const { data } = await supabase.storage.from('media').upload(path, idPhoto); if (data) { const { data: u } = supabase.storage.from('media').getPublicUrl(data.path); idPhotoUrl = u.publicUrl; } }
      if (selfie) { const ext = selfie.name.split('.').pop(); const path = `kyc/${user.id}/selfie-${Date.now()}.${ext}`; const { data } = await supabase.storage.from('media').upload(path, selfie); if (data) { const { data: u } = supabase.storage.from('media').getPublicUrl(data.path); selfieUrl = u.publicUrl; } }
      await updateProfile({ ...form, kyc_id_photo_url: idPhotoUrl, kyc_selfie_url: selfieUrl, kyc_status: 'pending', kyc_submitted_at: new Date().toISOString() });
      showToast?.('Identity submitted ✓');
      onComplete?.();
    } catch (e) { setError('Failed. Try again.'); }
    setSaving(false);
  };

  if (profile?.kyc_status === 'verified') { onComplete?.(); return null; }
  if (profile?.kyc_status === 'pending') return (
    <div className="text-center py-4"><div className="text-3xl mb-2">⏳</div><div className="text-sm font-bold text-yellow-400 mb-1">Verification Under Review</div><p className="text-xs text-white/40 mb-3">Your identity has been submitted. You can trade once approved.</p><button onClick={onComplete} className="btn-primary py-2 px-6 text-xs">Continue to Trade →</button></div>
  );

  return (
    <div className="space-y-3">
      <div className="text-center mb-2"><span className="text-3xl">🛡️</span><div className="font-bold text-sm mt-1">Identity Verification Required</div><div className="text-[10px] text-white/30">Both buyer and seller must verify before trading</div></div>
      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 leading-relaxed">⚠️ <strong>MANDATORY:</strong> You must upload your ID and selfie to start any trade. This protects both parties from fraud.</div>
      <input value={form.kyc_full_name} onChange={e => setForm({...form, kyc_full_name: e.target.value})} placeholder="Full legal name *" className="input-field text-sm" style={{ fontSize: '16px' }} />
      <input value={form.kyc_phone} onChange={e => setForm({...form, kyc_phone: e.target.value})} placeholder="Phone with country code *" className="input-field text-sm" style={{ fontSize: '16px' }} type="tel" />
      <select value={form.kyc_country} onChange={e => setForm({...form, kyc_country: e.target.value})} className="input-field text-sm" style={{ fontSize: '16px' }}><option value="">Country *</option>{['Nigeria','Kenya','South Africa','Ghana','United States','United Kingdom','Canada','Germany','France','India','Brazil','Other'].map(c=><option key={c} value={c}>{c}</option>)}</select>
      <select value={form.kyc_id_type} onChange={e => setForm({...form, kyc_id_type: e.target.value})} className="input-field text-sm" style={{ fontSize: '16px' }}><option value="">ID Type *</option><option value="national_id">National ID</option><option value="passport">Passport</option><option value="drivers_license">Driver&apos;s License</option><option value="voters_card">Voter&apos;s Card</option><option value="nin">NIN Slip</option></select>
      <input value={form.kyc_id_number} onChange={e => setForm({...form, kyc_id_number: e.target.value})} placeholder="ID number *" className="input-field text-sm" style={{ fontSize: '16px' }} />
      <div className="grid grid-cols-2 gap-2">
        <div><input type="file" ref={idRef} accept="image/*" className="hidden" onChange={e => setIdPhoto(e.target.files[0])} /><button onClick={() => idRef.current?.click()} className={`w-full p-3 rounded-xl border border-dashed text-center transition ${idPhoto ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/15 hover:bg-white/8'}`}><div className="text-lg mb-0.5">{idPhoto ? '✅' : '📄'}</div><div className="text-[9px] text-white/30">{idPhoto ? 'ID attached ✓' : 'Upload ID photo *'}</div></button></div>
        <div><input type="file" ref={selfieRef} accept="image/*" className="hidden" onChange={e => setSelfie(e.target.files[0])} /><button onClick={() => selfieRef.current?.click()} className={`w-full p-3 rounded-xl border border-dashed text-center transition ${selfie ? 'bg-green-500/10 border-green-500/30' : 'bg-white/5 border-white/15 hover:bg-white/8'}`}><div className="text-lg mb-0.5">{selfie ? '✅' : '🤳'}</div><div className="text-[9px] text-white/30">{selfie ? 'Selfie attached ✓' : 'Selfie holding ID *'}</div></button></div>
      </div>
      {error && <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg">{error}</div>}
      <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full py-2.5 text-sm disabled:opacity-40">{saving ? '⏳ Submitting...' : '🛡️ Submit & Continue'}</button>
    </div>
  );
}

// ===== START TRADE MODAL =====
export function StartTradeButton({ conversationId, otherUserId, onTradeCreated }) {
  const { user, profile, showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('kyc'); // kyc → intro → details
  const [role, setRole] = useState(null);
  const [categories, setCategories] = useState([]);
  const [deliveryEst, setDeliveryEst] = useState('');
  const [customDelivery, setCustomDelivery] = useState('');
  const [form, setForm] = useState({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '', categoryId: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    document.body.style.position = 'fixed'; document.body.style.top = `-${scrollY}px`; document.body.style.width = '100%';
    // Determine first step based on KYC
    if (profile?.kyc_status === 'verified' || profile?.kyc_status === 'pending') setStep('intro');
    else setStep('kyc');
    // Load categories
    (async () => { try { const supabase = createClient(); const { data } = await supabase.from('trade_categories').select('*').eq('is_active', true).order('name'); setCategories(data || []); } catch(e){} })();
    return () => { document.body.style.position = ''; document.body.style.top = ''; document.body.style.width = ''; window.scrollTo(0, scrollY); };
  }, [open, profile]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.amount || parseFloat(form.amount) <= 0) { setError('Title and amount required'); return; }
    if (!role) { setError('Pick your role'); return; }
    if (role === 'seller' && !deliveryEst) { setError('Set an estimated delivery time'); return; }
    setCreating(true); setError('');
    try {
      const supabase = createClient();
      const sellerId = role === 'seller' ? user.id : otherUserId;
      const buyerId = role === 'buyer' ? user.id : otherUserId;
      const delivery = deliveryEst === 'custom' ? customDelivery : (DELIVERY_OPTIONS.find(d => d.value === deliveryEst)?.label || deliveryEst);
      const insertData = { conversation_id: conversationId, seller_id: sellerId, buyer_id: buyerId, title: form.title.trim(), description: form.description.trim() + (delivery ? `\n\n📦 Estimated delivery: ${delivery}` : ''), amount: parseFloat(form.amount), currency: form.currency, payment_method: form.paymentMethod.trim() };
      if (form.categoryId) insertData.category_id = form.categoryId;
      const { data, error: err } = await supabase.from('trades').insert(insertData).select().single();
      if (err) { setError(err.message); setCreating(false); return; }
      await supabase.from('trade_messages').insert({ trade_id: data.id, content: `🔒 Trade created: "${form.title}" for ${form.currency} ${parseFloat(form.amount).toFixed(2)} (+2% escrow)\n📦 Delivery: ${delivery}\nWaiting for ${role === 'seller' ? 'buyer' : 'seller'} to accept.`, is_system: true });
      sendNotification({ toUserId: otherUserId, fromUserId: user.id, type: 'system', content: `wants to trade: "${form.title}" — ${form.currency} ${parseFloat(form.amount).toFixed(2)} (${delivery} delivery)` });
      setOpen(false); setForm({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '', categoryId: '' }); setRole(null); setDeliveryEst(''); setStep('kyc');
      showToast?.('Trade created ✓');
      onTradeCreated?.();
    } catch (e) { setError('Failed'); }
    setCreating(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition">🔒 Trade</button>
  );

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal-content max-w-md p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">🔒 New Trade</h3>
          <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white text-sm">✕</button>
        </div>

        {step === 'kyc' && <KYCForm onComplete={() => setStep('intro')} />}

        {step === 'intro' && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300 leading-relaxed">⚠️ <strong>Escrow Protection:</strong> Payment held until buyer confirms. <strong>2% fee</strong> for safety. Both parties must verify identity.</div>
            {profile?.kyc_status === 'verified' && <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">✅ Your identity is verified</div>}
            {profile?.kyc_status === 'pending' && <div className="flex items-center gap-1.5 text-xs text-yellow-400 font-semibold">⏳ Identity verification pending</div>}

            <div>
              <div className="text-sm font-semibold mb-2">What&apos;s your position in this trade?</div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setRole('seller')} className={`p-4 rounded-xl border transition text-center ${role === 'seller' ? 'bg-green-500/10 border-green-500/30' : 'bg-white/3 border-white/10'}`}><div className="text-3xl mb-1.5">🏪</div><div className="text-sm font-bold">I&apos;m Selling</div><div className="text-[10px] text-white/30 mt-0.5">I have goods/services</div></button>
                <button onClick={() => setRole('buyer')} className={`p-4 rounded-xl border transition text-center ${role === 'buyer' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/3 border-white/10'}`}><div className="text-3xl mb-1.5">🛒</div><div className="text-sm font-bold">I&apos;m Buying</div><div className="text-[10px] text-white/30 mt-0.5">I want to purchase</div></button>
              </div>
            </div>

            <div><div className="text-sm font-semibold mb-1.5">What do you want to trade?</div><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., iPhone 15, Logo Design, Gaming Account..." className="input-field text-sm" style={{ fontSize: '16px' }} /></div>
            <div><div className="text-sm font-semibold mb-1.5">Brief description</div><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Condition, what's included, delivery method..." className="input-field text-sm resize-none h-20" style={{ fontSize: '16px' }} /></div>

            {error && <div className="text-xs text-red-400 text-center">{error}</div>}
            <button onClick={() => { if (!role) { setError('Pick your role'); return; } if (!form.title.trim()) { setError('Describe what you\'re trading'); return; } setError(''); setStep('details'); }} disabled={!role || !form.title.trim()} className="btn-primary w-full py-3 text-sm disabled:opacity-30">Continue → Set Price & Delivery</button>
          </div>
        )}

        {step === 'details' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm mb-1">
              <span>{role === 'seller' ? '🏪' : '🛒'}</span>
              <span className="text-white/50">You&apos;re the <strong className="text-white">{role}</strong> of</span>
              <span className="font-bold truncate flex-1">{form.title}</span>
              <button onClick={() => setStep('intro')} className="text-[var(--accent)] text-xs shrink-0">← Back</button>
            </div>

            {categories.length > 0 && (
              <div><div className="text-xs text-white/40 mb-1.5">Category</div><div className="flex flex-wrap gap-1.5">{categories.map(c => (<button key={c.id} onClick={() => setForm({...form, categoryId: c.id})} className={`platform-pill text-[11px] ${form.categoryId === c.id ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>{c.icon} {c.name}</button>))}</div></div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/40 mb-1 block">Amount *</label><input type="number" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0.00" className="input-field text-sm" style={{ fontSize: '16px' }} min="0" step="0.01" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Currency</label><select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="input-field text-sm" style={{ fontSize: '16px' }}><option value="USD">USD ($)</option><option value="EUR">EUR (€)</option><option value="GBP">GBP (£)</option><option value="NGN">NGN (₦)</option><option value="KES">KES (KSh)</option><option value="BTC">BTC (₿)</option><option value="USDT">USDT</option></select></div>
            </div>

            {form.amount && parseFloat(form.amount) > 0 && (
              <div className="p-3 rounded-lg bg-white/3 text-sm space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-white/40">Price</span><span>{form.currency} {parseFloat(form.amount).toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Escrow (2%)</span><span className="text-yellow-400">{form.currency} {(parseFloat(form.amount) * 0.02).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t border-white/5 pt-1.5"><span>Buyer total</span><span className="text-[var(--accent)]">{form.currency} {(parseFloat(form.amount) * 1.02).toFixed(2)}</span></div>
              </div>
            )}

            <input value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})} placeholder="Payment: Bank, PayPal, M-Pesa, Crypto..." className="input-field text-sm" style={{ fontSize: '16px' }} />

            {/* Delivery estimate — only for sellers */}
            {role === 'seller' && (
              <div>
                <div className="text-sm font-semibold mb-1.5">📦 Estimated Delivery Time *</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {DELIVERY_OPTIONS.map(d => (
                    <button key={d.value} onClick={() => setDeliveryEst(d.value)}
                      className={`px-2 py-2 rounded-lg text-xs text-center transition ${deliveryEst === d.value ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 font-bold' : 'bg-white/5 text-white/40 border border-white/5'}`}>
                      {d.label}
                    </button>
                  ))}
                </div>
                {deliveryEst === 'custom' && (
                  <input value={customDelivery} onChange={e => setCustomDelivery(e.target.value)} placeholder="e.g., 5 business days, after payment clears..." className="input-field text-sm mt-2" style={{ fontSize: '16px' }} />
                )}
              </div>
            )}

            {/* Buyers see a note */}
            {role === 'buyer' && (
              <div className="p-2.5 rounded-lg bg-blue-500/8 border border-blue-500/15 text-[10px] text-blue-300/70">ℹ️ The seller will set the estimated delivery time when they accept.</div>
            )}

            {error && <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg">{error}</div>}
            <button onClick={handleCreate} disabled={creating || !form.amount || (role === 'seller' && !deliveryEst)} className="btn-primary w-full py-3 text-sm disabled:opacity-30 flex items-center justify-center gap-2">{creating ? '⏳ Creating...' : '🔒 Create Trade'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===== TRADE CARD =====
export function TradeCard({ trade, onUpdate }) {
  const { user, showToast } = useStore();
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
    const load = async () => { const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('trade_id', trade.id).order('created_at', { ascending: true }); setTradeMessages(data || []); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100); };
    load();
    const ch = supabase.channel(`trade-${trade.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `trade_id=eq.${trade.id}` }, async (p) => { try { const { data } = await supabase.from('trade_messages').select('*, profiles(*)').eq('id', p.new.id).maybeSingle(); if (data) { setTradeMessages(prev => [...prev, data]); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50); } } catch(e){} }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [expanded, trade.id]);

  const sendMsg = async () => { if (!msgText.trim()) return; const supabase = createClient(); await supabase.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: msgText.trim() }); setMsgText(''); };

  const updateStatus = async (newStatus) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const updateData = { status: newStatus };
      if (newStatus === 'disputed') { const reason = prompt('Describe the issue:'); if (!reason) { setLoading(false); return; } updateData.dispute_reason = reason; updateData.dispute_by = user.id; }
      await supabase.from('trades').update(updateData).eq('id', trade.id);
      const otherUserId = isSeller ? trade.buyer_id : trade.seller_id;
      const msgs = { accepted:'accepted the trade 🤝', paid:'marked payment sent 💰', delivered:'marked delivered 📦', completed:'confirmed receipt 🎉', disputed:'raised a dispute ⚠️', cancelled:'cancelled the trade' };
      sendNotification({ toUserId: otherUserId, fromUserId: user.id, type: 'system', content: `Trade "${trade.title}": ${msgs[newStatus] || newStatus}` });
      onUpdate?.();
    } catch (e) { showToast?.('Failed'); }
    setLoading(false);
  };

  const inviteAdmin = async () => {
    const supabase = createClient();
    try {
      await supabase.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: '🛡️ Requesting admin assistance. An administrator will review this trade.' });
      // Also update trade with admin_requested flag
      await supabase.from('trades').update({ dispute_reason: (trade.dispute_reason || '') + '\n[Admin requested by user]', admin_note: 'ADMIN REVIEW REQUESTED' }).eq('id', trade.id);
      showToast?.('Admin notified — they will review this trade');
      onUpdate?.();
    } catch (e) { showToast?.('Failed to request admin'); }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${config.color}30`, background: `${config.color}05` }}>
      <button onClick={() => setExpanded(!expanded)} className="w-full text-left p-3 flex items-center gap-3">
        <span className="text-xl">{config.icon}</span>
        <div className="flex-1 min-w-0"><div className="font-bold text-sm truncate">{trade.title}</div><div className="flex items-center gap-2 mt-0.5"><span className="text-xs font-semibold" style={{ color: config.color }}>{config.label}</span><span className="text-[10px] text-white/20">•</span><span className="text-xs text-white/30">{trade.currency} {parseFloat(trade.amount).toFixed(2)}</span></div></div>
        <div className="text-white/20 text-sm shrink-0">{expanded ? '▲' : '▼'}</div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {isActive && <div className="flex gap-1">{STEPS.map((s,i)=>(<div key={i} className="flex-1"><div className="h-1.5 rounded-full" style={{background:i<config.step?config.color:'rgba(255,255,255,0.05)'}}/><div className="text-[8px] text-white/20 text-center mt-0.5">{s}</div></div>))}</div>}

          <div className="p-2.5 rounded-lg bg-white/3 text-xs space-y-1.5">
            {trade.description && <div className="text-white/50 mb-2 whitespace-pre-wrap">{trade.description}</div>}
            <div className="flex justify-between"><span className="text-white/30">Price</span><span>{trade.currency} {parseFloat(trade.amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Escrow (2%)</span><span className="text-yellow-400">{trade.currency} {(parseFloat(trade.amount)*0.02).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold"><span>Total</span><span className="text-[var(--accent)]">{trade.currency} {(parseFloat(trade.amount)*1.02).toFixed(2)}</span></div>
            {trade.payment_method && <div className="flex justify-between"><span className="text-white/30">Payment</span><span>{trade.payment_method}</span></div>}
            <div className="flex justify-between"><span className="text-white/30">Your role</span><span className="font-semibold">{isSeller?'🏪 Seller':'🛒 Buyer'}</span></div>
          </div>

          <div className="p-2 rounded-lg bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/70">🔒 Escrow protected. Never share banking details.</div>

          {/* Action buttons */}
          {isActive && (
            <div className="flex flex-wrap gap-2">
              {trade.status==='pending'&&isBuyer&&<><button onClick={()=>updateStatus('accepted')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">🤝 Accept</button><button onClick={()=>updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">Cancel</button></>}
              {trade.status==='pending'&&isSeller&&<button onClick={()=>updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">Cancel</button>}
              {trade.status==='accepted'&&isBuyer&&<button onClick={()=>updateStatus('paid')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">💰 I&apos;ve Paid</button>}
              {trade.status==='paid'&&isSeller&&<button onClick={()=>updateStatus('delivered')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">📦 Delivered</button>}
              {trade.status==='delivered'&&isBuyer&&<><button onClick={()=>updateStatus('completed')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">✅ Confirm</button><button onClick={()=>updateStatus('disputed')} disabled={loading} className="text-xs text-red-400 px-3 py-2 bg-red-500/10 rounded-lg">⚠️ Dispute</button></>}
              {['paid','delivered'].includes(trade.status)&&<button onClick={()=>updateStatus('disputed')} disabled={loading} className="text-[10px] text-red-300 ml-auto">Report issue</button>}
            </div>
          )}

          {/* Invite Admin button — always visible on active trades */}
          {isActive && (
            <button onClick={inviteAdmin} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/8 border border-blue-500/15 text-blue-300 text-xs hover:bg-blue-500/15 transition">
              🛡️ Invite Administrator
            </button>
          )}

          {/* Trade chat */}
          <div>
            <div className="text-[10px] text-white/30 font-semibold mb-2 uppercase">Trade Chat</div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 mb-2 overscroll-contain">
              {tradeMessages.length===0&&<div className="text-center text-white/15 text-xs py-3">No messages</div>}
              {tradeMessages.map(m=>(<div key={m.id} className={`text-xs ${m.is_system?'text-center text-white/30 italic py-1':''}`}>{m.is_system?<span>{m.content}</span>:(<div className={`flex ${m.sender_id===user?.id?'justify-end':'justify-start'}`}><div className={`max-w-[80%] px-3 py-1.5 rounded-xl ${m.sender_id===user?.id?'bg-[var(--accent)]/20 text-white':'bg-white/5 text-white/70'}`}>{m.content}<div className="text-[9px] text-white/20 mt-0.5">{timeAgo(m.created_at)}</div></div></div>)}</div>))}
              <div ref={messagesEnd}/>
            </div>
            {isActive&&<div className="flex gap-2"><input value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()} placeholder="Trade message..." className="input-field flex-1 py-2 text-xs" style={{fontSize:'16px'}}/><button onClick={sendMsg} disabled={!msgText.trim()} className="btn-primary py-2 px-3 text-xs disabled:opacity-30">Send</button></div>}
          </div>
        </div>
      )}
    </div>
  );
}
