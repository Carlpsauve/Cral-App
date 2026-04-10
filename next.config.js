/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // ✨ LA LIGNE MAGIQUE QUI RÈGLE LE PROBLÈME VERCEL ✨
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.tcgdex.net',
      },
      {
        protocol: 'https',
        hostname: 'cards.lorcast.io',
      },
      {
        protocol: 'https',
        hostname: 'lorcana-api.com',
      },
    ],
  },
}

module.exports = nextConfig