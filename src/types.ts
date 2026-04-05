export interface UserProfile {
  uid: string;
  displayName: string;
  displayNameLowercase?: string;
  email: string;
  emailLowercase?: string;
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
  thumbnailUrl?: string;
  status: 'live' | 'ended';
  startedAt: any;
  endedAt?: any;
  viewerCount: number;
  likes?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text?: string;
  imageUrl?: string;
  createdAt: any;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  imageUrl?: string;
  createdAt: any;
}

export interface Contact {
  userId: string;
  contactId: string;
  contactName: string;
  contactPhoto?: string;
  addedAt: any;
}

export interface MediaItem {
  id: string;
  userId: string;
  url: string;
  folder: string;
  fileName: string;
  createdAt: any;
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
