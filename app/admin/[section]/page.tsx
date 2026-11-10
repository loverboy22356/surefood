"use client";

import { useParams } from "next/navigation";
import { AdminDashboardBody, AdminAuthForm } from "@/app/admin/admin-dashboard";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { firebaseAuth, firebaseConfigured } from "@/lib/firebase/client";

export default function AdminSectionPage() {
  const paramsPromise = useParams<{ section: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [staff, setStaff] = useState(false);
  const [section, setSection] = useState("dashboard");

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const params = await paramsPromise;
        if (active) setSection(typeof params.section === "string" ? params.section : "dashboard");
      } catch {
        /* params may not be ready yet */
      }
    })();
    return () => { active = false; };
  }, [paramsPromise]);

  useEffect(() => {
    if (!firebaseConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) return;
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        const role = String(tokenResult.claims.role ?? "");
        setStaff(role === "staff" || role === "admin");
      } catch {
        /* fall through */
      }
    });
  }, []);

  if (!authReady) return <div className="admin-loading">Loading staff workspace…</div>;

  if (user && staff) {
    return <AdminDashboardBody initialSection={section} />;
  }

  return <AdminAuthForm />;
}
