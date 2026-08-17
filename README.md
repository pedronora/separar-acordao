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
frontend/         Nuxt 3 (SSR) — interface
backend/          Nuxt 3 (server-only / Nitro) — API REST, auth, orquestração
python-service/   FastAPI — motor de separação de tarefas (baseado no notebook)
```

```
                 ┌──────────────┐   proxy /api (Nitro)  ┌─────────────────┐
  Browser  ───►  │   frontend   │  ───────────────────► │    backend      │
                 │   Nuxt SSR   │                       │  Nitro (API)    │
                 └──────────────┘                       └────────┬────────┘
                                                                │
                                       ┌────────────────────────┼──────────────────┐
                                       │                        │                  │
                               ┌───────▼───────┐         ┌──────▼──────┐   ┌──────▼────────┐
                               │ python-service│         │   db         │   │ SMTP          │
                               │  FastAPI      │         │  PostgreSQL  │   │ (e-mail)      │
                               └───────────────┘         └─────────────┘   └───────────────┘
```

- **frontend**: Nuxt 3 com **SSR** (Server-Side Rendering) — títulos, meta e
  conteúdo são renderizados no servidor. O frontend expõe um proxy em `/api/**`
  para o backend, então o navegador só fala com o frontend (mesma origem).
- **backend**: camada de servidor (Nitro) com rotas em `server/api/`. Cuida de
  autenticação, regras de negócio, acesso ao banco, envio de e-mail e da chamada
  ao `python-service` via rede Docker interna.
- **python-service**: microsserviço Python isolado que expõe `POST /separar`
  com a lógica do notebook. Mantido separado para não misturar runtimes e
  permitir evoluir/testar o algoritmo isoladamente.

---

## Estrutura do repositório

```
├── frontend/              # Nuxt 3 (SSR)
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

- Frontend (SSR): http://localhost:3000
- A API do backend não fica exposta publicamente — o frontend faz proxy de
  `/api/**` para o backend via rede interna.

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
| `API_INTERNAL_URL` | URL da API usada pelo servidor Nitro no SSR (ex.: `http://backend:3001` em Docker) |
| `API_PROXY_TARGET` | Alvo do proxy `/api` do Nitro (baked no build) |
| `COOKIE_SECURE` | Define `Secure` no cookie de sessão (`true` apenas sob HTTPS) |

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
- Rotas do backend protegidas por **JWT** (cookie httpOnly + Bearer), exceto
  login/logout/health.
- Validação de responsáveis não cadastrados ocorre **antes** de qualquer envio
  do lote (sem envios parciais silenciosos).
- Arquivos enviados são validados (tipo, tamanho, conteúdo) antes de repassar ao
  python-service.
- Backend não fica exposto publicamente — acesso apenas via proxy do frontend
  (mesma origem).
- Comunicação backend ↔ python-service é interna à rede Docker.

---

## Licença

Privado — uso interno.
