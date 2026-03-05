/** @type {import('next').NextConfig} */

// Reads BACKEND_PORT from frontend/.env.local if set, otherwise 3001.
// Set BACKEND_PORT=5000 in frontend/.env.local if your backend runs on 5000.
const BACKEND_PORT = process.env.BACKEND_PORT || "3001";

const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://localhost:${BACKEND_PORT}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
