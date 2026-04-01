'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import AdminTradeChat from '@/components/AdminTradeChat';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { timeAgo, formatCount } from '@/lib/constants';
import { BADGE_TYPES, InlineBadges } from '@/components/Badge';

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
  const [approvedKyc, setApprovedKyc] = useState([]);
  const [posts, setPosts] = useState([]);
  const [tradeRoles, setTradeRoles] = useState([]);
  const [feedbackList, setFeedbackList] = useState([]);
  const [topReferrers, setTopReferrers] = useState([]);
  const [tutorialUrl, setTutorialUrl] = useState('');
  const [uploadingTut, setUploadingTut] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', icon: '👤', description: '' });
  const [loading, setLoading] = useState(true);
  const [editingEscrow, setEditingEscrow] = useState(null);
  const [editingCat, setEditingCat] = useState(null);
  const [newEscrow, setNewEscrow] = useState({ method_name: '', method_icon: '💰', details: '', currency: 'USD', is_active: true, display_order: 0 });
  const [newCat, setNewCat] = useState({ name: '', icon: '📦', description: '', requires_kyc: true, is_active: true });
  const [viewingTrade, setViewingTrade] = useState(null);
  const [expandedUser, setExpandedUser] = useState(null);
  const [userSessions, setUserSessions] = useState([]);
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
        try { const { data } = await supabase.from('profiles').select('*').eq('kyc_status', 'verified').order('kyc_verified_at', { ascending: false }).limit(50); setApprovedKyc(data || []); } catch(e) {}
      }
      if (tab === 'posts') {
        try { const { data } = await supabase.from('posts').select('*, profiles(*)').order('created_at', { ascending: false }).limit(100); setPosts(data || []); } catch(e) { setPosts([]); }
      }
      if (tab === 'roles') {
        try { const { data } = await supabase.from('trade_roles').select('*').order('display_order'); setTradeRoles(data || []); } catch(e) { setTradeRoles([]); }
      }
      if (tab === 'referrals') {
        try { const { data } = await supabase.from('profiles').select('id, display_name, username, avatar_emoji, referral_code, referral_count, qualified_referrals, is_verified, badges').order('qualified_referrals', { ascending: false }).limit(100); setTopReferrers(data || []); } catch(e) { setTopReferrers([]); }
      }
      if (tab === 'feedback') {
        try {
          const { data: fb } = await supabase.from('feedback').select('*').order('created_at', { ascending: false }).limit(100);
          if (fb?.length) {
            const userIds = [...new Set(fb.filter(f => f.user_id).map(f => f.user_id))];
            const { data: profs } = await supabase.from('profiles').select('id, display_name, username, avatar_emoji, email').in('id', userIds);
            const profMap = new Map((profs||[]).map(p => [p.id, p]));
            setFeedbackList(fb.map(f => ({ ...f, profiles: profMap.get(f.user_id) || null })));
          } else { setFeedbackList([]); }
        } catch(e) { setFeedbackList([]); }
      }
      if (tab === 'site') {
        try {
          const { data } = await supabase.storage.from('media').list('site', { limit: 10 });
          const tut = (data||[]).find(f => f.name.startsWith('tutorial'));
          if (tut) {
            const { data: u } = supabase.storage.from('media').getPublicUrl('site/' + tut.name);
            setTutorialUrl(u.publicUrl);
          } else { setTutorialUrl(''); }
        } catch(e) {}
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
    { key: 'roles', label: '🎭 Roles' },
    { key: 'feedback', label: '💡 Feedback' },
    { key: 'referrals', label: '🔗 Referrals' },
    { key: 'site', label: '🎬 Site' },
    { key: 'diagnostics', label: '🔧 Test' },
    { key: 'posts', label: '📝 Posts' },
  ];

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-6"><span className="text-3xl">⚙️</span><div><h1 className="text-2xl font-black">Admin Panel</h1><p className="text-white/30 text-xs">Manage MidasHub</p></div></div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin' }}>
          <div className="flex gap-1.5 min-w-max">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.key ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>
              {t.label}
            </button>
          ))}
          </div>
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
                {users.map(u => {
                  const userBadges = (() => { try { const b = typeof u.badges === 'string' ? JSON.parse(u.badges) : u.badges; return Array.isArray(b) ? b : []; } catch(e) { return []; } })();
                  const isExpanded = expandedUser === u.id;
                  return (
                  <div key={u.id} className={`glass-light rounded-xl overflow-hidden ${u.is_suspended ? 'border border-red-500/30' : ''}`}>
                    {/* User header — click to expand */}
                    <button onClick={async () => {
                      if (isExpanded) { setExpandedUser(null); return; }
                      setExpandedUser(u.id);
                      try { const { data } = await supabase.from('user_sessions').select('*').eq('user_id', u.id).order('logged_in_at', { ascending: false }).limit(10); setUserSessions(data || []); } catch(e) { setUserSessions([]); }
                    }} className="w-full p-4 flex items-center gap-3 text-left hover:bg-white/3 transition">
                      <span className="text-2xl">{u.avatar_emoji || '😎'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5"><span className="font-bold text-sm truncate">{u.display_name}</span><InlineBadges profile={u} /><span className="text-xs text-white/25">@{u.username}</span></div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-white/30 flex-wrap">
                          <span>{u.xp || 0} XP</span><span>·</span>
                          <span>KYC: <span className={u.kyc_status==='verified'?'text-green-400':u.kyc_status==='pending'?'text-yellow-400':u.kyc_status==='rejected'?'text-red-400':''}>{u.kyc_status || 'none'}</span></span><span>·</span>
                          <span>{u.trade_count || 0} trades</span><span>·</span>
                          <span>{u.login_count || 0} logins</span>
                          {u.last_country && <><span>·</span><span>📍{u.last_city ? `${u.last_city}, ` : ''}{u.last_country}</span></>}
                          {u.is_suspended && <span className="text-red-400 font-bold">· ⛔ SUSPENDED</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {u.is_admin && <span className="text-[9px] px-2 py-1 rounded-full bg-purple-500/15 text-purple-400 font-bold">ADMIN</span>}
                        <span className="text-white/20 text-xs">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-3 border-t border-white/5">
                        {/* Quick info */}
                        <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Email</span><div className="text-xs truncate">{u.email || 'N/A'}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Joined</span><div className="text-xs">{new Date(u.created_at).toLocaleDateString()}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Last seen</span><div className="text-xs">{u.last_seen ? timeAgo(u.last_seen) : 'Never'}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Last IP</span><div className="text-xs font-mono">{u.last_ip || 'Unknown'}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Location</span><div className="text-xs">{u.last_city && u.last_country ? `${u.last_city}, ${u.last_country}` : u.last_country || 'Unknown'}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Device</span><div className="text-xs">{u.last_device || 'Unknown'}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">Logins</span><div className="text-xs">{u.login_count || 0}</div></div>
                          <div className="p-2 rounded-lg bg-white/3"><span className="text-white/30">DOB</span><div className="text-xs">{u.date_of_birth || 'N/A'}</div></div>
                        </div>

                        {/* KYC Details — always visible if submitted */}
                        {(u.kyc_full_name || u.kyc_status === 'verified' || u.kyc_status === 'pending' || u.kyc_status === 'rejected') && (
                          <div className="p-3 rounded-xl bg-white/3 border border-white/5 space-y-2">
                            <div className="flex items-center gap-2"><span className="text-sm font-bold">🛡️ KYC Details</span><span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${u.kyc_status==='verified'?'bg-green-500/15 text-green-400':u.kyc_status==='pending'?'bg-yellow-500/15 text-yellow-400':'bg-red-500/15 text-red-400'}`}>{u.kyc_status?.toUpperCase()}</span></div>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div><span className="text-white/30">Full Name</span><div className="text-xs font-semibold">{u.kyc_full_name || '—'}</div></div>
                              <div><span className="text-white/30">Phone</span><div className="text-xs">{u.kyc_phone || '—'}</div></div>
                              <div><span className="text-white/30">Country</span><div className="text-xs">{u.kyc_country || '—'}</div></div>
                              <div><span className="text-white/30">ID Type</span><div className="text-xs">{u.kyc_id_type || '—'}</div></div>
                              <div className="col-span-2"><span className="text-white/30">ID Number</span><div className="text-xs font-mono">{u.kyc_id_number || '—'}</div></div>
                              {u.kyc_submitted_at && <div className="col-span-2"><span className="text-white/30">Submitted</span><div className="text-xs">{new Date(u.kyc_submitted_at).toLocaleString()}</div></div>}
                              {u.kyc_admin_note && <div className="col-span-2"><span className="text-white/30">Admin Note</span><div className="text-xs text-yellow-400">{u.kyc_admin_note}</div></div>}
                            </div>
                            {/* ID photos */}
                            <div className="flex gap-2 mt-2">
                              {u.kyc_id_photo_url && <a href={u.kyc_id_photo_url} target="_blank" rel="noreferrer" className="block"><img src={u.kyc_id_photo_url} alt="ID" className="w-24 h-16 object-cover rounded-lg border border-white/10 hover:opacity-80" /></a>}
                              {u.kyc_selfie_url && <a href={u.kyc_selfie_url} target="_blank" rel="noreferrer" className="block"><img src={u.kyc_selfie_url} alt="Selfie" className="w-24 h-16 object-cover rounded-lg border border-white/10 hover:opacity-80" /></a>}
                            </div>
                          </div>
                        )}

                        {/* Login history */}
                        {userSessions.length > 0 && (
                          <div className="p-3 rounded-xl bg-white/3 border border-white/5">
                            <div className="text-sm font-bold mb-2">📍 Login History (last 10)</div>
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {userSessions.map((s, i) => (
                                <div key={s.id || i} className="flex items-center gap-2 text-[10px] text-white/40 py-1 border-b border-white/3 last:border-0">
                                  <span className="font-mono text-white/50 shrink-0">{s.ip_address || '?'}</span>
                                  <span>{s.city && s.country ? `${s.city}, ${s.country}` : s.country || '?'}</span>
                                  <span>·</span>
                                  <span>{s.device}/{s.browser}/{s.os}</span>
                                  <span className="ml-auto shrink-0 text-white/25">{new Date(s.logged_in_at).toLocaleString()}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          <button onClick={async () => { await supabase.from('profiles').update({ is_verified: !u.is_verified }).eq('id', u.id); loadAll(); }}
                            className={`text-[10px] px-2.5 py-1.5 rounded-lg ${u.is_verified ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-white/30'}`}>
                            {u.is_verified ? '✔ Verified' : '✔ Give Verified'}
                          </button>
                          {Object.entries(BADGE_TYPES).filter(([k]) => k !== 'verified' && k !== 'trader').map(([key, badge]) => {
                            const has = userBadges.includes(key);
                            return (
                              <button key={key} onClick={async () => {
                                const nb = has ? userBadges.filter(b => b !== key) : [...userBadges, key];
                                await supabase.from('profiles').update({ badges: JSON.stringify(nb) }).eq('id', u.id); loadAll();
                              }} className={`text-[10px] px-2.5 py-1.5 rounded-lg ${has ? 'border' : 'bg-white/5 text-white/30'}`}
                                style={has ? { background: badge.bg, color: badge.color, borderColor: badge.border } : {}}>
                                {badge.icon} {has ? badge.label : `${badge.label}`}
                              </button>
                            );
                          })}
                          {u.kyc_status === 'pending' && <button onClick={() => verifyUser(u.id)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-400 font-semibold">🛡️ Approve KYC</button>}
                          {u.kyc_status === 'pending' && <button onClick={() => rejectUser(u.id)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400">❌ Reject KYC</button>}
                          {u.id !== user.id && (
                            <button onClick={async () => { await supabase.from('profiles').update({ is_admin: !u.is_admin }).eq('id', u.id); loadAll(); }}
                              className={`text-[10px] px-2.5 py-1.5 rounded-lg ${u.is_admin ? 'bg-purple-500/15 text-purple-400' : 'bg-white/5 text-white/30'}`}>
                              {u.is_admin ? 'Remove Admin' : '⚙️ Make Admin'}
                            </button>
                          )}
                          {u.id !== user.id && (
                            <button onClick={async () => {
                              if (u.is_suspended) { await supabase.from('profiles').update({ is_suspended: false, suspension_reason: '' }).eq('id', u.id); }
                              else { const r = prompt('Suspension reason:'); if (!r) return; await supabase.from('profiles').update({ is_suspended: true, suspension_reason: r }).eq('id', u.id); }
                              loadAll();
                            }} className={`text-[10px] px-2.5 py-1.5 rounded-lg ${u.is_suspended ? 'bg-green-500/15 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              {u.is_suspended ? '✅ Unsuspend' : '⛔ Suspend'}
                            </button>
                          )}
                        </div>
                        {u.suspension_reason && <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded-lg">Reason: {u.suspension_reason}</div>}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}

            {/* ===== KYC QUEUE ===== */}
            {tab === 'kyc' && (
              <div className="space-y-6">
                {/* PENDING */}
                <div>
                  <div className="text-xs text-white/30 mb-2 font-bold uppercase">⏳ Pending ({kycQueue.length})</div>
                  {kycQueue.length === 0 && <div className="text-center py-8 text-white/20 text-sm">No pending KYC requests ✓</div>}
                  <div className="space-y-3">
                    {kycQueue.map(u => (
                      <div key={u.id} className="glass-light rounded-xl p-4 space-y-3 border border-yellow-500/20">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{u.avatar_emoji || '😎'}</span>
                          <div className="flex-1">
                            <div className="font-bold text-sm">{u.display_name} <span className="text-white/25 font-normal">@{u.username}</span></div>
                            <div className="text-[10px] text-white/30">Submitted {timeAgo(u.kyc_submitted_at)} · {u.email || 'No email'}</div>
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
                </div>

                {/* APPROVED */}
                <div>
                  <div className="text-xs text-white/30 mb-2 font-bold uppercase">✅ Approved ({approvedKyc.length})</div>
                  <div className="space-y-2">
                    {approvedKyc.map(u => (
                      <div key={u.id} className="glass-light rounded-xl p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{u.avatar_emoji || '😎'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5"><span className="font-bold text-sm truncate">{u.display_name}</span><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold">VERIFIED</span></div>
                            <div className="text-[10px] text-white/30">{u.kyc_full_name} · {u.kyc_phone} · {u.kyc_country} · {u.kyc_id_type}: {u.kyc_id_number}</div>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {u.kyc_id_photo_url && <a href={u.kyc_id_photo_url} target="_blank" rel="noreferrer"><img src={u.kyc_id_photo_url} alt="ID" className="w-10 h-8 object-cover rounded border border-white/10" /></a>}
                            {u.kyc_selfie_url && <a href={u.kyc_selfie_url} target="_blank" rel="noreferrer"><img src={u.kyc_selfie_url} alt="Self" className="w-10 h-8 object-cover rounded border border-white/10" /></a>}
                          </div>
                        </div>
                      </div>
                    ))}
                    {approvedKyc.length === 0 && <div className="text-center py-6 text-white/20 text-sm">No approved KYCs yet</div>}
                  </div>
                </div>
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

            {/* ===== TRADE ROLES ===== */}
            {tab === 'roles' && (
              <div className="space-y-4">
                <div className="text-xs text-white/30 mb-2">Users pick a role when creating trades. Add custom roles below.</div>

                {/* Add new role */}
                <div className="glass-light rounded-xl p-4 space-y-3">
                  <div className="text-sm font-bold">➕ Add New Role</div>
                  <div className="flex gap-2">
                    <input value={newRole.icon} onChange={e => setNewRole({ ...newRole, icon: e.target.value })} placeholder="🎭" className="input-field w-14 text-center text-lg" style={{ fontSize: '16px' }} />
                    <input value={newRole.name} onChange={e => setNewRole({ ...newRole, name: e.target.value })} placeholder="Role name (e.g. Agent)" className="input-field flex-1 text-sm" style={{ fontSize: '16px' }} />
                  </div>
                  <input value={newRole.description} onChange={e => setNewRole({ ...newRole, description: e.target.value })} placeholder="Description (shown to users)" className="input-field text-sm" style={{ fontSize: '16px' }} />
                  <button onClick={async () => {
                    if (!newRole.name.trim()) return;
                    const order = tradeRoles.length + 1;
                    await supabase.from('trade_roles').insert({ ...newRole, display_order: order });
                    setNewRole({ name: '', icon: '👤', description: '' });
                    loadAll();
                  }} disabled={!newRole.name.trim()} className="btn-primary py-2 px-4 text-sm disabled:opacity-30">Add Role</button>
                </div>

                {/* Existing roles */}
                <div className="space-y-2">
                  {tradeRoles.map(r => (
                    <div key={r.id} className={`glass-light rounded-xl p-4 flex items-center gap-3 ${!r.is_active ? 'opacity-40' : ''}`}>
                      <span className="text-2xl">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm">{r.name}</div>
                        <div className="text-xs text-white/30">{r.description || 'No description'}</div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={async () => {
                          await supabase.from('trade_roles').update({ is_active: !r.is_active }).eq('id', r.id);
                          loadAll();
                        }} className={`text-[10px] px-2.5 py-1.5 rounded-lg ${r.is_active ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-white/30'}`}>
                          {r.is_active ? '✅ Active' : '⏸️ Disabled'}
                        </button>
                        <button onClick={async () => {
                          const newName = prompt('Edit role name:', r.name);
                          if (!newName) return;
                          const newIcon = prompt('Edit icon:', r.icon) || r.icon;
                          const newDesc = prompt('Edit description:', r.description) || r.description;
                          await supabase.from('trade_roles').update({ name: newName, icon: newIcon, description: newDesc }).eq('id', r.id);
                          loadAll();
                        }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white/5 text-white/30">✏️ Edit</button>
                        <button onClick={async () => {
                          if (!confirm(`Delete "${r.name}" role?`)) return;
                          await supabase.from('trade_roles').delete().eq('id', r.id);
                          loadAll();
                        }} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400">🗑️</button>
                      </div>
                    </div>
                  ))}
                  {tradeRoles.length === 0 && <div className="text-center py-8 text-white/20 text-sm">No roles yet. Add some above!</div>}
                </div>
              </div>
            )}

            {/* ===== FEEDBACK ===== */}
            {tab === 'feedback' && (
              <div className="space-y-2">
                <div className="text-xs text-white/30 mb-2">{feedbackList.length} feedback items</div>
                {feedbackList.length === 0 && <div className="text-center py-12 text-white/20">No feedback yet</div>}
                {feedbackList.map(f => {
                  const typeConfig = { feature: { icon: '💡', color: 'text-blue-400', bg: 'bg-blue-500/10' }, bug: { icon: '🐛', color: 'text-red-400', bg: 'bg-red-500/10' }, complaint: { icon: '⚠️', color: 'text-yellow-400', bg: 'bg-yellow-500/10' }, other: { icon: '💬', color: 'text-white/50', bg: 'bg-white/5' } };
                  const tc = typeConfig[f.type] || typeConfig.other;
                  const statusColors = { new: 'bg-blue-500/15 text-blue-400', reviewing: 'bg-yellow-500/15 text-yellow-400', planned: 'bg-purple-500/15 text-purple-400', done: 'bg-green-500/15 text-green-400', dismissed: 'bg-white/5 text-white/30' };
                  return (
                    <div key={f.id} className="glass-light rounded-xl p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${tc.bg} ${tc.color} font-bold`}>{tc.icon} {f.type}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${statusColors[f.status] || statusColors.new}`}>{f.status?.toUpperCase()}</span>
                        <span className="text-[10px] text-white/20 ml-auto">{timeAgo(f.created_at)}</span>
                      </div>
                      <div className="text-sm text-white/80 whitespace-pre-wrap">{f.message}</div>
                      <div className="flex items-center gap-2 text-[10px] text-white/30">
                        <span>{f.profiles?.avatar_emoji || '😎'}</span>
                        <span>{f.profiles?.display_name || 'Unknown'}</span>
                        <span>@{f.profiles?.username || '?'}</span>
                        {f.profiles?.email && <span className="text-white/20">· {f.profiles.email}</span>}
                      </div>
                      {f.admin_reply && <div className="p-2 rounded-lg bg-green-500/8 text-xs text-green-300">🛡️ Reply: {f.admin_reply}</div>}
                      <div className="flex gap-1.5 pt-1">
                        {['new','reviewing','planned','done','dismissed'].map(s => (
                          <button key={s} onClick={async () => { await supabase.from('feedback').update({ status: s, updated_at: new Date().toISOString() }).eq('id', f.id); loadAll(); }}
                            className={`text-[9px] px-2 py-1 rounded-lg ${f.status === s ? statusColors[s] + ' font-bold' : 'bg-white/3 text-white/25'}`}>{s}</button>
                        ))}
                        <button onClick={async () => {
                          const reply = prompt('Reply to user (they\'ll see this):');
                          if (!reply) return;
                          await supabase.from('feedback').update({ admin_reply: reply, status: 'reviewing', updated_at: new Date().toISOString() }).eq('id', f.id);
                          loadAll();
                        }} className="text-[9px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 ml-auto">💬 Reply</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ===== REFERRALS ===== */}
            {tab === 'referrals' && (
              <div className="space-y-3">
                <div className="text-xs text-white/30 mb-2">Referral leaderboard — qualified = referred user made a post</div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="glass-light rounded-xl p-3 text-center"><div className="text-xl font-black">{topReferrers.reduce((s, u) => s + (u.referral_count || 0), 0)}</div><div className="text-[10px] text-white/30">Total Signups</div></div>
                  <div className="glass-light rounded-xl p-3 text-center"><div className="text-xl font-black text-green-400">{topReferrers.reduce((s, u) => s + (u.qualified_referrals || 0), 0)}</div><div className="text-[10px] text-white/30">Qualified</div></div>
                  <div className="glass-light rounded-xl p-3 text-center"><div className="text-xl font-black text-[var(--accent)]">{topReferrers.filter(u => (u.referral_count || 0) > 0).length}</div><div className="text-[10px] text-white/30">Active Referrers</div></div>
                </div>
                {topReferrers.filter(u => (u.referral_count || 0) > 0 || (u.qualified_referrals || 0) > 0).length === 0 && (
                  <div className="text-center py-12 text-white/20 text-sm">No referrals yet</div>
                )}
                {topReferrers.filter(u => (u.referral_count || 0) > 0 || (u.qualified_referrals || 0) > 0).map((u, i) => (
                  <div key={u.id} className="glass-light rounded-xl p-3 flex items-center gap-3">
                    <div className="text-center w-8 shrink-0"><div className="text-sm font-black text-white/20">#{i + 1}</div></div>
                    <span className="text-xl">{u.avatar_emoji || '😎'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm truncate">{u.display_name}</span>
                        <InlineBadges profile={u} />
                      </div>
                      <div className="text-[10px] text-white/30">@{u.username} · Code: <span className="font-mono text-white/50">{u.referral_code}</span></div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{u.referral_count || 0} <span className="text-[10px] text-white/30 font-normal">signups</span></div>
                      <div className="text-xs text-green-400 font-bold">{u.qualified_referrals || 0} <span className="text-[10px] text-green-400/50 font-normal">qualified</span></div>
                    </div>
                    <div className="shrink-0 text-right text-[9px] text-white/20 w-16">
                      {(u.qualified_referrals || 0) >= 50 ? '✔ Verified' : (u.qualified_referrals || 0) >= 30 ? '👑 VIP' : (u.qualified_referrals || 0) >= 15 ? '💎 OG' : (u.qualified_referrals || 0) >= 5 ? '⭐ Creator' : 'No badge'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ===== SITE SETTINGS ===== */}
            {tab === 'site' && (
              <div className="space-y-6">
                <div className="glass-light rounded-xl p-5">
                  <h3 className="font-bold text-base mb-1">🎬 Tutorial Video</h3>
                  <p className="text-xs text-white/30 mb-4">Upload a video showing users how to add the app to their home screen. It will appear on the landing page and feed.</p>

                  {tutorialUrl ? (
                    <div className="space-y-3">
                      <video src={tutorialUrl} controls className="w-full rounded-xl border border-white/10" style={{ maxHeight: '300px' }} />
                      <div className="flex gap-2">
                        <label className="btn-primary py-2 px-4 text-xs cursor-pointer flex-1 text-center">
                          🔄 Replace Video
                          <input type="file" accept="video/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingTut(true);
                            try {
                              // Delete old
                              const { data: old } = await supabase.storage.from('media').list('site');
                              if (old?.length) await supabase.storage.from('media').remove(old.map(f => 'site/' + f.name));
                              // Upload new
                              const ext = file.name.split('.').pop();
                              const { data, error } = await supabase.storage.from('media').upload(`site/tutorial.${ext}`, file, { contentType: file.type, upsert: true });
                              if (data && !error) { const { data: u } = supabase.storage.from('media').getPublicUrl(data.path); setTutorialUrl(u.publicUrl); }
                            } catch(err) {}
                            setUploadingTut(false);
                          }} />
                        </label>
                        <button onClick={async () => {
                          if (!confirm('Remove tutorial video?')) return;
                          const { data: old } = await supabase.storage.from('media').list('site');
                          if (old?.length) await supabase.storage.from('media').remove(old.map(f => 'site/' + f.name));
                          setTutorialUrl('');
                        }} className="text-xs px-4 py-2 rounded-lg bg-red-500/10 text-red-400">🗑️ Remove</button>
                      </div>
                    </div>
                  ) : (
                    <label className={`block w-full py-12 rounded-xl border-2 border-dashed border-white/10 hover:border-[var(--accent)]/30 text-center cursor-pointer transition ${uploadingTut ? 'opacity-50' : ''}`}>
                      {uploadingTut ? (
                        <><span className="animate-spin text-2xl block mb-2">⏳</span><span className="text-sm text-white/40">Uploading video...</span></>
                      ) : (
                        <><span className="text-4xl block mb-2">🎬</span><span className="text-sm text-white/40">Tap to upload tutorial video</span><br/><span className="text-[10px] text-white/20">MP4, MOV, WebM — max 50MB</span></>
                      )}
                      <input type="file" accept="video/*" className="hidden" disabled={uploadingTut} onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingTut(true);
                        try {
                          const ext = file.name.split('.').pop();
                          const { data, error } = await supabase.storage.from('media').upload(`site/tutorial.${ext}`, file, { contentType: file.type, upsert: true });
                          if (data && !error) { const { data: u } = supabase.storage.from('media').getPublicUrl(data.path); setTutorialUrl(u.publicUrl); }
                        } catch(err) {}
                        setUploadingTut(false);
                      }} />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* ===== DIAGNOSTICS ===== */}
            {tab === 'diagnostics' && (
              <DiagnosticsPanel supabase={supabase} user={user} />
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

// ===== DIAGNOSTICS TEST PANEL =====
function DiagnosticsPanel({ supabase, user }) {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [mode, setMode] = useState('system'); // system | bugs

  const add = (cat, name, status, detail) => {
    setResults(prev => [...prev, { cat, name, status, detail }]);
  };

  // ===== SYSTEM CHECKS =====
  const runSystem = async () => {
    setResults([]); setRunning(true); setDone(false);

    try { const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }); add('DB', 'Database', '✅', `Connected — ${count} profiles`); } catch(e) { add('DB', 'Database', '❌', e.message); }
    try { const { data: { session } } = await supabase.auth.getSession(); add('Auth', 'Session', session ? '✅' : '⚠️', session ? session.user.email : 'No session'); } catch(e) { add('Auth', 'Session', '❌', e.message); }
    try { const { data } = await supabase.from('profiles').select('id,email,is_verified,badges,is_suspended,last_ip,login_count,xp,trade_count,referral_code').limit(1); const cols = data?.[0] ? Object.keys(data[0]) : []; add('DB', 'Profile Columns', '✅', `${cols.length} columns`); } catch(e) { add('DB', 'Profile Columns', '❌', e.message); }

    const tables = ['posts','messages','trades','notifications','trade_roles','trade_categories','escrow_settings','push_subscriptions','feedback','user_sessions','trade_participants','conversation_members','conversations','likes','bookmarks','reposts','comments','friendships'];
    for (const t of tables) {
      try { const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true }); add('Tables', t, error ? '❌' : '✅', error ? error.message : `${count} rows`); } catch(e) { add('Tables', t, '❌', e.message); }
    }

    try { const { data } = await supabase.storage.from('media').list('', { limit: 1 }); add('Storage', 'Media Bucket', '✅', 'Accessible'); } catch(e) { add('Storage', 'Media Bucket', '❌', e.message); }
    try { const res = await fetch('/api/push?userId=' + user.id); const d = await res.json(); add('Push', 'Push API', d.vapid_set && d.service_role ? '✅' : '⚠️', `VAPID:${d.vapid_set?'✅':'❌'} DB:${d.supabase_url?'✅':'❌'} Key:${d.service_role?'✅':'❌'} Subs:${d.subscriptions??'?'}`); } catch(e) { add('Push', 'Push API', '❌', e.message); }
    try { const reg = await navigator.serviceWorker?.getRegistration(); add('SW', 'Service Worker', reg?.active ? '✅' : '⚠️', reg ? `State: ${reg.active?.state}` : 'Not registered'); } catch(e) { add('SW', 'Service Worker', '⚠️', e.message); }
    try { add('Notif', 'Permission', Notification.permission === 'granted' ? '✅' : '⚠️', Notification.permission); } catch(e) { add('Notif', 'Permission', '⚠️', 'N/A'); }
    try { const ch = supabase.channel('test-rt'); const s = await new Promise(r => { ch.subscribe(s => r(s)); setTimeout(() => r('timeout'), 3000); }); supabase.removeChannel(ch); add('Realtime', 'WebSocket', s === 'SUBSCRIBED' ? '✅' : '⚠️', s); } catch(e) { add('Realtime', 'WebSocket', '❌', e.message); }

    setRunning(false); setDone(true);
  };

  // ===== BUG TESTS (real CRUD operations) =====
  const runBugs = async () => {
    setResults([]); setRunning(true); setDone(false);
    const testId = 'test_' + Date.now();

    // Test 1: Auth token valid
    add('🔐', 'Auth Token', '⏳', 'Checking...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (session?.access_token) { setResults(prev => prev.map(r => r.name === 'Auth Token' ? { ...r, status: '✅', detail: `Token valid, expires ${new Date(session.expires_at * 1000).toLocaleTimeString()}` } : r)); }
      else { setResults(prev => prev.map(r => r.name === 'Auth Token' ? { ...r, status: '❌', detail: 'No valid session — auth is broken' } : r)); }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Auth Token' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 2: Can INSERT a post
    add('📝', 'Create Post', '⏳', 'Testing...');
    let testPostId = null;
    try {
      const { data, error } = await supabase.from('posts').insert({ user_id: user.id, content: `[BUG TEST — will delete] ${testId}`, source_platform: 'midashub', is_public: false }).select().single();
      if (error) { setResults(prev => prev.map(r => r.name === 'Create Post' ? { ...r, status: '❌', detail: `INSERT failed: ${error.message}` } : r)); }
      else { testPostId = data.id; setResults(prev => prev.map(r => r.name === 'Create Post' ? { ...r, status: '✅', detail: `Created post ${data.id.slice(0,8)}` } : r)); }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Create Post' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 3: Can LIKE a post
    add('❤️', 'Like Post', '⏳', 'Testing...');
    if (testPostId) {
      try {
        const { error } = await supabase.from('likes').insert({ user_id: user.id, post_id: testPostId });
        if (error) setResults(prev => prev.map(r => r.name === 'Like Post' ? { ...r, status: '❌', detail: `Like INSERT failed: ${error.message}` } : r));
        else {
          // Verify it saved
          const { count } = await supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', testPostId).eq('user_id', user.id);
          setResults(prev => prev.map(r => r.name === 'Like Post' ? { ...r, status: count > 0 ? '✅' : '❌', detail: count > 0 ? 'Liked + verified in DB' : 'Like inserted but not found!' } : r));
          // Clean up
          await supabase.from('likes').delete().match({ user_id: user.id, post_id: testPostId });
        }
      } catch(e) { setResults(prev => prev.map(r => r.name === 'Like Post' ? { ...r, status: '❌', detail: e.message } : r)); }
    } else { setResults(prev => prev.map(r => r.name === 'Like Post' ? { ...r, status: '⏭️', detail: 'Skipped — no test post' } : r)); }

    // Test 4: Can COMMENT
    add('💬', 'Comment', '⏳', 'Testing...');
    if (testPostId) {
      try {
        const { data, error } = await supabase.from('comments').insert({ user_id: user.id, post_id: testPostId, content: `Test comment ${testId}` }).select().single();
        if (error) setResults(prev => prev.map(r => r.name === 'Comment' ? { ...r, status: '❌', detail: `Comment INSERT failed: ${error.message}` } : r));
        else {
          setResults(prev => prev.map(r => r.name === 'Comment' ? { ...r, status: '✅', detail: 'Comment created + verified' } : r));
          await supabase.from('comments').delete().eq('id', data.id);
        }
      } catch(e) { setResults(prev => prev.map(r => r.name === 'Comment' ? { ...r, status: '❌', detail: e.message } : r)); }
    } else { setResults(prev => prev.map(r => r.name === 'Comment' ? { ...r, status: '⏭️', detail: 'Skipped' } : r)); }

    // Test 5: Can BOOKMARK
    add('🔖', 'Bookmark', '⏳', 'Testing...');
    if (testPostId) {
      try {
        const { error } = await supabase.from('bookmarks').insert({ user_id: user.id, post_id: testPostId });
        if (error) setResults(prev => prev.map(r => r.name === 'Bookmark' ? { ...r, status: '❌', detail: error.message } : r));
        else {
          setResults(prev => prev.map(r => r.name === 'Bookmark' ? { ...r, status: '✅', detail: 'Bookmark saved + verified' } : r));
          await supabase.from('bookmarks').delete().match({ user_id: user.id, post_id: testPostId });
        }
      } catch(e) { setResults(prev => prev.map(r => r.name === 'Bookmark' ? { ...r, status: '❌', detail: e.message } : r)); }
    } else { setResults(prev => prev.map(r => r.name === 'Bookmark' ? { ...r, status: '⏭️', detail: 'Skipped' } : r)); }

    // Test 6: Can UPDATE profile
    add('👤', 'Update Profile', '⏳', 'Testing...');
    try {
      const { error } = await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
      setResults(prev => prev.map(r => r.name === 'Update Profile' ? { ...r, status: error ? '❌' : '✅', detail: error ? error.message : 'Profile update works' } : r));
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Update Profile' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 7: Can INSERT notification
    add('🔔', 'Notification Insert', '⏳', 'Testing...');
    try {
      const { data, error } = await supabase.from('notifications').insert({ user_id: user.id, from_user_id: user.id, type: 'system', content: `[Test] ${testId}` }).select().single();
      if (error) setResults(prev => prev.map(r => r.name === 'Notification Insert' ? { ...r, status: '❌', detail: error.message } : r));
      else {
        setResults(prev => prev.map(r => r.name === 'Notification Insert' ? { ...r, status: '✅', detail: 'Notification created' } : r));
        await supabase.from('notifications').delete().eq('id', data.id);
      }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Notification Insert' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 8: Can INSERT feedback
    add('💡', 'Feedback Insert', '⏳', 'Testing...');
    try {
      const { data, error } = await supabase.from('feedback').insert({ user_id: user.id, type: 'other', message: `[Test] ${testId}` }).select().single();
      if (error) setResults(prev => prev.map(r => r.name === 'Feedback Insert' ? { ...r, status: '❌', detail: error.message } : r));
      else {
        setResults(prev => prev.map(r => r.name === 'Feedback Insert' ? { ...r, status: '✅', detail: 'Feedback created' } : r));
        await supabase.from('feedback').delete().eq('id', data.id);
      }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Feedback Insert' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 9: Can INSERT session log
    add('📍', 'Session Tracking', '⏳', 'Testing...');
    try {
      const { data, error } = await supabase.from('user_sessions').insert({ user_id: user.id, ip_address: 'test', device: 'test', browser: 'test', os: 'test' }).select().single();
      if (error) setResults(prev => prev.map(r => r.name === 'Session Tracking' ? { ...r, status: '❌', detail: error.message } : r));
      else {
        setResults(prev => prev.map(r => r.name === 'Session Tracking' ? { ...r, status: '✅', detail: 'Session log works' } : r));
        await supabase.from('user_sessions').delete().eq('id', data.id);
      }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Session Tracking' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 10: Push notification delivery
    add('📱', 'Push Send', '⏳', 'Testing...');
    try {
      const res = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, title: '🔧 Test', body: 'Bug tester notification', url: '/admin' }) });
      const d = await res.json();
      setResults(prev => prev.map(r => r.name === 'Push Send' ? { ...r, status: d.sent > 0 ? '✅' : '⚠️', detail: `Sent: ${d.sent}, Total subs: ${d.total || 0}${d.errors?.length ? ', Errors: ' + d.errors.join(',') : ''}` } : r));
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Push Send' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 11: Media upload
    add('📷', 'Media Upload', '⏳', 'Testing...');
    try {
      const blob = new Blob(['test'], { type: 'text/plain' });
      const path = `test/${user.id}/bugtest-${Date.now()}.txt`;
      const { data, error } = await supabase.storage.from('media').upload(path, blob);
      if (error) setResults(prev => prev.map(r => r.name === 'Media Upload' ? { ...r, status: '❌', detail: error.message } : r));
      else {
        setResults(prev => prev.map(r => r.name === 'Media Upload' ? { ...r, status: '✅', detail: 'Upload + public URL works' } : r));
        await supabase.storage.from('media').remove([path]);
      }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Media Upload' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 12: Auth refresh
    add('🔄', 'Auth Refresh', '⏳', 'Testing...');
    try {
      const { refreshSession } = await import('@/lib/supabase-browser');
      await refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      setResults(prev => prev.map(r => r.name === 'Auth Refresh' ? { ...r, status: session ? '✅' : '❌', detail: session ? 'Token refreshed successfully' : 'Refresh failed — session lost' } : r));
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Auth Refresh' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 13: After-refresh write (simulates background return)
    add('🔁', 'Post-Refresh Write', '⏳', 'Testing after auth refresh...');
    try {
      const { error } = await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id);
      setResults(prev => prev.map(r => r.name === 'Post-Refresh Write' ? { ...r, status: error ? '❌' : '✅', detail: error ? `Write after refresh FAILED: ${error.message}` : 'Write after refresh works — no stale auth bug' } : r));
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Post-Refresh Write' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 14: Background simulation — wait 3s then try all operations
    add('⏰', 'Background Sim (3s)', '⏳', 'Waiting 3 seconds to simulate background...');
    await new Promise(r => setTimeout(r, 3000));
    try {
      const { ensureFreshAuth } = await import('@/lib/supabase-browser');
      await ensureFreshAuth();
      // Try multiple writes after the delay
      const { data: bgPost, error: bgErr } = await supabase.from('posts').insert({ user_id: user.id, content: '[BG TEST]', source_platform: 'midashub', is_public: false }).select().single();
      if (bgErr) {
        setResults(prev => prev.map(r => r.name === 'Background Sim (3s)' ? { ...r, status: '❌', detail: `Write after 3s pause FAILED: ${bgErr.message}` } : r));
      } else {
        // Also test like
        const { error: likeErr } = await supabase.from('likes').insert({ user_id: user.id, post_id: bgPost.id });
        await supabase.from('likes').delete().match({ user_id: user.id, post_id: bgPost.id });
        await supabase.from('posts').delete().eq('id', bgPost.id);
        setResults(prev => prev.map(r => r.name === 'Background Sim (3s)' ? { ...r, status: likeErr ? '⚠️' : '✅', detail: likeErr ? `Post OK but like failed: ${likeErr.message}` : 'All writes work after 3s pause + ensureFreshAuth' } : r));
      }
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Background Sim (3s)' ? { ...r, status: '❌', detail: e.message } : r)); }

    // Test 15: Token keepalive check
    add('💓', 'Token Keepalive', '⏳', 'Checking...');
    try {
      const { isTokenStale } = await import('@/lib/supabase-browser');
      const stale = isTokenStale();
      setResults(prev => prev.map(r => r.name === 'Token Keepalive' ? { ...r, status: stale ? '⚠️' : '✅', detail: stale ? 'Token may be stale — keepalive might not be running' : 'Token is fresh — keepalive active' } : r));
    } catch(e) { setResults(prev => prev.map(r => r.name === 'Token Keepalive' ? { ...r, status: '⚠️', detail: e.message } : r)); }

    // Clean up test post
    if (testPostId) {
      await supabase.from('posts').delete().eq('id', testPostId);
      add('🧹', 'Cleanup', '✅', 'Test post deleted');
    }

    setRunning(false); setDone(true);
  };

  const passed = results.filter(r => r.status === '✅').length;
  const warned = results.filter(r => r.status === '⚠️').length;
  const failed = results.filter(r => r.status === '❌').length;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-4xl mb-2">🔧</div>
        <h3 className="text-lg font-bold">System Diagnostics & Bug Tester</h3>
        <p className="text-xs text-white/30 mb-4">Tests real operations against the database to find actual bugs</p>
        <div className="flex gap-2 justify-center mb-4">
          <button onClick={() => { setMode('system'); }} className={`text-xs px-4 py-2 rounded-lg ${mode === 'system' ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>📊 System Check</button>
          <button onClick={() => { setMode('bugs'); }} className={`text-xs px-4 py-2 rounded-lg ${mode === 'bugs' ? 'bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30' : 'bg-white/5 text-white/40'}`}>🐛 Bug Tester</button>
        </div>
        <button onClick={mode === 'system' ? runSystem : runBugs} disabled={running} className="btn-primary px-8 py-3 text-sm disabled:opacity-30">
          {running ? <><span className="animate-spin inline-block mr-2">⏳</span> Running...</> : done ? '🔄 Run Again' : mode === 'system' ? '▶️ Run System Check' : '▶️ Run Bug Tests'}
        </button>
        {mode === 'bugs' && <p className="text-[10px] text-white/20 mt-2">Creates test data, verifies it saved, then deletes it. Safe to run anytime.</p>}
      </div>

      {done && (
        <div className="flex justify-center gap-4 text-sm">
          <span className="text-green-400 font-bold">✅ {passed} passed</span>
          {warned > 0 && <span className="text-yellow-400 font-bold">⚠️ {warned} warnings</span>}
          {failed > 0 && <span className="text-red-400 font-bold">❌ {failed} failed</span>}
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-1">
          {results.map((r, i) => (
            <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg ${r.status === '✅' ? 'bg-green-500/5' : r.status === '⚠️' ? 'bg-yellow-500/5' : r.status === '❌' ? 'bg-red-500/8' : 'bg-white/3'}`}>
              <span className="text-sm shrink-0">{r.status}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{r.cat && <span className="text-white/30 mr-1">[{r.cat}]</span>}{r.name}</div>
                <div className="text-[10px] text-white/30 break-words">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

