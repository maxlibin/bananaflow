/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**", port: "", pathname: "/**" },
      { protocol: "http", hostname: "**", port: "", pathname: "/**" },
    ],
    formats: ["image/webp"],
    minimumCacheTTL: 31536000,
  },
  turbopack: {
    resolveAlias: {
      // Konva's Node.js entry tries to require 'canvas' — stub it out for client builds
      canvas: "./src/lib/canvas-stub.js",
    },
  },
};

export default nextConfig;
