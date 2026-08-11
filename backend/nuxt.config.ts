export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: true },
  routeRules: {
    '/api/**': {
      cors: true,
      headers: {
        'Access-Control-Allow-Origin':
          process.env.CORS_ORIGIN || 'http://localhost:3000',
        'Access-Control-Allow-Methods':
          'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    },
  },
});
