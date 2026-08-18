import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore Database instance
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.warn('[EMKA Radio Firestore]', JSON.stringify(errInfo));
}

// Test connection on boot
(async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'radio', 'live'));
    console.log('[EMKA Radio] ⚡ Firebase Firestore connection verified');
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[EMKA Radio] Firebase client is offline, using cache/local persistence.');
    }
  }
})();
