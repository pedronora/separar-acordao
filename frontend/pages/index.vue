<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import type {
  AnalisarResultado,
  EnvioDetalhe,
  EnvioIniciado,
  LoteDetalhe,
} from '~/types';

definePageMeta({ middleware: 'auth' });

const analise = ref<AnalisarResultado | null>(null);
const lote = ref<LoteDetalhe | null>(null);

const arquivo = ref<File | null>(null);
const pautas = reactive<Record<string, string>>({});
const orgao = ref('');
const dataSessao = ref('');
const totalAcordaos = ref<number | null>(null);

const carregando = ref(false);
const erroMsg = ref('');

let intervalo: ReturnType<typeof setInterval> | null = null;

const inicioAcompanhamento = ref(0);
const segundosDecorridos = ref(0);

const processando = computed(() => lote.value?.status === 'processando');

const podeEnviar = computed(() => {
  if (!analise.value) {
    return false;
  }
  const pautasCompletas = analise.value.desdes.every(
    (desde) => String(pautas[desde] ?? '').trim() !== ''
  );
  return (
    pautasCompletas &&
    orgao.value.trim() !== '' &&
    dataSessao.value.trim() !== ''
  );
});

const progresso = computed(() => {
  if (!lote.value) {
    return { enviados: 0, total: 0, restantes: 0 };
  }
  const enviados = lote.value.envios.filter(
    (e) => e.status === 'enviado'
  ).length;
  const total = lote.value.totalEnvios ?? lote.value.envios.length;
  return { enviados, total, restantes: total - enviados };
});

const percentual = computed(() => {
  if (progresso.value.total === 0) {
    return 0;
  }
  return Math.min(100, Math.round((progresso.value.enviados / progresso.value.total) * 100));
});

const ordemStatus = ['enviado', 'pendente', 'falhou'] as const;

function rotuloStatus(status: EnvioDetalhe['status'], emEnvio = false) {
  if (status === 'pendente' && emEnvio) {
    return 'Enviando...';
  }
  const rotulos: Record<EnvioDetalhe['status'], string> = {
    pendente: 'Pendente',
    enviado: 'Enviado',
    falhou: 'Falhou',
  };
  return rotulos[status];
}

const enviosOrdenados = computed(() => {
  if (!lote.value) {
    return [];
  }
  return [...lote.value.envios].sort(
    (a, b) =>
      ordemStatus.indexOf(a.status) - ordemStatus.indexOf(b.status)
  );
});

const primeiroPendente = computed(() =>
  enviosOrdenados.value.findIndex((e) => e.status === 'pendente')
);

function formatoTempo(segundos: number) {
  const mm = Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0');
  const ss = (segundos % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

const concluidoComFalhas = computed(
  () =>
    lote.value?.status === 'processado' &&
    lote.value.envios.some((e) => e.status === 'falhou')
);

async function consultarLote(id: string) {
  try {
    lote.value = await useApi<LoteDetalhe>(`/api/lotes/${id}`);
  } catch {
    // erro temporário de consulta; mantém estado atual
  }
}

function iniciarAcompanhamento(id: string) {
  if (intervalo) {
    clearInterval(intervalo);
  }
  inicioAcompanhamento.value = Date.now();
  segundosDecorridos.value = 0;
  intervalo = setInterval(() => {
    consultarLote(id);
    segundosDecorridos.value = Math.floor(
      (Date.now() - inicioAcompanhamento.value) / 1000
    );
  }, 4000);
}

function pararAcompanhamento() {
  if (intervalo) {
    clearInterval(intervalo);
    intervalo = null;
  }
}

watch(
  () => lote.value?.status,
  (status) => {
    if (status && status !== 'processando') {
      pararAcompanhamento();
    }
  }
);

onUnmounted(pararAcompanhamento);

function selecionarArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement;
  arquivo.value = alvo.files?.[0] ?? null;
  lote.value = null;
  if (arquivo.value) {
    void analisarArquivo();
  }
}

async function analisarArquivo() {
  if (!arquivo.value || carregando.value) {
    return;
  }
  carregando.value = true;
  erroMsg.value = '';
  try {
    const form = new FormData();
    form.append('file', arquivo.value);
    analise.value = await useApi<AnalisarResultado>(
      '/api/processar/analisar',
      { method: 'POST', body: form }
    );
    totalAcordaos.value = analise.value.totalAcordaos;
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    carregando.value = false;
  }
}

async function enviar() {
  if (!analise.value) {
    return;
  }
  carregando.value = true;
  erroMsg.value = '';
  try {
    const iniciado = await useApi<EnvioIniciado>('/api/processar/enviar', {
      method: 'POST',
      body: {
        token: analise.value.token,
        arquivoOrigem: analise.value.arquivoOrigem,
        pautas,
        orgao: orgao.value,
        dataSessao: dataSessao.value,
        totalAcordaos: totalAcordaos.value ?? undefined,
      },
    });
    lote.value = null;
    await consultarLote(iniciado.loteId);
    iniciarAcompanhamento(iniciado.loteId);
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    carregando.value = false;
  }
}
</script>

<template>
  <div>
    <h1>Novo envio</h1>

    <p v-if="erroMsg" class="erro">
      {{ erroMsg }}
    </p>

    <section v-if="!analise" class="card">
      <h2>1. Upload do arquivo</h2>
      <p>Envie o CSV exportado do painel (tarefas "Assinar acórdão").</p>
      <div class="campo">
        <input type="file" accept=".csv" @change="selecionarArquivo" />
      </div>
      <p v-if="carregando" class="dica">Analisando arquivo...</p>
      <p v-else class="dica">
        A análise do arquivo é iniciada automaticamente ao selecioná-lo.
      </p>
    </section>

    <section v-else class="card">
      <h2>2. Identificação das pautas</h2>
      <p>
        Informe o rótulo da pauta para cada "Desde" identificado (arquivo:
        <strong>{{ analise.arquivoOrigem }}</strong
        >, {{ analise.totalAcordaos }} acórdãos).
      </p>

      <div class="pautas">
        <div v-for="desde in analise.desdes" :key="desde" class="campo">
          <label :for="`pauta-${desde}`">{{ desde }}</label>
          <input
            :id="`pauta-${desde}`"
            v-model="pautas[desde]"
            placeholder="Ex.: Pauta 13:05 (Sala com 98)"
          />
        </div>
      </div>

      <div class="duas-colunas">
        <div class="campo">
          <label for="orgao">Órgão colegiado</label>
          <input id="orgao" v-model="orgao" placeholder="Ex.: 1ª Turma" />
        </div>
        <div class="campo">
          <label for="sessao">Data da sessão</label>
          <input
            id="sessao"
            v-model="dataSessao"
            placeholder="Ex.: 05/08/2026"
          />
        </div>
      </div>

      <div class="campo">
        <label for="total">Total de acórdãos (validação)</label>
        <input id="total" v-model.number="totalAcordaos" type="number" />
      </div>

      <button
        class="btn"
        :disabled="carregando || processando || !podeEnviar"
        @click="enviar"
      >
        {{ carregando ? 'Enviando...' : 'Separar e enviar e-mails' }}
      </button>
      <p v-if="!podeEnviar && !carregando && !processando" class="dica">
        Preencha o rótulo de todas as pautas, o órgão e a data da sessão para
        habilitar o envio.
      </p>
      <button
        class="btn btn-secundario"
        :disabled="carregando || processando"
        style="margin-left: 0.5rem"
        @click="analise = null"
      >
        Trocar arquivo
      </button>
    </section>

    <section v-if="lote" class="card">
      <h2>3. Acompanhamento</h2>

      <div v-if="processando" class="progresso">
        <div class="barra-progresso">
          <div
            class="barra-preenchimento"
            :style="{ width: percentual + '%' }"
          />
        </div>
        <p class="progresso-texto">
          <template v-if="lote.totalEnvios">
            {{ progresso.enviados }} de {{ progresso.total }} e-mails enviados
            ({{ percentual }}%) · {{ formatoTempo(segundosDecorridos) }}
          </template>
          <template v-else>
            Separando as tarefas por pauta... ·
            {{ formatoTempo(segundosDecorridos) }}
          </template>
        </p>
      </div>

      <p
        v-else-if="lote.status === 'processado' && !concluidoComFalhas"
        class="sucesso"
      >
        Envio concluído: {{ progresso.enviados }}/{{ progresso.total }}
        e-mails enviados com sucesso · {{ formatoTempo(segundosDecorridos) }}.
      </p>
      <p v-else-if="concluidoComFalhas" class="erro">
        Envio concluído com falhas: {{ progresso.enviados }}/{{
          progresso.total
        }}
        enviados.
      </p>
      <p v-else-if="lote.status === 'falhou'" class="erro">
        Falha no processamento: {{ lote.erro }}
      </p>

      <ul v-if="enviosOrdenados.length" class="lista-envios">
        <li
          v-for="(envio, indice) in enviosOrdenados"
          :key="envio.id"
          class="item-envio"
        >
          <span class="envio-nome">{{ envio.responsavel.nome }}</span>
          <span class="estampa" :class="`estampa-${envio.status}`">
            {{ rotuloStatus(envio.status, processando && indice === primeiroPendente) }}
          </span>
        </li>
      </ul>

      <p v-if="!processando">
        <NuxtLink :to="`/lote/${lote.id}`">Ver detalhes do lote</NuxtLink>
      </p>
    </section>
  </div>
</template>

<style scoped>
.pautas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.dica {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: var(--c-texto-suave, #888);
}

.duas-colunas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.progresso {
  margin-bottom: 1rem;
}

.barra-progresso {
  height: 10px;
  border-radius: 6px;
  background: #e2e4e8;
  overflow: hidden;
}

.barra-preenchimento {
  height: 100%;
  border-radius: 6px;
  background: #2f7d32;
  transition: width 0.5s ease;
}

.progresso-texto {
  margin-top: 0.4rem;
  font-size: 0.9rem;
}

.lista-envios {
  list-style: none;
  margin: 0.75rem 0 0;
  padding: 0;
  display: grid;
  gap: 0.35rem;
}

.item-envio {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
  border-bottom: 1px solid #eee;
}

.envio-nome {
  font-size: 0.9rem;
}

.estampa {
  font-size: 0.8rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
}

.estampa-enviado {
  background: #e3f2e4;
  color: #2f7d32;
}

.estampa-pendente {
  background: #f1f2f4;
  color: #666;
}

.estampa-falhou {
  background: #fde8e8;
  color: #b3261e;
}
</style>
