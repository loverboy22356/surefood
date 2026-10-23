"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

export type BusinessProfile = {
  uid: string;
  email: string;
  role: "buyer" | "vendor" | "supplier";
  displayName: string;
  verificationStatus: string;
  approvalFeeMinor?: number;
  approvalFeeCurrency?: string;
  approvalFeeStatus?: string;
  approvalFeeAuthorizationUrl?: string;
  phone?: string;
  location?: string;
  notificationPreferences?: {
    newOrders?: boolean;
    shipmentUpdates?: boolean;
    lowStockAlerts?: boolean;
    marketingEmails?: boolean;
  };
  business?: {
    businessName?: string;
    country?: string;
    city?: string;
    region?: string;
  };
};

export function useBusinessAccount(expectedRole: BusinessProfile["role"]) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!firebaseConfigured()) {
      setError("Firebase is not configured. Set up .env.local before using this workspace.");
      setLoading(false);
      return;
    }

    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/profile", { headers: { authorization: `Bearer ${token}` } });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load your account.");
        const account = result.profile as BusinessProfile;
        if (account.role !== expectedRole) {
          router.replace(account.role === "buyer" ? "/" : account.role === "vendor" ? "/vendor" : "/supplier");
          return;
        }
        if (active) setProfile(account);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load your account.");
      } finally {
        if (active) setLoading(false);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [expectedRole, router]);

  return { user, profile, loading, error };
}
