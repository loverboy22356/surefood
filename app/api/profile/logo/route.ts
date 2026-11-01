import { Timestamp } from "firebase-admin/firestore";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { configureCloudinary } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const logoFormats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to change your business logo.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") {
    return jsonError("Only vendor and supplier accounts can set a business logo.", 403);
  }

  if (Number(request.headers.get("content-length")) > maxBytes + 512 * 1024) {
    return jsonError("Choose a JPG, PNG, or WebP logo smaller than 5 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Choose a logo to upload.", 400);
  }

  const file = form.get("logo");
  if (!(file instanceof File) || !logoFormats[file.type]) {
    return jsonError("Upload a JPG, PNG, or WebP logo.", 400);
  }
  if (file.size > maxBytes) {
    return jsonError("Choose a logo smaller than 5 MB.", 413);
  }

  try {
    configureCloudinary();
    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "surefood/business",
          public_id: `business_${user.uid}`,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
          transformation: [{ width: 320, height: 320, crop: "fill", gravity: "center" }],
        },
        (error, result) => (error || !result ? reject(error) : resolve(result)),
      );
      stream.end(buffer);
    });

    await adminDb().collection("users").doc(user.uid).set(
      { businessLogoUrl: upload.secure_url, updatedAt: Timestamp.now() },
      { merge: true },
    );

    return Response.json({ logoUrl: upload.secure_url });
  } catch (error) {
    console.error("Could not save the business logo.", error);
    return jsonError("We could not save your logo. Try a smaller image.", 500);
  }
}
