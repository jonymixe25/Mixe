import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, onSnapshot, addDoc, updateDoc, serverTimestamp, getDocs, deleteDoc, increment, orderBy, limit, getDocFromServer } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, listAll, getMetadata } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { OperationType, FirestoreErrorInfo } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

export const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || '',
      email: auth.currentUser?.email || '',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || '',
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  // Check for quota exceeded error
  if (errInfo.error.includes('quota-exceeded') || errInfo.error.includes('resource-exhausted')) {
    const quotaError = new Error('Quota exceeded. The daily free limit for Firestore writes has been reached. It will reset tomorrow.');
    (quotaError as any).isQuotaError = true;
    throw quotaError;
  }

  throw new Error(JSON.stringify(errInfo));
};

export { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  increment,
  orderBy,
  limit,
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  listAll,
  getMetadata
};
