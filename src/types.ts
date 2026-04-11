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
  city?: string;
  neighborhood?: string;
  streetAndNumber?: string;
  dateOfBirth?: string;
  socialLinks?: { platform: string; url: string }[];
}

export interface StreamSession {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description?: string;
  category?: string;
  privacy?: 'public' | 'private';
  latency?: 'normal' | 'low';
  resolution?: '720p' | '1080p';
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
  fileType?: string;
  fileSize?: number;
  tags?: string[];
  isPublic?: boolean;
  createdAt: any;
}

export interface ShortVideo {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  videoUrl: string;
  description: string;
  likes: number;
  comments: number;
  shares: number;
  createdAt: any;
}

export interface Comment {
  id: string;
  newsId: string;
  userId: string;
  userName: string;
  text: string;
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
