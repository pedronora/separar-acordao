import { verificarToken } from '../utils/auth';
import { prisma } from '../utils/prisma';

export default defineEventHandler(async (event) => {
  if (event.method === 'OPTIONS') {
    return;
  }

  const url = getRequestURL(event).pathname;
  if (url.startsWith('/api/auth/login') || url.startsWith('/api/health')) {
    return;
  }

  const cabecalho = getHeader(event, 'authorization');
  const token = cabecalho?.startsWith('Bearer ') ? cabecalho.slice(7) : null;
  const payload = token ? verificarToken(token) : null;
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Não autenticado.' });
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, nome: true },
  });
  if (!usuario) {
    throw createError({ statusCode: 401, message: 'Sessão inválida.' });
  }

  event.context.auth = usuario;
});
