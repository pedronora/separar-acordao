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
  desembargadorNome: string;
  desembargadorEmail: string;
}

export type ComunicacaoStatus = 'pendente' | 'enviando' | 'enviada' | 'falhou';

export interface ComunicacaoResumo {
  configurado: boolean;
  status: ComunicacaoStatus | null;
  apresentadaEm: string | null;
  enviadaEm: string | null;
  erro: string | null;
}

export interface ResponsavelBcc {
  id: string;
  nome: string;
  email: string;
}

export interface ResumoComunicacaoItem {
  etiqueta: string;
  pauta: string;
  quantidade: number;
}

export interface ComunicacaoPreview {
  destinatario: { nome: string; email: string };
  assunto: string;
  corpoHtml: string;
  resumo: ResumoComunicacaoItem[];
  bccDisponiveis: ResponsavelBcc[];
  status: ComunicacaoStatus;
  enviadaEm: string | null;
  erro: string | null;
  apresentadaAgora: boolean;
  jaEnviada: boolean;
}

export type StatusLote = 'processando' | 'processado' | 'falhou';
export type StatusEnvio = 'pendente' | 'enviado' | 'falhou';

export interface LoteResumo {
  id: string;
  arquivoOrigem: string;
  etiquetas: string;
  orgao: string | null;
  dataSessao: string | null;
  criadoEm: string;
  status: StatusLote;
  erro: string | null;
  usuario: string;
  totalEnvios: number;
  enviados: number;
  falhas: number;
  confirmados: number;
}

export interface EnvioDetalhe {
  id: string;
  status: StatusEnvio;
  para: string | null;
  assunto: string | null;
  corpoHtml: string | null;
  enviadoEm: string | null;
  reenviadoDe: string | null;
  confirmado: boolean;
  confirmadoEm: string | null;
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
  status: StatusLote;
  erro: string | null;
  totalEnvios: number | null;
  completamenteConfirmado: boolean;
  comunicacao: ComunicacaoResumo;
  usuario: { id: string; nome: string; email: string };
  envios: EnvioDetalhe[];
}
