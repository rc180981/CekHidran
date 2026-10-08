import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Inisialisasi Firebase Admin jika service account tersedia, atau fallback ke client
export const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hidran-7d88c';

let adminApp;
if (getApps().length === 0) {
  adminApp = initializeApp({
    projectId,
  });
} else {
  adminApp = getApp();
}

export const adminDb = getFirestore(adminApp);
export const adminAuth = getAuth(adminApp);
