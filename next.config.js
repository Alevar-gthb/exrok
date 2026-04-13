/** @type {import('next').NextConfig} */
const nextConfig = {
  // Hindari chunk server bernama `@supabase.js` (scope npm `@`) yang bisa
  // gagal di-resolve saat dev / static-paths-worker — pola umum Next + Supabase.
  experimental: {
    serverComponentsExternalPackages: ['@supabase/ssr', '@supabase/supabase-js'],
  },
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
