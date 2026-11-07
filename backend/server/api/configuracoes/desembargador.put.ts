import {
  CHAVE_CAMEL_DESEMBARGADOR_EMAIL,
  CHAVE_CAMEL_DESEMBARGADOR_NOME,
  CHAVE_DESEMBARGADOR_EMAIL,
  CHAVE_DESEMBARGADOR_NOME,
  validarDadosDesembargador,
} from '../../utils/configuracoes';

export default defineEventHandler(async (event) => {
  const corpo = await readBody(event);
  const nome = String(corpo?.nome ?? '').trim();
  const email = String(corpo?.email ?? '').trim();

  const erro = validarDadosDesembargador({ nome, email });
  if (erro) {
    throw createError({
      statusCode: 422,
      message: erro,
    });
  }

  await prisma.$transaction([
    prisma.configuracao.upsert({
      where: { chave: CHAVE_DESEMBARGADOR_NOME },
      update: { valor: nome },
      create: { chave: CHAVE_DESEMBARGADOR_NOME, valor: nome },
    }),
    prisma.configuracao.upsert({
      where: { chave: CHAVE_DESEMBARGADOR_EMAIL },
      update: { valor: email },
      create: { chave: CHAVE_DESEMBARGADOR_EMAIL, valor: email },
    }),
  ]);

  return {
    [CHAVE_CAMEL_DESEMBARGADOR_NOME]: nome,
    [CHAVE_CAMEL_DESEMBARGADOR_EMAIL]: email,
  };
});
