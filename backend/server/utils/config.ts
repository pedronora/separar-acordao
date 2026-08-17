function segundosDeExp(i: string): number {
  const horas = /^(\d+)h$/.exec(i);
  if (horas) {
    return Number(horas[1]) * 60 * 60;
  }
  const dias = /^(\d+)d$/.exec(i);
  if (dias) {
    return Number(dias[1]) * 24 * 60 * 60;
  }
  return 8 * 60 * 60;
}

export const config = {
  jwtSecret: process.env.JWT_SECRET || 'chave-de-desenvolvimento',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  authCookieMaxAge: segundosDeExp(process.env.JWT_EXPIRES_IN || '8h'),
  authCookieSecure: process.env.COOKIE_SECURE === 'true',
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || 'http://localhost:8000',
  uploadDir: process.env.UPLOAD_DIR || '.uploads',
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: process.env.SMTP_USER || '',
  smtpPassword: process.env.SMTP_PASSWORD || '',
  smtpFrom: process.env.SMTP_FROM || 'acordaos.informe@gmail.com',
  smtpFromName: process.env.SMTP_FROM_NAME || 'Gab. Des. Helio Bastida Lopes',
  smtpReplyTo: process.env.SMTP_REPLY_TO || 'gdhbl@trt12.jus.br',
  emailDelayMin: Number(process.env.EMAIL_DELAY_MIN || 0),
  emailDelayMax: Number(process.env.EMAIL_DELAY_MAX || 0),
};
