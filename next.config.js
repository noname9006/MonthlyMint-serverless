// Map STORAGE1_* prefixed environment variables to standard KV names
// This allows users to copy-paste storage credentials without renaming them
if (process.env.STORAGE1_KV_REST_API_URL && !process.env.KV_REST_API_URL) {
  process.env.KV_REST_API_URL = process.env.STORAGE1_KV_REST_API_URL
}
if (process.env.STORAGE1_KV_REST_API_TOKEN && !process.env.KV_REST_API_TOKEN) {
  process.env.KV_REST_API_TOKEN = process.env.STORAGE1_KV_REST_API_TOKEN
}
if (process.env.STORAGE1_KV_REST_API_READ_ONLY_TOKEN && !process.env.KV_REST_API_READ_ONLY_TOKEN) {
  process.env.KV_REST_API_READ_ONLY_TOKEN = process.env.STORAGE1_KV_REST_API_READ_ONLY_TOKEN
}
if (process.env.STORAGE1_KV_URL && !process.env.KV_URL) {
  process.env.KV_URL = process.env.STORAGE1_KV_URL
}
if (process.env.STORAGE1_REDIS_URL && !process.env.REDIS_URL) {
  process.env.REDIS_URL = process.env.STORAGE1_REDIS_URL
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    }
    return config
  },
}

module.exports = nextConfig
