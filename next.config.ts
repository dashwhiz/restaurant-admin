import type { NextConfig } from 'next';

// Static export so the app can be hosted on GitHub Pages (no server needed).
// BASE_PATH is set by the deploy workflow to "/restaurant-admin" (the repo
// name). Locally it's empty, so the app is served at "/".
const basePath = process.env.BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true }, // required for static export; we use plain <img>/SVG
  basePath,
  // Make the base path available to client code (e.g. for building asset URLs).
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
