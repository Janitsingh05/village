const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // The menu footer shows the running version; taking it from package.json at
  // build time means there is no second number to remember to bump.
  env: { NEXT_PUBLIC_APP_VERSION: require('./package.json').version },

  // Firebase Hosting's free tier serves static files only, and this app is
  // entirely client-rendered anyway — every page fetches its own data from
  // Firestore in the browser, so there is nothing for a server to do.
  output: 'export',

  // Emit directory-style pages (out/report/index.html), which is what Hosting
  // expects for clean URLs.
  trailingSlash: true,

  images: { unoptimized: true },

  // There is an unrelated package-lock.json further up the drive; pin the
  // trace root here so Next stops guessing the workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
