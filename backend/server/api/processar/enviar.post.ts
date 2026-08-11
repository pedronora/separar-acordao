import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { config } from '../../utils/config';
import {
  emailDestino,
  obterEmailPadraoInativo,
} from '../../utils/configuracoes';

interface CorpoEnvio {
  token?: string;
  arquivoOrigem?: string;
  pautas?: Record<string, string>;
  orgao?: string;
  dataSessao?: string;
  totalAcordaos?: number;
}

interface ParametrosProcessamento {
  loteId: string;
  token: string;
  arquivo: Buffer;
  arquivoOrigem: string;
  pautas: Record<string, string>;
  orgao: string;
  dataSessao: string;
  totalAcordaos?: number;
}

function mensagemDeErroDoProcessamento(erro: unknown): string {
  if (erro instanceof ErroPythonService) {
    const detalhe = erro.detalhe;
    if (
      typeof detalhe === 'object' &&
      detalhe.tipo === 'responsaveis_faltantes'
    ) {
      return `Responsável(is) não cadastrado(s): ${detalhe.faltantes?.join(', ')}. Cadastre antes de processar.`;
    }
  }
  if (erro instanceof Error && erro.message) {
    return erro.message;
  }
  return 'Erro inesperado ao processar o lote.';
}

async function processarLote(params: ParametrosProcessamento): Promise<void> {
  const caminho = join(
    resolve(process.cwd(), config.uploadDir),
    `${params.token}.csv`
  );
  try {
    const responsaveisCadastrados = await prisma.responsavel.findMany({
      select: { id: true, nome: true, email: true, ativo: true },
    });
    const mapaPorNome = new Map(
      responsaveisCadastrados.map((r) => [r.nome.trim().toUpperCase(), r])
    );

    const resultado = await chamarSeparar({
      arquivo: params.arquivo,
      nomeArquivo: `${params.loteId}.csv`,
      pautas: params.pautas,
      responsaveisCadastrados: responsaveisCadastrados.map((r) => r.nome),
      totalAcordaos: params.totalAcordaos,
    });

    const normalizar = (nome: string) => nome.trim().toUpperCase();
    const inativosNoLote = resultado.grupos.filter((grupo) => {
      const responsavel = mapaPorNome.get(normalizar(grupo.responsavel));
      return responsavel && !responsavel.ativo;
    });
    let emailPadraoInativo = '';
    if (inativosNoLote.length > 0) {
      emailPadraoInativo = await obterEmailPadraoInativo();
      if (!emailPadraoInativo) {
        throw createError({
          statusCode: 422,
          message: `Responsável(is) inativo(s) no lote (${inativosNoLote.map((g) => g.responsavel).join(', ')}). Configure o e-mail padrão para responsáveis inativos antes de processar.`,
        });
      }
    }

    const totalGrupos = resultado.grupos.length;

    await prisma.loteEnvio.update({
      where: { id: params.loteId },
      data: { totalEnvios: totalGrupos },
    });

    for (const [indice, grupo] of resultado.grupos.entries()) {
      const responsavel = mapaPorNome.get(normalizar(grupo.responsavel));
      if (!responsavel) {
        continue;
      }

      const html = montarHtml(grupo.responsavel, grupo.tarefas);
      const assunto = montarAssunto(
        params.orgao,
        params.dataSessao,
        grupo.responsavel
      );
      const para = emailDestino(responsavel, emailPadraoInativo);

      const registroEnvio = await prisma.envio.create({
        data: {
          loteId: params.loteId,
          responsavelId: responsavel.id,
          tarefas: grupo.tarefas,
          para,
          assunto,
          corpoHtml: html,
          status: 'pendente',
        },
      });

      try {
        await enviarEmail({
          to: para,
          subject: assunto,
          html,
        });
        await prisma.envio.update({
          where: { id: registroEnvio.id },
          data: { status: 'enviado', enviadoEm: new Date() },
        });
      } catch {
        await prisma.envio.update({
          where: { id: registroEnvio.id },
          data: { status: 'falhou' },
        });
      }

      if (indice < totalGrupos - 1) {
        await pausaEntreEnvios();
      }
    }

    await prisma.loteEnvio.update({
      where: { id: params.loteId },
      data: { status: 'processado' },
    });
  } catch (erro) {
    await prisma.loteEnvio.update({
      where: { id: params.loteId },
      data: {
        status: 'falhou',
        erro: mensagemDeErroDoProcessamento(erro),
      },
    });
  } finally {
    await rm(caminho, { force: true });
  }
}

export default defineEventHandler(async (event) => {
  const usuario = getUsuarioAutenticado(event);
  const corpo = (await readBody(event)) as CorpoEnvio;

  if (!corpo.token || !corpo.pautas || !corpo.orgao || !corpo.dataSessao) {
    throw createError({
      statusCode: 422,
      message: 'token, pautas, orgao e dataSessao são obrigatórios.',
    });
  }

  const pautasVazias = Object.entries(corpo.pautas)
    .filter(([, valor]) => !String(valor).trim())
    .map(([desde]) => desde);
  if (pautasVazias.length > 0) {
    throw createError({
      statusCode: 422,
      message: `Rótulo de pauta não informado para: ${pautasVazias.join(', ')}.`,
    });
  }

  const caminho = join(
    resolve(process.cwd(), config.uploadDir),
    `${corpo.token}.csv`
  );
  let arquivo: Buffer;
  try {
    arquivo = await readFile(caminho);
  } catch {
    throw createError({
      statusCode: 404,
      message: 'Arquivo não encontrado ou expirado. Reenvie o upload.',
    });
  }

  const lote = await prisma.loteEnvio.create({
    data: {
      arquivoOrigem: corpo.arquivoOrigem || corpo.token,
      orgao: corpo.orgao,
      dataSessao: corpo.dataSessao,
      usuarioId: usuario.sub,
      status: 'processando',
    },
  });

  void processarLote({
    loteId: lote.id,
    token: corpo.token,
    arquivo,
    arquivoOrigem: corpo.arquivoOrigem || corpo.token,
    pautas: corpo.pautas,
    orgao: corpo.orgao,
    dataSessao: corpo.dataSessao,
    totalAcordaos: corpo.totalAcordaos,
  });

  return { loteId: lote.id, status: 'processando' };
});
