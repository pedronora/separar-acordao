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
}

export interface AnalisarResultado {
  token: string;
  arquivoOrigem: string;
  desdes: string[];
  responsaveis: string[];
  totalAcordaos: number;
}

export interface ResultadoEnvio {
  loteId: string;
  totalAcordaos: number;
  totalEnvios: number;
  enviados: number;
  falhas: string[];
}

export interface LoteResumo {
  id: string;
  arquivoOrigem: string;
  orgao: string | null;
  dataSessao: string | null;
  criadoEm: string;
  status: 'processando' | 'processado' | 'falhou';
  usuario: string;
  totalEnvios: number;
  enviados: number;
  falhas: number;
}

export interface EnvioDetalhe {
  id: string;
  status: 'pendente' | 'enviado' | 'falhou';
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
  orgao: string | null;
  dataSessao: string | null;
  criadoEm: string;
  status: 'processando' | 'processado' | 'falhou';
  usuario: { id: string; nome: string; email: string };
  envios: EnvioDetalhe[];
}
