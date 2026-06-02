/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the dev server to be reached through a Cloudflare quick tunnel.
  allowedDevOrigins: ["*.trycloudflare.com"]
};

export default nextConfig;
