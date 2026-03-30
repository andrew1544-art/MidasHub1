'use client';
import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { sendNotification, alertAdmins } from '@/lib/notifications';
import { timeAgo } from '@/lib/constants';
import { compressImage } from '@/lib/media';

const STATUS_CONFIG = {
  pending:   { label: 'Waiting for acceptance', color: '#f59e0b', icon: '⏳', step: 1 },
  accepted:  { label: 'Accepted — pay now', color: '#3b82f6', icon: '🤝', step: 2 },
  paid:      { label: 'Paid — awaiting delivery', color: '#8b5cf6', icon: '💰', step: 3 },
  delivered: { label: 'Delivered — confirm receipt', color: '#f97316', icon: '📦', step: 4 },
  completed: { label: 'Completed ✓', color: '#22c55e', icon: '🎉', step: 5 },
  disputed:  { label: 'Disputed ⚠️', color: '#ef4444', icon: '⚠️', step: 0 },
  resolved:  { label: 'Resolved', color: '#6b7280', icon: '⚖️', step: 0 },
  cancelled: { label: 'Cancelled', color: '#6b7280', icon: '❌', step: 0 },
};
const STEPS = ['Proposed','Accepted','Paid','Delivered','Complete'];
const DELIVERY_OPTIONS = [
  {value:'instant',label:'⚡ Instant'},{value:'10min',label:'10 min'},{value:'30min',label:'30 min'},
  {value:'1hour',label:'1 hour'},{value:'6hours',label:'6 hours'},{value:'24hours',label:'24 hours'},
  {value:'2days',label:'2 days'},{value:'3days',label:'3 days'},{value:'1week',label:'1 week'},
  {value:'2weeks',label:'2 weeks'},{value:'custom',label:'Custom'},
];

// ===== KYC FORM =====
function KYCForm({ onComplete }) {
  const { user, profile, updateProfile, showToast } = useStore();
  const [form, setForm] = useState({ kyc_full_name:profile?.kyc_full_name||'', kyc_phone:profile?.kyc_phone||'', kyc_country:profile?.kyc_country||'', kyc_id_type:profile?.kyc_id_type||'', kyc_id_number:profile?.kyc_id_number||'' });
  const [idPhoto, setIdPhoto] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const idRef = useRef(null);
  const selfieRef = useRef(null);

  const submit = async () => {
    if (!form.kyc_full_name||!form.kyc_phone||!form.kyc_country||!form.kyc_id_type||!form.kyc_id_number) { setError('All fields are required'); return; }
    if (!idPhoto && !profile?.kyc_id_photo_url) { setError('Upload a photo of your ID'); return; }
    if (!selfie && !profile?.kyc_selfie_url) { setError('Upload a selfie holding your ID'); return; }
    setSaving(true); setError('');
    try {
      const sb = createClient();
      let idUrl = profile?.kyc_id_photo_url || '';
      let selfUrl = profile?.kyc_selfie_url || '';
      if (idPhoto) { const compressed = await compressImage(idPhoto); const p = `kyc/${user.id}/id-${Date.now()}.jpg`; const { data } = await sb.storage.from('media').upload(p, compressed, { contentType: 'image/jpeg' }); if (data) { const { data: u } = sb.storage.from('media').getPublicUrl(data.path); idUrl = u.publicUrl; } }
      if (selfie) { const compressed = await compressImage(selfie); const p = `kyc/${user.id}/self-${Date.now()}.jpg`; const { data } = await sb.storage.from('media').upload(p, compressed, { contentType: 'image/jpeg' }); if (data) { const { data: u } = sb.storage.from('media').getPublicUrl(data.path); selfUrl = u.publicUrl; } }
      await updateProfile({ ...form, kyc_id_photo_url: idUrl, kyc_selfie_url: selfUrl, kyc_status: 'pending', kyc_submitted_at: new Date().toISOString() });
      showToast?.('Identity submitted ✓');
      alertAdmins({ fromUserId: user.id, type: 'system', content: `🛡️ KYC from ${profile?.display_name || 'a user'} — needs review` });
      onComplete?.();
    } catch(e) { setError('Upload failed. Try again.'); }
    setSaving(false);
  };

  if (profile?.kyc_status === 'verified') { onComplete?.(); return null; }
  if (profile?.kyc_status === 'pending') return (
    <div className="text-center py-4">
      <div className="text-3xl mb-2">⏳</div>
      <div className="text-sm font-bold text-yellow-400 mb-1">Verification Pending</div>
      <p className="text-xs text-white/40 mb-3">Your ID is being reviewed. You can continue while we verify.</p>
      <button onClick={onComplete} className="btn-primary py-2 px-6 text-xs">Continue →</button>
    </div>
  );
  if (profile?.kyc_status === 'rejected') return (
    <div className="text-center py-4">
      <div className="text-3xl mb-2">❌</div>
      <div className="text-sm font-bold text-red-400 mb-1">Verification Declined</div>
      <p className="text-xs text-white/40 mb-2">Reason: {profile?.kyc_admin_note || 'Documents not clear'}</p>
      <p className="text-xs text-white/30 mb-3">Please resubmit with clearer documents.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="text-center mb-2"><div className="text-3xl mb-1">🛡️</div><div className="text-sm font-bold">Verify Your Identity</div><p className="text-xs text-white/30">Required for trading. Your info is private.</p></div>
      <input value={form.kyc_full_name} onChange={e=>setForm({...form,kyc_full_name:e.target.value})} placeholder="Full Legal Name" className="input-field text-sm" style={{fontSize:'16px'}}/>
      <input value={form.kyc_phone} onChange={e=>setForm({...form,kyc_phone:e.target.value})} placeholder="Phone Number" className="input-field text-sm" style={{fontSize:'16px'}}/>
      <input value={form.kyc_country} onChange={e=>setForm({...form,kyc_country:e.target.value})} placeholder="Country" className="input-field text-sm" style={{fontSize:'16px'}}/>
      <div className="grid grid-cols-2 gap-2">
        <select value={form.kyc_id_type} onChange={e=>setForm({...form,kyc_id_type:e.target.value})} className="input-field text-sm" style={{fontSize:'16px'}}>
          <option value="">ID Type</option><option value="passport">Passport</option><option value="national_id">National ID</option><option value="drivers_license">Driver&apos;s License</option><option value="voter_id">Voter ID</option>
        </select>
        <input value={form.kyc_id_number} onChange={e=>setForm({...form,kyc_id_number:e.target.value})} placeholder="ID Number" className="input-field text-sm" style={{fontSize:'16px'}}/>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><input type="file" ref={idRef} accept="image/*" className="hidden" onChange={e=>setIdPhoto(e.target.files[0])}/><button onClick={()=>idRef.current?.click()} className={`w-full py-3 rounded-xl border text-center text-xs ${idPhoto||profile?.kyc_id_photo_url?'border-green-500/30 bg-green-500/10 text-green-400':'border-white/10 bg-white/3 text-white/40'}`}>{idPhoto?'✅ ID Photo':'📄 Upload ID Photo'}</button></div>
        <div><input type="file" ref={selfieRef} accept="image/*" className="hidden" onChange={e=>setSelfie(e.target.files[0])}/><button onClick={()=>selfieRef.current?.click()} className={`w-full py-3 rounded-xl border text-center text-xs ${selfie||profile?.kyc_selfie_url?'border-green-500/30 bg-green-500/10 text-green-400':'border-white/10 bg-white/3 text-white/40'}`}>{selfie?'✅ Selfie':'🤳 Selfie with ID'}</button></div>
      </div>
      {error && <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg">{error}</div>}
      <button onClick={submit} disabled={saving} className="btn-primary w-full py-3 text-sm disabled:opacity-30">{saving?'⏳ Uploading...':'Submit for Verification'}</button>
    </div>
  );
}

// ===== ESCROW PAYMENT PANEL =====
function EscrowPaymentPanel({ trade, onPaid }) {
  const { user, showToast } = useStore();
  const [methods, setMethods] = useState([]);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [paymentRef, setPaymentRef] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    (async () => { try { const sb = createClient(); const { data } = await sb.from('escrow_settings').select('*').eq('is_active', true).order('display_order'); setMethods(data || []); } catch(e) {} })();
  }, []);

  const total = (parseFloat(trade.amount) * 1.02).toFixed(2);

  const confirmPayment = async () => {
    if (!paymentRef.trim()) return;
    setConfirming(true);
    try {
      const sb = createClient();
      await sb.from('trades').update({ status: 'paid', escrow_payment_method: selectedMethod?.method_name || '', escrow_payment_ref: paymentRef.trim(), paid_at: new Date().toISOString() }).eq('id', trade.id);
      await sb.from('trade_messages').insert({ trade_id: trade.id, content: `💰 Buyer paid ${trade.currency} ${total} via ${selectedMethod?.method_name || 'escrow'}. Ref: ${paymentRef.trim()}`, is_system: true });
      sendNotification({ toUserId: trade.seller_id, fromUserId: user.id, type: 'system', content: `Trade "${trade.title}": Payment sent 💰` });
      alertAdmins({ fromUserId: user.id, type: 'system', content: `💰 Payment: "${trade.title}" — ${trade.currency} ${total} (ref: ${paymentRef.trim()})`, referenceId: trade.id });
      showToast?.('Payment submitted ✓');
      onPaid?.();
    } catch(e) { showToast?.('Failed'); }
    setConfirming(false);
  };

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-green-500/8 border border-green-500/15 text-xs text-green-300 leading-relaxed">
        ✅ Send <strong>{trade.currency} {total}</strong> (price + 2% fee) to MidasHub escrow below. Funds are held until you confirm delivery. Seller gets paid only after you&apos;re satisfied.
      </div>
      {methods.length === 0 ? <div className="text-xs text-white/30 text-center py-3">No payment methods set up. Contact admin.</div> : (
        <div className="space-y-2">
          {methods.map(m => (
            <button key={m.id} onClick={() => setSelectedMethod(m)}
              className={`w-full p-3 rounded-xl text-left text-sm ${selectedMethod?.id === m.id ? 'border-2 bg-green-500/5' : 'border bg-white/3'}`}
              style={{ borderColor: selectedMethod?.id === m.id ? '#22c55e' : 'rgba(255,255,255,0.08)' }}>
              <div className="flex items-center gap-2 mb-1"><span>{m.method_icon}</span><strong>{m.method_name}</strong><span className="text-[10px] text-white/30 ml-auto">{m.currency}</span></div>
              <div className="text-xs text-white/40 whitespace-pre-wrap">{m.details}</div>
            </button>
          ))}
        </div>
      )}
      {selectedMethod && (
        <div className="space-y-2">
          <div className="text-xs text-white/40">After paying, enter your payment reference:</div>
          <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Transaction ID / Reference / Receipt" className="input-field text-sm" style={{ fontSize: '16px' }} />
          <button onClick={confirmPayment} disabled={confirming || !paymentRef.trim()} className="btn-primary w-full py-2.5 text-sm disabled:opacity-30">
            {confirming ? '⏳...' : '✅ I\'ve Paid — Confirm'}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== REVIEW FORM =====
function ReviewForm({ trade, onDone }) {
  const { user, showToast } = useStore();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const isSeller = user?.id === trade.seller_id;
  const reviewedId = isSeller ? trade.buyer_id : trade.seller_id;

  const submit = async () => {
    if (!rating) return;
    setSaving(true);
    try {
      const sb = createClient();
      await sb.from('trade_reviews').insert({ trade_id: trade.id, reviewer_id: user.id, reviewed_id: reviewedId, rating, comment: comment.trim() });
      await sb.from('trades').update(isSeller ? { seller_reviewed: true } : { buyer_reviewed: true }).eq('id', trade.id);
      showToast?.('Review submitted ✓');
      onDone?.();
    } catch(e) { showToast?.('Failed'); }
    setSaving(false);
  };

  return (
    <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-3">
      <div className="text-sm font-bold">⭐ Rate this trade</div>
      <div className="flex gap-2 justify-center">{[1,2,3,4,5].map(s => (<button key={s} onClick={() => setRating(s)} className={`text-2xl transition ${s <= rating ? '' : 'opacity-20'}`}>⭐</button>))}</div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Share your experience (optional)" className="input-field text-sm resize-none h-16" style={{ fontSize: '16px' }} />
      <button onClick={submit} disabled={!rating || saving} className="btn-primary w-full py-2 text-sm disabled:opacity-30">{saving ? '⏳...' : 'Submit Review'}</button>
    </div>
  );
}

// ===== START TRADE BUTTON + MODAL =====
export function StartTradeButton({ conversationId, otherUserId, onTradeCreated }) {
  const { user, profile, showToast } = useStore();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('instructions');
  const [role, setRole] = useState(null);
  const [categories, setCategories] = useState([]);
  const [deliveryEst, setDeliveryEst] = useState('');
  const [customDelivery, setCustomDelivery] = useState('');
  const [form, setForm] = useState({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '', categoryId: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const sy = window.scrollY; document.body.style.position = 'fixed'; document.body.style.top = `-${sy}px`; document.body.style.width = '100%';
    // Decide starting step
    if (profile?.kyc_status === 'verified' || profile?.kyc_status === 'pending') setStep('instructions');
    else setStep('kyc');
    // Load categories
    (async () => { try { const sb = createClient(); const { data } = await sb.from('trade_categories').select('*').eq('is_active', true).order('name'); setCategories(data || []); } catch(e) {} })();
    return () => { document.body.style.position = ''; document.body.style.top = ''; document.body.style.width = ''; window.scrollTo(0, sy); };
  }, [open, profile]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.amount || parseFloat(form.amount) <= 0) { setError('Title and amount required'); return; }
    if (!role) { setError('Pick your role'); return; }
    if (role === 'seller' && !deliveryEst) { setError('Set delivery estimate'); return; }
    setCreating(true); setError('');
    try {
      const sb = createClient();
      const delivery = deliveryEst === 'custom' ? customDelivery : (DELIVERY_OPTIONS.find(d => d.value === deliveryEst)?.label || deliveryEst);
      const ins = { conversation_id: conversationId, seller_id: role === 'seller' ? user.id : otherUserId, buyer_id: role === 'buyer' ? user.id : otherUserId, title: form.title.trim(), description: form.description.trim(), amount: parseFloat(form.amount), currency: form.currency, payment_method: form.paymentMethod.trim(), delivery_estimate: delivery };
      if (form.categoryId) ins.category_id = form.categoryId;
      const { data, error: err } = await sb.from('trades').insert(ins).select().single();
      if (err) { setError(err.message); setCreating(false); return; }
      await sb.from('trade_messages').insert({ trade_id: data.id, content: `🔒 New Trade Created\n━━━━━━━━━━━━━━━\n📦 ${form.title}\n💰 ${form.currency} ${parseFloat(form.amount).toFixed(2)} (+2% escrow fee)\n📦 Delivery: ${delivery}\n\nWaiting for ${role === 'seller' ? 'buyer' : 'seller'} to accept.`, is_system: true });
      sendNotification({ toUserId: otherUserId, fromUserId: user.id, type: 'system', content: `🔒 wants to start a trade with you: "${form.title}" for ${form.currency} ${parseFloat(form.amount).toFixed(2)}. Open your chat to review and accept!` });
      alertAdmins({ fromUserId: user.id, type: 'system', content: `🔒 New trade: "${form.title}" — ${form.currency} ${parseFloat(form.amount).toFixed(2)} (fee: ${form.currency} ${(parseFloat(form.amount) * 0.02).toFixed(2)})`, referenceId: data.id });
      setOpen(false); setForm({ title: '', description: '', amount: '', currency: 'USD', paymentMethod: '', categoryId: '' }); setRole(null); setDeliveryEst('');
      showToast?.('Trade created ✓');
      onTradeCreated?.();
    } catch(e) { setError('Failed to create trade'); }
    setCreating(false);
  };

  if (!open) return (<button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold hover:bg-green-500/15 transition">🔒 Trade</button>);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal-content max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4"><h3 className="font-bold text-lg">🔒 Secure Trade</h3><button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 text-sm">✕</button></div>

        {/* STEP: Instructions */}
        {step === 'instructions' && (
          <div className="space-y-4">
            <div className="text-center mb-2"><div className="text-4xl mb-2">🔒</div><h4 className="text-lg font-bold">How MidasHub Escrow Works</h4></div>

            <div className="space-y-3">
              {[
                { icon: '1️⃣', title: 'Create the trade', desc: 'Describe what you\'re trading, set the price, and choose your role (buyer/seller).' },
                { icon: '2️⃣', title: 'Other party accepts', desc: 'They review the trade details and accept if they agree to the terms.' },
                { icon: '3️⃣', title: 'Buyer pays to MidasHub', desc: 'Buyer sends the money (price + 2% fee) to our escrow account. We hold it safely.' },
                { icon: '4️⃣', title: 'Seller delivers', desc: 'Seller delivers the item/service. Digital products can be sent instantly.' },
                { icon: '5️⃣', title: 'Buyer confirms', desc: 'Once satisfied, buyer confirms receipt. We release payment to the seller.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-lg shrink-0">{s.icon}</span>
                  <div><div className="text-sm font-semibold">{s.title}</div><div className="text-xs text-white/40">{s.desc}</div></div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-yellow-500/8 border border-yellow-500/15 text-xs text-yellow-300/80 space-y-1">
              <div className="font-bold">⚠️ Important:</div>
              <div>• Never send money directly to the other person</div>
              <div>• Only pay through MidasHub escrow accounts</div>
              <div>• Both parties must verify their identity</div>
              <div>• Disputes are resolved by MidasHub admin</div>
              <div>• 2% escrow fee is charged to the buyer</div>
            </div>

            {profile?.kyc_status === 'verified' && <div className="flex items-center gap-2 text-xs text-green-400"><span>✅</span> Your identity is verified</div>}
            {profile?.kyc_status === 'pending' && <div className="flex items-center gap-2 text-xs text-yellow-400"><span>⏳</span> Verification pending — you can still create trades</div>}

            <button onClick={() => setStep('trade')} className="btn-primary w-full py-3 text-sm">I Understand → Create Trade</button>
          </div>
        )}

        {/* STEP: KYC */}
        {step === 'kyc' && <KYCForm onComplete={() => setStep('instructions')} />}

        {/* STEP: Trade setup */}
        {step === 'trade' && (
          <div className="space-y-4">
            <div className="text-sm font-semibold mb-1">What&apos;s your role?</div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setRole('seller')} className={`p-4 rounded-xl border text-center transition ${role === 'seller' ? 'bg-green-500/10 border-green-500/30' : 'bg-white/3 border-white/10'}`}><div className="text-3xl mb-1">🏪</div><div className="text-sm font-bold">I&apos;m Selling</div><div className="text-[10px] text-white/30">I have an item/service</div></button>
              <button onClick={() => setRole('buyer')} className={`p-4 rounded-xl border text-center transition ${role === 'buyer' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/3 border-white/10'}`}><div className="text-3xl mb-1">🛒</div><div className="text-sm font-bold">I&apos;m Buying</div><div className="text-[10px] text-white/30">I want to purchase</div></button>
            </div>

            <div><div className="text-sm font-semibold mb-1.5">What are you trading? *</div><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g., Logo Design, iPhone 15, Web Development..." className="input-field text-sm" style={{ fontSize: '16px' }} /></div>
            <div><div className="text-sm font-semibold mb-1.5">Description</div><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Details: what's included, condition, requirements..." className="input-field text-sm resize-none h-20" style={{ fontSize: '16px' }} /></div>

            {categories.length > 0 && (<div><div className="text-xs text-white/40 mb-1.5">Category</div><div className="flex flex-wrap gap-1.5">{categories.map(c => (<button key={c.id} onClick={() => setForm({ ...form, categoryId: c.id })} className={`platform-pill text-[11px] ${form.categoryId === c.id ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>{c.icon} {c.name}</button>))}</div></div>)}

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-white/40 mb-1 block">Price *</label><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className="input-field text-sm" style={{ fontSize: '16px' }} min="0" step="0.01" /></div>
              <div><label className="text-xs text-white/40 mb-1 block">Currency</label><select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="input-field text-sm" style={{ fontSize: '16px' }}><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="NGN">NGN</option><option value="KES">KES</option><option value="BTC">BTC</option><option value="USDT">USDT</option></select></div>
            </div>

            {form.amount && parseFloat(form.amount) > 0 && (
              <div className="p-3 rounded-lg bg-white/3 text-sm space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-white/40">Price</span><span>{form.currency} {parseFloat(form.amount).toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Escrow fee (2%)</span><span className="text-yellow-400">{form.currency} {(parseFloat(form.amount) * 0.02).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold border-t border-white/5 pt-1.5"><span>Buyer pays</span><span className="text-[var(--accent)]">{form.currency} {(parseFloat(form.amount) * 1.02).toFixed(2)}</span></div>
                <div className="flex justify-between text-xs"><span className="text-white/40">Seller receives</span><span className="text-green-400">{form.currency} {parseFloat(form.amount).toFixed(2)}</span></div>
              </div>
            )}

            {role === 'seller' && (
              <div><div className="text-sm font-semibold mb-1.5">📦 Delivery Estimate *</div>
                <div className="grid grid-cols-3 gap-1.5">{DELIVERY_OPTIONS.map(d => (<button key={d.value} onClick={() => setDeliveryEst(d.value)} className={`px-2 py-2 rounded-lg text-xs text-center ${deliveryEst === d.value ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30 font-bold' : 'bg-white/5 text-white/40 border border-white/5'}`}>{d.label}</button>))}</div>
                {deliveryEst === 'custom' && <input value={customDelivery} onChange={e => setCustomDelivery(e.target.value)} placeholder="e.g., 5 business days" className="input-field text-sm mt-2" style={{ fontSize: '16px' }} />}
              </div>
            )}

            {error && <div className="text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg">{error}</div>}
            <button onClick={handleCreate} disabled={creating || !form.amount || !form.title.trim() || !role || (role === 'seller' && !deliveryEst)} className="btn-primary w-full py-3 text-sm disabled:opacity-30">{creating ? '⏳ Creating...' : '🔒 Create Secure Trade'}</button>
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
  const [showPayment, setShowPayment] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const messagesEnd = useRef(null);
  const isSeller = user?.id === trade.seller_id;
  const isBuyer = user?.id === trade.buyer_id;
  const config = STATUS_CONFIG[trade.status] || STATUS_CONFIG.pending;
  const isActive = !['completed', 'cancelled', 'resolved'].includes(trade.status);
  const canReview = trade.status === 'completed' && ((isSeller && !trade.seller_reviewed) || (isBuyer && !trade.buyer_reviewed));

  useEffect(() => {
    if (!expanded) return;
    const sb = createClient();
    (async () => { const { data } = await sb.from('trade_messages').select('*, profiles(*)').eq('trade_id', trade.id).order('created_at', { ascending: true }); setTradeMessages(data || []); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 100); })();
    const ch = sb.channel(`trade-${trade.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trade_messages', filter: `trade_id=eq.${trade.id}` }, async (p) => {
      try { const { data } = await sb.from('trade_messages').select('*, profiles(*)').eq('id', p.new.id).maybeSingle(); if (data) { setTradeMessages(prev => [...prev, data]); setTimeout(() => messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50); } } catch(e) {}
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [expanded, trade.id]);

  const sendMsg = async () => { if (!msgText.trim()) return; const sb = createClient(); await sb.from('trade_messages').insert({ trade_id: trade.id, sender_id: user.id, content: msgText.trim() }); setMsgText(''); };

  const updateStatus = async (newStatus) => {
    setLoading(true);
    try {
      const sb = createClient(); const ud = { status: newStatus };
      if (newStatus === 'accepted') ud.accepted_at = new Date().toISOString();
      if (newStatus === 'delivered') ud.delivered_at = new Date().toISOString();
      if (newStatus === 'completed') ud.completed_at = new Date().toISOString();
      if (newStatus === 'cancelled') ud.cancelled_at = new Date().toISOString();
      if (newStatus === 'disputed') {
        const r = prompt('Describe the issue in detail:');
        if (!r) { setLoading(false); return; }
        ud.dispute_reason = r; ud.dispute_by = user.id; ud.disputed_at = new Date().toISOString();
      }
      await sb.from('trades').update(ud).eq('id', trade.id);
      const other = isSeller ? trade.buyer_id : trade.seller_id;
      const msgs = {
        accepted: '🤝 accepted your trade! Open chat to continue.',
        paid: '💰 sent payment! Check escrow details in chat.',
        delivered: '📦 marked as delivered! Open chat to confirm receipt.',
        completed: '🎉 confirmed receipt — trade complete! Leave a review.',
        disputed: '⚠️ raised a dispute on your trade. Open chat to respond.',
        cancelled: '❌ cancelled the trade.',
      };
      sendNotification({ toUserId: other, fromUserId: user.id, type: 'system', content: `Trade "${trade.title}": ${msgs[newStatus] || newStatus}` });
      // System message in trade chat
      await sb.from('trade_messages').insert({ trade_id: trade.id, content: `${config.icon} Trade ${msgs[newStatus] || newStatus}`, is_system: true });
      if (['disputed', 'paid', 'completed'].includes(newStatus)) {
        alertAdmins({ fromUserId: user.id, type: 'system', content: `🔒 Trade "${trade.title}" → ${newStatus.toUpperCase()} (${trade.currency} ${parseFloat(trade.amount).toFixed(2)})`, referenceId: trade.id });
      }
      onUpdate?.();
    } catch(e) { showToast?.('Failed'); }
    setLoading(false);
  };

  const inviteAdmin = async () => {
    const sb = createClient();
    await sb.from('trade_messages').insert({ trade_id: trade.id, content: '🛡️ Admin assistance requested. An administrator will review this trade.', is_system: true });
    await sb.from('trades').update({ admin_note: 'ADMIN REVIEW REQUESTED' }).eq('id', trade.id);
    alertAdmins({ fromUserId: user.id, type: 'system', content: `🛡️ Help requested on trade "${trade.title}"`, referenceId: trade.id });
    showToast?.('Admin notified ✓');
    onUpdate?.();
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
        <div className="text-white/20 text-sm">{expanded ? '▲' : '▼'}</div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Progress bar */}
          {isActive && <div className="flex gap-1">{STEPS.map((s, i) => (<div key={i} className="flex-1"><div className="h-1.5 rounded-full" style={{ background: i < config.step ? config.color : 'rgba(255,255,255,0.05)' }} /><div className="text-[8px] text-white/20 text-center mt-0.5">{s}</div></div>))}</div>}

          {/* Trade details */}
          <div className="p-2.5 rounded-lg bg-white/3 text-xs space-y-1.5">
            {trade.description && <div className="text-white/50 mb-2 whitespace-pre-wrap">{trade.description}</div>}
            <div className="flex justify-between"><span className="text-white/30">Price</span><span>{trade.currency} {parseFloat(trade.amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/30">Escrow fee (2%)</span><span className="text-yellow-400">{trade.currency} {(parseFloat(trade.amount) * 0.02).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold"><span>Buyer total</span><span className="text-[var(--accent)]">{trade.currency} {(parseFloat(trade.amount) * 1.02).toFixed(2)}</span></div>
            {trade.delivery_estimate && <div className="flex justify-between"><span className="text-white/30">📦 Delivery</span><span className="font-semibold">{trade.delivery_estimate}</span></div>}
            <div className="flex justify-between"><span className="text-white/30">Your role</span><span className="font-semibold">{isSeller ? '🏪 Seller' : '🛒 Buyer'}</span></div>
            {trade.escrow_payment_ref && <div className="flex justify-between"><span className="text-white/30">Payment ref</span><span className="text-green-400 truncate max-w-[60%]">{trade.escrow_payment_ref}</span></div>}
            {trade.dispute_reason && <div className="mt-2 p-2 rounded-lg bg-red-500/10 text-red-300">⚠️ Dispute: {trade.dispute_reason}</div>}
            {trade.admin_note && trade.admin_note !== 'ADMIN REVIEW REQUESTED' && <div className="mt-2 p-2 rounded-lg bg-blue-500/10 text-blue-300">🛡️ Admin: {trade.admin_note}</div>}
          </div>

          <div className="p-2 rounded-lg bg-yellow-500/8 border border-yellow-500/15 text-[10px] text-yellow-300/70">🔒 Funds held by MidasHub. Released to seller only after buyer confirms receipt.</div>

          {/* Escrow payment for buyer */}
          {trade.status === 'accepted' && isBuyer && !showPayment && (
            <button onClick={() => setShowPayment(true)} className="btn-primary w-full py-2.5 text-sm">💰 Pay Now → View Escrow Accounts</button>
          )}
          {showPayment && trade.status === 'accepted' && isBuyer && (
            <EscrowPaymentPanel trade={trade} onPaid={() => { setShowPayment(false); onUpdate?.(); }} />
          )}

          {/* Action buttons */}
          {isActive && !(trade.status === 'accepted' && isBuyer) && (
            <div className="flex flex-wrap gap-2">
              {trade.status === 'pending' && isBuyer && <><button onClick={() => updateStatus('accepted')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">🤝 Accept Trade</button><button onClick={() => updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">❌ Decline</button></>}
              {trade.status === 'pending' && isSeller && <button onClick={() => updateStatus('cancelled')} disabled={loading} className="btn-secondary py-2 px-4 text-xs">❌ Cancel Trade</button>}
              {trade.status === 'paid' && isSeller && <button onClick={() => updateStatus('delivered')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">📦 Mark as Delivered</button>}
              {trade.status === 'delivered' && isBuyer && <><button onClick={() => updateStatus('completed')} disabled={loading} className="btn-primary py-2 px-4 text-xs flex-1">✅ Confirm Received</button><button onClick={() => updateStatus('disputed')} disabled={loading} className="text-xs text-red-400 px-3 py-2 bg-red-500/10 rounded-lg">⚠️ Dispute</button></>}
              {['paid', 'delivered'].includes(trade.status) && <button onClick={() => updateStatus('disputed')} disabled={loading} className="text-[10px] text-red-300 ml-auto">⚠️ Report Issue</button>}
            </div>
          )}

          {/* Admin invite */}
          {isActive && <button onClick={inviteAdmin} className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-500/8 border border-blue-500/15 text-blue-300 text-xs hover:bg-blue-500/15 transition">🛡️ Request Admin Help</button>}

          {/* Review */}
          {canReview && !showReview && <button onClick={() => setShowReview(true)} className="w-full py-2.5 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] text-sm font-semibold">⭐ Leave a Review</button>}
          {showReview && <ReviewForm trade={trade} onDone={() => { setShowReview(false); onUpdate?.(); }} />}
          {trade.status === 'completed' && ((isSeller && trade.seller_reviewed) || (isBuyer && trade.buyer_reviewed)) && <div className="text-center text-xs text-green-400 font-semibold py-1">✅ You&apos;ve reviewed this trade</div>}

          {/* Trade chat */}
          <div>
            <div className="text-[10px] text-white/30 font-semibold mb-2 uppercase">Trade Chat</div>
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
            {(isActive || trade.status === 'completed') && (
              <div className="flex gap-2">
                <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} placeholder="Trade message..." className="input-field flex-1 py-2 text-xs" style={{ fontSize: '16px' }} />
                <button onClick={sendMsg} disabled={!msgText.trim()} className="btn-primary py-2 px-3 text-xs disabled:opacity-30">Send</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
