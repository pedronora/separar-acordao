import {
  montarAssuntoComunicacao,
  montarHtmlComunicacao,
} from '../../../../utils/comunicacao';
import { carregarDadosComunicacao } from '../../../../utils/comunicacaoLote';

export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 404,
      message: 'Lote não encontrado.',
    });
  }

  const { lote, desembargador, orgao, dataSessao, resumo } =
    await carregarDadosComunicacao(id);

  const assunto = montarAssuntoComunicacao(orgao, dataSessao);
  const corpoHtml = montarHtmlComunicacao({
    nomeDesembargador: desembargador.nome,
    resumo,
  });

  await prisma.comunicacaoDesembargador.upsert({
    where: { loteId: lote.id },
    update: {},
    create: {
      loteId: lote.id,
      status: 'pendente',
      destinatario: desembargador.email,
      destinatarioNome: desembargador.nome,
      assunto,
      corpoHtml,
    },
  });

  await prisma.comunicacaoDesembargador.updateMany({
    where: {
      loteId: lote.id,
      status: { in: ['pendente', 'falhou'] },
    },
    data: {
      destinatario: desembargador.email,
      destinatarioNome: desembargador.nome,
      assunto,
      corpoHtml,
    },
  });

  const apresentacao = await prisma.comunicacaoDesembargador.updateMany({
    where: { loteId: lote.id, apresentadaEm: null },
    data: { apresentadaEm: new Date() },
  });

  const comunicacao = await prisma.comunicacaoDesembargador.findUnique({
    where: { loteId: lote.id },
  });
  if (!comunicacao) {
    throw createError({
      statusCode: 500,
      message: 'Não foi possível preparar a comunicação.',
    });
  }

  const bccDisponiveis = await prisma.responsavel.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, email: true },
    orderBy: { nome: 'asc' },
  });
  const emailPrincipal = comunicacao.destinatario.trim().toLowerCase();

  return {
    destinatario: {
      nome: comunicacao.destinatarioNome,
      email: comunicacao.destinatario,
    },
    assunto: comunicacao.assunto,
    corpoHtml: comunicacao.corpoHtml,
    resumo,
    bccDisponiveis: bccDisponiveis.filter(
      (responsavel) =>
        responsavel.email.trim().toLowerCase() !== emailPrincipal
    ),
    status: comunicacao.status,
    enviadaEm: comunicacao.enviadaEm,
    erro: comunicacao.erro,
    apresentadaAgora: apresentacao.count === 1,
    jaEnviada: comunicacao.status === 'enviada',
  };
});
