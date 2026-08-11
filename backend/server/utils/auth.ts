import jwt from 'jsonwebtoken';

import { config } from './config';

export interface PayloadAuth {
  sub: string;
  email: string;
  nome: string;
}

export function gerarToken(payload: PayloadAuth): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verificarToken(token: string): PayloadAuth | null {
  try {
    return jwt.verify(token, config.jwtSecret) as PayloadAuth;
  } catch {
    return null;
  }
}

export function getUsuarioAutenticado(event: H3Event): PayloadAuth {
  const auth = event.context.auth as PayloadAuth | undefined;
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Não autenticado.' });
  }
  return auth;
}
