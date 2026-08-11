export default defineEventHandler(async (event) => {
  const corpo = await readBody(event);
  const nome = typeof corpo.nome === 'string' ? corpo.nome.trim() : '';
  const email = typeof corpo.email === 'string' ? corpo.email.trim() : '';

  if (!nome || !email) {
    throw createError({
      statusCode: 422,
      message: 'Nome e email são obrigatórios.',
    });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({
      statusCode: 422,
      message: 'E-mail inválido.',
    });
  }

  const nomeNormalizado = nome.toUpperCase();
  const existe = await prisma.responsavel.findUnique({
    where: { nome: nomeNormalizado },
  });
  if (existe) {
    throw createError({
      statusCode: 409,
      message: 'Já existe um responsável com este nome.',
    });
  }

  return prisma.responsavel.create({
    data: { nome: nomeNormalizado, email },
  });
});
