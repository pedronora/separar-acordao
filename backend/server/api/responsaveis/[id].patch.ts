export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id');
  const corpo = await readBody(event);

  const dados: {
    nome?: string;
    email?: string;
    ativo?: boolean;
  } = {};

  if (corpo.nome !== undefined) {
    const nome = String(corpo.nome).trim();
    if (!nome) {
      throw createError({
        statusCode: 422,
        message: 'Nome não pode ser vazio.',
      });
    }
    dados.nome = nome.toUpperCase();
  }
  if (corpo.email !== undefined) {
    const email = String(corpo.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw createError({
        statusCode: 422,
        message: 'E-mail inválido.',
      });
    }
    dados.email = email;
  }
  if (corpo.ativo !== undefined) {
    dados.ativo = Boolean(corpo.ativo);
  }

  if (dados.nome) {
    const atual = await prisma.responsavel.findUnique({
      where: { id },
      select: { nome: true },
    });
    if (!atual) {
      throw createError({
        statusCode: 404,
        message: 'Responsável não encontrado.',
      });
    }
    if (atual.nome !== dados.nome) {
      const existe = await prisma.responsavel.findUnique({
        where: { nome: dados.nome },
      });
      if (existe) {
        throw createError({
          statusCode: 409,
          message: 'Já existe um responsável com este nome.',
        });
      }
    }
  }

  try {
    return await prisma.responsavel.update({
      where: { id },
      data: dados,
    });
  } catch {
    throw createError({
      statusCode: 404,
      message: 'Responsável não encontrado.',
    });
  }
});
