import type { StatusEnvio, StatusLote } from '~/types';

type Status = StatusEnvio | StatusLote;

const ROTULOS: Record<Status, string> = {
  pendente: 'Pendente',
  enviado: 'Enviado',
  falhou: 'Falhou',
  processando: 'Processando',
  processado: 'Processado',
};

const CLASSES: Record<Status, string> = {
  pendente: 'tag-amarela',
  enviado: 'tag-verde',
  falhou: 'tag-vermelha',
  processando: 'tag-amarela',
  processado: 'tag-verde',
};

/**
 * Rótulo em português para o status de um envio ou de um lote.
 * `emEnvio` sinaliza que o item é o próximo da fila e está sendo disparado.
 */
export function rotuloStatus(status: Status, emEnvio = false): string {
  if (status === 'pendente' && emEnvio) {
    return 'Enviando...';
  }
  return ROTULOS[status];
}

/** Variante de cor da tag para o status informado. */
export function classeTag(status: Status): string {
  return CLASSES[status];
}
