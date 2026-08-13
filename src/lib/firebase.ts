import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasFirebaseConfig(): boolean {
  return Object.values(firebaseConfig).every(Boolean);
}

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;

  if (getApps().length > 0) {
    app = getApp();
    return app;
  }

  if (!hasFirebaseConfig()) {
    throw new Error(
      "Missing NEXT_PUBLIC_FIREBASE_* env vars. Add them in Cloudflare Pages or .env.production.",
    );
  }

  app = initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}

export function getFirestoreDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

/** @deprecated Prefer getFirebaseAuth() — kept for shorter imports. */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, property, receiver) {
    return Reflect.get(getFirebaseAuth() as object, property, receiver);
  },
});

/** @deprecated Prefer getFirestoreDb() — kept for shorter imports. */
export const db: Firestore = new Proxy({} as Firestore, {
  get(_target, property, receiver) {
    return Reflect.get(getFirestoreDb() as object, property, receiver);
  },
});
