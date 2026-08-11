<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import { formatarData } from '~/utils/format';
import type { LoteResumo } from '~/types';

definePageMeta({ middleware: 'auth' });

const lotes = ref<LoteResumo[]>([]);
const carregando = ref(false);
const erroMsg = ref('');

async function listar() {
  carregando.value = true;
  erroMsg.value = '';
  try {
    lotes.value = await useApi<LoteResumo[]>('/api/lotes');
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    carregando.value = false;
  }
}

await listar();
</script>

<template>
  <div>
    <h1>Histórico de envios</h1>

    <p v-if="erroMsg" class="erro">
      {{ erroMsg }}
    </p>

    <section class="card">
      <table class="tabela">
        <thead>
          <tr>
            <th>Data</th>
            <th>Órgão / Sessão</th>
            <th>Arquivo</th>
            <th>Enviados</th>
            <th>Status</th>
            <th>Usuário</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="lote in lotes" :key="lote.id">
            <td>{{ formatarData(lote.criadoEm) }}</td>
            <td>
              {{ lote.orgao || '-' }} /
              {{ lote.dataSessao || '-' }}
            </td>
            <td>
              <NuxtLink :to="`/lote/${lote.id}`">
                {{ lote.arquivoOrigem }}
              </NuxtLink>
            </td>
            <td>
              {{ lote.enviados }}/{{ lote.totalEnvios }}
              <span v-if="lote.falhas">({{ lote.falhas }} falhas)</span>
            </td>
            <td>
              <span
                :class="
                  lote.status === 'processado'
                    ? 'tag tag-verde'
                    : lote.status === 'falhou'
                      ? 'tag tag-vermelha'
                      : 'tag tag-amarela'
                "
              >
                {{ lote.status }}
              </span>
            </td>
            <td>{{ lote.usuario }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
