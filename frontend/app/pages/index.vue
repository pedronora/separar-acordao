<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import type {
  ArquivoAnalise,
  EnvioDetalhe,
  EnvioIniciado,
  LoteDetalhe,
} from '~/types';

definePageMeta({ title: 'Novo envio', middleware: 'auth' });

const analises = ref<ArquivoAnalise[]>([]);
const etiquetas = reactive<Record<number, string>>({});
const pautasPorArquivo = reactive<
  Record<number, Record<string, string>>
>({});
const orgao = ref('');
const dataSessao = ref('');
const totalAcordaos = ref<number | null>(null);

const lote = ref<LoteDetalhe | null>(null);
const carregandoAnalise = ref(false);
const carregandoEnvio = ref(false);
const erroMsg = ref('');

let intervalo: ReturnType<typeof setInterval> | null =
  null;
const inicioAcompanhamento = ref(0);
const segundosDecorridos = ref(0);

const processando = computed(
  () => lote.value?.status === 'processando'
);

const podeEnviar = computed(() => {
  if (analises.value.length === 0) {
    return false;
  }
  for (let i = 0; i < analises.value.length; i++) {
    if (!String(etiquetas[i] ?? '').trim()) {
      return false;
    }
    const desde = analises.value[i]?.desdes ?? [];
    for (const d of desde) {
      if (!String(pautasPorArquivo[i]?.[d] ?? '').trim()) {
        return false;
      }
    }
  }
  return (
    orgao.value.trim() !== '' &&
    dataSessao.value.trim() !== ''
  );
});

const progresso = computed(() => {
  if (!lote.value) {
    return { enviados: 0, total: 0, restantes: 0 };
  }
  const enviados = lote.value.envios.filter(
    (e: EnvioDetalhe) => e.status === 'enviado'
  ).length;
  const total =
    lote.value.totalEnvios ?? lote.value.envios.length;
  return {
    enviados,
    total,
    restantes: total - enviados,
  };
});

const percentual = computed(() => {
  if (progresso.value.total === 0) {
    return 0;
  }
  return Math.min(
    100,
    Math.round(
      (progresso.value.enviados /
        progresso.value.total) *
        100
    )
  );
});

const ordemStatus = [
  'enviado',
  'pendente',
  'falhou',
] as const;

function rotuloStatus(
  status: EnvioDetalhe['status'],
  emEnvio = false
) {
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
      ordemStatus.indexOf(a.status) -
      ordemStatus.indexOf(b.status)
  );
});

const primeiroPendente = computed(() =>
  enviosOrdenados.value.findIndex(
    (e: EnvioDetalhe) => e.status === 'pendente'
  )
);

function formatoTempo(segundos: number) {
  const mm = Math.floor(segundos / 60)
    .toString()
    .padStart(2, '0');
  const ss = (segundos % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
}

const concluidoComFalhas = computed(
  () =>
    lote.value?.status === 'processado' &&
    lote.value.envios.some(
      (e: EnvioDetalhe) => e.status === 'falhou'
    )
);

async function consultarLote(id: string) {
  try {
    lote.value = await useApi<LoteDetalhe>(
      `/api/lotes/${id}`
    );
  } catch {
    // erro temporário; mantém estado atual
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
  (status: LoteDetalhe['status'] | undefined) => {
    if (status && status !== 'processando') {
      pararAcompanhamento();
    }
  }
);

onUnmounted(pararAcompanhamento);

async function adicionarArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement;
  const file = alvo.files?.[0];
  if (!file) {
    return;
  }
  alvo.value = '';

  carregandoAnalise.value = true;
  erroMsg.value = '';
  try {
    const form = new FormData();
    form.append('file', file);
    const resultado =
      await useApi<ArquivoAnalise>(
        '/api/processar/analisar',
        { method: 'POST', body: form }
      );
    const idx = analises.value.length;
    analises.value.push({
      ...resultado,
      etiqueta: '',
    });
    etiquetas[idx] = '';
    pautasPorArquivo[idx] = {};
    totalAcordaos.value =
      (totalAcordaos.value ?? 0) +
      resultado.totalAcordaos;
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    carregandoAnalise.value = false;
  }
}

function removerArquivo(indice: number) {
  analises.value.splice(indice, 1);
  const novasEtiquetas: Record<number, string> = {};
  const novasPautas: Record<
    number,
    Record<string, string>
  > = {};
  for (
    let i = 0;
    i < analises.value.length;
    i++
  ) {
    const antigo = i >= indice ? i + 1 : i;
    novasEtiquetas[i] = etiquetas[antigo] ?? '';
    novasPautas[i] = pautasPorArquivo[antigo] ?? {};
  }
  for (const chave of Object.keys(etiquetas)) {
    const n = Number(chave);
    etiquetas[n] = novasEtiquetas[n] ?? '';
  }
  for (const chave of Object.keys(
    pautasPorArquivo
  )) {
    const n = Number(chave);
    pautasPorArquivo[n] = novasPautas[n] ?? {};
  }
  totalAcordaos.value =
    analises.value.reduce(
      (s, a) => s + a.totalAcordaos,
      0
    ) || null;
}

async function enviar() {
  if (!podeEnviar.value) {
    return;
  }
  carregandoEnvio.value = true;
  erroMsg.value = '';
  try {
    const arquivos = analises.value.map((a, i) => ({
      token: a.token,
      arquivoOrigem: a.arquivoOrigem,
      etiqueta: etiquetas[i],
      pautas: pautasPorArquivo[i],
      totalAcordaos: a.totalAcordaos,
    }));
    const iniciado =
      await useApi<EnvioIniciado>(
        '/api/processar/enviar',
        {
          method: 'POST',
          body: {
            arquivos,
            orgao: orgao.value,
            dataSessao: dataSessao.value,
            totalAcordaos:
              totalAcordaos.value ?? undefined,
          },
        }
      );
    lote.value = null;
    await consultarLote(iniciado.loteId);
    iniciarAcompanhamento(iniciado.loteId);
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    carregandoEnvio.value = false;
  }
}
</script>

<template>
  <div>
    <h1>Novo envio</h1>

    <p v-if="erroMsg" class="erro">
      {{ erroMsg }}
    </p>

    <section class="card">
      <h2>1. Upload dos arquivos</h2>
      <p>
        Envie um ou mais CSVs exportados do painel
        (tarefas "Assinar acórdão").
      </p>

      <div
        v-for="(analise, i) in analises"
        :key="analise.token"
        class="arquivo-item"
      >
        <div class="arquivo-cabecalho">
          <input
            :value="etiquetas[i]"
            placeholder="Etiqueta (ex.: Acórdãos 1ª Turma)"
            class="input-etiqueta"
            @input="
              etiquetas[i] = (
                $event.target as HTMLInputElement
              ).value
            "
          />
          <span class="tag tag-verde">
            {{ analise.totalAcordaos }} acórdãos
          </span>
          <button
            class="btn btn-perigo btn-pequeno"
            :disabled="carregandoEnvio"
            @click="removerArquivo(i)"
          >
            Remover
          </button>
        </div>
        <p class="dica">{{ analise.arquivoOrigem }}</p>
      </div>

      <div class="campo">
        <input
          type="file"
          accept=".csv"
          :disabled="carregandoAnalise"
          @change="adicionarArquivo"
        />
      </div>
      <p v-if="carregandoAnalise" class="dica">
        Analisando arquivo...
      </p>
      <p v-else-if="analises.length === 0" class="dica">
        Selecione um arquivo para iniciar. Pode adicionar
        mais arquivos depois.
      </p>
    </section>

    <section
      v-if="analises.length > 0"
      class="card"
    >
      <h2>2. Identificação das pautas</h2>

      <div
        v-for="(analise, i) in analises"
        :key="analise.token"
        class="bloco-pauta"
      >
        <h3>
          {{ etiquetas[i] || 'Sem etiqueta' }}
          <span class="arquivo-ref">
            ({{ analise.arquivoOrigem }})
          </span>
        </h3>
        <div class="pautas">
          <div
            v-for="desde in analise.desdes"
            :key="`${i}-${desde}`"
            class="campo"
          >
            <label :for="`pauta-${i}-${desde}`">
              {{ desde }}
            </label>
            <input
              :id="`pauta-${i}-${desde}`"
              :value="
                pautasPorArquivo[i]?.[desde] ?? ''
              "
              placeholder="Ex.: Pauta 13:05 (Sala com 98)"
              @input="
                (pautasPorArquivo[i] ??= {})[desde] = (
                  $event.target as HTMLInputElement
                ).value
              "
            />
          </div>
        </div>
      </div>

      <div class="duas-colunas">
        <div class="campo">
          <label for="orgao">Órgão colegiado</label>
          <input
            id="orgao"
            v-model="orgao"
            placeholder="Ex.: 1ª Turma"
          />
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
        <label for="total"
          >Total de acórdãos (validação)</label
        >
        <input
          id="total"
          v-model.number="totalAcordaos"
          type="number"
        />
      </div>

      <button
        class="btn"
        :disabled="
          carregandoEnvio ||
          processando ||
          !podeEnviar
        "
        @click="enviar"
      >
        {{
          carregandoEnvio
            ? 'Enviando...'
            : 'Separar e enviar e-mails'
        }}
      </button>
      <p
        v-if="
          !podeEnviar &&
          !carregandoEnvio &&
          !processando
        "
        class="dica"
      >
        Preencha a etiqueta de todos os arquivos, o
        rótulo de todas as pautas, o órgão e a data da
        sessão para habilitar o envio.
      </p>
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
            {{ progresso.enviados }} de
            {{ progresso.total }} e-mails enviados ({{
              percentual
            }}%) ·
            {{
              formatoTempo(segundosDecorridos)
            }}
          </template>
          <template v-else>
            Separando as tarefas por pauta... ·
            {{
              formatoTempo(segundosDecorridos)
            }}
          </template>
        </p>
      </div>

      <p
        v-else-if="
          lote.status === 'processado' &&
          !concluidoComFalhas
        "
        class="sucesso"
      >
        Envio concluído:
        {{ progresso.enviados }}/{{
          progresso.total
        }}
        e-mails enviados com sucesso ·
        {{ formatoTempo(segundosDecorridos) }}.
      </p>
      <p v-else-if="concluidoComFalhas" class="erro">
        Envio concluído com falhas:
        {{ progresso.enviados }}/{{
          progresso.total
        }}
        enviados.
      </p>
      <p
        v-else-if="lote.status === 'falhou'"
        class="erro"
      >
        Falha no processamento: {{ lote.erro }}
      </p>

      <ul
        v-if="enviosOrdenados.length"
        class="lista-envios"
      >
        <li
          v-for="(envio, indice) in enviosOrdenados"
          :key="envio.id"
          class="item-envio"
        >
          <span class="envio-nome">{{
            envio.responsavel.nome
          }}</span>
          <span
            class="estampa"
            :class="`estampa-${envio.status}`"
          >
            {{
              rotuloStatus(
                envio.status,
                processando &&
                  indice === primeiroPendente
              )
            }}
          </span>
        </li>
      </ul>

      <p v-if="!processando">
        <NuxtLink :to="`/lote/${lote.id}`"
          >Ver detalhes do lote</NuxtLink
        >
      </p>
    </section>
  </div>
</template>

<style scoped>
.pautas {
  display: grid;
  grid-template-columns: repeat(
    auto-fill,
    minmax(280px, 1fr)
  );
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

.arquivo-item {
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
  background: #fafbfc;
}

.arquivo-cabecalho {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.input-etiqueta {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  font-size: 0.92rem;
}

.btn-pequeno {
  padding: 0.3rem 0.6rem;
  font-size: 0.82rem;
}

.bloco-pauta {
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--cor-borda);
}

.bloco-pauta:last-of-type {
  border-bottom: none;
  margin-bottom: 0.75rem;
  padding-bottom: 0;
}

.bloco-pauta h3 {
  margin-bottom: 0.5rem;
}

.arquivo-ref {
  font-weight: 400;
  font-size: 0.85em;
  color: var(--c-texto-suave, #888);
}
</style>
