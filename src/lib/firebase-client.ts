/**
 * Firebase Client SDK — Browser-side Firestore access
 * 
 * Used by Cloud Console FE pages for onSnapshot real-time listeners.
 * FE reads only — all writes go through API layer (Admin SDK).
 * 
 * Cloud Console Standard v2.1
 */

import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, onSnapshot, type DocumentData, type Unsubscribe } from 'firebase/firestore';

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!apiKey || !projectId) {
  console.error('[Firebase] Missing NEXT_PUBLIC_FIREBASE_API_KEY or NEXT_PUBLIC_FIREBASE_PROJECT_ID');
}

const firebaseConfig = {
  apiKey: apiKey || '',
  projectId: projectId || '',
};

// Singleton — avoid re-init on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const clientDb = getFirestore(app);

export { clientDb, doc, setDoc, collection, onSnapshot };
export type { DocumentData, Unsubscribe };
