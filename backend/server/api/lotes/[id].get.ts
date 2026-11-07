import { loteCompletamenteConfirmado } from '../../utils/comunicacao';
import { obterDadosDesembargador } from '../../utils/configuracoes';

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
      comunicacao: true,
    },
  });
  if (!lote) {
    throw createError({
      statusCode: 404,
      message: 'Lote não encontrado.',
    });
  }

  const { comunicacao, ...dadosLote } = lote;
  const desembargador = await obterDadosDesembargador();

  return {
    ...dadosLote,
    completamenteConfirmado: loteCompletamenteConfirmado(lote.envios),
    comunicacao: {
      configurado: Boolean(
        desembargador.nome.trim() && desembargador.email.trim()
      ),
      status: comunicacao?.status ?? null,
      apresentadaEm: comunicacao?.apresentadaEm ?? null,
      enviadaEm: comunicacao?.enviadaEm ?? null,
      erro: comunicacao?.erro ?? null,
    },
  };
});
