<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import type { AnalisarResultado, ResultadoEnvio } from '~/types';

definePageMeta({ middleware: 'auth' });

const analise = ref<AnalisarResultado | null>(null);
const resultado = ref<ResultadoEnvio | null>(null);

const arquivo = ref<File | null>(null);
const pautas = reactive<Record<string, string>>({});
const orgao = ref('');
const dataSessao = ref('');
const totalAcordaos = ref<number | null>(null);

const carregando = ref(false);
const erroMsg = ref('');

function selecionarArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement;
  arquivo.value = alvo.files?.[0] ?? null;
  resultado.value = null;
}

async function analisarArquivo() {
  if (!arquivo.value) {
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
    resultado.value = await useApi<ResultadoEnvio>('/api/processar/enviar', {
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
    <p v-if="resultado && !resultado.falhas.length" class="sucesso">
      Envio concluído: {{ resultado.enviados }}/{{ resultado.totalEnvios }}
      e-mails enviados com sucesso.
    </p>
    <p v-if="resultado && resultado.falhas.length" class="erro">
      Envio com falhas para: {{ resultado.falhas.join(', ') }}
    </p>

    <section v-if="!analise" class="card">
      <h2>1. Upload do arquivo</h2>
      <p>Envie o CSV exportado do painel (tarefas "Assinar acórdão").</p>
      <div class="campo">
        <input type="file" accept=".csv" @change="selecionarArquivo" />
      </div>
      <button
        class="btn"
        :disabled="!arquivo || carregando"
        @click="analisarArquivo"
      >
        {{ carregando ? 'Analisando...' : 'Analisar arquivo' }}
      </button>
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

      <button class="btn" :disabled="carregando" @click="enviar">
        {{ carregando ? 'Enviando...' : 'Separar e enviar e-mails' }}
      </button>
      <button
        class="btn btn-secundario"
        :disabled="carregando"
        style="margin-left: 0.5rem"
        @click="analise = null"
      >
        Trocar arquivo
      </button>
    </section>

    <section v-if="resultado" class="card">
      <h2>3. Resultado</h2>
      <p>
        <NuxtLink :to="`/lote/${resultado.loteId}`">
          Ver detalhes do lote
        </NuxtLink>
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

.duas-colunas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
</style>
