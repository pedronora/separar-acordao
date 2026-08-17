export default defineNuxtRouteMiddleware(() => {
  const { usuario } = useAuth();
  if (!usuario.value) {
    return navigateTo('/login');
  }
});
