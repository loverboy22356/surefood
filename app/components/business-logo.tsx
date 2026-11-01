"use client";

import Image from "next/image";
import type { User } from "firebase/auth";
import { useRef, useState } from "react";

const maxBytes = 5 * 1024 * 1024;

/**
 * Lets a seller upload the logo buyers see for their store. The file goes to
 * /api/profile/logo, which stores it on the account as businessLogoUrl.
 */
export function BusinessLogo({
  user,
  logoUrl,
  name,
  onChange,
  onError,
  className = "",
}: {
  user: User | null;
  logoUrl?: string;
  name: string;
  onChange: (logoUrl: string) => void;
  onError: (message: string) => void;
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initials = (name.trim() || "Seller").slice(0, 2).toUpperCase();
  const label = logoUrl ? `Change the ${name} logo` : `Upload a logo for ${name}`;

  async function save(file: File) {
    if (!user) {
      onError("Sign in again to change your business logo.");
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      onError("Choose a JPG, PNG, or WebP logo.");
      return;
    }
    if (file.size > maxBytes) {
      onError("Choose a logo smaller than 5 MB.");
      return;
    }
    setUploading(true);
    onError("");
    try {
      const token = await user.getIdToken();
      const form = new FormData();
      form.append("logo", file);
      const response = await fetch("/api/profile/logo", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save your logo.");
      if (typeof result.logoUrl !== "string") throw new Error("The upload did not return a logo.");
      onChange(result.logoUrl);
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : "Could not save your logo.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <span className={`business-logo ${className}`.trim()}>
      <button
        type="button"
        className="business-logo-button"
        onClick={() => input.current?.click()}
        disabled={uploading}
        aria-label={label}
        title={label}
      >
        {logoUrl
          ? <Image src={logoUrl} alt={`${name} logo`} fill sizes="96px" unoptimized />
          : <span aria-hidden="true">{initials}</span>}
        <i aria-hidden="true">{uploading ? "…" : "＋"}</i>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void save(file);
        }}
      />
    </span>
  );
}
