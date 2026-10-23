"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const requiredConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseConfigured() {
  return Object.values(requiredConfig).every(Boolean);
}

function firebaseApp() {
  if (!firebaseConfigured()) {
    throw new Error("Firebase client is not configured. Copy the values into .env.local.");
  }
  return getApps().length ? getApp() : initializeApp(requiredConfig);
}

export function firebaseAuth() {
  return getAuth(firebaseApp());
}
