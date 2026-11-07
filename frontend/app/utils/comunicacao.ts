import type { LoteDetalhe } from '~/types';

export function deveApresentarComunicacaoAutomaticamente(
  lote: LoteDetalhe | null
): boolean {
  if (!lote) {
    return false;
  }
  if (lote.status !== 'processado') {
    return false;
  }
  if (!lote.completamenteConfirmado) {
    return false;
  }
  if (!lote.comunicacao.configurado) {
    return false;
  }
  if (lote.comunicacao.status === 'enviada') {
    return false;
  }
  if (lote.comunicacao.status === 'enviando') {
    return false;
  }
  if (lote.comunicacao.apresentadaEm) {
    return false;
  }
  return true;
}
