import { db, doc, updateDoc, serverTimestamp, collection, query, where, onSnapshot, handleFirestoreError } from '../firebase';
import { UserProfile, OperationType } from '../types';

export const updateUserStatus = async (uid: string, status: 'online' | 'offline') => {
  const path = `users/${uid}`;
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      status,
      lastSeen: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating status:', error);
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const subscribeToContactsPresence = (
  userId: string, 
  onPresenceUpdate: (updates: { [uid: string]: { status: string, lastSeen: any, name: string } }) => void
) => {
  // First get contact IDs
  const contactsPath = `users/${userId}/contacts`;
  const contactsRef = collection(db, 'users', userId, 'contacts');
  
  return onSnapshot(contactsRef, (snapshot) => {
    const contactIds = snapshot.docs.map(doc => doc.data().contactId);
    
    if (contactIds.length === 0) {
      onPresenceUpdate({});
      return;
    }

    const usersRef = collection(db, 'users');
    const usersPath = 'users';
    
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
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, usersPath);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, contactsPath);
  });
};
