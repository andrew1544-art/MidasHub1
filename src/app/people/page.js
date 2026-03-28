'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/AppShell';
import { useStore } from '@/lib/store';
import { createClient } from '@/lib/supabase-browser';
import { formatCount, timeAgo } from '@/lib/constants';

export default function PeoplePage() {
  const { user, profile, setShowAuth } = useStore();
  const [people, setPeople] = useState([]);
  const [friends, setFriends] = useState([]);
  const [pendingReceived, setPendingReceived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('discover');
  const [friendIds, setFriendIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, [user, tab]);

  const fetchData = async () => {
    setLoading(true);
    const supabase = createClient();

    if (tab === 'discover') {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      let results = (data || []).filter((p) => p.id !== user?.id);

      // Get friendship status
      if (user) {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('*')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

        const fIds = new Set();
        const pIds = new Set();
        (friendships || []).forEach((f) => {
          const otherId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
          if (f.status === 'accepted') fIds.add(otherId);
          if (f.status === 'pending' && f.requester_id === user.id) pIds.add(otherId);
        });
        setFriendIds(fIds);
        setPendingIds(pIds);
      }

      setPeople(results);
    } else if (tab === 'friends' && user) {
      const { data: friendships } = await supabase
        .from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*), addressee:profiles!friendships_addressee_id_fkey(*)')
        .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
        .eq('status', 'accepted');

      const friendList = (friendships || []).map((f) =>
        f.requester_id === user.id ? f.addressee : f.requester
      );
      setFriends(friendList);
    } else if (tab === 'requests' && user) {
      const { data } = await supabase
        .from('friendships')
        .select('*, requester:profiles!friendships_requester_id_fkey(*)')
        .eq('addressee_id', user.id)
        .eq('status', 'pending');
      setPendingReceived(data || []);
    }

    setLoading(false);
  };

  const sendFriendRequest = async (targetId) => {
    if (!user) return setShowAuth(true);
    const supabase = createClient();
    await supabase.from('friendships').insert({ requester_id: user.id, addressee_id: targetId });
    setPendingIds((prev) => new Set([...prev, targetId]));
    // Notify
    await supabase.from('notifications').insert({
      user_id: targetId,
      from_user_id: user.id,
      type: 'friend_request',
    });
  };

  const acceptRequest = async (friendshipId, requesterId) => {
    const supabase = createClient();
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId);
    setPendingReceived((prev) => prev.filter((r) => r.id !== friendshipId));
    // Notify
    await supabase.from('notifications').insert({
      user_id: requesterId,
      from_user_id: user.id,
      type: 'friend_accepted',
    });
  };

  const removeFriend = async (targetId) => {
    const supabase = createClient();
    await supabase.from('friendships').delete().or(
      `and(requester_id.eq.${user.id},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${user.id})`
    );
    setFriendIds((prev) => { const n = new Set(prev); n.delete(targetId); return n; });
    setFriends((prev) => prev.filter((f) => f.id !== targetId));
  };

  const PersonCard = ({ person, showActions = true }) => (
    <div className="glass-light rounded-2xl p-5 hover-lift text-center">
      <Link href={`/profile/${person.username}`}>
        <div className="text-5xl mb-3 hover:scale-110 transition-transform inline-block">{person.avatar_emoji || '😎'}</div>
        <div className="font-bold text-base">{person.display_name}</div>
        <div className="text-xs text-white/30 mt-0.5">@{person.username}</div>
      </Link>
      {person.bio && <div className="text-sm text-white/50 mt-2 line-clamp-2">{person.bio}</div>}
      <div className="text-xs text-white/20 mt-2">{person.location || 'MidasHub member'}</div>

      {showActions && user && person.id !== user.id && (
        <div className="flex gap-2 mt-4">
          {friendIds.has(person.id) ? (
            <button onClick={() => removeFriend(person.id)}
              className="flex-1 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 text-xs font-semibold transition hover:bg-cyan-500/25"
            >
              ✓ Friends
            </button>
          ) : pendingIds.has(person.id) ? (
            <button className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/30 text-xs font-semibold cursor-default">
              ⏳ Pending
            </button>
          ) : (
            <button onClick={() => sendFriendRequest(person.id)}
              className="flex-1 py-2.5 rounded-xl btn-primary text-xs"
            >
              + Add Friend
            </button>
          )}
          <Link href={`/chat?user=${person.id}`}
            className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-lg hover:bg-white/10 transition"
          >
            💬
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-black mb-2">👥 People</h1>
        <p className="text-white/40 text-sm mb-6">Discover, connect, and chat with people from everywhere</p>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'discover', icon: '🌍', label: 'Discover' },
            { key: 'friends', icon: '🤝', label: 'Friends' },
            { key: 'requests', icon: '📩', label: `Requests${pendingReceived.length > 0 ? ` (${pendingReceived.length})` : ''}` },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`platform-pill px-4 py-2 rounded-xl text-sm ${tab === t.key ? 'bg-white/12 text-white font-bold' : 'bg-white/4 text-white/40'}`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="glass-light rounded-2xl p-6 text-center">
                <div className="w-12 h-12 rounded-full skeleton mx-auto mb-3" />
                <div className="h-4 w-24 rounded skeleton mx-auto mb-2" />
                <div className="h-3 w-16 rounded skeleton mx-auto" />
              </div>
            ))}
          </div>
        ) : tab === 'discover' ? (
          people.length === 0 ? (
            <div className="text-center py-16 text-white/30">No people found yet. Be the first!</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {people.map((person) => <PersonCard key={person.id} person={person} />)}
            </div>
          )
        ) : tab === 'friends' ? (
          !user ? (
            <div className="text-center py-16">
              <p className="text-white/40 mb-4">Log in to see your friends</p>
              <button onClick={() => setShowAuth(true)} className="btn-primary">Log In</button>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-16 text-white/30">No friends yet. Start connecting!</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {friends.map((person) => <PersonCard key={person.id} person={person} showActions={false} />)}
            </div>
          )
        ) : tab === 'requests' ? (
          !user ? (
            <div className="text-center py-16">
              <p className="text-white/40 mb-4">Log in to see friend requests</p>
              <button onClick={() => setShowAuth(true)} className="btn-primary">Log In</button>
            </div>
          ) : pendingReceived.length === 0 ? (
            <div className="text-center py-16 text-white/30">No pending requests</div>
          ) : (
            <div className="space-y-3">
              {pendingReceived.map((req) => (
                <div key={req.id} className="glass-light rounded-xl p-4 flex items-center gap-4">
                  <Link href={`/profile/${req.requester.username}`} className="text-3xl">{req.requester.avatar_emoji || '😎'}</Link>
                  <div className="flex-1">
                    <div className="font-bold text-sm">{req.requester.display_name}</div>
                    <div className="text-xs text-white/30">@{req.requester.username} • {timeAgo(req.created_at)}</div>
                  </div>
                  <button onClick={() => acceptRequest(req.id, req.requester_id)} className="btn-primary py-2 px-4 text-xs">
                    Accept ✓
                  </button>
                  <button onClick={async () => {
                    const supabase = createClient();
                    await supabase.from('friendships').delete().eq('id', req.id);
                    setPendingReceived((prev) => prev.filter((r) => r.id !== req.id));
                  }} className="btn-secondary py-2 px-4 text-xs">
                    Decline
                  </button>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </AppShell>
  );
}
