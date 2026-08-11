export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);
  const lotes = await prisma.loteEnvio.findMany({
    orderBy: { criadoEm: 'desc' },
    include: {
      usuario: { select: { nome: true } },
      envios: { select: { status: true } },
    },
  });
  return lotes.map((lote) => ({
    id: lote.id,
    arquivoOrigem: lote.arquivoOrigem,
    orgao: lote.orgao,
    dataSessao: lote.dataSessao,
    criadoEm: lote.criadoEm,
    status: lote.status,
    erro: lote.erro,
    usuario: lote.usuario.nome,
    totalEnvios: lote.envios.length,
    enviados: lote.envios.filter((e) => e.status === 'enviado').length,
    falhas: lote.envios.filter((e) => e.status === 'falhou').length,
  }));
});
