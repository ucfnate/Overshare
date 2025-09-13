/** @type {import('next').NextConfig} */
const isPreview = process.env.VERCEL_ENV === 'preview';

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Don’t block preview deploys on lint errors; keep production strict
  eslint: { ignoreDuringBuilds: isPreview },
  // (Optional) typescript: { ignoreBuildErrors: isPreview },
};

module.exports = nextConfig;

