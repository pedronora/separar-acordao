# Separar Acórdão

Aplicação para **identificar tarefas de mesma pauta** a partir de um arquivo com
acórdãos/tarefas, **agrupá-las** e **enviá-las por e-mail** aos respectivos
responsáveis, de forma ordenada e rastreável.

A lógica de separação/agrupamento segue uma solução validada em um notebook de
referência (ver [Referência de negócio](#referência-de-negócio)).

> Solução de uso local, operada por usuários autenticados do sistema.

---

## Funcionalidades

- **Upload de arquivo** com as tarefas (com validação de tipo/tamanho/conteúdo).
- **Separação automática por pauta** — motor Python baseado no notebook de
  referência.
- **Envio ordenado por e-mail** — tarefas de um mesmo responsável são agrupadas
  em um único envio.
- **Histórico de envios** — o quê foi enviado, para quem, quando e por qual
  usuário do sistema.
- **Reenvio** de um envio específico (todo ou parcial) a partir do histórico.
- **Cadastro/edição de responsáveis** (nome, e-mail e metadados para casamento
  com a pauta).
- **Validação de pré-cadastro** — responsáveis encontrados no arquivo mas não
  cadastrados fazem o backend **rejeitar o lote** com erro explícito, sem enviar
  e-mails até o cadastro ser feito.
- **Processamento assíncrono** — envio em segundo plano com progresso e
  recuperação de lotes presos.
- **Autenticação de usuários** com senhas criptografadas (hash, nunca texto
  plano).

---

## Arquitetura

Monorepo com três componentes desacoplados, orquestrados via Docker Compose:

```
frontend/         Nuxt 3 (SPA) — interface
backend/          Nuxt 3 (server-only / Nitro) — API REST, auth, orquestração
python-service/   FastAPI — motor de separação de tarefas (baseado no notebook)
```

```
                 ┌──────────────┐   HTTP (interna)   ┌─────────────────┐
  Browser  ───►  │   frontend   │  ───────────────►  │    backend      │
                 │   Nuxt SPA   │                    │  Nitro (API)    │
                 └──────────────┘                    └────────┬────────┘
                                                              │
                                      ┌───────────────────────┼───────────────────┐
                                      │                       │                   │
                              ┌───────▼───────┐        ┌──────▼──────┐    ┌──────▼────────┐
                              │ python-service│        │   db         │    │ SMTP          │
                              │  FastAPI      │        │  PostgreSQL  │    │ (e-mail)      │
                              └───────────────┘        └─────────────┘    └───────────────┘
```

- **frontend**: SPA consumindo a API do backend via HTTP — não acessa o banco
  diretamente.
- **backend**: camada de servidor (Nitro) com rotas em `server/api/`. Cuida de
  autenticação, regras de negócio, acesso ao banco, envio de e-mail e da chamada
  ao `python-service` via rede Docker interna.
- **python-service**: microsserviço Python isolado que expõe `POST /separar`
  com a lógica do notebook. Mantido separado para não misturar runtimes e
  permitir evoluir/testar o algoritmo isoladamente.

---

## Estrutura do repositório

```
├── frontend/              # Nuxt 3 (SPA)
├── backend/               # Nuxt 3 (Nitro) — API REST
│   ├── prisma/            # schema + migrations
│   ├── server/api/        # rotas HTTP
│   └── scripts/           # recuperação de lotes, seed
├── python-service/        # FastAPI — motor de separação
│   ├── app/               # main, schemas, lógica de separação
│   └── reference/         # notebook de referência (fonte de verdade)
├── docker-compose.yml     # produção
├── docker-compose.dev.yml # desenvolvimento (hot-reload)
└── AGENTS.md              # orientações para agentes de IA / devs
```

---

## Referência de negócio

O algoritmo de separação **deve** preservar o comportamento do notebook:

```
python-service/reference/Separar_acórdãos_para_formatar.ipynb
```

Ele é a fonte de verdade dos critérios de agrupamento e ordenação. Qualquer
refatoração para Python de produção deve manter o mesmo resultado.

---

## Requisitos

- **Docker** + **Docker Compose** (para subir tudo de uma vez), ou
- **pnpm** (Node 20+) para frontend/backend e **uv** (ou pip) para o
  python-service, no desenvolvimento local.

---

## Como rodar

### Produção (Docker)

```bash
docker compose up --build -d
```

- Frontend: http://localhost:3000
- Backend (API): http://localhost:3001

### Desenvolvimento (Docker, hot-reload)

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Desenvolvimento local (sem Docker)

> PostgreSQL deve estar disponível localmente (ou via Docker) com a URL definida
> em `backend/.env`.

```bash
# Frontend       -> http://localhost:3000
cd frontend && pnpm install && pnpm dev

# Backend        -> http://localhost:3001
cd backend && pnpm install
cd backend && pnpm exec nuxi prepare   # gera .nuxt (exigido pelo prisma.config.ts)
cd backend && pnpm prisma generate     # gera o cliente Prisma
cd backend && pnpm prisma migrate dev  # aplica migrations
cd backend && pnpm dev

# Python service -> http://localhost:8000
cd python-service && uv sync
cd python-service && uv run uvicorn app.main:app --reload --port 8000
```

---

## Configuração (variáveis de ambiente)

### `backend/.env`

| Variável | Descrição |
| --- | --- |
| `DATABASE_URL` | URL do PostgreSQL |
| `JWT_SECRET` | Segredo para assinatura do JWT (obrigatório) |
| `SMTP_HOST` / `SMTP_PORT` | Servidor SMTP |
| `SMTP_USER` / `SMTP_PASSWORD` | Credenciais SMTP |
| `SMTP_FROM` | Remetente dos e-mails |
| `PYTHON_SERVICE_URL` | URL interna do python-service (ex.: `http://python-service:8000`) |
| `CORS_ORIGIN` | Origem permitida no CORS (ex.: `http://localhost:3000`) |

### `frontend/.env`

| Variável | Descrição |
| --- | --- |
| `NUXT_PUBLIC_API_BASE_URL` | Base URL da API (ex.: `http://localhost:3001`) |

> Segredos nunca são commitados — crie os `.env` a partir das orientações acima.

---

## Comandos úteis

| Ação | Comando |
| --- | --- |
| Lint frontend/backend | `pnpm lint` / `pnpm lint:fix` |
| Formatação frontend/backend | `pnpm format` |
| Lint python-service | `uv run ruff check .` |
| Formatação python-service | `uv run ruff format .` |
| Testes frontend/backend | `pnpm test` |
| Testes python-service | `uv run pytest` |
| Build frontend | `cd frontend && pnpm build` |
| Build backend | `cd backend && pnpm build` |

---

## Banco de dados

- **PostgreSQL**, gerenciado via **Prisma ORM** (migrations com Prisma Migrate).
- Entidades: `usuarios`, `responsaveis`, `lotes_envio`, `envios`,
  `configuracoes`.
- Nunca alterar o schema manualmente em produção — sempre via migrations.

---

## Segurança

- Senhas armazenadas com **hash** (argon2/bcrypt) — nunca texto plano nem
  criptografia reversível.
- Rotas do backend protegidas por **JWT**, exceto login.
- Validação de responsáveis não cadastrados ocorre **antes** de qualquer envio
  do lote (sem envios parciais silenciosos).
- Arquivos enviados são validados (tipo, tamanho, conteúdo) antes de repassar ao
  python-service.
- CORS restrito à origem do frontend.
- Comunicação backend ↔ python-service é interna à rede Docker.

---

## Licença

Privado — uso interno.
