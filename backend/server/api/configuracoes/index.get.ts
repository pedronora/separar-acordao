import {
  CHAVE_CAMEL,
  CHAVE_EMAIL_PADRAO_INATIVO,
} from '../../utils/configuracoes';

export default defineEventHandler(async () => {
  const registros = await prisma.configuracao.findMany();
  const configuracoes: Record<string, string> = {};
  for (const registro of registros) {
    configuracoes[registro.chave] = registro.valor;
  }
  return {
    [CHAVE_CAMEL]: configuracoes[CHAVE_EMAIL_PADRAO_INATIVO] ?? '',
  };
});
