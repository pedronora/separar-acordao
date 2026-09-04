import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { config } from '../../utils/config';
import {
  emailDestino,
  obterEmailPadraoInativo,
} from '../../utils/configuracoes';
import type { ArquivoLote } from '../../utils/tipos';
import {
  montarAssunto,
  montarHtml,
  type TarefaEmail,
} from '../../utils/email';
import {
  chamarSeparar,
  ErroPythonService,
} from '../../utils/python';

interface CorpoEnvio {
  arquivos?: ArquivoLote[];
  orgao?: string;
  dataSessao?: string;
  totalAcordaos?: number;
}

interface GrupoArquivo {
  responsavel: string;
  tarefas: TarefaEmail[];
}

interface GrupoMerged {
  responsavel: string;
  tabelas: Map<string, TarefaEmail[]>;
  tarefasFlat: TarefaEmail[];
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

function marcarEtiqueta(
  grupos: {
    responsavel: string;
    tarefas: { autos: string; pauta: string }[];
  }[],
  etiqueta: string
): GrupoArquivo[] {
  return grupos.map((grupo) => ({
    responsavel: grupo.responsavel,
    tarefas: grupo.tarefas.map((t) => ({
      autos: t.autos,
      pauta: t.pauta,
      etiqueta,
    })),
  }));
}

function mergePorResponsavel(
  arquivosGrupos: GrupoArquivo[][]
): GrupoMerged[] {
  const mapa = new Map<
    string,
    { tabelas: Map<string, TarefaEmail[]>; flat: TarefaEmail[] }
  >();

  for (const grupos of arquivosGrupos) {
    for (const grupo of grupos) {
      const nome = grupo.responsavel;
      let entrada = mapa.get(nome);
      if (!entrada) {
        entrada = { tabelas: new Map(), flat: [] };
        mapa.set(nome, entrada);
      }
      const etiqueta =
        grupo.tarefas[0]?.etiqueta ?? '';
      const existente = entrada.tabelas.get(etiqueta);
      if (existente) {
        existente.push(...grupo.tarefas);
      } else {
        entrada.tabelas.set(
          etiqueta,
          [...grupo.tarefas]
        );
      }
      entrada.flat.push(...grupo.tarefas);
    }
  }

  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([responsavel, dados]) => ({
      responsavel,
      tabelas: dados.tabelas,
      tarefasFlat: dados.flat,
    }));
}

async function processarLote(
  loteId: string,
  arquivos: ArquivoLote[],
  orgao: string,
  dataSessao: string,
  _totalAcordaos?: number
): Promise<void> {
  const caminhos: string[] = [];
  try {
    const responsaveisCadastrados =
      await prisma.responsavel.findMany({
        select: {
          id: true,
          nome: true,
          email: true,
          ativo: true,
        },
      });
    const mapaPorNome = new Map(
      responsaveisCadastrados.map((r) => [
        r.nome.trim().toUpperCase(),
        r,
      ])
    );
    const nomesCadastrados = responsaveisCadastrados.map(
      (r) => r.nome
    );

    const arquivosGrupos: GrupoArquivo[][] = [];

    for (const arquivo of arquivos) {
      const caminho = join(
        resolve(process.cwd(), config.uploadDir),
        `${arquivo.token}.csv`
      );
      caminhos.push(caminho);

      let conteudo: Buffer;
      try {
        conteudo = await readFile(caminho);
      } catch {
        throw createError({
          statusCode: 404,
          message: `Arquivo "${arquivo.arquivoOrigem}" não encontrado ou expirado.`,
        });
      }

      const resultado = await chamarSeparar({
        arquivo: conteudo,
        nomeArquivo: `${loteId}_${arquivo.etiqueta}.csv`,
        pautas: arquivo.pautas,
        responsaveisCadastrados: nomesCadastrados,
        totalAcordaos: arquivo.totalAcordaos,
      });

      arquivosGrupos.push(
        marcarEtiqueta(resultado.grupos, arquivo.etiqueta)
      );
    }

    const gruposMerged = mergePorResponsavel(arquivosGrupos);

    const normalizar = (nome: string) =>
      nome.trim().toUpperCase();
    const responsaveisUnicos = [
      ...new Set(gruposMerged.map((g) => g.responsavel)),
    ];
    const inativosNoLote = responsaveisUnicos.filter((nome) => {
      const resp = mapaPorNome.get(normalizar(nome));
      return resp && !resp.ativo;
    });
    let emailPadraoInativo = '';
    if (inativosNoLote.length > 0) {
      emailPadraoInativo = await obterEmailPadraoInativo();
      if (!emailPadraoInativo) {
        throw createError({
          statusCode: 422,
          message: `Responsável(is) inativo(s) no lote (${inativosNoLote.join(', ')}). Configure o e-mail padrão para responsáveis inativos antes de processar.`,
        });
      }
    }

    const totalGrupos = gruposMerged.length;

    await prisma.loteEnvio.update({
      where: { id: loteId },
      data: { totalEnvios: totalGrupos },
    });

    for (const [indice, grupo] of gruposMerged.entries()) {
      const responsavel = mapaPorNome.get(
        normalizar(grupo.responsavel)
      );
      if (!responsavel) {
        continue;
      }

      const html = montarHtml(
        grupo.responsavel,
        grupo.tabelas
      );
      const assunto = montarAssunto(
        orgao,
        dataSessao,
        grupo.responsavel
      );
      const para = emailDestino(responsavel, emailPadraoInativo);

      const registroEnvio = await prisma.envio.create({
        data: {
          loteId,
          responsavelId: responsavel.id,
          tarefas: grupo.tarefasFlat,
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
          data: {
            status: 'enviado',
            enviadoEm: new Date(),
          },
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
      where: { id: loteId },
      data: { status: 'processado' },
    });
  } catch (erro) {
    await prisma.loteEnvio.update({
      where: { id: loteId },
      data: {
        status: 'falhou',
        erro: mensagemDeErroDoProcessamento(erro),
      },
    });
  } finally {
    for (const caminho of caminhos) {
      await rm(caminho, { force: true });
    }
  }
}

export default defineEventHandler(async (event) => {
  const usuario = getUsuarioAutenticado(event);
  const corpo = (await readBody(event)) as CorpoEnvio;

  if (
    !corpo.arquivos ||
    !Array.isArray(corpo.arquivos) ||
    corpo.arquivos.length === 0 ||
    !corpo.orgao ||
    !corpo.dataSessao
  ) {
    throw createError({
      statusCode: 422,
      message: 'arquivos, orgao e dataSessao são obrigatórios.',
    });
  }

  for (const arquivo of corpo.arquivos) {
    if (!arquivo.token || !arquivo.etiqueta) {
      throw createError({
        statusCode: 422,
        message:
          'Cada arquivo deve conter token e etiqueta.',
      });
    }
    const pautasVazias = Object.entries(
      arquivo.pautas ?? {}
    )
      .filter(([, valor]) => !String(valor).trim())
      .map(([desde]) => desde);
    if (pautasVazias.length > 0) {
      throw createError({
        statusCode: 422,
        message: `Rótulo de pauta não informado para: ${pautasVazias.join(', ')} (arquivo: ${arquivo.etiqueta}).`,
      });
    }
  }

  const etiquetas = corpo.arquivos.map((a) => a.etiqueta);
  const nomesArquivos = corpo.arquivos.map(
    (a) => a.arquivoOrigem
  );
  const descricaoArquivo =
    corpo.arquivos.length === 1
      ? nomesArquivos[0]
      : `${etiquetas.join(', ')}`;

  const lote = await prisma.loteEnvio.create({
    data: {
      arquivoOrigem: descricaoArquivo,
      orgao: corpo.orgao,
      dataSessao: corpo.dataSessao,
      usuarioId: usuario.sub,
      status: 'processando',
      arquivos: corpo.arquivos,
    },
  });

  void processarLote(
    lote.id,
    corpo.arquivos,
    corpo.orgao,
    corpo.dataSessao,
    corpo.totalAcordaos
  );

  return { loteId: lote.id, status: 'processando' };
});
