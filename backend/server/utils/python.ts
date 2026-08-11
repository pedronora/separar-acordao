import { config } from './config';

interface AnalisarResponse {
  desdes: string[];
  responsaveis: string[];
  total_acordaos: number;
}

export interface TarefaSeparacao {
  autos: string;
  classe: string;
  processo: string;
  pauta: string;
}

export interface GrupoSeparacao {
  responsavel: string;
  tarefas: TarefaSeparacao[];
}

interface SepararResponse {
  grupos: GrupoSeparacao[];
  total_acordaos: number;
  responsaveis_faltantes: string[];
}

interface DetalheErro {
  tipo?: string;
  faltantes?: string[];
}

export class ErroPythonService extends Error {
  status: number;
  detalhe: string | DetalheErro;

  constructor(status: number, detalhe: string | DetalheErro) {
    super(
      typeof detalhe === 'string' ? detalhe : 'Erro no motor de separação.'
    );
    this.status = status;
    this.detalhe = detalhe;
  }
}

function urlBase(): string {
  return config.pythonServiceUrl;
}

function anexarArquivo(
  form: FormData,
  arquivo: Buffer,
  nomeArquivo: string
): void {
  form.append('file', new Blob([arquivo], { type: 'text/csv' }), nomeArquivo);
}

async function parseResposta<T>(resp: Response): Promise<T> {
  const corpo = (await resp.json()) as { detail?: string | DetalheErro };
  if (!resp.ok) {
    throw new ErroPythonService(
      resp.status,
      corpo.detail ?? 'Erro desconhecido.'
    );
  }
  return corpo as T;
}

export async function chamarAnalisar(
  arquivo: Buffer,
  nomeArquivo: string,
  totalAcordaos?: number
): Promise<AnalisarResponse> {
  const form = new FormData();
  anexarArquivo(form, arquivo, nomeArquivo);
  if (totalAcordaos != null) {
    form.append('total_acordaos', String(totalAcordaos));
  }
  const resp = await fetch(`${urlBase()}/analisar`, {
    method: 'POST',
    body: form,
  });
  return parseResposta<AnalisarResponse>(resp);
}

export async function chamarSeparar(opts: {
  arquivo: Buffer;
  nomeArquivo: string;
  pautas: Record<string, string>;
  responsaveisCadastrados: string[];
  totalAcordaos?: number;
}): Promise<SepararResponse> {
  const form = new FormData();
  anexarArquivo(form, opts.arquivo, opts.nomeArquivo);
  form.append('pautas', JSON.stringify(opts.pautas));
  form.append(
    'responsaveis_cadastrados',
    JSON.stringify(opts.responsaveisCadastrados)
  );
  if (opts.totalAcordaos != null) {
    form.append('total_acordaos', String(opts.totalAcordaos));
  }
  const resp = await fetch(`${urlBase()}/separar`, {
    method: 'POST',
    body: form,
  });
  return parseResposta<SepararResponse>(resp);
}
