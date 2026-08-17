import { useApi } from '~/composables/useApi';
import type { Usuario } from '~/types';

export const useAuth = () => {
  const usuario = useCookie<Usuario | null>(CHAVE_USUARIO, {
    default: () => null,
    maxAge: CHAVE_SESSAO_MAX_AGE,
    sameSite: 'lax',
  });

  async function login(email: string, senha: string): Promise<void> {
    const resultado = await useApi<{ usuario: Usuario }>('/api/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
    usuario.value = resultado.usuario;
  }

  async function logout(): Promise<void> {
    try {
      await useApi('/api/auth/logout', { method: 'POST' });
    } catch {
      // segue para limpar o estado local mesmo se o backend não responder
    }
    usuario.value = null;
  }

  return { usuario, login, logout };
};
