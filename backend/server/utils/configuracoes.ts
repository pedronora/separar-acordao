export const CHAVE_EMAIL_PADRAO_INATIVO = 'email_padrao_responsavel_inativo';

export const CHAVE_CAMEL = 'emailPadraoResponsavelInativo';

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
