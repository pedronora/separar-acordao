import {
  agruparTarefas,
  montarAssunto,
  type TarefaEmail,
} from '../../../utils/email';
import {
  emailDestino,
  obterEmailPadraoInativo,
} from '../../../utils/configuracoes';

interface CorpoReenvio {
  envioIds?: string[];
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
  let enviados = 0;
  const falhas: string[] = [];

  for (const envio of selecionados) {
    const tarefas = envio.tarefas as TarefaEmail[];
    const tabelas = agruparTarefas(tarefas);
    const html = montarHtml(envio.responsavel.nome, tabelas);
    const assunto = montarAssunto(orgao, dataSessao, envio.responsavel.nome);
    const para = emailDestino(envio.responsavel, emailPadraoInativo);

    const novoEnvio = await prisma.envio.create({
      data: {
        loteId: lote.id,
        responsavelId: envio.responsavelId,
        tarefas: envio.tarefas,
        para,
        assunto,
        corpoHtml: html,
        reenviadoDe: envio.id,
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
        where: { id: novoEnvio.id },
        data: { status: 'enviado', enviadoEm: new Date() },
      });
      enviados++;
    } catch {
      await prisma.envio.update({
        where: { id: novoEnvio.id },
        data: { status: 'falhou' },
      });
      falhas.push(envio.responsavel.nome);
    }

    await pausaEntreEnvios();
  }

  return { total: selecionados.length, enviados, falhas };
});
