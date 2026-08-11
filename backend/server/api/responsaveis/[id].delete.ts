export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');

  const responsavel = await prisma.responsavel.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!responsavel) {
    throw createError({
      statusCode: 404,
      message: 'Responsável não encontrado.',
    });
  }

  const quantidadeEnvios = await prisma.envio.count({
    where: { responsavelId: id },
  });
  if (quantidadeEnvios > 0) {
    throw createError({
      statusCode: 409,
      message: `Não é possível excluir: este responsável possui ${quantidadeEnvios} envio(s) no histórico. Desative-o para impedir novos envios.`,
    });
  }

  await prisma.responsavel.delete({ where: { id } });
  setResponseStatus(event, 204);
  return null;
});
