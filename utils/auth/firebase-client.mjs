import { getApps, initializeApp } from 'firebase/app';
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence,
  inMemoryPersistence, connectAuthEmulator, getIdTokenResult,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

let client;

export function getFirebase() {
  if (client) return client;
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_PUBLIC_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
  if (!config.apiKey || !config.projectId) throw new Error('Firebase configuration is missing');
  const app = getApps().find(app => app.name === '[DEFAULT]') || initializeApp(config);
  // Email/password authentication does not need the popup/redirect resolver.
  const auth = initializeAuth(app, {
    persistence: typeof window === 'undefined'
      ? inMemoryPersistence : [indexedDBLocalPersistence, browserLocalPersistence],
  });
  const db = getFirestore(app);
  const functions = getFunctions(app, 'us-central1');
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
    // Emulator traffic always stays on loopback, including callable functions.
    connectAuthEmulator(auth, 'http://127.0.0.1:9399', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8380);
    connectFunctionsEmulator(functions, '127.0.0.1', 5301);
  }
  client = { app, auth, db, functions };
  return client;
}

export async function getCustomClaimRole() {
  const user = getFirebase().auth.currentUser;
  if (!user) return null;
  return (await getIdTokenResult(user, true)).claims.stripeRole || null;
}

export function clearLegacyAuthCookie() {
  if (typeof document !== 'undefined') {
    document.cookie = 'auth=; Max-Age=0; Path=/; SameSite=Lax';
  }
}
