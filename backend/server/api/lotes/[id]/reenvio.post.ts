import {
  agruparTarefas,
  montarAssunto,
  montarHtml,
  type TarefaEmail,
} from '../../../utils/email';
import {
  emailDestino,
  obterEmailPadraoInativo,
} from '../../../utils/configuracoes';

interface CorpoReenvio {
  envioIds?: string[];
}

interface ReenvioPronto {
  id: string;
  para: string;
  assunto: string;
  html: string;
}

async function processarReenvios(reenvios: ReenvioPronto[]): Promise<void> {
  for (const [indice, reenvio] of reenvios.entries()) {
    const enviado = await enviarEmail({
      to: reenvio.para,
      subject: reenvio.assunto,
      html: reenvio.html,
    })
      .then(() => true)
      .catch(() => false);

    await prisma.envio
      .update({
        where: { id: reenvio.id },
        data: enviado
          ? { status: 'enviado', enviadoEm: new Date() }
          : { status: 'falhou' },
      })
      .catch(() => undefined);

    if (indice < reenvios.length - 1) {
      await pausaEntreEnvios();
    }
  }
}

export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);
  const id = getRouterParam(event, 'id');
  const corpo = (await readBody(event).catch(
    () => ({})
  )) as CorpoReenvio;

  const envioIds = corpo?.envioIds;
  if (!Array.isArray(envioIds) || envioIds.length === 0) {
    throw createError({
      statusCode: 422,
      message: 'Nenhum envio selecionado.',
    });
  }

  const lote = await prisma.loteEnvio.findUnique({
    where: { id },
    include: { envios: { include: { responsavel: true } } },
  });
  if (!lote) {
    throw createError({
      statusCode: 404,
      message: 'Lote não encontrado.',
    });
  }

  const idsSelecionados = new Set(envioIds);
  const selecionados = lote.envios.filter((e) =>
    idsSelecionados.has(e.id)
  );
  if (selecionados.length !== idsSelecionados.size) {
    throw createError({
      statusCode: 422,
      message:
        'Seleção inválida: um ou mais envios não pertencem a este lote.',
    });
  }

  const inativosSelecionados = selecionados.filter(
    (e) => !e.responsavel.ativo
  );
  let emailPadraoInativo = '';
  if (inativosSelecionados.length > 0) {
    emailPadraoInativo = await obterEmailPadraoInativo();
    if (!emailPadraoInativo) {
      throw createError({
        statusCode: 422,
        message: `Envio(s) de responsável(is) inativo(s) selecionado(s). Configure o e-mail padrão para responsáveis inativos antes de reenviar.`,
      });
    }
  }

  const orgao = lote.orgao ?? '';
  const dataSessao = lote.dataSessao ?? '';

  const preparados = selecionados.map((envio) => {
    const tarefas = envio.tarefas as TarefaEmail[];
    return {
      envio,
      para: emailDestino(envio.responsavel, emailPadraoInativo),
      assunto: montarAssunto(orgao, dataSessao, envio.responsavel.nome),
      html: montarHtml(envio.responsavel.nome, agruparTarefas(tarefas)),
    };
  });

  const reenvios = await prisma.$transaction(async (tx) => {
    const criados: ReenvioPronto[] = [];
    for (const item of preparados) {
      const criado = await tx.envio.create({
        data: {
          loteId: lote.id,
          responsavelId: item.envio.responsavelId,
          tarefas: item.envio.tarefas,
          para: item.para,
          assunto: item.assunto,
          corpoHtml: item.html,
          reenviadoDe: item.envio.id,
          status: 'pendente',
        },
      });
      criados.push({
        id: criado.id,
        para: item.para,
        assunto: item.assunto,
        html: item.html,
      });
    }
    return criados;
  });

  void processarReenvios(reenvios).catch(() => undefined);

  return {
    total: reenvios.length,
    envioIds: reenvios.map((reenvio) => reenvio.id),
  };
});
