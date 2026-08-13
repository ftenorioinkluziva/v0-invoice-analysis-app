/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['pdf-parse'],
}

export default nextConfig
