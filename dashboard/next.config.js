/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    return {
      // fallback: las rutas dinámicas del App Router (como [...path]) se evalúan
      // ANTES de fallback. El Route Handler en app/api/sse/[...path] coincide con
      // /api/sse/* y maneja SSE. Todo lo demás cae en fallback y se envía al backend.
      fallback: [
        {
          source: "/api/:path*",
          destination: `${apiUrl}/api/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
