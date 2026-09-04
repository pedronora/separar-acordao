import { describe, expect, it } from 'vitest';

import { emailDestino } from '../server/utils/configuracoes';
import {
  agruparTarefas,
  escaparHtml,
  montarAssunto,
  montarHtml,
  montarLinhas,
  montarTabela,
  type TarefaEmail,
} from '../server/utils/email';

const tarefas: TarefaEmail[] = [
  {
    autos: 'AP 0000001-11.2026',
    pauta: 'Pauta 13:05 (Sala com 98)',
  },
  {
    autos: 'AP 0000002-22.2026',
    pauta: 'Pauta 13:50 (Sala com 62)',
  },
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

describe('escaparHtml', () => {
  it('escapa caracteres especiais', () => {
    expect(escaparHtml('<b>& "aspas"</b>')).toBe(
      '&lt;b&gt;&amp; &quot;aspas&quot;&lt;/b&gt;'
    );
  });
});

describe('montarTabela', () => {
  it('renderiza tabela com PROCESSO e PAUTA', () => {
    const html = montarTabela(tarefas);
    expect(html).toContain('PROCESSO');
    expect(html).toContain('PAUTA');
    expect(html).toContain('AP 0000001-11.2026');
    expect(html).toContain(
      'Pauta 13:05 (Sala com 98)'
    );
  });
});

describe('montarHtml', () => {
  it('inclui responsável e tabela única por etiqueta', () => {
    const tabelas = new Map([
      ['Etiqueta A', tarefas],
    ]);
    const html = montarHtml('ANA', tabelas);
    expect(html).toContain('ANA');
    expect(html).toContain('Etiqueta A');
    expect(html).toContain('AP 0000001-11.2026');
    expect(html).toContain(
      'Pauta 13:05 (Sala com 98)'
    );
  });

  it('renderiza múltiplas tabelas por etiqueta', () => {
    const tabelas = new Map([
      ['Acórdãos 1ª Turma', [tarefas[0]]],
      ['Acórdãos 2ª Turma', [tarefas[1]]],
    ]);
    const html = montarHtml('ANA', tabelas);
    expect(html).toContain('Acórdãos 1ª Turma');
    expect(html).toContain('Acórdãos 2ª Turma');
    expect(html).toContain('AP 0000001-11.2026');
    expect(html).toContain('AP 0000002-22.2026');
  });

  it('escapa conteúdo do CSV no HTML', () => {
    const tabelas = new Map([
      [
        '',
        [
          {
            autos: '<script>alert(1)</script>',
            pauta: 'a & b',
          },
        ],
      ],
    ]);
    const html = montarHtml('ANA', tabelas);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('a &amp; b');
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
    const primeira = linhas.slice(
      0,
      linhas.indexOf('</tr>')
    );
    expect(primeira).toContain('#f9f9f9');
  });
});

describe('agruparTarefas', () => {
  it('agrupa tarefas por etiqueta', () => {
    const tarefasComEtiqueta: TarefaEmail[] = [
      { autos: 'A1', pauta: 'P1', etiqueta: 'Etq A' },
      { autos: 'A2', pauta: 'P2', etiqueta: 'Etq A' },
      { autos: 'B1', pauta: 'P1', etiqueta: 'Etq B' },
    ];
    const mapa = agruparTarefas(tarefasComEtiqueta);
    expect(mapa.size).toBe(2);
    expect(mapa.get('Etq A')).toHaveLength(2);
    expect(mapa.get('Etq B')).toHaveLength(1);
  });

  it('agrupa tarefas sem etiqueta sob chave vazia', () => {
    const tarefasSemEtiqueta: TarefaEmail[] = [
      { autos: 'A1', pauta: 'P1' },
      { autos: 'A2', pauta: 'P2' },
    ];
    const mapa = agruparTarefas(tarefasSemEtiqueta);
    expect(mapa.size).toBe(1);
    expect(mapa.get('')).toHaveLength(2);
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
