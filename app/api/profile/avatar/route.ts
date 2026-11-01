import { Timestamp } from "firebase-admin/firestore";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { configureCloudinary } from "@/lib/cloudinary-server";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

const photoFormats: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to change your profile photo.", 401);

  if (Number(request.headers.get("content-length")) > maxBytes + 512 * 1024) {
    return jsonError("Choose a JPG, PNG, or WebP photo smaller than 5 MB.", 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError("Choose a photo to upload.", 400);
  }

  const file = form.get("photo");
  if (!(file instanceof File) || !photoFormats[file.type]) {
    return jsonError("Upload a JPG, PNG, or WebP photo.", 400);
  }
  if (file.size > maxBytes) {
    return jsonError("Choose a photo smaller than 5 MB.", 413);
  }

  try {
    configureCloudinary();
    const buffer = Buffer.from(await file.arrayBuffer());
    const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "surefood/avatars",
          public_id: `avatar_${user.uid}`,
          overwrite: true,
          invalidate: true,
          resource_type: "image",
          transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
        },
        (error, result) => (error || !result ? reject(error) : resolve(result)),
      );
      stream.end(buffer);
    });

    await adminDb().collection("users").doc(user.uid).set(
      { photoUrl: upload.secure_url, updatedAt: Timestamp.now() },
      { merge: true },
    );

    return Response.json({ photoUrl: upload.secure_url });
  } catch (error) {
    console.error("Could not save the profile photo.", error);
    return jsonError("We could not save your photo. Try a smaller image.", 500);
  }
}
