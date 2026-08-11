import {
  CHAVE_CAMEL,
  CHAVE_EMAIL_PADRAO_INATIVO,
} from '../../utils/configuracoes';

const CHAVES_VALIDAS = [CHAVE_EMAIL_PADRAO_INATIVO];

export default defineEventHandler(async (event) => {
  const chave = getRouterParam(event, 'chave');
  if (!chave || !CHAVES_VALIDAS.includes(chave)) {
    throw createError({
      statusCode: 404,
      message: 'Configuração não existe.',
    });
  }

  const corpo = await readBody(event);
  const valor = String(corpo.valor ?? '').trim();
  if (chave === CHAVE_EMAIL_PADRAO_INATIVO) {
    if (valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
      throw createError({
        statusCode: 422,
        message: 'E-mail padrão inválido.',
      });
    }
  }

  const registro = await prisma.configuracao.upsert({
    where: { chave },
    update: { valor },
    create: { chave, valor },
  });

  return { [CHAVE_CAMEL]: registro.valor };
});
