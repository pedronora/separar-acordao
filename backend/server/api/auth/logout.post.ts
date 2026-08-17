import { config } from '../../utils/config';

export default defineEventHandler((event) => {
  deleteCookie(event, 'auth_token', {
    path: '/',
    secure: config.authCookieSecure,
  });
  return { ok: true };
});
