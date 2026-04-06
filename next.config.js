/** @type {import('next').NextConfig} */
const nextConfig = {
  // Izinkan gambar dari Supabase Storage
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Skip TypeScript errors saat build (types belum di-generate dari Supabase)
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
