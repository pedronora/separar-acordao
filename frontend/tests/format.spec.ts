import { describe, expect, it } from 'vitest';

import { formatarData } from '../app/utils/format';

describe('formatarData', () => {
  it('retorna "-" para valores vazios', () => {
    expect(formatarData(null)).toBe('-');
    expect(formatarData(undefined)).toBe('-');
    expect(formatarData('')).toBe('-');
  });

  it('formata uma data ISO no padrão pt-BR', () => {
    const resultado = formatarData('2026-08-05T21:00:00.000Z');
    expect(resultado).toContain('2026');
    expect(resultado).toContain('/08/');
  });
});
