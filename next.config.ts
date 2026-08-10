import type { NextConfig } from "next";

function getAllowedDevOrigins(value: string | undefined): string[] {
  if (!value) return [];

  return [...new Set(value.split(",").flatMap((entry) => {
    try {
      const url = new URL(entry.trim());
      const isOriginOnly =
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password &&
        url.pathname === "/" &&
        !url.search &&
        !url.hash;
      return isOriginOnly ? [url.hostname] : [];
    } catch {
      return [];
    }
  }))];
}

const nextConfig: NextConfig = {
  // Next compares the request Origin's hostname (without its port).
  allowedDevOrigins: getAllowedDevOrigins(process.env.BETTER_AUTH_DEV_ORIGINS),
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
