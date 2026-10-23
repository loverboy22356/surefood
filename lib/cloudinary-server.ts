import "server-only";

import { v2 as cloudinary } from "cloudinary";

export const verificationDocumentTypes = ["business-registration", "proof-of-address", "nin"] as const;
export type VerificationDocumentType = typeof verificationDocumentTypes[number];

const documentFormats = new Set(["pdf", "jpg", "png"]);

export function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  return { cloudName, apiKey, apiSecret };
}

export function verificationDocumentPublicId(uid: string, type: VerificationDocumentType, format: string) {
  return `surefood/kyb/${uid}/${type}/document.${format}`;
}

export async function findVerificationDocument(uid: string, type: VerificationDocumentType, publicId: string) {
  const match = publicId.match(/^surefood\/kyb\/([A-Za-z0-9_-]{1,128})\/(business-registration|proof-of-address|nin)\/document\.(pdf|jpg|png)$/);
  if (!match || match[1] !== uid || match[2] !== type || !documentFormats.has(match[3])) return null;

  configureCloudinary();
  try {
    const asset = await cloudinary.api.resource(publicId, { resource_type: "raw", type: "private" }) as {
      public_id?: string;
      bytes?: number;
      format?: string;
      resource_type?: string;
      type?: string;
    };
    // Raw assets keep their extension inside public_id and report no `format`,
    // so the format is taken from the validated reference instead of the asset.
    const format = match[3];
    if (
      asset.public_id !== publicId ||
      asset.resource_type !== "raw" ||
      asset.type !== "private" ||
      !documentFormats.has(format) ||
      Number(asset.bytes) <= 0 ||
      Number(asset.bytes) > 15 * 1024 * 1024
    ) return null;
    return { ...asset, format };
  } catch (error) {
    if (typeof error === "object" && error !== null && "http_code" in error && error.http_code === 404) return null;
    throw error;
  }
}

export function verificationDocumentDownloadUrl(publicId: string) {
  configureCloudinary();
  const match = publicId.match(/^surefood\/kyb\/[A-Za-z0-9_-]{1,128}\/(?:business-registration|proof-of-address|nin)\/document\.(pdf|jpg|png)$/);
  if (!match) throw new Error("Invalid verification document reference.");
  return cloudinary.utils.private_download_url(publicId, match[1], {
    resource_type: "raw",
    type: "private",
    expires_at: Math.floor(Date.now() / 1000) + 15 * 60,
  });
}
