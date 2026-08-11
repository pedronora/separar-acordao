export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);
  const id = getRouterParam(event, 'id');
  const lote = await prisma.loteEnvio.findUnique({
    where: { id },
    include: {
      usuario: { select: { id: true, nome: true, email: true } },
      envios: {
        orderBy: { enviadoEm: 'asc' },
        include: {
          responsavel: { select: { id: true, nome: true, email: true } },
        },
      },
    },
  });
  if (!lote) {
    throw createError({
      statusCode: 404,
      message: 'Lote não encontrado.',
    });
  }
  return lote;
});
