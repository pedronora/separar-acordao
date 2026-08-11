export default defineEventHandler(async (event) => {
  const auth = getUsuarioAutenticado(event);
  const usuario = await prisma.usuario.findUnique({
    where: { id: auth.sub },
    select: { id: true, email: true, nome: true, criadoEm: true },
  });
  if (!usuario) {
    throw createError({ statusCode: 401, message: 'Usuário inexistente.' });
  }
  return usuario;
});
