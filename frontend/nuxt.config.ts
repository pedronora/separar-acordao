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
  modules: ['@nuxt/eslint', '@nuxt/icon'],
  icon: {
    mode: 'svg',
    // Fora de /api, que é proxiado para o backend.
    localApiEndpoint: '/_nuxt_icon',
    serverBundle: { collections: ['lucide'] },
    clientBundle: {
      scan: true,
      icons: [
        'lucide:pencil',
        'lucide:eye',
        'lucide:eye-off',
        'lucide:trash-2',
        'lucide:check',
        'lucide:x',
      ],
    },
    fallbackToApi: false,
  },
});
