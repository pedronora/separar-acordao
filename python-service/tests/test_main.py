"""Testes do endpoint HTTP ``/separar``."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

CSV_RAW = """Classe,Processo,Tarefa,Desde,Responsável
AP,0000001-11.2026,Assinar acórdão,06/08/2026 22:21,ANA
AP,0000002-22.2026,Assinar acórdão,06/08/2026 14:05,BRUNO
"""

PAUTAS = {
    '06/08/2026 22:21': 'Pauta 13:05 (Sala com 98)',
    '06/08/2026 14:05': 'Pauta 13:50 (Sala com 62)',
}


def test_health() -> None:
    resp = client.get('/health')
    assert resp.status_code == 200
    assert resp.json() == {'status': 'ok'}


def test_analisar_ok() -> None:
    resp = client.post(
        '/analisar',
        files={'file': ('painel.csv', CSV_RAW.encode('utf-8'), 'text/csv')},
    )
    assert resp.status_code == 200
    corpo = resp.json()
    assert corpo['total_acordaos'] == 2
    assert corpo['desdes'] == ['06/08/2026 22:21', '06/08/2026 14:05']
    assert corpo['responsaveis'] == ['ANA', 'BRUNO']


def test_analisar_total_inconsistente() -> None:
    resp = client.post(
        '/analisar',
        files={'file': ('painel.csv', CSV_RAW.encode('utf-8'), 'text/csv')},
        data={'total_acordaos': '10'},
    )
    assert resp.status_code == 422
    assert 'Inconsistência' in resp.json()['detail']


def test_separar_ok() -> None:
    resp = client.post(
        '/separar',
        files={'file': ('painel.csv', CSV_RAW.encode('utf-8'), 'text/csv')},
        data={
            'pautas': json.dumps(PAUTAS),
            'responsaveis_cadastrados': json.dumps(['ANA', 'BRUNO']),
            'total_acordaos': '2',
        },
    )
    assert resp.status_code == 200
    corpo = resp.json()
    assert corpo['total_acordaos'] == 2
    assert corpo['responsaveis_faltantes'] == []
    assert [g['responsavel'] for g in corpo['grupos']] == ['ANA', 'BRUNO']
    assert corpo['grupos'][0]['tarefas'][0]['autos'].startswith('AP ')


def test_separar_responsavel_nao_cadastrado() -> None:
    resp = client.post(
        '/separar',
        files={'file': ('painel.csv', CSV_RAW.encode('utf-8'), 'text/csv')},
        data={
            'pautas': json.dumps(PAUTAS),
            'responsaveis_cadastrados': json.dumps(['ANA']),
        },
    )
    assert resp.status_code == 422
    assert resp.json()['detail']['tipo'] == 'responsaveis_faltantes'
    assert resp.json()['detail']['faltantes'] == ['BRUNO']


def test_separar_pauta_ausente() -> None:
    resp = client.post(
        '/separar',
        files={'file': ('painel.csv', CSV_RAW.encode('utf-8'), 'text/csv')},
        data={'pautas': '{}', 'responsaveis_cadastrados': '[]'},
    )
    assert resp.status_code == 422
    assert 'pauta' in resp.json()['detail'].lower()
