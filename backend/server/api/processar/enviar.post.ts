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

export default defineEventHandler(async (event) => {
  const usuario = getUsuarioAutenticado(event);
  const corpo = (await readBody(event)) as CorpoEnvio;

  if (!corpo.token || !corpo.pautas || !corpo.orgao || !corpo.dataSessao) {
    throw createError({
      statusCode: 422,
      message: 'token, pautas, orgao e dataSessao são obrigatórios.',
    });
  }

  const diretorio = resolve(process.cwd(), config.uploadDir);
  const caminho = join(diretorio, `${corpo.token}.csv`);
  let arquivo: Buffer;
  try {
    arquivo = await readFile(caminho);
  } catch {
    throw createError({
      statusCode: 404,
      message: 'Arquivo não encontrado ou expirado. Reenvie o upload.',
    });
  }

  const responsaveisCadastrados = await prisma.responsavel.findMany({
    select: { id: true, nome: true, email: true, ativo: true },
  });
  const mapaPorNome = new Map(
    responsaveisCadastrados.map((r) => [r.nome.trim().toUpperCase(), r])
  );

  const lote = await prisma.loteEnvio.create({
    data: {
      arquivoOrigem: corpo.arquivoOrigem || corpo.token,
      orgao: corpo.orgao,
      dataSessao: corpo.dataSessao,
      usuarioId: usuario.sub,
      status: 'processando',
    },
  });

  try {
    const resultado = await chamarSeparar({
      arquivo,
      nomeArquivo: `${lote.id}.csv`,
      pautas: corpo.pautas,
      responsaveisCadastrados: responsaveisCadastrados.map((r) => r.nome),
      totalAcordaos: corpo.totalAcordaos,
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

    let enviados = 0;
    const falhas: string[] = [];
    const totalGrupos = resultado.grupos.length;

    for (const [indice, grupo] of resultado.grupos.entries()) {
      const responsavel = mapaPorNome.get(normalizar(grupo.responsavel));
      if (!responsavel) {
        continue;
      }

      const html = montarHtml(grupo.responsavel, grupo.tarefas);
      const assunto = montarAssunto(
        corpo.orgao!,
        corpo.dataSessao!,
        grupo.responsavel
      );
      const para = emailDestino(responsavel, emailPadraoInativo);

      const registroEnvio = await prisma.envio.create({
        data: {
          loteId: lote.id,
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
        enviados++;
      } catch {
        await prisma.envio.update({
          where: { id: registroEnvio.id },
          data: { status: 'falhou' },
        });
        falhas.push(grupo.responsavel);
      }

      if (indice < totalGrupos - 1) {
        await pausaEntreEnvios();
      }
    }

    await prisma.loteEnvio.update({
      where: { id: lote.id },
      data: { status: 'processado' },
    });

    await rm(caminho, { force: true });

    return {
      loteId: lote.id,
      totalAcordaos: resultado.total_acordaos,
      totalEnvios: resultado.grupos.length,
      enviados,
      falhas,
    };
  } catch (erro) {
    await prisma.loteEnvio.update({
      where: { id: lote.id },
      data: { status: 'falhou' },
    });
    if (erro instanceof ErroPythonService) {
      const detalhe = erro.detalhe;
      if (
        typeof detalhe === 'object' &&
        detalhe.tipo === 'responsaveis_faltantes'
      ) {
        throw createError({
          statusCode: 422,
          message: `Responsável(is) não cadastrado(s): ${detalhe.faltantes?.join(', ')}. Cadastre antes de processar.`,
        });
      }
    }
    throw erro;
  }
});
