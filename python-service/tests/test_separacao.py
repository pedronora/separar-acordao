"""Suíte de testes do motor de separação."""

from __future__ import annotations

import io

import pandas as pd
import pytest

from app.separacao import (
    ErroDeSeparacao,
    aplicar_pautas,
    filtrar_acordaos,
    ler_csv,
    processar,
    responsaveis_faltantes,
    separar,
)

PAUTAS = {
    '06/08/2026 22:21': 'Pauta 13:05 (Sala com 98)',
    '06/08/2026 14:05': 'Pauta 13:50 (Sala com 62)',
    '07/08/2026 13:06': 'Pauta 13:05 (Sala com 98)',
}


CSV_RAW = """Classe,Processo,Tarefa,Desde,Responsável
AP,0000001-11.2026,Assinar acórdão,06/08/2026 22:21,ANA
AP,0000002-22.2026,Assinar acórdão,06/08/2026 14:05,ANA
AP,0000003-33.2026,Assinar acórdão,07/08/2026 13:06,BRUNO
AP,0000004-44.2026,Assinar acórdão,07/08/2026 13:06,BRUNO
AP,0000005-55.2026,Outra tarefa,06/08/2026 22:21,ANA
"""


def _df() -> pd.DataFrame:
    return pd.read_csv(io.StringIO(CSV_RAW))


def _csv_bytes() -> bytes:
    return CSV_RAW.encode('utf-8')


def test_filtra_apenas_assinar_acordao() -> None:
    df_acordao = filtrar_acordaos(_df())
    assert len(df_acordao) == 4


def test_ler_csv_valida_colunas_ausentes() -> None:
    conteudo = b'ColunaA,ColunaB\n1,2\n'
    with pytest.raises(ErroDeSeparacao):
        ler_csv(conteudo)


def test_ler_csv_arquivo_vazio() -> None:
    with pytest.raises(ErroDeSeparacao):
        ler_csv(b'')


def test_aplicar_pautas_ok() -> None:
    df = aplicar_pautas(filtrar_acordaos(_df()), PAUTAS)
    pautas = set(df['Desde'].unique())
    assert pautas == {'Pauta 13:05 (Sala com 98)', 'Pauta 13:50 (Sala com 62)'}


def test_aplicar_pautas_sem_cobertura() -> None:
    df = filtrar_acordaos(_df())
    with pytest.raises(ErroDeSeparacao, match='Rótulo de pauta não informado'):
        aplicar_pautas(df, {})


def test_responsaveis_faltantes() -> None:
    df = filtrar_acordaos(_df())
    assert responsaveis_faltantes(df, ['ANA']) == ['BRUNO']
    assert responsaveis_faltantes(df, ['ana']) == ['BRUNO']


def test_agrupamento_por_responsavel_ordenado() -> None:
    df = aplicar_pautas(filtrar_acordaos(_df()), PAUTAS)
    grupos = separar(df)

    assert [g['responsavel'] for g in grupos] == ['ANA', 'BRUNO']

    ana = grupos[0]['tarefas']
    assert [t['autos'] for t in ana] == [
        'AP 0000001-11.2026',
        'AP 0000002-22.2026',
    ]
    assert [t['pauta'] for t in ana] == [
        'Pauta 13:05 (Sala com 98)',
        'Pauta 13:50 (Sala com 62)',
    ]

    bruno = grupos[1]['tarefas']
    assert [t['processo'] for t in bruno] == [
        '0000003-33.2026',
        '0000004-44.2026',
    ]


def test_processar_pipeline_completo() -> None:
    resultado = processar(
        _csv_bytes(),
        PAUTAS,
        responsaveis_cadastrados=['ANA', 'BRUNO'],
        total_acordaos=4,
    )
    assert resultado['total_acordaos'] == 4
    assert resultado['responsaveis_faltantes'] == []
    assert len(resultado['grupos']) == 2


def test_processar_total_inconsistente() -> None:
    with pytest.raises(ErroDeSeparacao, match='Inconsistência'):
        processar(_csv_bytes(), PAUTAS, total_acordaos=10)


def test_processar_sem_assinar_acordao() -> None:
    df = _df()
    df['Tarefa'] = 'Outra tarefa'
    buffer = io.StringIO()
    df.to_csv(buffer, index=False)
    with pytest.raises(ErroDeSeparacao, match='Nenhuma tarefa'):
        processar(
            buffer.getvalue().encode('utf-8'),
            PAUTAS,
            responsaveis_cadastrados=['ANA', 'BRUNO'],
        )
