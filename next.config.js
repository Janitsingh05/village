const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // There is an unrelated package-lock.json further up the drive; pin the
  // trace root here so Next stops guessing the workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

module.exports = nextConfig;
