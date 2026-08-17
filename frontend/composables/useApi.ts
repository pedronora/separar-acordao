import type { FetchError, FetchOptions } from 'ofetch';

export async function useApi<T>(
  path: string,
  options: FetchOptions<'json'> = {}
): Promise<T> {
  const noServidor = import.meta.server;
  const baseURL = noServidor ? useRuntimeConfig().apiInternalUrl : undefined;
  const fetchFn = noServidor ? useRequestFetch() : $fetch;

  try {
    return await fetchFn<T>(path, {
      ...options,
      baseURL,
    } as Parameters<typeof $fetch<T>>[1]);
  } catch (erro) {
    const fetchErro = erro as FetchError;
    if (fetchErro?.statusCode === 401) {
      const cookie = useCookie<unknown>(CHAVE_USUARIO, {
        default: () => null,
        maxAge: CHAVE_SESSAO_MAX_AGE,
        sameSite: 'lax',
      });
      if (cookie.value) {
        try {
          await fetchFn('/api/auth/logout', { method: 'POST', baseURL });
        } catch {
          // segue mesmo se o logout remoto falhar
        }
        cookie.value = null;
        await navigateTo('/login');
      }
    }
    throw erro;
  }
}

interface CorpoErro {
  message?: string;
  statusMessage?: string;
  detail?: string | { faltantes?: string[] };
}

export function mensagemDeErro(erro: unknown): string {
  const fetchErro = erro as FetchError;
  if (!fetchErro?.data) {
    return 'Erro inesperado. Tente novamente.';
  }
  const corpo = fetchErro.data as CorpoErro;
  if (typeof corpo.detail === 'string') {
    return corpo.detail;
  }
  if (corpo.detail && typeof corpo.detail === 'object') {
    const faltantes = corpo.detail.faltantes;
    if (Array.isArray(faltantes) && faltantes.length) {
      return `Responsável(is) não cadastrado(s): ${faltantes.join(', ')}. Cadastre antes de processar.`;
    }
  }
  return corpo.message || corpo.statusMessage || 'Erro inesperado.';
}
