import { describe, expect, it } from 'vitest';

import { emailDestino } from '../server/utils/configuracoes';
import {
  montarAssunto,
  montarHtml,
  montarLinhas,
  type TarefaEmail,
} from '../server/utils/email';

const tarefas: TarefaEmail[] = [
  { autos: 'AP 0000001-11.2026', pauta: 'Pauta 13:05 (Sala com 98)' },
  { autos: 'AP 0000002-22.2026', pauta: 'Pauta 13:50 (Sala com 62)' },
];

describe('montarAssunto', () => {
  it('usa o primeiro nome do responsável capitalizado', () => {
    const assunto = montarAssunto(
      '1ª Turma',
      '05/08/2026',
      'ALEXANDRE MAIA DE MORAES'
    );
    expect(assunto).toBe(
      '[1ª Turma - Sessão: 05/08/2026] Formatar acórdãos - Alexandre'
    );
  });
});

describe('montarHtml', () => {
  it('inclui responsável, autos e pauta de cada tarefa', () => {
    const html = montarHtml('ANA', tarefas);
    expect(html).toContain('ANA');
    expect(html).toContain('AP 0000001-11.2026');
    expect(html).toContain('Pauta 13:05 (Sala com 98)');
    expect(html).toContain('PROCESSO');
    expect(html).toContain('PAUTA');
  });
});

describe('montarLinhas', () => {
  it('enumera as tarefas a partir de 1', () => {
    const linhas = montarLinhas(tarefas);
    expect(linhas).toContain('>1</td>');
    expect(linhas).toContain('>2</td>');
  });

  it('aplica zebra nas linhas', () => {
    const linhas = montarLinhas(tarefas);
    const primeira = linhas.slice(0, linhas.indexOf('</tr>'));
    expect(primeira).toContain('#f9f9f9');
  });
});

describe('emailDestino', () => {
  it('retorna o e-mail do responsável quando ativo', () => {
    const destino = emailDestino(
      { ativo: true, email: 'ana@trt12.jus.br' },
      'padrao@trt12.jus.br'
    );
    expect(destino).toBe('ana@trt12.jus.br');
  });

  it('retorna o e-mail padrão quando o responsável é inativo', () => {
    const destino = emailDestino(
      { ativo: false, email: 'bruno@trt12.jus.br' },
      'padrao@trt12.jus.br'
    );
    expect(destino).toBe('padrao@trt12.jus.br');
  });
});
