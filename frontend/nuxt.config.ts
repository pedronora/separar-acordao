export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      apiBaseUrl:
        process.env.NUXT_PUBLIC_API_BASE_URL || 'http://localhost:3001',
    },
  },
  css: ['~/assets/css/main.css'],
  modules: ['@nuxt/eslint'],
});
