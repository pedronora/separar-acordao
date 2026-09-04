export interface ArquivoLote {
  token: string;
  arquivoOrigem: string;
  etiqueta: string;
  pautas: Record<string, string>;
  totalAcordaos?: number;
}
