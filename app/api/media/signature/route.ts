import { v2 as cloudinary } from "cloudinary";
import { authenticatedUser } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { sellerCanManageListings } from "@/lib/auth/seller-verification";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return jsonError("Sign in to upload product images.", 401);
  if (user.role !== "vendor" && user.role !== "supplier") return jsonError("Only vendors and suppliers can upload product images.", 403);
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return jsonError("Product image uploads are not configured yet.", 503);
  }

  try {
    const profile = await adminDb().collection("users").doc(user.uid).get();
    if (!sellerCanManageListings(profile.data())) {
      return jsonError("Your business account must be approved and the approval fee paid before uploading product images.", 403);
    }
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `surefood/products/${user.uid}`;
    const params = { timestamp, folder, allowed_formats: "jpg,jpeg,png,webp" };
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
    return Response.json({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      allowedFormats: params.allowed_formats,
      signature,
    });
  } catch (error) {
    console.error("Could not create a product image upload signature.", error);
    return jsonError("We could not prepare the product image upload.", 500);
  }
}
