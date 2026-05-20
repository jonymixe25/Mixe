import { db, collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot, orderBy, handleFirestoreError, deleteDoc, getDocs, writeBatch } from '../firebase';
import { OperationType } from '../types';

export interface AppNotification {
  id?: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  type: 'message' | 'friend' | 'system' | 'call' | 'like' | 'comment';
  title: string;
  description: string;
  link?: string;
  read: boolean;
  createdAt: any;
}

/**
 * Creates and sends a dynamic real-time notification to another user
 */
export async function sendNotification(
  recipientId: string,
  sender: { id: string; name: string; photo?: string },
  type: AppNotification['type'],
  title: string,
  description: string,
  link?: string
) {
  if (!recipientId || recipientId === sender.id) return null;

  try {
    const notificationData = {
      recipientId,
      senderId: sender.id,
      senderName: sender.name,
      senderPhoto: sender.photo || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sender.id}`,
      type,
      title,
      description,
      link: link || '',
      read: false,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), notificationData);
    return docRef.id;
  } catch (error) {
    console.error('Error in sendNotification:', error);
    // Suppress notification errors to prevent breaking critical experiences (like messaging/calls)
    return null;
  }
}

/**
 * Attaches a real-time listener to notifications for a user
 */
export function listenToNotifications(
  userId: string,
  callback: (notifications: AppNotification[]) => void,
  errorCallback?: (error: any) => void
) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: AppNotification[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt ? data.createdAt.toDate() : new Date()
        } as AppNotification);
      });
      callback(items);
    },
    (error) => {
      console.error('Error in listenToNotifications:', error);
      if (errorCallback) {
        errorCallback(error);
      }
    }
  );
}

/**
 * Attaches a real-time listener specifically for the unread count
 */
export function listenToUnreadCount(
  userId: string,
  callback: (count: number) => void
) {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId),
    where('read', '==', false)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.size);
    },
    (error) => {
      console.error('Error in listenToUnreadCount:', error);
    }
  );
}

/**
 * Marks a notification as read
 */
export async function markAsRead(notificationId: string) {
  try {
    const docRef = doc(db, 'notifications', notificationId);
    await updateDoc(docRef, { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

/**
 * Marks all notifications as read for a specific user
 */
export async function markAllAllAsRead(userId: string) {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', userId),
      where('read', '==', false)
    );
    const querySnapshot = await getDocs(q);
    
    const batch = writeBatch(db);
    querySnapshot.docs.forEach((d) => {
      batch.update(doc(db, 'notifications', d.id), { read: true });
    });
    
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications-bulk-read`);
  }
}

/**
 * Deletes a notification
 */
export async function deleteNotification(notificationId: string) {
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `notifications/${notificationId}`);
  }
}
