import argon2 from 'argon2';

import { config } from '../../utils/config';

export default defineEventHandler(async (event) => {
  const corpo = await readBody(event);
  const email =
    typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : '';
  const senha = typeof corpo.senha === 'string' ? corpo.senha : '';

  if (!email || !senha) {
    throw createError({
      statusCode: 422,
      message: 'Email e senha são obrigatórios.',
    });
  }

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario) {
    throw createError({
      statusCode: 401,
      message: 'Credenciais inválidas.',
    });
  }

  const senhaOk = await argon2.verify(usuario.senhaHash, senha);
  if (!senhaOk) {
    throw createError({
      statusCode: 401,
      message: 'Credenciais inválidas.',
    });
  }

  const token = gerarToken({
    sub: usuario.id,
    email: usuario.email,
    nome: usuario.nome,
  });

  setCookie(event, 'auth_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.authCookieSecure,
    path: '/',
    maxAge: config.authCookieMaxAge,
  });

  return {
    token,
    usuario: {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
    },
  };
});
