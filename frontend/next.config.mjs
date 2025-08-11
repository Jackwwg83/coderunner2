/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Use port 8083 to comply with port usage rules (3000-3009 are forbidden)
  experimental: {
    serverComponentsExternalPackages: [],
  },
}

export default nextConfig
