import { db, collection, addDoc, onSnapshot, updateDoc, doc, getDoc, setDoc } from '../firebase';

export const createSignalDocument = async (streamId: string, viewerId: string) => {
  const signalRef = doc(db, 'streams', streamId, 'signaling', viewerId);
  await setDoc(signalRef, {
    createdAt: new Date(),
    status: 'new'
  });
  return signalRef;
};

export const addIceCandidate = async (streamId: string, viewerId: string, candidate: RTCIceCandidate, role: 'admin' | 'viewer') => {
  const candidatesRef = collection(db, 'streams', streamId, 'signaling', viewerId, role === 'admin' ? 'adminCandidates' : 'viewerCandidates');
  await addDoc(candidatesRef, candidate.toJSON());
};

export const listenForIceCandidates = (streamId: string, viewerId: string, role: 'admin' | 'viewer', callback: (candidate: RTCIceCandidate) => void) => {
  const candidatesRef = collection(db, 'streams', streamId, 'signaling', viewerId, role === 'admin' ? 'viewerCandidates' : 'adminCandidates');
  return onSnapshot(candidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') {
        callback(new RTCIceCandidate(change.doc.data()));
      }
    });
  });
};
