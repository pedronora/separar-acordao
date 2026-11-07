import { config } from './config';
import { escaparHtml, type TarefaEmail } from './email';

export interface ResumoComunicacaoItem {
  etiqueta: string;
  pauta: string;
  quantidade: number;
}

export type StatusComunicacao = 'pendente' | 'enviando' | 'enviada' | 'falhou';

export type DecisaoEnvioComunicacao = 'enviar' | 'ja_enviada' | 'em_andamento';

export const TIMEOUT_ENVIO_COMUNICACAO_MS = 5 * 60 * 1000;

export const MENSAGEM_ERRO_ENVIO_COMUNICACAO =
  'Não foi possível enviar a comunicação ao desembargador. ' +
  'Tente novamente.';

const SEPARADOR_CHAVE = '\u0000';

function normalizarRecurso(tarefa: TarefaEmail): string {
  return (tarefa.autos ?? '').trim().toUpperCase();
}

export function montarResumoComunicacao(
  tarefas: TarefaEmail[]
): ResumoComunicacaoItem[] {
  const mapa = new Map<
    string,
    { etiqueta: string; pauta: string; recursos: Set<string> }
  >();

  for (const tarefa of tarefas) {
    const etiqueta = (tarefa.etiqueta ?? '').trim();
    const pauta = (tarefa.pauta ?? '').trim();
    const chave = `${etiqueta}${SEPARADOR_CHAVE}${pauta}`;
    let item = mapa.get(chave);
    if (!item) {
      item = { etiqueta, pauta, recursos: new Set() };
      mapa.set(chave, item);
    }
    const recurso = normalizarRecurso(tarefa);
    if (recurso) {
      item.recursos.add(recurso);
    }
  }

  return [...mapa.values()]
    .map((item) => ({
      etiqueta: item.etiqueta,
      pauta: item.pauta,
      quantidade: item.recursos.size,
    }))
    .sort(
      (a, b) =>
        a.etiqueta.localeCompare(b.etiqueta, 'pt-BR', {
          numeric: true,
        }) ||
        a.pauta.localeCompare(b.pauta, 'pt-BR', {
          numeric: true,
        })
    );
}

export function coletarTarefasDosEnvios(
  envios: { tarefas: unknown }[]
): TarefaEmail[] {
  const tarefas: TarefaEmail[] = [];
  for (const envio of envios) {
    if (!Array.isArray(envio.tarefas)) {
      continue;
    }
    for (const tarefa of envio.tarefas) {
      if (
        tarefa &&
        typeof tarefa === 'object' &&
        typeof (tarefa as TarefaEmail).autos === 'string' &&
        typeof (tarefa as TarefaEmail).pauta === 'string'
      ) {
        tarefas.push(tarefa as TarefaEmail);
      }
    }
  }
  return tarefas;
}

export function loteCompletamenteConfirmado(
  envios: { confirmado: boolean }[]
): boolean {
  return envios.length > 0 && envios.every((envio) => envio.confirmado);
}

export function detectarTransicaoConfirmacao(
  antes: { confirmado: boolean }[],
  depois: { confirmado: boolean }[]
): boolean {
  return (
    !loteCompletamenteConfirmado(antes) && loteCompletamenteConfirmado(depois)
  );
}

export function podeComunicarLote(lote: {
  status: string;
  envios: { confirmado: boolean }[];
}): boolean {
  return (
    lote.status === 'processado' && loteCompletamenteConfirmado(lote.envios)
  );
}

export function montarAssuntoComunicacao(
  orgao: string,
  dataSessao: string
): string {
  return `[${orgao} - Sessão: ${dataSessao}] Acórdãos para assinatura`;
}

export function montarTabelaResumoComunicacao(
  resumo: ResumoComunicacaoItem[]
): string {
  const celula = 'padding: 10px; border: 1px solid #dddddd;';
  const cabecalho =
    'padding: 10px; border: 1px solid #dddddd; ' +
    'background-color: #f2f2f2; color: black; text-align: left;';
  const cabecalhoNumero = `${cabecalho} text-align: right;`;
  const celulaNumero = `${celula} text-align: right;`;

  const linhas = resumo
    .map((item, indice) => {
      const fundo = indice % 2 === 0 ? '#f9f9f9' : 'transparent';
      return `
                <tr style="color: black; background-color: ${fundo};">
                    <td style="${celula}">${escaparHtml(
                      item.etiqueta || 'Sem órgão'
                    )}</td>
                    <td style="${celula}">${escaparHtml(item.pauta)}</td>
                    <td style="${celulaNumero}">${item.quantidade}</td>
                </tr>`;
    })
    .join('\n');

  return `
        <table style="width: 100%; max-width: 600px; border-collapse: collapse; margin: 0 auto;">
            <thead>
                <tr>
                    <th style="${cabecalho}">Órgão</th>
                    <th style="${cabecalho}">Pauta</th>
                    <th style="${cabecalhoNumero}">Acórdãos</th>
                </tr>
            </thead>
            <tbody>
${linhas}
            </tbody>
        </table>
    `;
}

const TITULOS_DESEMBARGADOR = new Set([
  'des',
  'des.',
  'dr',
  'dr.',
  'dra',
  'dra.',
  'exmo',
  'exmo.',
  'exma',
  'exma.',
  'ministro',
  'ministra',
]);

export function primeiroNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const semTitulo = partes.filter(
    (parte) => !TITULOS_DESEMBARGADOR.has(parte.toLowerCase())
  );
  const escolhido = (semTitulo[0] ?? partes[0] ?? '').replace(/\.$/, '');
  if (!escolhido) {
    return '';
  }
  return escolhido.charAt(0).toUpperCase() + escolhido.slice(1).toLowerCase();
}

export function saudacaoPorHorario(agora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(agora)
  );
  return hora < 18 ? 'Boa tarde' : 'Boa noite';
}

export function listarEtiquetas(resumo: ResumoComunicacaoItem[]): string {
  const vistas = new Set<string>();
  const etiquetas: string[] = [];
  for (const item of resumo) {
    const etiqueta = item.etiqueta.trim();
    if (!etiqueta || vistas.has(etiqueta)) {
      continue;
    }
    vistas.add(etiqueta);
    etiquetas.push(etiqueta);
  }

  if (etiquetas.length === 0) {
    return '';
  }
  if (etiquetas.length === 1) {
    return etiquetas[0] ?? '';
  }
  return `${etiquetas.slice(0, -1).join(', ')} e ${
    etiquetas[etiquetas.length - 1]
  }`;
}

export function montarHtmlComunicacao(opts: {
  nomeDesembargador: string;
  resumo: ResumoComunicacaoItem[];
  remetenteNome?: string;
  agora?: Date;
}): string {
  const remetente = opts.remetenteNome ?? config.smtpFromName;
  const tabela = montarTabelaResumoComunicacao(opts.resumo);
  const saudacao = saudacaoPorHorario(opts.agora);
  const nome = primeiroNome(opts.nomeDesembargador);
  const lista = listarEtiquetas(opts.resumo);
  const complemento = lista ? ` (${escaparHtml(lista)})` : '';

  return `
    <div style="font-family: Arial, sans-serif; color: #1f2933; max-width: 600px; margin: 0 auto; line-height: 1.5;">
        <p>${saudacao}, Dr. ${escaparHtml(nome)}:</p>
        <p>Os acórdãos da última sessão${complemento} estão prontos para assinatura.</p>
${tabela}
        <p>Att,<br/>${escaparHtml(remetente)}</p>
    </div>
    `;
}

export function normalizarBcc(
  responsaveis: { nome: string; email: string }[],
  emailPrincipal: string
): string[] {
  const principal = emailPrincipal.trim().toLowerCase();
  const vistos = new Set<string>();
  const resultado: string[] = [];

  for (const responsavel of responsaveis) {
    const email = responsavel.email.trim();
    const chave = email.toLowerCase();
    if (!email || chave === principal || vistos.has(chave)) {
      continue;
    }
    vistos.add(chave);
    resultado.push(email);
  }

  return resultado;
}

export function decidirEnvioComunicacao(
  status: StatusComunicacao | null,
  atualizadoEm: Date | null,
  agora: Date,
  timeoutMs = TIMEOUT_ENVIO_COMUNICACAO_MS
): DecisaoEnvioComunicacao {
  if (status === 'enviada') {
    return 'ja_enviada';
  }
  if (
    status === 'enviando' &&
    atualizadoEm &&
    agora.getTime() - atualizadoEm.getTime() < timeoutMs
  ) {
    return 'em_andamento';
  }
  return 'enviar';
}
