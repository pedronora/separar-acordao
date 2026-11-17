import { describe, expect, it } from 'vitest';

import type { EnvioDetalhe } from '../app/types';
import { agruparReenvios, progressoReenvio } from '../app/utils/reenvios';

function envio(
  parciais: Partial<EnvioDetalhe> & { id: string }
): EnvioDetalhe {
  return {
    status: 'enviado',
    para: 'dest@tribunal.jus.br',
    assunto: 'Assunto',
    corpoHtml: '<p>corpo</p>',
    enviadoEm: '2026-10-01T10:00:00.000Z',
    reenviadoDe: null,
    confirmado: false,
    confirmadoEm: null,
    tarefas: [],
    responsavel: {
      id: 'resp-1',
      nome: 'Responsável',
      email: 'dest@tribunal.jus.br',
    },
    ...parciais,
  };
}

describe('agruparReenvios', () => {
  it('retorna uma linha por envio quando não há reenvio', () => {
    const a = envio({ id: 'a' });
    const b = envio({ id: 'b' });

    const linhas = agruparReenvios([a, b]);

    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({ envio: a, reenvios: [] });
    expect(linhas[1]).toEqual({ envio: b, reenvios: [] });
  });

  it('agrupa um reenvio na linha do envio original', () => {
    const original = envio({ id: 'orig' });
    const reenvio = envio({
      id: 're1',
      reenviadoDe: 'orig',
      enviadoEm: '2026-10-02T11:00:00.000Z',
    });

    const linhas = agruparReenvios([original, reenvio]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].envio).toBe(original);
    expect(linhas[0].reenvios).toEqual([reenvio]);
  });

  it('agrupa múltiplos reenvios em ordem cronológica', () => {
    const original = envio({ id: 'orig' });
    const tarde = envio({
      id: 're2',
      reenviadoDe: 'orig',
      enviadoEm: '2026-10-03T12:00:00.000Z',
    });
    const cedo = envio({
      id: 're1',
      reenviadoDe: 'orig',
      enviadoEm: '2026-10-02T11:00:00.000Z',
    });
    const falho = envio({
      id: 're3',
      reenviadoDe: 'orig',
      status: 'falhou',
      enviadoEm: null,
    });

    const linhas = agruparReenvios([original, tarde, cedo, falho]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].reenvios.map((e) => e.id)).toEqual(['re1', 're2', 're3']);
  });

  it('agrupa reenvio de reenvio (cadeia) no original', () => {
    const original = envio({ id: 'orig' });
    const primeiro = envio({
      id: 're1',
      reenviadoDe: 'orig',
      enviadoEm: '2026-10-02T11:00:00.000Z',
    });
    const segundo = envio({
      id: 're2',
      reenviadoDe: 're1',
      enviadoEm: '2026-10-02T12:00:00.000Z',
    });

    const linhas = agruparReenvios([original, primeiro, segundo]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].reenvios.map((e) => e.id)).toEqual(['re1', 're2']);
  });

  it('trata reenvio com pai inexistente como original', () => {
    const orfao = envio({ id: 'orfao', reenviadoDe: 'inexistente' });

    const linhas = agruparReenvios([orfao]);

    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual({ envio: orfao, reenvios: [] });
  });
});

describe('progressoReenvio', () => {
  it('considera pendentes os envios ainda ausentes na listagem', () => {
    const progresso = progressoReenvio([], ['re1', 're2']);

    expect(progresso).toEqual({
      total: 2,
      pendentes: 2,
      enviados: 0,
      falhas: 0,
      concluido: false,
    });
  });

  it('conta enviados, falhas e pendentes', () => {
    const progresso = progressoReenvio(
      [
        envio({ id: 're1' }),
        envio({ id: 're2', status: 'falhou', enviadoEm: null }),
        envio({ id: 're3', status: 'pendente', enviadoEm: null }),
      ],
      ['re1', 're2', 're3']
    );

    expect(progresso).toEqual({
      total: 3,
      pendentes: 1,
      enviados: 1,
      falhas: 1,
      concluido: false,
    });
  });

  it('conclui quando todos os envios deixam de estar pendentes', () => {
    const progresso = progressoReenvio(
      [envio({ id: 're1' }), envio({ id: 're2' })],
      ['re1', 're2']
    );

    expect(progresso).toEqual({
      total: 2,
      pendentes: 0,
      enviados: 2,
      falhas: 0,
      concluido: true,
    });
  });

  it('ignora envios que não fazem parte do reenvio', () => {
    const progresso = progressoReenvio(
      [
        envio({ id: 're1', status: 'pendente', enviadoEm: null }),
        envio({ id: 'outro', status: 'pendente', enviadoEm: null }),
      ],
      ['re1']
    );

    expect(progresso).toEqual({
      total: 1,
      pendentes: 1,
      enviados: 0,
      falhas: 0,
      concluido: false,
    });
  });
});
