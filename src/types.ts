export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  role: 'admin' | 'user';
  createdAt: any;
}

export interface StreamSession {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  status: 'live' | 'ended';
  startedAt: any;
  endedAt?: any;
  viewerCount: number;
}

export interface Contact {
  userId: string;
  contactId: string;
  contactName: string;
  contactPhoto?: string;
  addedAt: any;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
