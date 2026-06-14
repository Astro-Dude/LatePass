/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pg` and `googleapis` are server-only; keep them out of the client bundle.
  serverExternalPackages: ["pg", "googleapis", "google-auth-library"],
};

module.exports = nextConfig;
