import { createError } from 'h3';

import {
  coletarTarefasDosEnvios,
  montarResumoComunicacao,
  podeComunicarLote,
} from './comunicacao';
import {
  obterDadosDesembargador,
  validarDadosDesembargador,
} from './configuracoes';

export async function carregarDadosComunicacao(loteId: string) {
  const lote = await prisma.loteEnvio.findUnique({
    where: { id: loteId },
    include: {
      envios: {
        select: { confirmado: true, tarefas: true },
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

  if (!podeComunicarLote(lote)) {
    throw createError({
      statusCode: 422,
      message:
        'O lote ainda não está completamente confirmado. ' +
        'Confirme todos os responsáveis antes de comunicar.',
    });
  }

  const desembargador = await obterDadosDesembargador();
  const erroConfig = validarDadosDesembargador(desembargador);
  if (erroConfig) {
    throw createError({
      statusCode: 422,
      message: `${erroConfig} Complete a configuração em Configurações.`,
    });
  }

  const orgao = (lote.orgao ?? '').trim();
  const dataSessao = (lote.dataSessao ?? '').trim();
  if (!orgao || !dataSessao) {
    throw createError({
      statusCode: 422,
      message:
        'Órgão julgador e data da sessão não estão preenchidos no lote.',
    });
  }

  const resumo = montarResumoComunicacao(coletarTarefasDosEnvios(lote.envios));
  if (resumo.length === 0) {
    throw createError({
      statusCode: 422,
      message: 'Não há recursos para incluir na comunicação.',
    });
  }

  return { lote, desembargador, orgao, dataSessao, resumo };
}
