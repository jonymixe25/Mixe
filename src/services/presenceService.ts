import { db, doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot } from '../firebase';
import { UserProfile } from '../types';

export const updateUserStatus = async (uid: string, status: 'online' | 'offline') => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      status,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating status:', error);
  }
};

export const subscribeToContactsPresence = (
  userId: string, 
  onPresenceUpdate: (updates: { [uid: string]: { status: string, lastSeen: any, name: string } }) => void
) => {
  // First get contact IDs
  const contactsRef = collection(db, 'users', userId, 'contacts');
  
  return onSnapshot(contactsRef, (snapshot) => {
    const contactIds = snapshot.docs.map(doc => doc.data().contactId);
    
    if (contactIds.length === 0) {
      onPresenceUpdate({});
      return;
    }

    // Now subscribe to those users' status
    // Note: Firestore has a limit of 10-30 IDs in 'in' queries, 
    // but for a simple social app we'll assume contacts < 30 for now or chunk it.
    // Let's just listen to all users in small batches or individually.
    // For simplicity, we'll listen to the whole users collection filtered by IDs if possible.
    
    const usersRef = collection(db, 'users');
    // We can't really do dynamic 'in' queries with more than 30 IDs easily.
    // But we can listen to each user individually or use a single query if IDs are few.
    
    const presenceUpdates: { [uid: string]: { status: string, lastSeen: any, name: string } } = {};
    
    // Divide contactIds into chunks of 10
    const chunks = [];
    for (let i = 0; i < contactIds.length; i += 10) {
      chunks.push(contactIds.slice(i, i + 10));
    }

    const unsubscribes = chunks.map(chunk => {
      const q = query(usersRef, where('uid', 'in', chunk));
      return onSnapshot(q, (userSnap) => {
        userSnap.docs.forEach(doc => {
          const data = doc.data() as UserProfile;
          presenceUpdates[data.uid] = {
            status: data.status || 'offline',
            lastSeen: data.lastSeen,
            name: data.displayName
          };
        });
        onPresenceUpdate({ ...presenceUpdates });
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  });
};
