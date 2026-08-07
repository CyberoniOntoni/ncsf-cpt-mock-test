import type { NextConfig } from "next";

/**
 * Next.js 16 blocks cross-origin access to /_next/* in dev by default.
 * Opening the app from a phone/PC on LAN (e.g. http://192.168.x.x:3000)
 * then serves HTML but **no client JS** — buttons look dead.
 *
 * Set ALLOWED_DEV_ORIGINS=192.168.11.18,my-pc.local in .env.local if needed.
 */
function allowedDevOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_DEV_ORIGINS || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return [
    "localhost",
    "127.0.0.1",
    // Hosts seen in this project's dev / LAN access
    "192.168.11.18",
    "100.98.110.105",
    ...fromEnv,
  ];
}

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["@electric-sql/pglite"],
  allowedDevOrigins: allowedDevOrigins(),
};

export default nextConfig;
