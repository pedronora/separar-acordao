interface CorpoConfirmacao {
  envioIds: string[];
  confirmado: boolean;
}

export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);
  const id = getRouterParam(event, 'id');
  const corpo = (await readBody(
    event
  )) as CorpoConfirmacao;

  if (
    !Array.isArray(corpo.envioIds) ||
    corpo.envioIds.length === 0
  ) {
    throw createError({
      statusCode: 422,
      message: 'Nenhum envio selecionado.',
    });
  }

  const lote = await prisma.loteEnvio.findUnique({
    where: { id },
    include: {
      envios: { select: { id: true } },
    },
  });
  if (!lote) {
    throw createError({
      statusCode: 404,
      message: 'Lote não encontrado.',
    });
  }

  const idsValidos = new Set(
    lote.envios.map((e) => e.id)
  );
  const envioIdsValidos = corpo.envioIds.filter(
    (eid) => idsValidos.has(eid)
  );
  if (envioIdsValidos.length === 0) {
    throw createError({
      statusCode: 422,
      message:
        'Nenhum envio válido selecionado neste lote.',
    });
  }

  const agora = corpo.confirmado ? new Date() : null;

  const atualizados = await prisma.envio.updateMany({
    where: { id: { in: envioIdsValidos } },
    data: {
      confirmado: corpo.confirmado,
      confirmadoEm: agora,
    },
  });

  return { atualizados: atualizados.count };
});
