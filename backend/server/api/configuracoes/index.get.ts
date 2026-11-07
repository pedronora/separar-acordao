import {
  CHAVE_CAMEL,
  CHAVE_CAMEL_DESEMBARGADOR_EMAIL,
  CHAVE_CAMEL_DESEMBARGADOR_NOME,
  CHAVE_DESEMBARGADOR_EMAIL,
  CHAVE_DESEMBARGADOR_NOME,
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
    [CHAVE_CAMEL_DESEMBARGADOR_NOME]:
      configuracoes[CHAVE_DESEMBARGADOR_NOME] ?? '',
    [CHAVE_CAMEL_DESEMBARGADOR_EMAIL]:
      configuracoes[CHAVE_DESEMBARGADOR_EMAIL] ?? '',
  };
});
