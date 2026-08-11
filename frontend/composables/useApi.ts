import type { FetchError, FetchOptions } from 'ofetch';

export function apiBaseUrl(): string {
  return useRuntimeConfig().public.apiBaseUrl;
}

export async function useApi<T>(
  path: string,
  options: FetchOptions<'json'> = {}
): Promise<T> {
  const { token, logout } = useAuth();
  const headers = {
    ...((options.headers as Record<string, string>) ?? {}),
    ...(token.value ? { authorization: `Bearer ${token.value}` } : {}),
  };
  try {
    return await $fetch<T>(path, {
      baseURL: apiBaseUrl(),
      ...options,
      headers,
    });
  } catch (erro) {
    const fetchErro = erro as FetchError;
    if (fetchErro?.statusCode === 401 && token.value) {
      logout();
      await navigateTo('/login');
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
