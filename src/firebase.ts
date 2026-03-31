import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase SDK
const app = initializeApp(firebaseConfig);
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth();

// Test connection to Firestore
export let isFirestoreConnected = false;
export let firestoreConnectionError: string | null = null;

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('TODO')) {
  firestoreConnectionError = "Firebase API Key is missing or invalid. Please check your firebase-applet-config.json file.";
} else {
  testConnection();
}

async function testConnection() {
  // Wait a moment for network to stabilize in iframe
  await new Promise(resolve => setTimeout(resolve, 1000));
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    isFirestoreConnected = true;
    console.log("Firestore connection test successful.");
  } catch (error) {
    if (error instanceof Error) {
      firestoreConnectionError = error.message;
      if (error.message.includes('the client is offline')) {
        console.error("Please check your Firebase configuration. (Client is offline)");
      } else {
        console.error("Firestore connection test failed:", error.message);
      }
    } else {
      firestoreConnectionError = String(error);
      console.error("Firestore connection test failed with unknown error:", error);
    }
  }
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
