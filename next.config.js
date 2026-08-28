const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

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
