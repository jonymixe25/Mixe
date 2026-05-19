import React, { useEffect, useState } from 'react';
import { Users, Search, UserPlus, MoreVertical, Check, X, MessageSquare, Trash2, Clock } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { db, collection, query, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, addDoc, deleteDoc } from '../firebase';
import { useNavigate } from 'react-router-dom';

interface FriendRequest {
  id: string;
  senderId: string;
  senderName: string;
  status: 'pending' | 'accepted' | 'rejected';
}

interface Friend {
  id: string;
  contactId: string;
  contactName: string;
  contactPhoto?: string;
}

interface AppUser {
  id: string;
  name: string;
  email: string;
}

const Friends = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const friendsRef = collection(db, 'users', user.uid, 'contacts');
    const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
      setFriends(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Friend)));
    });

    const requestsRef = collection(db, 'users', user.uid, 'friendRequests');
    const unsubscribeRequests = onSnapshot(requestsRef, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest)).filter(r => r.status === 'pending'));
    });

    const fetchUsers = async () => {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        setAllUsers(usersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as AppUser)).filter(u => u.id !== user.uid));
    }
    fetchUsers();

    return () => {
      unsubscribeFriends();
      unsubscribeRequests();
    };
  }, [user]);

  const acceptRequest = async (request: FriendRequest) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'friendRequests', request.id), { status: 'accepted' });
      await addDoc(collection(db, 'users', user.uid, 'contacts'), { contactId: request.senderId, contactName: request.senderName });
      await addDoc(collection(db, 'users', request.senderId, 'contacts'), { contactId: user.uid, contactName: user.displayName || 'Usuario' });
    } catch (e) { console.error(e); }
  };

  const sendRequest = async (targetUser: AppUser) => {
      if (!user) return;
      try {
          await addDoc(collection(db, 'users', targetUser.id, 'friendRequests'), {
              senderId: user.uid,
              senderName: user.displayName || 'Usuario',
              status: 'pending',
              createdAt: serverTimestamp()
          });
          setSentRequests(prev => new Set(prev).add(targetUser.id));
      } catch (e) {
          console.error(e);
      }
  };

  const removeFriend = async (friendDocId: string) => {
    if (!user) return;
    try {
        await deleteDoc(doc(db, 'users', user.uid, 'contacts', friendDocId));
    } catch (e) { console.error(e); }
  }

  return (
    <div className="space-y-12 p-8">
      <header className="flex items-end justify-between px-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-brand">
            <Users className="w-5 h-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em]">Comunidad</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-white">Amigos</h1>
        </div>
      </header>
      
      {requests.length > 0 && (
        <section className="space-y-4">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-white/70">Solicitudes pendientes</h2>
            {requests.map(req => (
                <div key={req.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between backdrop-blur-sm">
                    <span className="text-white font-medium">{req.senderName}</span>
                    <div className="flex gap-2">
                        <button onClick={() => acceptRequest(req)} className="p-2 bg-brand text-black rounded-lg hover:bg-brand/90 transition-colors"><Check className="w-5 h-5"/></button>
                        <button className="p-2 bg-white/5 rounded-lg text-white/70 hover:bg-white/10 transition-colors"><X className="w-5 h-5"/></button>
                    </div>
                </div>
            ))}
        </section>
      )}
      
      <section className="space-y-4">
        <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-white/70">Buscar Usuarios</h2>
        <div className="flex items-center gap-2 w-full bg-white/5 rounded-xl p-2 border border-white/10 focus-within:border-brand/50 transition-colors">
            <Search className="w-5 h-5 text-white/30 ml-2" />
            <input type="text" placeholder="Buscar por nombre..." className="bg-transparent w-full p-2 outline-none text-white placeholder:text-white/30" onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-2">
            {allUsers.filter(u => u.name?.toLowerCase().includes(search.toLowerCase())).map(u => (
                <div key={u.id} className="flex justify-between items-center p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 transition-colors">
                    <span className="text-white font-medium">{u.name}</span>
                    <button 
                        onClick={() => sendRequest(u)} 
                        disabled={sentRequests.has(u.id)}
                        className={`p-2 rounded-lg transition-all ${sentRequests.has(u.id) ? 'bg-white/5 text-white/30' : 'bg-white/5 text-brand hover:bg-white/10'}`}
                    >
                        {sentRequests.has(u.id) ? <Clock /> : <UserPlus/>}
                    </button>
                </div>
            ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {friends.map((friend) => (
          <div key={friend.id} className="bg-white/[0.03] border border-white/5 p-6 rounded-3xl flex items-center justify-between gap-4 hover:bg-white/[0.06] transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 overflow-hidden border border-white/10">
                <img src={friend.contactPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.contactId}`} alt="Friend avatar" className="w-full h-full" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{friend.contactName}</h3>
              </div>
            </div>
            <div className="flex gap-2">
                <button onClick={() => navigate(`/chat/${friend.contactId}`)} className="p-2 bg-white/5 rounded-lg text-brand hover:bg-white/10 transition-colors"><MessageSquare className="w-5 h-5"/></button>
                <button onClick={() => removeFriend(friend.id)} className="p-2 bg-white/5 rounded-lg text-red-400 hover:bg-white/10 transition-colors"><Trash2 className="w-5 h-5"/></button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Friends;
