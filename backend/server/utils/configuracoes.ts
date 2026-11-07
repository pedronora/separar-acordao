export const CHAVE_EMAIL_PADRAO_INATIVO = 'email_padrao_responsavel_inativo';

export const CHAVE_CAMEL = 'emailPadraoResponsavelInativo';

export const CHAVE_DESEMBARGADOR_NOME = 'desembargador_nome';

export const CHAVE_DESEMBARGADOR_EMAIL = 'desembargador_email';

export const CHAVE_CAMEL_DESEMBARGADOR_NOME = 'desembargadorNome';

export const CHAVE_CAMEL_DESEMBARGADOR_EMAIL = 'desembargadorEmail';

export interface DadosDesembargador {
  nome: string;
  email: string;
}

export function emailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validarDadosDesembargador(
  dados: DadosDesembargador
): string | null {
  if (!dados.nome.trim()) {
    return 'Informe o nome do desembargador.';
  }
  if (!dados.email.trim()) {
    return 'Informe o e-mail do desembargador.';
  }
  if (!emailValido(dados.email.trim())) {
    return 'E-mail do desembargador inválido.';
  }
  return null;
}

export function extrairDadosDesembargador(
  registros: { chave: string; valor: string }[]
): DadosDesembargador {
  const mapa = new Map(registros.map((r) => [r.chave, r.valor]));
  return {
    nome: mapa.get(CHAVE_DESEMBARGADOR_NOME) ?? '',
    email: mapa.get(CHAVE_DESEMBARGADOR_EMAIL) ?? '',
  };
}

export async function obterDadosDesembargador(): Promise<DadosDesembargador> {
  const registros = await prisma.configuracao.findMany({
    where: {
      chave: {
        in: [CHAVE_DESEMBARGADOR_NOME, CHAVE_DESEMBARGADOR_EMAIL],
      },
    },
    select: { chave: true, valor: true },
  });
  return extrairDadosDesembargador(registros);
}

export async function obterEmailPadraoInativo(): Promise<string> {
  const config = await prisma.configuracao.findUnique({
    where: { chave: CHAVE_EMAIL_PADRAO_INATIVO },
  });
  return config?.valor ?? '';
}

export function emailDestino(
  responsavel: { ativo: boolean; email: string },
  emailPadraoInativo: string
): string {
  return responsavel.ativo ? responsavel.email : emailPadraoInativo;
}
