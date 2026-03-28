'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { timeAgo } from '@/lib/constants';

export default function PeoplePage() {
  const { user, setShowAuth, showToast } = useStore();
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('discover');
  const [friendIds, setFriendIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => { fetchData(); }, [user, tab]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();
    let fIds = new Set(); let pIds = new Set();

    // Always load friendship status for logged in users
    if (user) {
      const { data: friendships } = await supabase.from('friendships').select('*').or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
      (friendships || []).forEach((f) => {
        const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
        if (f.status === 'accepted') fIds.add(otherId);
        if (f.status === 'pending' && f.requester_id === user.id) pIds.add(otherId);
      });
      setFriendIds(fIds); setPendingIds(pIds);
    }

    if (tab === 'discover') {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50);
      setPeople((data || []).filter((p) => p.id !== user?.id));
    } else if (tab === 'friends' && user) {
      const { data: friendships } = await supabase.from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted');
      const list = (friendships || []).map((f) => f.requester_id === user.id ? f.addressee : f.requester);
      setFriends(list);

      // Friend suggestions: people your friends are friends with (but not you)
      const friendIdList = list.map((f) => f.id);
      if (friendIdList.length > 0) {
        const { data: fof } = await supabase.from('friendships')
          .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
          .or(friendIdList.map((id) => `requester_id.eq.${id},addressee_id.eq.${id}`).join(','))
          .eq('status', 'accepted').limit(30);
        const suggestedMap = new Map();
        (fof || []).forEach((f) => {
          const other = f.requester_id === user.id ? null : f.addressee_id === user.id ? null :
            friendIdList.includes(f.requester_id) ? f.addressee : friendIdList.includes(f.addressee_id) ? f.requester : null;
          if (other && other.id !== user.id && !fIds.has(other.id) && !pIds.has(other.id)) {
            suggestedMap.set(other.id, other);
          }
        });
        setSuggestions(Array.from(suggestedMap.values()).slice(0, 6));
      } else {
        // No friends yet — suggest random people
        const { data: random } = await supabase.from('profiles').select('*').neq('id', user.id).limit(6);
        setSuggestions((random || []).filter((p) => !fIds.has(p.id) && !pIds.has(p.id)));
      }
    } else if (tab === 'requests' && user) {
      const { data } = await supabase.from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', user.id).eq('status', 'pending');
      setPendingReceived(data || []);
    }
    setLoading(false);
  };

  const sendFriendRequest = async (targetId) => {
    if (!user) return setShowAuth(true);
    const supabase = createClient();
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: targetId });
    setPendingIds((prev) => new Set([...prev, targetId]));
    await supabase.from('notifications').insert({ user_id: targetId, from_user_id: user.id, type: 'friend_request' });
    showToast('Friend request sent ✓');
  };

  const acceptRequest = async (friendshipId, requesterId) => {
    const supabase = createClient();
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    setPendingReceived((prev) => prev.filter((r) => r.id !== friendshipId));
    await supabase.from('notifications').insert({ user_id: requesterId, from_user_id: user.id, type: 'friend_accepted' });
    showToast('Friend added! 🤝');
  };

  const removeFriend = async (targetId) => {
    const supabase = createClient();
    await supabase.from('friendships').delete().or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`);
    setFriendIds((prev) => { const n = new Set(prev); n.delete(targetId); return n; });
    setFriends((prev) => prev.filter((f) => f.id !== targetId));
    showToast('Unfriended');
  };

  const PersonCard = ({ person, showActions = true }) => (
    <div className="glass-light rounded-2xl p-4 hover-lift text-center">
      <Link href={`/profile/${person.username}`}>
        <div className="text-4xl mb-2 hover:scale-110 transition-transform inline-block">{person.avatar_emoji || '😎'}</div>
        <div className="font-bold text-sm">{person.display_name}</div>
        <div className="text-[11px] text-white/25 mt-0.5">@{person.username}</div>
      </Link>
      {person.bio && <div className="text-xs text-white/40 mt-1.5 line-clamp-2">{person.bio}</div>}
      {showActions && user && person.id !== user.id && (
        <div className="flex gap-1.5 mt-3">
          {friendIds.has(person.id) ? (
            <button onClick={() => removeFriend(person.id)} className="flex-1 py-2 rounded-xl bg-white/5 text-cyan-400 text-xs font-semibold transition hover:bg-red-500/10 hover:text-red-400">✓ Friends</button>
          ) : pendingIds.has(person.id) ? (
            <button className="flex-1 py-2 rounded-xl bg-white/5 text-white/25 text-xs cursor-default">⏳ Pending</button>
          ) : (
            <button onClick={() => sendFriendRequest(person.id)} className="flex-1 py-2 rounded-xl btn-primary text-xs">+ Add</button>
          )}
          <Link href={`/chat?user=${person.id}`} className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-base hover:bg-white/10 transition">💬</Link>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <h1 className="text-2xl sm:text-3xl font-black mb-1">👥 People</h1>
        <p className="text-white/30 text-sm mb-4 sm:mb-5">Discover, connect, and chat</p>

        <div className="flex gap-1.5 mb-4 sm:mb-5">
          {[
            { key: 'discover', icon: '🌍', label: 'Discover' },
            { key: 'friends', icon: '🤝', label: 'Friends' },
            { key: 'requests', icon: '📩', label: `Requests${pendingReceived.length > 0 ? ` (${pendingReceived.length})` : ''}` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`platform-pill px-3 py-1.5 rounded-xl text-sm ${tab === t.key ? 'bg-white/10 text-white font-bold' : 'bg-white/4 text-white/35'}`}>{t.icon} {t.label}</button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[1,2,3,4,5,6].map((i) => <div key={i} className="glass-light rounded-2xl p-5 text-center"><div className="w-10 h-10 rounded-full skeleton mx-auto mb-2" /><div className="h-3.5 w-20 skeleton mx-auto mb-1.5" /><div className="h-3 w-14 skeleton mx-auto" /></div>)}</div>
        ) : tab === 'discover' ? (
          people.length === 0 ? <div className="text-center py-14 text-white/25 text-sm">No people found yet</div> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{people.map((p) => <PersonCard key={p.id} person={p} />)}</div>
          )
        ) : tab === 'friends' ? (
          !user ? <div className="text-center py-14"><p className="text-white/30 mb-3">Log in to see friends</p><button onClick={() => setShowAuth(true)} className="btn-primary">Log In</button></div> : (
            <>
              {/* Friend suggestions */}
              {suggestions.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-bold text-sm mb-3 text-white/50">💡 People you may know</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {suggestions.map((p) => <PersonCard key={p.id} person={p} />)}
                  </div>
                </div>
              )}
              {friends.length === 0 ? <div className="text-center py-14 text-white/25 text-sm">No friends yet — start connecting!</div> : (
                <>
                  <h3 className="font-bold text-sm mb-3 text-white/50">Your friends ({friends.length})</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{friends.map((p) => <PersonCard key={p.id} person={p} showActions={false} />)}</div>
                </>
              )}
            </>
          )
        ) : tab === 'requests' ? (
          !user ? <div className="text-center py-14"><p className="text-white/30 mb-3">Log in to see requests</p><button onClick={() => setShowAuth(true)} className="btn-primary">Log In</button></div> : (
            pendingReceived.length === 0 ? <div className="text-center py-14 text-white/25 text-sm">No pending requests</div> : (
              <div className="space-y-2">{pendingReceived.map((req) => (
                <div key={req.id} className="glass-light rounded-xl p-3 sm:p-4 flex items-center gap-3">
                  <Link href={`/profile/${req.requester.username}`} className="text-2xl sm:text-3xl">{req.requester.avatar_emoji || '😎'}</Link>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm truncate">{req.requester.display_name}</div>
                    <div className="text-[11px] text-white/25">@{req.requester.username} · {timeAgo(req.created_at)}</div>
                  </div>
                  <button onClick={() => acceptRequest(req.id, req.requester_id)} className="btn-primary py-1.5 px-3 text-xs">Accept</button>
                  <button onClick={async () => { const supabase = createClient(); await supabase.from('friendships').delete().eq('id', req.id); setPendingReceived((prev) => prev.filter((r) => r.id !== req.id)); }}
                    className="btn-secondary py-1.5 px-3 text-xs">Decline</button>
                </div>
              ))}</div>
            )
          )
        ) : null}
      </div>
    </AppShell>
  );
}
