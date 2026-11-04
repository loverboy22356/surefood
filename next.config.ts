import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Keep the dev clock helper on the same google-auth instance firebase-admin loads,
  // instead of a second bundled copy it cannot patch.
  serverExternalPackages: ["google-auth-library"],
  images: {
    qualities: [75, 90, 92, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
