import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

import { config } from './config';

export interface TarefaEmail {
  autos: string;
  pauta: string;
}

export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function montarLinhas(tarefas: TarefaEmail[]): string {
  return tarefas
    .map((tarefa, indice) => {
      const fundo = indice % 2 === 0 ? '#f9f9f9' : 'transparent';
      const celula =
        'padding: 10px; text-align: center; border: 1px solid #dddddd;';
      return `
            <tr style="color: black; background-color: ${fundo};">
                <td style="${celula}">${indice + 1}</td>
                <td style="${celula}">${escaparHtml(tarefa.autos)}</td>
                <td style="${celula}">${escaparHtml(tarefa.pauta)}</td>
            </tr>`;
    })
    .join('\n');
}

export function montarHtml(
  responsavel: string,
  tarefas: TarefaEmail[]
): string {
  const cabecalho =
    'padding: 10px; text-align: center; border: 1px solid #dddddd; background-color: #f2f2f2; color: black;';
  return `
    <div style="text-align: center;">
        <div style="display: inline-block; text-align: left; width: 100%; max-width: 600px; margin-bottom: 5px;">Responsável: <strong>${escaparHtml(responsavel)}</strong></div>
        <table style="width: 100%; max-width: 600px; border-collapse: collapse; margin: 0 auto;">
            <thead>
                <tr>
                    <th style="${cabecalho}">n.</th>
                    <th style="${cabecalho}">PROCESSO</th>
                    <th style="${cabecalho}">PAUTA</th>
                </tr>
            </thead>
            <tbody>
${montarLinhas(tarefas)}
            </tbody>
        </table>
    </div>
    `;
}

export function montarAssunto(
  orgao: string,
  dataSessao: string,
  responsavel: string
): string {
  const primeiroNome = responsavel
    .split(' ')[0]
    .charAt(0)
    .toUpperCase()
    .concat(responsavel.split(' ')[0].slice(1).toLowerCase());
  return `[${orgao} - Sessão: ${dataSessao}] Formatar acórdãos - ${primeiroNome}`;
}

function criarTransporter(): Transporter {
  return nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: config.smtpUser
      ? { user: config.smtpUser, pass: config.smtpPassword }
      : undefined,
    connectionTimeout: 20 * 1000,
    greetingTimeout: 20 * 1000,
    socketTimeout: 60 * 1000,
  });
}

export async function enviarEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transporter = criarTransporter();
  await transporter.sendMail({
    from: `"${config.smtpFromName}" <${config.smtpFrom}>`,
    replyTo: config.smtpReplyTo,
    to: opts.to,
    bcc: config.smtpFrom,
    subject: opts.subject,
    html: opts.html,
    headers: {
      'Disposition-Notification-To': config.smtpReplyTo,
    },
  });
}

export async function pausaEntreEnvios(): Promise<void> {
  const { emailDelayMin, emailDelayMax } = config;
  if (emailDelayMax <= 0) {
    return;
  }
  const minimo = Math.max(0, emailDelayMin);
  const maximo = Math.max(minimo, emailDelayMax);
  const segundos = minimo + Math.floor(Math.random() * (maximo - minimo + 1));
  await new Promise((resolve) => setTimeout(resolve, segundos * 1000));
}
