export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: true },
  runtimeConfig: {
    apiInternalUrl: process.env.API_INTERNAL_URL || 'http://localhost:3001',
  },
  routeRules: {
    '/api/**': {
      proxy: `${process.env.API_PROXY_TARGET || 'http://localhost:3001'}/api/**`,
    },
  },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/eslint'],
});
