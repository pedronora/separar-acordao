import type { EnvioDetalhe } from '~/types';

export interface LinhaEnvio {
  envio: EnvioDetalhe;
  reenvios: EnvioDetalhe[];
}

export interface ProgressoReenvio {
  total: number;
  pendentes: number;
  enviados: number;
  falhas: number;
  concluido: boolean;
}

/**
 * Resume o andamento dos reenvios a partir dos IDs retornados pela
 * API. Envios ainda ausentes na listagem contam como pendentes, pois
 * podem estar sendo criados entre o POST e a próxima consulta.
 */
export function progressoReenvio(
  envios: EnvioDetalhe[],
  ids: string[]
): ProgressoReenvio {
  const porId = new Map(envios.map((e) => [e.id, e]));
  let pendentes = 0;
  let enviados = 0;
  let falhas = 0;

  for (const id of ids) {
    const envio = porId.get(id);
    if (!envio || envio.status === 'pendente') {
      pendentes++;
    } else if (envio.status === 'enviado') {
      enviados++;
    } else {
      falhas++;
    }
  }

  return {
    total: ids.length,
    pendentes,
    enviados,
    falhas,
    concluido: pendentes === 0,
  };
}

function ordenarCronologico(
  a: EnvioDetalhe,
  b: EnvioDetalhe
): number {
  if (!a.enviadoEm && !b.enviadoEm) {
    return 0;
  }
  if (!a.enviadoEm) {
    return 1;
  }
  if (!b.enviadoEm) {
    return -1;
  }
  if (a.enviadoEm < b.enviadoEm) {
    return -1;
  }
  if (a.enviadoEm > b.enviadoEm) {
    return 1;
  }
  return 0;
}

/**
 * Agrupa os envios de um lote por envio original, para que cada
 * reenvio seja exibido na linha do original em vez de virar uma
 * nova linha na tabela. A travessia é transitiva (cobre reenvio
 * de reenvio). Envios cujo `reenviadoDe` não existe na lista são
 * tratados como originais.
 */
export function agruparReenvios(
  envios: EnvioDetalhe[]
): LinhaEnvio[] {
  const porId = new Map(envios.map((e) => [e.id, e]));
  const filhos = new Map<string, EnvioDetalhe[]>();
  for (const envio of envios) {
    if (envio.reenviadoDe && porId.has(envio.reenviadoDe)) {
      const lista = filhos.get(envio.reenviadoDe) ?? [];
      lista.push(envio);
      filhos.set(envio.reenviadoDe, lista);
    }
  }

  const linhas: LinhaEnvio[] = [];
  for (const envio of envios) {
    if (envio.reenviadoDe && porId.has(envio.reenviadoDe)) {
      continue;
    }
    const reenvios: EnvioDetalhe[] = [];
    const fila = [...(filhos.get(envio.id) ?? [])];
    while (fila.length > 0) {
      const atual = fila.shift();
      if (!atual) {
        break;
      }
      reenvios.push(atual);
      fila.push(...(filhos.get(atual.id) ?? []));
    }
    reenvios.sort(ordenarCronologico);
    linhas.push({ envio, reenvios });
  }
  return linhas;
}
