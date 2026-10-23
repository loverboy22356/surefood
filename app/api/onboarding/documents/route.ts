import { Timestamp } from "firebase-admin/firestore";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { authenticatedUser } from "@/lib/auth/server";
import { createActivity } from "@/lib/activity";
import { adminDb } from "@/lib/firebase/admin";
import { configureCloudinary, findVerificationDocument, verificationDocumentPublicId, type VerificationDocumentType } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const documentFormats: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function isVerificationDocumentType(value: FormDataEntryValue | null): value is VerificationDocumentType {
  return value === "business-registration" || value === "proof-of-address" || value === "nin";
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to upload verification documents.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") {
    return jsonError("Only vendor and supplier accounts can upload verification documents.", 403);
  }

  if (Number(request.headers.get("content-length")) > 16 * 1024 * 1024) {
    return jsonError("Upload a PDF, JPG, or PNG smaller than 15 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Choose a valid verification document to upload.", 400);
  }
  const documentType = form.get("documentType");
  const file = form.get("file");
  if (!isVerificationDocumentType(documentType) || !(file instanceof File)) {
    return jsonError("Choose a valid verification document.", 400);
  }
  const format = documentFormats[file.type];
  if (!format || file.size === 0 || file.size > 15 * 1024 * 1024) {
    return jsonError("Upload a PDF, JPG, or PNG smaller than 15 MB.", 400);
  }

  try {
    const db = adminDb();
    const profileRef = db.collection("users").doc(user.uid);
    const profile = await profileRef.get();
    if (!profile.exists || profile.data()?.role !== user.role) {
      return jsonError("Complete your account profile before uploading verification documents.", 409);
    }
    const verificationStatus = String(profile.data()?.verificationStatus ?? "");
    if (verificationStatus === "approved") return jsonError("This business account is already approved.", 409);
    const existingPath = (profile.data()?.business?.documentPaths as Record<string, string> | undefined)?.[documentType];
    if (["pending_review", "manual_review", "registry_check_pending", "registry_check_submitting"].includes(verificationStatus) &&
        existingPath && await findVerificationDocument(user.uid, documentType, existingPath)) {
      return jsonError("This document is already uploaded and locked while your application is under review.", 409);
    }

    const { public_id: publicId, resource_type: resourceType, type: deliveryType, bytes } =
      await uploadPrivateDocument(file, user.uid, documentType, format);
    if (
      publicId !== verificationDocumentPublicId(user.uid, documentType, format) ||
      resourceType !== "raw" ||
      deliveryType !== "private" ||
      bytes > 15 * 1024 * 1024
    ) {
      throw new Error("Cloudinary returned an unexpected verification document.");
    }

    const batch = db.batch();
    batch.set(profileRef, {
      business: { documentPaths: { [documentType]: publicId } },
      updatedAt: Timestamp.now(),
    }, { merge: true });
    createActivity(batch, {
      actorUid: user.uid,
      actorRole: user.role,
      targetUserId: user.uid,
      action: "verification_document_uploaded",
      targetType: "business_verification",
      targetId: user.uid,
      summary: `Uploaded ${documentType === "business-registration" ? "business registration" : documentType === "proof-of-address" ? "proof of address" : "NIN"} verification document.`,
    });
    await batch.commit();
    return Response.json({ uploaded: true }, { status: 201 });
  } catch (error) {
    console.error("Could not upload and save a Cloudinary verification document.", error);
    return jsonError("We could not upload the verification document. Please try again.", 502);
  }
}

async function uploadPrivateDocument(
  file: File,
  uid: string,
  documentType: VerificationDocumentType,
  format: string,
) {
  configureCloudinary();
  const publicId = verificationDocumentPublicId(uid, documentType, format);
  const bytes = Buffer.from(await file.arrayBuffer());
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream({
      resource_type: "raw",
      type: "private",
      public_id: publicId,
      overwrite: true,
      allowed_formats: ["pdf", "jpg", "png"],
    }, (error, result) => {
      if (error) {
        reject(error);
      } else if (!result) {
        reject(new Error("Cloudinary returned an empty upload response."));
      } else {
        resolve(result);
      }
    });
    upload.end(bytes);
  });
}
