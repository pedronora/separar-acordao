import {
  MENSAGEM_ERRO_ENVIO_COMUNICACAO,
  TIMEOUT_ENVIO_COMUNICACAO_MS,
  decidirEnvioComunicacao,
  montarAssuntoComunicacao,
  montarHtmlComunicacao,
  normalizarBcc,
  sanitizarCorpoComunicacao,
  validarAssuntoComunicacao,
} from '../../../../utils/comunicacao';
import { carregarDadosComunicacao } from '../../../../utils/comunicacaoLote';
import { enviarEmail } from '../../../../utils/email';

interface CorpoComunicacao {
  bccResponsavelIds?: string[];
  assunto?: string;
  corpoHtml?: string;
}

export default defineEventHandler(async (event) => {
  const usuario = getUsuarioAutenticado(event);
  const id = getRouterParam(event, 'id');
  if (!id) {
    throw createError({
      statusCode: 404,
      message: 'Lote não encontrado.',
    });
  }

  const corpo = (await readBody(event).catch(() => ({}))) as CorpoComunicacao;
  const idsBrutos = Array.isArray(corpo?.bccResponsavelIds)
    ? corpo.bccResponsavelIds
    : [];
  const idsUnicos = [
    ...new Set(
      idsBrutos.filter((valor): valor is string => typeof valor === 'string')
    ),
  ];

  const { lote, desembargador, orgao, dataSessao, resumo } =
    await carregarDadosComunicacao(id);

  const assuntoGerado = montarAssuntoComunicacao(orgao, dataSessao);
  const corpoGerado = montarHtmlComunicacao({
    nomeDesembargador: desembargador.nome,
    resumo,
  });

  const assuntoValidado = validarAssuntoComunicacao(
    typeof corpo?.assunto === 'string' ? corpo.assunto : assuntoGerado
  );
  if (assuntoValidado.erro) {
    throw createError({
      statusCode: 422,
      message: assuntoValidado.erro,
    });
  }

  const corpoValidado = sanitizarCorpoComunicacao(
    typeof corpo?.corpoHtml === 'string' ? corpo.corpoHtml : corpoGerado
  );
  if (corpoValidado.erro) {
    throw createError({
      statusCode: 422,
      message: corpoValidado.erro,
    });
  }

  const assunto = assuntoValidado.valor;
  const corpoHtml = corpoValidado.valor;

  const bccResponsaveis =
    idsUnicos.length > 0
      ? await prisma.responsavel.findMany({
          where: { id: { in: idsUnicos }, ativo: true },
          select: { id: true, nome: true, email: true },
          orderBy: { nome: 'asc' },
        })
      : [];

  if (bccResponsaveis.length !== idsUnicos.length) {
    throw createError({
      statusCode: 422,
      message:
        'Um ou mais responsáveis selecionados para BCC ' +
        'são inválidos ou estão inativos.',
    });
  }

  const bcc = normalizarBcc(bccResponsaveis, desembargador.email);

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

  const agora = new Date();
  const limite = new Date(agora.getTime() - TIMEOUT_ENVIO_COMUNICACAO_MS);

  const claim = await prisma.comunicacaoDesembargador.updateMany({
    where: {
      loteId: lote.id,
      OR: [
        { status: 'pendente' },
        { status: 'falhou' },
        { status: 'enviando', atualizadoEm: { lt: limite } },
      ],
    },
    data: {
      status: 'enviando',
      destinatario: desembargador.email,
      destinatarioNome: desembargador.nome,
      assunto,
      corpoHtml,
      bcc,
      usuarioId: usuario.sub,
      erro: null,
    },
  });

  if (claim.count === 0) {
    const atual = await prisma.comunicacaoDesembargador.findUnique({
      where: { loteId: lote.id },
    });
    const decisao = decidirEnvioComunicacao(
      atual?.status ?? null,
      atual?.atualizadoEm ?? null,
      new Date()
    );
    if (decisao === 'ja_enviada') {
      return {
        status: 'enviada',
        enviadaEm: atual?.enviadaEm ?? null,
        jaEnviada: true,
        bcc,
      };
    }
    if (decisao === 'em_andamento') {
      throw createError({
        statusCode: 409,
        message: 'O envio desta comunicação já está em andamento.',
      });
    }
    throw createError({
      statusCode: 409,
      message: 'Não foi possível iniciar o envio. Tente novamente.',
    });
  }

  try {
    await enviarEmail({
      to: desembargador.email,
      subject: assunto,
      html: corpoHtml,
      bcc,
    });
  } catch (erro) {
    console.error('Falha ao enviar comunicação ao desembargador:', erro);
    await prisma.comunicacaoDesembargador
      .update({
        where: { loteId: lote.id },
        data: {
          status: 'falhou',
          erro: MENSAGEM_ERRO_ENVIO_COMUNICACAO,
        },
      })
      .catch(() => {});
    throw createError({
      statusCode: 502,
      message: MENSAGEM_ERRO_ENVIO_COMUNICACAO,
    });
  }

  const enviada = await prisma.comunicacaoDesembargador.update({
    where: { loteId: lote.id },
    data: {
      status: 'enviada',
      enviadaEm: new Date(),
      erro: null,
    },
  });

  return {
    status: 'enviada',
    enviadaEm: enviada.enviadaEm,
    jaEnviada: false,
    bcc,
  };
});
