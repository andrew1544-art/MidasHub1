'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import AdminTradeChat from '@/components/AdminTradeChat';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { timeAgo, formatCount } from '@/lib/constants';

// Admin access is controlled from the database (profiles.is_admin)
// To add/remove admins, update the is_admin column in Supabase

export default function AdminPage() {
  const { user, profile } = useStore();
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [trades, setTrades] = useState([]);
  const [escrowMethods, setEscrowMethods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [kycQueue, setKycQueue] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingEscrow, setEditingEscrow] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [newEscrow, setNewEscrow] = useState({ method_name: '', method_icon: '💰', details: '', currency: 'USD', is_active: true, display_order: 0 });
  const [newCat, setNewCat] = useState({ name: '', icon: '📦', description: '', requires_kyc: true, is_active: true });
  const [viewingTrade, setViewingTrade] = useState(null);
  const supabase = createClient();

  // Admin check — fetch fresh from DB, don't rely on cached profile
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  useEffect(() => {
    if (!user) { setAdminChecked(true); setLoading(false); return; }
    // Always re-fetch profile to check is_admin
    (async () => {
      try {
        const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
        setIsAdmin(data?.is_admin === true);
      } catch (e) { setIsAdmin(false); }
      setAdminChecked(true);
    })();
  }, [user]);

  useEffect(() => {
    if (!adminChecked || !isAdmin) return;
    loadAll();
  }, [isAdmin, adminChecked, tab]);

  const loadAll = async () => {
    setLoading(true);
    try {
      // Stats — each in try/catch so one failure doesn't break all
      let userCount = 0, postCount = 0, tradeCount = 0, msgCount = 0, notifCount = 0;
      let activeTrades = 0, completedTrades = 0, disputedTrades = 0;

      try { const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }); userCount = count || 0; } catch(e){}
      try { const { count } = await supabase.from('posts').select('*', { count: 'exact', head: true }); postCount = count || 0; } catch(e){}
      try { const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }); msgCount = count || 0; } catch(e){}
      try { const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }); notifCount = count || 0; } catch(e){}
      try {
        const { count: tc } = await supabase.from('trades').select('*', { count: 'exact', head: true }); tradeCount = tc || 0;
        const { count: at } = await supabase.from('trades').select('*', { count: 'exact', head: true }).in('status', ['pending','accepted','paid','delivered']); activeTrades = at || 0;
        const { count: ct } = await supabase.from('trades').select('*', { count: 'exact', head: true }).eq('status', 'completed'); completedTrades = ct || 0;
        const { count: dt } = await supabase.from('trades').select('*', { count: 'exact', head: true }).eq('status', 'disputed'); disputedTrades = dt || 0;
      } catch(e){}

      setStats({ users: userCount, posts: postCount, trades: tradeCount, messages: msgCount, notifications: notifCount, activeTrades, completedTrades, disputedTrades });

      // Load tab-specific data — each wrapped safely
      if (tab === 'users' || tab === 'dashboard') {
        try { const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100); setUsers(data || []); } catch(e) { setUsers([]); }
      }
      if (tab === 'trades' || tab === 'dashboard') {
        try {
          const { data, error } = await supabase.from('trades').select('*').order('created_at', { ascending: false }).limit(100);
          if (error) throw error;
          // Manually fetch seller/buyer profiles
          const enriched = [];
          for (const t of (data || [])) {
            const [{ data: seller }, { data: buyer }] = await Promise.all([
              supabase.from('profiles').select('id, username, display_name, avatar_emoji').eq('id', t.seller_id).maybeSingle(),
              supabase.from('profiles').select('id, username, display_name, avatar_emoji').eq('id', t.buyer_id).maybeSingle(),
            ]);
            enriched.push({ ...t, seller, buyer });
          }
          setTrades(enriched);
        } catch (e) { console.warn('Trades load:', e); setTrades([]); }
      }
      if (tab === 'escrow') {
        try { const { data } = await supabase.from('escrow_settings').select('*').order('display_order'); setEscrowMethods(data || []); } catch(e) { setEscrowMethods([]); }
      }
      if (tab === 'categories') {
        try { const { data } = await supabase.from('trade_categories').select('*').order('name'); setCategories(data || []); } catch(e) { setCategories([]); }
      }
      if (tab === 'kyc') {
        try { const { data } = await supabase.from('profiles').select('*').eq('kyc_status', 'pending').order('kyc_submitted_at', { ascending: false }); setKycQueue(data || []); } catch(e) { setKycQueue([]); }
      }
      if (tab === 'posts') {
        try { const { data } = await supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false }).limit(100); setPosts(data || []); } catch(e) { setPosts([]); }
      }
    } catch (e) { console.error('Admin load error:', e); }
    setLoading(false);
  };

  // ===== ACTIONS =====
  const verifyUser = async (userId) => {
    await supabase.from('profiles').update({ kyc_status: 'verified', kyc_verified_at: new Date().toISOString() }).eq('id', userId);
    loadAll();
  };
  const rejectUser = async (userId) => {
    const note = prompt('Rejection reason:');
    await supabase.from('profiles').update({ kyc_status: 'rejected', kyc_admin_note: note || 'Rejected' }).eq('id', userId);
    loadAll();
  };
  const updateTradeStatus = async (tradeId, status) => {
    const updates = { status };
    if (status === 'resolved') {
      const note = prompt('Admin resolution note:');
      updates.admin_note = note || 'Resolved by admin';
      updates.resolved_at = new Date().toISOString();
    }
    await supabase.from('trades').update(updates).eq('id', tradeId);
    loadAll();
  };
  const deletePost = async (postId) => {
    if (!confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    loadAll();
  };
  const saveEscrow = async (item) => {
    if (item.id) {
      await supabase.from('escrow_settings').update(item).eq('id', item.id);
    } else {
      await supabase.from('escrow_settings').insert(item);
    }
    setEditingEscrow(null);
    loadAll();
  };
  const deleteEscrow = async (id) => {
    if (!confirm('Delete this payment method?')) return;
    await supabase.from('escrow_settings').delete().eq('id', id);
    loadAll();
  };
  const saveCat = async (item) => {
    if (item.id) {
      await supabase.from('trade_categories').update(item).eq('id', item.id);
    } else {
      await supabase.from('trade_categories').insert(item);
    }
    setEditingCat(null);
    loadAll();
  };
  const deleteCat = async (id) => {
    if (!confirm('Delete this category?')) return;
    await supabase.from('trade_categories').delete().eq('id', id);
    loadAll();
  };
  const toggleEscrowActive = async (id, current) => {
    await supabase.from('escrow_settings').update({ is_active: !current }).eq('id', id);
    loadAll();
  };

  if (!user) return <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-6xl mb-4">🔐</div><h2 className="text-2xl font-bold">Admin Access Required</h2><p className="text-white/30 mt-2">Log in to access the admin panel</p></div></AppShell>;
  if (!adminChecked) return <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-4xl animate-pulse">⚡</div></div></AppShell>;
  if (!isAdmin) return <AppShell><div className="max-w-2xl mx-auto px-4 py-20 text-center"><div className="text-6xl mb-4">🚫</div><h2 className="text-2xl font-bold">Access Denied</h2><p className="text-white/30 mt-2 text-sm">You don&apos;t have admin access.</p></div></AppShell>;

  const tabs = [
    { key: 'dashboard', label: '📊 Dashboard' },
    { key: 'users', label: '👥 Users' },
    { key: 'kyc', label: '🛡️ KYC Queue' },
    { key: 'trades', label: '🔒 Trades' },
    { key: 'escrow', label: '💰 Escrow' },
    { key: 'categories', label: '📂 Categories' },
    { key: 'posts', label: '📝 Posts' },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-6"><span className="text-3xl">⚙️</span><div><h1 className="text-2xl font-black">Admin Panel</h1><p className="text-white/30 text-xs">Manage MidasHub</p></div></div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto no-scrollbar pb-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.key ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="text-center py-20 text-white/20">⏳ Loading...</div> : (
          <>
            {/* ===== DASHBOARD ===== */}
            {tab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Users', val: stats.users, icon: '👥' },
                    { label: 'Posts', val: stats.posts, icon: '📝' },
                    { label: 'Messages', val: stats.messages, icon: '💬' },
                    { label: 'Total Trades', val: stats.trades, icon: '🔒' },
                    { label: 'Active Trades', val: stats.activeTrades, icon: '⏳', color: '#f59e0b' },
                    { label: 'Completed', val: stats.completedTrades, icon: '✅', color: '#22c55e' },
                    { label: 'Disputed', val: stats.disputedTrades, icon: '⚠️', color: '#ef4444' },
                    { label: 'Notifications', val: stats.notifications, icon: '🔔' },
                  ].map((s, i) => (
                    <div key={i} className="glass-light rounded-xl p-4 text-center">
                      <div className="text-2xl mb-1">{s.icon}</div>
                      <div className="text-2xl font-black" style={{ color: s.color }}>{formatCount(s.val || 0)}</div>
                      <div className="text-[10px] text-white/30 mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Recent disputed trades */}
                {trades.filter(t => t.status === 'disputed').length > 0 && (
                  <div className="glass-light rounded-xl p-4">
                    <h3 className="font-bold text-sm text-red-400 mb-3">⚠️ Disputed Trades — Needs Attention</h3>
                    {trades.filter(t => t.status === 'disputed').map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{t.title}</div>
                          <div className="text-xs text-white/40">{t.seller?.display_name} → {t.buyer?.display_name} · {t.currency} {parseFloat(t.amount).toFixed(2)}</div>
                          {t.dispute_reason && <div className="text-xs text-red-300 mt-1">Reason: {t.dispute_reason}</div>}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => setViewingTrade(t)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-400">👁️ Chat</button>
                          <button onClick={() => updateTradeStatus(t.id, 'resolved')} className="btn-primary py-1.5 px-3 text-[10px]">⚖️ Resolve</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Admin review requested */}
                {trades.filter(t => t.admin_note === 'ADMIN REVIEW REQUESTED').length > 0 && (
                  <div className="glass-light rounded-xl p-4">
                    <h3 className="font-bold text-sm text-blue-400 mb-3">🛡️ Admin Review Requested</h3>
                    {trades.filter(t => t.admin_note === 'ADMIN REVIEW REQUESTED').map(t => (
                      <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm truncate">{t.title}</div>
                          <div className="text-xs text-white/40">Status: {t.status} · {t.currency} {parseFloat(t.amount).toFixed(2)}</div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => setViewingTrade(t)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-400">👁️ Chat</button>
                          <button onClick={async () => { await supabase.from('trades').update({ admin_note: 'Reviewed by admin' }).eq('id', t.id); loadAll(); }} className="btn-secondary py-1.5 px-3 text-[10px]">Mark Reviewed</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ===== USERS ===== */}
            {tab === 'users' && (
              <div className="space-y-2">
                <div className="text-xs text-white/30 mb-2">{users.length} users</div>
                {users.map(u => (
                  <div key={u.id} className="glass-light rounded-xl p-4 flex items-center gap-3">
                    <span className="text-2xl">{u.avatar_emoji || '😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="font-bold text-sm truncate">{u.display_name}</span><span className="text-xs text-white/25">@{u.username}</span></div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30">
                        <span>{u.xp || 0} XP</span>
                        <span>·</span>
                        <span>KYC: {u.kyc_status || 'none'}</span>
                        <span>·</span>
                        <span>{u.trade_count || 0} trades</span>
                        <span>·</span>
                        <span>Joined {timeAgo(u.created_at)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {u.is_admin && <span className="text-[9px] px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 font-bold">ADMIN</span>}
                      {u.kyc_status === 'pending' && <button onClick={() => verifyUser(u.id)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 font-semibold">✅ Verify</button>}
                      {u.kyc_status !== 'verified' && <button onClick={() => verifyUser(u.id)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 text-white/30">Force Verify</button>}
                      {u.id !== user.id && (
                        <button onClick={async () => { await supabase.from('profiles').update({ is_admin: !u.is_admin }).eq('id', u.id); loadAll(); }}
                          className={`text-[10px] px-2.5 py-1.5 rounded-lg ${u.is_admin ? 'bg-red-500/15 text-red-400' : 'bg-purple-500/10 text-purple-400'}`}>
                          {u.is_admin ? 'Remove Admin' : '⚙️ Make Admin'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== KYC QUEUE ===== */}
            {tab === 'kyc' && (
              <div className="space-y-3">
                <div className="text-xs text-white/30 mb-2">{kycQueue.length} pending verifications</div>
                {kycQueue.length === 0 && <div className="text-center py-12 text-white/20">No pending KYC requests</div>}
                {kycQueue.map(u => (
                  <div key={u.id} className="glass-light rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{u.avatar_emoji || '😎'}</span>
                      <div className="flex-1">
                        <div className="font-bold text-sm">{u.display_name} <span className="text-white/25 font-normal">@{u.username}</span></div>
                        <div className="text-[10px] text-white/30">Submitted {timeAgo(u.kyc_submitted_at)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Name:</span> <strong>{u.kyc_full_name}</strong></div>
                      <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Phone:</span> <strong>{u.kyc_phone}</strong></div>
                      <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Country:</span> <strong>{u.kyc_country}</strong></div>
                      <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">ID:</span> <strong>{u.kyc_id_type} — {u.kyc_id_number}</strong></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {u.kyc_id_photo_url && <a href={u.kyc_id_photo_url} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-xl overflow-hidden bg-white/5"><img src={u.kyc_id_photo_url} alt="ID" className="w-full h-full object-cover" /><div className="text-[9px] text-center text-white/30 -mt-5 relative z-10 bg-black/50 py-0.5">📄 ID Photo</div></a>}
                      {u.kyc_selfie_url && <a href={u.kyc_selfie_url} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-xl overflow-hidden bg-white/5"><img src={u.kyc_selfie_url} alt="Selfie" className="w-full h-full object-cover" /><div className="text-[9px] text-center text-white/30 -mt-5 relative z-10 bg-black/50 py-0.5">🤳 Selfie</div></a>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => verifyUser(u.id)} className="btn-primary py-2 px-4 text-xs flex-1">✅ Approve</button>
                      <button onClick={() => rejectUser(u.id)} className="btn-secondary py-2 px-4 text-xs text-red-400 border-red-500/20 flex-1">❌ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== TRADES ===== */}
            {tab === 'trades' && (
              <div className="space-y-2">
                <div className="text-xs text-white/30 mb-2">{trades.length} trades</div>
                {trades.map(t => (
                  <div key={t.id} className="glass-light rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{t.title}</div>
                        <div className="flex items-center gap-2 text-xs text-white/30 mt-0.5">
                          <span className="font-semibold" style={{ color: t.status === 'completed' ? '#22c55e' : t.status === 'disputed' ? '#ef4444' : '#f59e0b' }}>{t.status.toUpperCase()}</span>
                          <span>·</span><span>{t.currency} {parseFloat(t.amount).toFixed(2)}</span>
                          <span>·</span><span>Fee: {t.currency} {(parseFloat(t.amount) * 0.02).toFixed(2)}</span>
                          <span>·</span><span>{timeAgo(t.created_at)}</span>
                        </div>
                        <div className="text-[10px] text-white/20 mt-1">🏪 {t.seller?.display_name || 'Seller'} → 🛒 {t.buyer?.display_name || 'Buyer'}</div>
                        {t.escrow_payment_ref && <div className="text-[10px] text-green-400 mt-1">💰 Payment ref: {t.escrow_payment_ref} {t.escrow_payment_method && `via ${t.escrow_payment_method}`}</div>}
                        {t.dispute_reason && <div className="text-[10px] text-red-300 mt-1">⚠️ Dispute: {t.dispute_reason}</div>}
                        {t.admin_note && <div className="text-[10px] text-blue-300 mt-1">📋 Admin: {t.admin_note}</div>}
                        {t.delivery_estimate && <div className="text-[10px] text-white/20 mt-1">📦 Delivery: {t.delivery_estimate}</div>}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button onClick={() => setViewingTrade(t)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 font-semibold">👁️ View Chat</button>
                        {t.status === 'disputed' && <button onClick={() => updateTradeStatus(t.id, 'resolved')} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400">⚖️ Resolve</button>}
                        {!['completed','cancelled','resolved'].includes(t.status) && <button onClick={() => updateTradeStatus(t.id, 'cancelled')} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400">Cancel</button>}
                        {t.status === 'paid' && <button onClick={() => { supabase.from('trades').update({ escrow_confirmed: true, admin_note: 'Payment verified by admin' }).eq('id', t.id); loadAll(); }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-blue-500/15 text-blue-400">✅ Confirm Pay</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== ESCROW SETTINGS ===== */}
            {tab === 'escrow' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-white/30">{escrowMethods.length} payment methods</div>
                  <button onClick={() => setEditingEscrow({ ...newEscrow })} className="btn-primary py-1.5 px-4 text-xs">+ Add Method</button>
                </div>

                {/* Edit/Add form */}
                {editingEscrow && (
                  <div className="glass-light rounded-xl p-4 space-y-3 border border-[var(--accent)]/20">
                    <h4 className="font-bold text-sm">{editingEscrow.id ? 'Edit' : 'Add'} Payment Method</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={editingEscrow.method_name} onChange={e => setEditingEscrow({...editingEscrow, method_name: e.target.value})} placeholder="Name (e.g. PayPal)" className="input-field text-sm" style={{ fontSize: '16px' }} />
                      <input value={editingEscrow.method_icon} onChange={e => setEditingEscrow({...editingEscrow, method_icon: e.target.value})} placeholder="Icon emoji" className="input-field text-sm" style={{ fontSize: '16px' }} />
                    </div>
                    <textarea value={editingEscrow.details} onChange={e => setEditingEscrow({...editingEscrow, details: e.target.value})}
                      placeholder="Payment details users will see (account number, wallet address, etc)" className="input-field text-sm resize-none h-24" style={{ fontSize: '16px' }} />
                    <div className="grid grid-cols-2 gap-2">
                      <select value={editingEscrow.currency} onChange={e => setEditingEscrow({...editingEscrow, currency: e.target.value})} className="input-field text-sm" style={{ fontSize: '16px' }}>
                        {['USD','EUR','GBP','NGN','KES','BTC','USDT','ETH'].map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input type="number" value={editingEscrow.display_order} onChange={e => setEditingEscrow({...editingEscrow, display_order: parseInt(e.target.value)||0})} placeholder="Order" className="input-field text-sm" style={{ fontSize: '16px' }} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEscrow(editingEscrow)} className="btn-primary py-2 px-4 text-xs flex-1">💾 Save</button>
                      <button onClick={() => setEditingEscrow(null)} className="btn-secondary py-2 px-4 text-xs">Cancel</button>
                    </div>
                  </div>
                )}

                {escrowMethods.map(m => (
                  <div key={m.id} className={`glass-light rounded-xl p-4 flex items-center gap-3 ${!m.is_active ? 'opacity-50' : ''}`}>
                    <span className="text-2xl">{m.method_icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><span className="font-bold text-sm">{m.method_name}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30">{m.currency}</span>{m.is_active ? <span className="text-[9px] text-green-400">LIVE</span> : <span className="text-[9px] text-red-400">OFF</span>}</div>
                      <div className="text-[10px] text-white/25 mt-0.5 truncate">{m.details.slice(0, 60)}...</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => toggleEscrowActive(m.id, m.is_active)} className={`text-[10px] px-2 py-1.5 rounded-lg ${m.is_active ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'}`}>{m.is_active ? 'Disable' : 'Enable'}</button>
                      <button onClick={() => setEditingEscrow({...m})} className="text-[10px] px-2 py-1.5 rounded-lg bg-white/5 text-white/40">Edit</button>
                      <button onClick={() => deleteEscrow(m.id)} className="text-[10px] px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== CATEGORIES ===== */}
            {tab === 'categories' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs text-white/30">{categories.length} categories</div>
                  <button onClick={() => setEditingCat({ ...newCat })} className="btn-primary py-1.5 px-4 text-xs">+ Add Category</button>
                </div>

                {editingCat && (
                  <div className="glass-light rounded-xl p-4 space-y-3 border border-[var(--accent)]/20">
                    <h4 className="font-bold text-sm">{editingCat.id ? 'Edit' : 'Add'} Category</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <input value={editingCat.name} onChange={e => setEditingCat({...editingCat, name: e.target.value})} placeholder="Name" className="input-field text-sm col-span-2" style={{ fontSize: '16px' }} />
                      <input value={editingCat.icon} onChange={e => setEditingCat({...editingCat, icon: e.target.value})} placeholder="Icon" className="input-field text-sm" style={{ fontSize: '16px' }} />
                    </div>
                    <input value={editingCat.description} onChange={e => setEditingCat({...editingCat, description: e.target.value})} placeholder="Description" className="input-field text-sm" style={{ fontSize: '16px' }} />
                    <div className="flex gap-2">
                      <button onClick={() => saveCat(editingCat)} className="btn-primary py-2 px-4 text-xs flex-1">💾 Save</button>
                      <button onClick={() => setEditingCat(null)} className="btn-secondary py-2 px-4 text-xs">Cancel</button>
                    </div>
                  </div>
                )}

                {categories.map(c => (
                  <div key={c.id} className="glass-light rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">{c.icon}</span>
                    <div className="flex-1"><div className="font-bold text-sm">{c.name}</div><div className="text-[10px] text-white/25">{c.description}</div></div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingCat({...c})} className="text-[10px] px-2 py-1.5 rounded-lg bg-white/5 text-white/40">Edit</button>
                      <button onClick={() => deleteCat(c.id)} className="text-[10px] px-2 py-1.5 rounded-lg bg-red-500/10 text-red-400">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== POSTS ===== */}
            {tab === 'posts' && (
              <div className="space-y-2">
                {posts.map(p => (
                  <div key={p.id} className="glass-light rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">{p.profiles?.avatar_emoji || '😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white/40">{p.profiles?.display_name} · {timeAgo(p.created_at)} · {p.is_public ? '🌍' : '🔒'}</div>
                      <div className="text-sm truncate mt-0.5">{p.content}</div>
                      <div className="text-[10px] text-white/20 mt-0.5">❤️ {p.likes_count||0} · 💬 {p.comments_count||0} · 🔄 {p.reposts_count||0}</div>
                    </div>
                    <button onClick={() => deletePost(p.id)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 shrink-0">🗑️</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Trade Chat Viewer — always available from any tab */}
        {viewingTrade && <AdminTradeChat trade={viewingTrade} onClose={() => { setViewingTrade(null); loadAll(); }} />}
      </div>
    </AppShell>
  );
}
