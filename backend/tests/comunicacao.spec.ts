import { describe, expect, it } from 'vitest';

import {
  coletarTarefasDosEnvios,
  decidirEnvioComunicacao,
  detectarTransicaoConfirmacao,
  listarEtiquetas,
  loteCompletamenteConfirmado,
  montarAssuntoComunicacao,
  montarHtmlComunicacao,
  montarResumoComunicacao,
  normalizarBcc,
  podeComunicarLote,
  primeiroNome,
  saudacaoPorHorario,
} from '../server/utils/comunicacao';
import {
  extrairDadosDesembargador,
  validarDadosDesembargador,
} from '../server/utils/configuracoes';
import { montarOpcoesEmail } from '../server/utils/email';

describe('montarResumoComunicacao', () => {
  it('agrupa por etiqueta e pauta contando autos únicos', () => {
    const resumo = montarResumoComunicacao([
      { autos: 'AP 1', pauta: 'P1', etiqueta: 'Etq A' },
      { autos: 'AP 1', pauta: 'P1', etiqueta: 'Etq A' },
      { autos: 'AP 2', pauta: 'P1', etiqueta: 'Etq A' },
      { autos: 'AP 3', pauta: 'P2', etiqueta: 'Etq A' },
    ]);

    expect(resumo).toEqual([
      { etiqueta: 'Etq A', pauta: 'P1', quantidade: 2 },
      { etiqueta: 'Etq A', pauta: 'P2', quantidade: 1 },
    ]);
  });

  it('deduplica autos ignorando caixa e espaços', () => {
    const resumo = montarResumoComunicacao([
      { autos: ' AP 1 ', pauta: 'P1', etiqueta: 'Etq' },
      { autos: 'ap 1', pauta: 'P1', etiqueta: 'Etq' },
    ]);

    expect(resumo).toHaveLength(1);
    expect(resumo[0].quantidade).toBe(1);
  });

  it('não conta tarefas sem autos', () => {
    const resumo = montarResumoComunicacao([
      { autos: '', pauta: 'P1', etiqueta: 'Etq' },
      { autos: 'AP 1', pauta: 'P1', etiqueta: 'Etq' },
    ]);

    expect(resumo).toEqual([{ etiqueta: 'Etq', pauta: 'P1', quantidade: 1 }]);
  });

  it('ordena etiquetas e pautas numericamente', () => {
    const resumo = montarResumoComunicacao([
      { autos: 'AP 1', pauta: 'Pauta 10', etiqueta: 'Turma 2' },
      { autos: 'AP 2', pauta: 'Pauta 2', etiqueta: 'Turma 2' },
      { autos: 'AP 3', pauta: 'Pauta 1', etiqueta: 'Turma 1' },
    ]);

    expect(resumo.map((item) => `${item.etiqueta}|${item.pauta}`)).toEqual([
      'Turma 1|Pauta 1',
      'Turma 2|Pauta 2',
      'Turma 2|Pauta 10',
    ]);
  });
});

describe('coletarTarefasDosEnvios', () => {
  it('ignora tarefas inválidas e envios sem lista', () => {
    const tarefas = coletarTarefasDosEnvios([
      {
        tarefas: [
          { autos: 'AP 1', pauta: 'P1', etiqueta: 'Etq' },
          { autos: 1, pauta: 'P2' },
          null,
        ],
      },
      { tarefas: null },
    ]);

    expect(tarefas).toEqual([{ autos: 'AP 1', pauta: 'P1', etiqueta: 'Etq' }]);
  });
});

describe('loteCompletamenteConfirmado', () => {
  it('exige ao menos um envio', () => {
    expect(loteCompletamenteConfirmado([])).toBe(false);
  });

  it('exige todos os envios confirmados', () => {
    expect(
      loteCompletamenteConfirmado([
        { confirmado: true },
        { confirmado: false },
      ])
    ).toBe(false);
    expect(
      loteCompletamenteConfirmado([{ confirmado: true }, { confirmado: true }])
    ).toBe(true);
  });
});

describe('detectarTransicaoConfirmacao', () => {
  it('detecta a passagem para completamente confirmado', () => {
    expect(
      detectarTransicaoConfirmacao(
        [{ confirmado: true }, { confirmado: false }],
        [{ confirmado: true }, { confirmado: true }]
      )
    ).toBe(true);
  });

  it('não detecta transição quando já estava confirmado', () => {
    expect(
      detectarTransicaoConfirmacao(
        [{ confirmado: true }],
        [{ confirmado: true }]
      )
    ).toBe(false);
  });

  it('não detecta transição ao desmarcar', () => {
    expect(
      detectarTransicaoConfirmacao(
        [{ confirmado: true }],
        [{ confirmado: false }]
      )
    ).toBe(false);
  });
});

describe('podeComunicarLote', () => {
  it('exige lote processado e todos confirmados', () => {
    expect(
      podeComunicarLote({
        status: 'processado',
        envios: [{ confirmado: true }],
      })
    ).toBe(true);
    expect(
      podeComunicarLote({
        status: 'processando',
        envios: [{ confirmado: true }],
      })
    ).toBe(false);
    expect(
      podeComunicarLote({
        status: 'processado',
        envios: [],
      })
    ).toBe(false);
  });
});

describe('montarAssuntoComunicacao', () => {
  it('usa o padrão de sessão', () => {
    expect(montarAssuntoComunicacao('1ª Turma', '05/08/2026')).toBe(
      '[1ª Turma - Sessão: 05/08/2026] Acórdãos para assinatura'
    );
  });
});

describe('montarHtmlComunicacao', () => {
  const agoraTarde = new Date('2026-08-05T15:00:00-03:00');
  const agoraNoite = new Date('2026-08-05T19:00:00-03:00');

  const resumo = [
    { etiqueta: '1ª Turma', pauta: 'P1', quantidade: 3 },
    { etiqueta: 'Núcleo 4.0', pauta: 'P2', quantidade: 1 },
  ];

  it('monta saudação, resumo e assinatura simples', () => {
    const html = montarHtmlComunicacao({
      nomeDesembargador: 'HELIO BASTIDA LOPES',
      resumo,
      remetenteNome: 'Gab. Teste',
      agora: agoraTarde,
    });

    expect(html).toContain('Boa tarde, Dr. Helio:');
    expect(html).toContain(
      'Os acórdãos da última sessão (1ª Turma e Núcleo 4.0) ' +
        'estão prontos para assinatura.'
    );
    expect(html).toContain('>Órgão</th>');
    expect(html).toContain('>Pauta</th>');
    expect(html).toContain('>Acórdãos</th>');
    expect(html).toContain('Att,<br/>Gab. Teste');
    expect(html).not.toContain('Prezado');
    expect(html).not.toContain('Permanecemos');
    expect(html).not.toContain('Atenciosamente');
  });

  it('usa “Boa noite” a partir das 18h', () => {
    const html = montarHtmlComunicacao({
      nomeDesembargador: 'HELIO',
      resumo,
      agora: agoraNoite,
    });

    expect(html).toContain('Boa noite, Dr. Helio:');
  });

  it('escapa nome, órgãos e pauta', () => {
    const html = montarHtmlComunicacao({
      nomeDesembargador: 'Fu<b>lano Silva',
      resumo: [{ etiqueta: 'Etq <x>', pauta: 'P1 & P2', quantidade: 3 }],
      remetenteNome: 'Gab. Teste',
      agora: agoraTarde,
    });

    expect(html).toContain('Dr. Fu&lt;b&gt;lano:');
    expect(html).toContain('(Etq &lt;x&gt;)');
    expect(html).toContain('Etq &lt;x&gt;');
    expect(html).toContain('P1 &amp; P2');
    expect(html).toContain('>3</td>');
  });

  it('omite os parênteses quando não há órgão', () => {
    const html = montarHtmlComunicacao({
      nomeDesembargador: 'HELIO',
      resumo: [{ etiqueta: '', pauta: 'P1', quantidade: 1 }],
      agora: agoraTarde,
    });

    expect(html).toContain(
      'Os acórdãos da última sessão estão prontos para assinatura.'
    );
  });
});

describe('primeiroNome', () => {
  it('usa o primeiro nome capitalizado', () => {
    expect(primeiroNome('HELIO BASTIDA LOPES')).toBe('Helio');
  });

  it('ignora títulos no início do nome', () => {
    expect(primeiroNome('Des. HELIO BASTIDA LOPES')).toBe('Helio');
    expect(primeiroNome('Dr. Helio Bastida')).toBe('Helio');
  });

  it('retorna vazio para nome vazio', () => {
    expect(primeiroNome('   ')).toBe('');
  });
});

describe('saudacaoPorHorario', () => {
  it('usa “Boa tarde” antes das 18h', () => {
    expect(saudacaoPorHorario(new Date('2026-08-05T17:59:00-03:00'))).toBe(
      'Boa tarde'
    );
  });

  it('usa “Boa noite” a partir das 18h', () => {
    expect(saudacaoPorHorario(new Date('2026-08-05T18:00:00-03:00'))).toBe(
      'Boa noite'
    );
  });
});

describe('listarEtiquetas', () => {
  it('lista etiquetas únicas na ordem do resumo', () => {
    expect(
      listarEtiquetas([
        { etiqueta: '1ª Turma', pauta: 'P1', quantidade: 1 },
        { etiqueta: '1ª Turma', pauta: 'P2', quantidade: 1 },
        { etiqueta: 'Núcleo 4.0', pauta: 'P3', quantidade: 1 },
      ])
    ).toBe('1ª Turma e Núcleo 4.0');
  });

  it('usa vírgulas e “e” para três ou mais etiquetas', () => {
    expect(
      listarEtiquetas([
        { etiqueta: 'A', pauta: 'P1', quantidade: 1 },
        { etiqueta: 'B', pauta: 'P2', quantidade: 1 },
        { etiqueta: 'C', pauta: 'P3', quantidade: 1 },
      ])
    ).toBe('A, B e C');
  });

  it('retorna vazio quando não há etiqueta', () => {
    expect(listarEtiquetas([])).toBe('');
  });
});

describe('normalizarBcc', () => {
  it('exclui o destinatário principal e duplicidades', () => {
    const bcc = normalizarBcc(
      [
        { nome: 'Ana', email: 'ana@trt12.jus.br' },
        { nome: 'Bruno', email: 'bruno@trt12.jus.br' },
        { nome: 'Bruno 2', email: ' BRUNO@trt12.jus.br ' },
        { nome: 'Des.', email: 'des@trt12.jus.br' },
      ],
      'des@trt12.jus.br'
    );

    expect(bcc).toEqual(['ana@trt12.jus.br', 'bruno@trt12.jus.br']);
  });
});

describe('decidirEnvioComunicacao', () => {
  const agora = new Date('2026-08-05T12:00:00Z');

  it('não reenvia comunicação já enviada', () => {
    expect(decidirEnvioComunicacao('enviada', null, agora)).toBe('ja_enviada');
  });

  it('bloqueia envio em andamento recente', () => {
    const recente = new Date(agora.getTime() - 60 * 1000);
    expect(decidirEnvioComunicacao('enviando', recente, agora)).toBe(
      'em_andamento'
    );
  });

  it('permite retomar envio travado após o timeout', () => {
    const antigo = new Date(agora.getTime() - 6 * 60 * 1000);
    expect(decidirEnvioComunicacao('enviando', antigo, agora)).toBe('enviar');
  });

  it('permite envio pendente ou falho', () => {
    expect(decidirEnvioComunicacao('pendente', null, agora)).toBe('enviar');
    expect(decidirEnvioComunicacao('falhou', null, agora)).toBe('enviar');
  });
});

describe('validarDadosDesembargador', () => {
  it('aceita nome e e-mail válidos', () => {
    expect(
      validarDadosDesembargador({
        nome: 'Des. Fulano',
        email: 'fulano@trt12.jus.br',
      })
    ).toBeNull();
  });

  it('rejeita nome, e-mail vazio ou e-mail inválido', () => {
    expect(validarDadosDesembargador({ nome: ' ', email: 'a@b.com' })).toBe(
      'Informe o nome do desembargador.'
    );
    expect(validarDadosDesembargador({ nome: 'Des.', email: ' ' })).toBe(
      'Informe o e-mail do desembargador.'
    );
    expect(
      validarDadosDesembargador({ nome: 'Des.', email: 'invalido' })
    ).toBe('E-mail do desembargador inválido.');
  });
});

describe('extrairDadosDesembargador', () => {
  it('lê as chaves do banco e usa vazio quando ausentes', () => {
    expect(
      extrairDadosDesembargador([
        { chave: 'desembargador_nome', valor: 'Des. Fulano' },
      ])
    ).toEqual({ nome: 'Des. Fulano', email: '' });
  });
});

describe('montarOpcoesEmail', () => {
  it('inclui BCC quando informado', () => {
    const opcoes = montarOpcoesEmail({
      to: 'des@trt12.jus.br',
      subject: 'Assunto',
      html: '<p>Olá</p>',
      bcc: ['ana@trt12.jus.br'],
    });

    expect(opcoes.bcc).toEqual(['ana@trt12.jus.br']);
    expect(opcoes.to).toBe('des@trt12.jus.br');
  });

  it('omite BCC quando a lista está vazia', () => {
    const opcoes = montarOpcoesEmail({
      to: 'des@trt12.jus.br',
      subject: 'Assunto',
      html: '<p>Olá</p>',
      bcc: [],
    });

    expect(opcoes.bcc).toBeUndefined();
  });
});
