import { describe, expect, it } from 'vitest';

import { classeTag, rotuloStatus } from '../app/utils/status';

describe('rotuloStatus', () => {
  it('traduz os status de envio', () => {
    expect(rotuloStatus('pendente')).toBe('Pendente');
    expect(rotuloStatus('enviado')).toBe('Enviado');
    expect(rotuloStatus('falhou')).toBe('Falhou');
  });

  it('traduz os status de lote', () => {
    expect(rotuloStatus('processando')).toBe('Processando');
    expect(rotuloStatus('processado')).toBe('Processado');
  });

  it('sinaliza o envio em andamento', () => {
    expect(rotuloStatus('pendente', true)).toBe('Enviando...');
  });

  it('ignora o envio em andamento fora do status pendente', () => {
    expect(rotuloStatus('enviado', true)).toBe('Enviado');
    expect(rotuloStatus('falhou', true)).toBe('Falhou');
  });
});

describe('classeTag', () => {
  it('usa verde para concluídos', () => {
    expect(classeTag('enviado')).toBe('tag-verde');
    expect(classeTag('processado')).toBe('tag-verde');
  });

  it('usa amarelo para o que está em curso', () => {
    expect(classeTag('pendente')).toBe('tag-amarela');
    expect(classeTag('processando')).toBe('tag-amarela');
  });

  it('usa vermelho para falhas', () => {
    expect(classeTag('falhou')).toBe('tag-vermelha');
  });
});
