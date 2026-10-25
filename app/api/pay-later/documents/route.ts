import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { configureCloudinary, payLaterDocumentPublicId } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";
import { isPayLaterDocumentType, type PayLaterDocumentType } from "@/lib/requests";

export const runtime = "nodejs";

const documentFormats: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

async function uploadPrivateDocument(file: File, uid: string, documentType: PayLaterDocumentType, format: string) {
  configureCloudinary();
  const publicId = payLaterDocumentPublicId(uid, documentType, format);
  const bytes = Buffer.from(await file.arrayBuffer());
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream({
      resource_type: "raw",
      type: "private",
      public_id: publicId,
      overwrite: true,
      allowed_formats: ["pdf", "jpg", "png"],
    }, (error, result) => {
      if (error) reject(error);
      else if (!result) reject(new Error("Cloudinary returned an empty upload response."));
      else resolve(result);
    });
    upload.end(bytes);
  });
}

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to upload your Pay Later evidence.", 401);
  if (user.role === "staff" || user.role === "admin") {
    return jsonError("Staff accounts cannot apply for Pay Later.", 403);
  }

  if (Number(request.headers.get("content-length")) > 16 * 1024 * 1024) {
    return jsonError("Upload a PDF, JPG, or PNG smaller than 15 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Choose a valid document to upload.", 400);
  }
  const documentType = form.get("documentType");
  const file = form.get("file");
  if (!isPayLaterDocumentType(documentType) || !(file instanceof File)) {
    return jsonError("Choose a valid document to upload.", 400);
  }
  const format = documentFormats[file.type];
  if (!format || file.size === 0 || file.size > 15 * 1024 * 1024) {
    return jsonError("Upload a PDF, JPG, or PNG smaller than 15 MB.", 400);
  }

  try {
    const ownApplications = await adminDb().collection("payLaterApplications")
      .where("uid", "==", user.uid)
      .limit(10)
      .get();
    if (ownApplications.docs.some((document) => document.data().status === "submitted")) {
      return jsonError("Your application is already with our review team. Evidence is locked until they respond.", 409);
    }
    const upload = await uploadPrivateDocument(file, user.uid, documentType, format);
    return Response.json({ documentType, publicId: upload.public_id, uploaded: true });
  } catch (error) {
    console.error("Could not upload a Pay Later document.", error);
    return jsonError("We could not upload that document. Please try again.", 502);
  }
}
