"use client";

import type { User } from "firebase/auth";

export async function uploadProductImage(file: File, user: User) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 10 * 1024 * 1024) {
    throw new Error("Choose a JPG, PNG, or WebP image smaller than 10 MB.");
  }

  const token = await user.getIdToken();
  const signatureResponse = await fetch("/api/media/signature", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const signatureData = await signatureResponse.json();
  if (!signatureResponse.ok) throw new Error(signatureData.error || "Could not prepare the product image upload.");

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", signatureData.apiKey);
  form.append("timestamp", String(signatureData.timestamp));
  form.append("folder", signatureData.folder);
  form.append("allowed_formats", signatureData.allowedFormats);
  form.append("signature", signatureData.signature);
  const uploadResponse = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(signatureData.cloudName)}/image/upload`,
    { method: "POST", body: form },
  );
  const uploadData = await uploadResponse.json();
  if (!uploadResponse.ok || typeof uploadData.secure_url !== "string") {
    console.error("Cloudinary product image upload failed.", uploadData.error?.message);
    throw new Error("The product image could not be uploaded.");
  }
  return uploadData.secure_url as string;
}
