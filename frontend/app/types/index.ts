export interface Usuario {
  id: string;
  email: string;
  nome: string;
}

export interface Responsavel {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TarefaSeparacao {
  autos: string;
  classe: string;
  processo: string;
  pauta: string;
  etiqueta?: string;
}

export interface ArquivoAnalise {
  token: string;
  arquivoOrigem: string;
  etiqueta: string;
  desdes: string[];
  responsaveis: string[];
  totalAcordaos: number;
}

export interface ArquivoEnvio {
  token: string;
  arquivoOrigem: string;
  etiqueta: string;
  pautas: Record<string, string>;
  totalAcordaos?: number;
}

export interface AnalisarResultado {
  token: string;
  arquivoOrigem: string;
  desdes: string[];
  responsaveis: string[];
  totalAcordaos: number;
}

export interface EnvioIniciado {
  loteId: string;
  status: string;
}

export interface Configuracoes {
  emailPadraoResponsavelInativo: string;
}

export interface LoteResumo {
  id: string;
  arquivoOrigem: string;
  etiquetas: string;
  orgao: string | null;
  dataSessao: string | null;
  criadoEm: string;
  status: 'processando' | 'processado' | 'falhou';
  erro: string | null;
  usuario: string;
  totalEnvios: number;
  enviados: number;
  falhas: number;
}

export interface EnvioDetalhe {
  id: string;
  status: 'pendente' | 'enviado' | 'falhou';
  para: string | null;
  assunto: string | null;
  corpoHtml: string | null;
  enviadoEm: string | null;
  reenviadoDe: string | null;
  tarefas: TarefaSeparacao[];
  responsavel: {
    id: string;
    nome: string;
    email: string;
  };
}

export interface LoteDetalhe {
  id: string;
  arquivoOrigem: string;
  arquivos: {
    token: string;
    arquivoOrigem: string;
    etiqueta: string;
    pautas: Record<string, string>;
    totalAcordaos?: number;
  }[] | null;
  orgao: string | null;
  dataSessao: string | null;
  criadoEm: string;
  status: 'processando' | 'processado' | 'falhou';
  erro: string | null;
  totalEnvios: number | null;
  usuario: { id: string; nome: string; email: string };
  envios: EnvioDetalhe[];
}
