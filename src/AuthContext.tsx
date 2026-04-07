import React, { useState, useEffect } from 'react';
import { auth, db, onAuthStateChanged, signInWithPopup, googleProvider, signOut, doc, getDoc, setDoc, serverTimestamp, onSnapshot, updateDoc, handleFirestoreError, createUserWithEmailAndPassword, signInWithEmailAndPassword } from './firebase';
import { UserProfile, OperationType } from './types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Initial fetch to ensure we have data before setting loading to false
        try {
          const userDoc = await getDoc(userDocRef);
          if (!userDoc.exists()) {
            const newUser: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'Anonymous',
              displayNameLowercase: (firebaseUser.displayName || 'Anonymous').toLowerCase(),
              email: firebaseUser.email || '',
              emailLowercase: (firebaseUser.email || '').toLowerCase(),
              photoURL: firebaseUser.photoURL || '',
              role: firebaseUser.email === 'jonyoax95@gmail.com' ? 'admin' : 'user',
              createdAt: serverTimestamp(),
            };
            try {
              await setDoc(userDocRef, newUser);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
            }
          } else {
            // If the document exists but the role is not admin and it should be
            const currentData = userDoc.data() as UserProfile;
            const updates: any = {};
            
            if (firebaseUser.email === 'jonyoax95@gmail.com' && currentData.role !== 'admin') {
               updates.role = 'admin';
            }
            
            // Ensure lowercase fields exist for existing users
            if (!currentData.displayNameLowercase || !currentData.emailLowercase) {
              updates.displayNameLowercase = currentData.displayName.toLowerCase();
              updates.emailLowercase = currentData.email.toLowerCase();
            }

            if (Object.keys(updates).length > 0) {
              try {
                await updateDoc(userDocRef, updates);
              } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `users/${firebaseUser.uid}`);
              }
            }
          }
        } catch (error) {
          console.error('Error in initial user setup:', error);
        }

        // Real-time listener for profile changes (like role updates)
        unsubscribeUserDoc = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            setUser(doc.data() as UserProfile);
          }
          setLoading(false);
        }, (error) => {
          console.error('Error listening to user profile:', error);
          setLoading(false);
        });
      } else {
        if (unsubscribeUserDoc) unsubscribeUserDoc();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        console.log('El usuario cerró la ventana de inicio de sesión.');
      } else {
        console.error('Login error:', error);
      }
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Optionally update profile
      // await updateProfile(userCredential.user, { displayName });
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, registerWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
