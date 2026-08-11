import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { config } from '../../utils/config';

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
  const ativos = responsaveisCadastrados.filter((r) => r.ativo);
  const mapaPorNome = new Map(
    ativos.map((r) => [r.nome.trim().toUpperCase(), r])
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
      responsaveisCadastrados: ativos.map((r) => r.nome),
      totalAcordaos: corpo.totalAcordaos,
    });

    let enviados = 0;
    const falhas: string[] = [];
    const totalGrupos = resultado.grupos.length;

    for (const [indice, grupo] of resultado.grupos.entries()) {
      const responsavel = mapaPorNome.get(
        grupo.responsavel.trim().toUpperCase()
      );
      if (!responsavel) {
        continue;
      }

      const registroEnvio = await prisma.envio.create({
        data: {
          loteId: lote.id,
          responsavelId: responsavel.id,
          tarefas: grupo.tarefas,
          status: 'pendente',
        },
      });

      const html = montarHtml(grupo.responsavel, grupo.tarefas);
      const assunto = montarAssunto(
        corpo.orgao!,
        corpo.dataSessao!,
        grupo.responsavel
      );

      try {
        await enviarEmail({
          to: responsavel.email,
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
