import { initializeApp, cert, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

export const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'hidran-7d88c';

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApp('FirebaseAdmin') || getApp();
  }

  // Cek apakah ada kredensial service account dari environment variables
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      credential = cert(parsed);
    } catch (e) {
      console.error('Gagal membaca FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      credential = cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } catch (e) {
      console.error('Gagal membaca FIREBASE_CLIENT_EMAIL/PRIVATE_KEY:', e);
    }
  }

  return initializeApp(
    credential ? { credential, projectId } : { projectId },
    'FirebaseAdmin'
  );
}

export const getAdminAuthInstance = (): Auth => {
  return getAuth(getAdminApp());
};

export const getAdminDbInstance = (): Firestore => {
  return getFirestore(getAdminApp());
};
