import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.warn("Kullanıcı giriş penceresini kapattı.");
    } else {
      console.error("Giriş başarısız:", error);
    }
    throw error;
  }
}

async function testConnection() {
  try {
    // Basic connectivity test - using getDocFromServer to bypass cache
    const testDoc = doc(db, '_connection_test_', 'ping');
    await getDocFromServer(testDoc).catch(err => {
      // If document doesn't exist, it's still a success (connected to server)
      if (err.code === 'permission-denied' || err.code === 'not-found') {
        return;
      }
      throw err;
    });
    console.log("Firebase bağlantısı başarılı.");
  } catch (error) {
    console.error("Firebase bağlantı hatası:", error);
    if (error instanceof Error && (error.message.includes('offline') || (error as any).code === 'unavailable')) {
      console.error("Lütfen Firebase yapılandırmanızı veya internet bağlantınızı kontrol edin.");
    }
  }
}

testConnection();

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  // Safe logging that avoids circularity
  const logMessage = `Firestore Error [${operationType}] at ${path || 'unknown'}: ${errorMessage}`;
  console.error(logMessage, {
    operation: operationType,
    path: path,
    userId: auth.currentUser?.uid
  });

  // Throw a serializable error
  throw new Error(JSON.stringify(errInfo));
}
