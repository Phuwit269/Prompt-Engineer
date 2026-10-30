import type { NextConfig } from "next";

// Browser -> Next (same origin) -> FastAPI. Keeps the httpOnly auth cookie first-party (no CORS/cookie headaches).
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
