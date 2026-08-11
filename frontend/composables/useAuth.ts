import type { Usuario } from '~/types';

const CHAVE_TOKEN = 'auth-token';
const CHAVE_USUARIO = 'auth-usuario';

export const useAuth = () => {
  const token = useState<string | null>('auth-token', () => null);
  const usuario = useState<Usuario | null>('auth-usuario', () => null);

  if (import.meta.client && !token.value) {
    token.value = localStorage.getItem(CHAVE_TOKEN);
    const bruto = localStorage.getItem(CHAVE_USUARIO);
    if (bruto) {
      try {
        usuario.value = JSON.parse(bruto) as Usuario;
      } catch {
        localStorage.removeItem(CHAVE_USUARIO);
      }
    }
  }

  async function login(email: string, senha: string): Promise<void> {
    const resultado = await $fetch<{ token: string; usuario: Usuario }>(
      '/api/auth/login',
      {
        baseURL: apiBaseUrl(),
        method: 'POST',
        body: { email, senha },
      }
    );
    token.value = resultado.token;
    usuario.value = resultado.usuario;
    if (import.meta.client) {
      localStorage.setItem(CHAVE_TOKEN, resultado.token);
      localStorage.setItem(CHAVE_USUARIO, JSON.stringify(resultado.usuario));
    }
  }

  function logout(): void {
    token.value = null;
    usuario.value = null;
    if (import.meta.client) {
      localStorage.removeItem(CHAVE_TOKEN);
      localStorage.removeItem(CHAVE_USUARIO);
    }
  }

  return { token, usuario, login, logout };
};
