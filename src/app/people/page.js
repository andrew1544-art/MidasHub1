'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { RankBadge } from '@/components/RankBadge';
import { InlineBadges } from '@/components/Badge';
import { useStore } from '@/lib/store';
import { createClient, ensureFreshAuth } from '@/lib/supabase-browser';
import { sendNotification } from '@/lib/notifications';
import { timeAgo } from '@/lib/constants';

export default function PeoplePage() {
  const { user, setShowAuth, showToast } = useStore();
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('discover');
  const [friendIds, setFriendIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => {
    const safety = setTimeout(() => setLoading(false), 3000);
    fetchData().finally(() => clearTimeout(safety));
  }, [user, tab]);

  // Refetch when app resumes from background
  useEffect(() => {
    const onResumed = () => fetchData();
    window.addEventListener('midashub:resumed', onResumed);
    return () => window.removeEventListener('midashub:resumed', onResumed);
  }, [user, tab]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    if (tab === 'discover') {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(60);
      let results = (data || []).filter(p => p.id !== user?.id);
      if (user) {
        const { data: ships } = await supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
        const fIds = new Set(), pIds = new Set();
        (ships || []).forEach(f => {
          const other = f.requester_id === user.id ? f.addressee_id : f.requester_id;
          if (f.status === 'accepted') fIds.add(other);
          if (f.status === 'pending' && f.requester_id === user.id) pIds.add(other);
        });
        setFriendIds(fIds); setPendingIds(pIds);
      }
      setPeople(results);
    } else if (tab === 'friends' && user) {
      const { data: ships } = await supabase.from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');
      setFriends((ships || []).map(f => f.requester_id === user.id ? f.addressee : f.requester));
    } else if (tab === 'requests' && user) {
      const { data } = await supabase.from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', user.id).eq('status', 'pending');
      setRequests(data || []);
    }
    setLoading(false);
  };

  const sendRequest = async (id) => {
    if (!user) return setShowAuth(true);
    await ensureFreshAuth();
    const supabase = createClient();
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: id });
    setPendingIds(prev => new Set([...prev, id]));
    sendNotification({ toUserId: id, fromUserId: user.id, type: 'friend_request', content: 'sent you a friend request 👋' });
    showToast('Friend request sent ✓');
  };

  const acceptReq = async (shipId, requesterId) => {
    await ensureFreshAuth();
    const supabase = createClient();
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', shipId);
    setRequests(prev => prev.filter(r => r.id !== shipId));
    sendNotification({ toUserId: requesterId, fromUserId: user.id, type: 'friend_accepted', content: 'accepted your friend request 🤝' });
    showToast('Friend request accepted ✓');
  };

  const declineReq = async (shipId) => {
    await ensureFreshAuth();
    const supabase = createClient();
    await supabase.from('friendships').delete().eq('id', shipId);
    setRequests(prev => prev.filter(r => r.id !== shipId));
  };

  const PersonCard = ({ person, isFriend = false }) => (
    <div className="glass-light rounded-2xl p-5 hover-lift text-center transition-all">
      <Link href={`/profile/${person.username}`} className="block group">
        <div className="text-5xl mb-3 group-hover:scale-110 transition-transform inline-block">{person.avatar_emoji || '😎'}</div>
        <div className="font-bold text-sm truncate">{person.display_name}</div>
        <div className="text-xs text-white/25 truncate mt-0.5">@{person.username}</div>
        <div className="flex justify-center gap-1.5 mt-1.5">
          <RankBadge xp={person.xp || 0} size="xs" />
          <InlineBadges profile={person} />
        </div>
      </Link>
      {person.bio && <div className="text-xs text-white/35 mt-2 line-clamp-2 leading-relaxed">{person.bio}</div>}
      {person.location && <div className="text-[11px] text-white/15 mt-1.5">📍 {person.location}</div>}

      {user && person.id !== user.id && (
        <div className="flex gap-2 mt-4">
          {isFriend || friendIds.has(person.id) ? (
            <span className="flex-1 py-2.5 rounded-xl bg-green-500/10 text-green-400 text-xs font-semibold text-center">✓ Friends</span>
          ) : pendingIds.has(person.id) ? (
            <span className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/25 text-xs font-semibold text-center">⏳ Pending</span>
          ) : (
            <button onClick={() => sendRequest(person.id)} className="flex-1 py-2.5 rounded-xl btn-primary text-xs">+ Add Friend</button>
          )}
          <Link href={`/chat?user=${person.id}`}
            className="w-11 h-11 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-lg hover:bg-white/10 transition">💬</Link>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">👥</span>
          <h1 className="text-2xl sm:text-3xl font-black">People</h1>
        </div>
        <p className="text-white/30 text-sm ml-12 mb-6">Discover, connect, and chat with people from everywhere</p>

        <div className="flex gap-2 mb-6">
          {[
            { key: 'discover', icon: '🌍', label: 'Discover' },
            { key: 'friends', icon: '🤝', label: 'Friends' },
            { key: 'requests', icon: '📩', label: `Requests${requests.length > 0 ? ` (${requests.length})` : ''}` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`platform-pill px-4 py-2 rounded-xl text-sm ${tab === t.key ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="glass-light rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-full skeleton mx-auto mb-3"/>
                <div className="h-4 w-20 skeleton mx-auto mb-2"/>
                <div className="h-3 w-14 skeleton mx-auto"/>
              </div>
            ))}
          </div>
        ) : tab === 'discover' ? (
          people.length === 0 ? (
            <div className="text-center py-20 text-white/25">
              <div className="text-5xl mb-3">🌍</div>
              <p>No one here yet. Be the first!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {people.map(p => <PersonCard key={p.id} person={p}/>)}
            </div>
          )
        ) : tab === 'friends' ? (
          !user ? (
            <div className="text-center py-20">
              <p className="text-white/30 mb-4">Log in to see friends</p>
              <button onClick={() => setShowAuth(true)} className="btn-primary">Log In</button>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-20 text-white/25">
              <div className="text-5xl mb-3">🤝</div>
              <p>No friends yet — go discover people!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {friends.map(p => <PersonCard key={p.id} person={p} isFriend/>)}
            </div>
          )
        ) : tab === 'requests' ? (
          !user ? (
            <div className="text-center py-20">
              <p className="text-white/30 mb-4">Log in to see requests</p>
              <button onClick={() => setShowAuth(true)} className="btn-primary">Log In</button>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-20 text-white/25">
              <div className="text-5xl mb-3">📩</div>
              <p>No pending requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="glass-light rounded-xl p-4 flex items-center gap-4 animate-slide-up">
                  <Link href={`/profile/${req.requester.username}`} className="text-3xl shrink-0">{req.requester.avatar_emoji || '😎'}</Link>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{req.requester.display_name}</div>
                    <div className="text-xs text-white/25 truncate">@{req.requester.username} · {timeAgo(req.created_at)}</div>
                  </div>
                  <button onClick={() => acceptReq(req.id, req.requester_id)} className="btn-primary py-2 px-4 text-xs">Accept</button>
                  <button onClick={() => declineReq(req.id)} className="btn-secondary py-2 px-4 text-xs">Decline</button>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </AppShell>
  );
}
