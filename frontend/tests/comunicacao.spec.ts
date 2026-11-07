import { describe, expect, it } from 'vitest';

import type { LoteDetalhe } from '../app/types';
import { deveApresentarComunicacaoAutomaticamente } from '../app/utils/comunicacao';

function lote(parciais: Partial<LoteDetalhe> = {}): LoteDetalhe {
  return {
    id: 'lote-1',
    arquivoOrigem: 'arquivo.csv',
    arquivos: null,
    orgao: '1ª Turma',
    dataSessao: '05/08/2026',
    criadoEm: '2026-08-05T10:00:00.000Z',
    status: 'processado',
    erro: null,
    totalEnvios: 1,
    completamenteConfirmado: true,
    comunicacao: {
      configurado: true,
      status: null,
      apresentadaEm: null,
      enviadaEm: null,
      erro: null,
    },
    usuario: { id: 'u1', nome: 'Usuário', email: 'u@trt12.jus.br' },
    envios: [],
    ...parciais,
  };
}

describe('deveApresentarComunicacaoAutomaticamente', () => {
  it('abre quando o lote está completo e nunca apresentado', () => {
    expect(deveApresentarComunicacaoAutomaticamente(lote())).toBe(true);
  });

  it('não abre sem lote', () => {
    expect(deveApresentarComunicacaoAutomaticamente(null)).toBe(false);
  });

  it('não abre se o lote não está processado', () => {
    expect(
      deveApresentarComunicacaoAutomaticamente(lote({ status: 'processando' }))
    ).toBe(false);
  });

  it('não abre se nem todos confirmaram', () => {
    expect(
      deveApresentarComunicacaoAutomaticamente(
        lote({ completamenteConfirmado: false })
      )
    ).toBe(false);
  });

  it('não abre se o desembargador não está configurado', () => {
    expect(
      deveApresentarComunicacaoAutomaticamente(
        lote({
          comunicacao: {
            configurado: false,
            status: null,
            apresentadaEm: null,
            enviadaEm: null,
            erro: null,
          },
        })
      )
    ).toBe(false);
  });

  it('não reabre depois de apresentada', () => {
    expect(
      deveApresentarComunicacaoAutomaticamente(
        lote({
          comunicacao: {
            configurado: true,
            status: 'pendente',
            apresentadaEm: '2026-08-05T10:00:00.000Z',
            enviadaEm: null,
            erro: null,
          },
        })
      )
    ).toBe(false);
  });

  it('não abre quando já foi enviada ou está enviando', () => {
    for (const status of ['enviada', 'enviando'] as const) {
      expect(
        deveApresentarComunicacaoAutomaticamente(
          lote({
            comunicacao: {
              configurado: true,
              status,
              apresentadaEm: null,
              enviadaEm: null,
              erro: null,
            },
          })
        )
      ).toBe(false);
    }
  });
});
