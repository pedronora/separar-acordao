interface CorpoReenvio {
  envioIds?: string[];
}

export default defineEventHandler(async (event) => {
  getUsuarioAutenticado(event);
  const id = getRouterParam(event, 'id');
  const corpo = (await readBody(event)) as CorpoReenvio;

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

  const selecionados = corpo.envioIds?.length
    ? lote.envios.filter((e) => corpo.envioIds?.includes(e.id))
    : lote.envios;
  if (!selecionados.length) {
    throw createError({
      statusCode: 422,
      message: 'Nenhum envio selecionado.',
    });
  }

  const orgao = lote.orgao ?? '';
  const dataSessao = lote.dataSessao ?? '';
  let enviados = 0;
  const falhas: string[] = [];

  for (const envio of selecionados) {
    const novoEnvio = await prisma.envio.create({
      data: {
        loteId: lote.id,
        responsavelId: envio.responsavelId,
        tarefas: envio.tarefas,
        reenviadoDe: envio.id,
        status: 'pendente',
      },
    });

    const tarefas = envio.tarefas as TarefaEmail[];
    const html = montarHtml(envio.responsavel.nome, tarefas);
    const assunto = montarAssunto(orgao, dataSessao, envio.responsavel.nome);

    try {
      await enviarEmail({
        to: envio.responsavel.email,
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
