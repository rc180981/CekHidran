import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from './client';
import type { Role } from '../rbac';

export interface FirebaseUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  warehouseIds: string[];
  active: boolean;
}

// Helper untuk fetch user di server actions / router
export async function getFirebaseUserProfile(uid: string): Promise<FirebaseUser | null> {
  try {
    const snap = await getDoc(doc(db, 'profiles', uid));
    if (snap.exists()) {
      return snap.data() as FirebaseUser;
    }
    return null;
  } catch (e) {
    console.error('Error fetching user profile:', e);
    return null;
  }
}
