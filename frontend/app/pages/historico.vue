<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import { formatarData } from '~/utils/format';
import type { LoteResumo } from '~/types';

definePageMeta({ title: 'Histórico', middleware: 'auth' });

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

    <p v-if="erroMsg" class="erro" role="alert">
      {{ erroMsg }}
    </p>

    <section class="card">
      <p v-if="lotes.length === 0" class="estado-vazio">
        Nenhum envio registrado ainda.
      </p>
      <div v-else class="tabela-responsiva">
        <table class="tabela tabela--cartoes">
          <thead>
            <tr>
              <th>Data</th>
              <th>Órgão / Sessão</th>
              <th>Etiqueta(s)</th>
              <th>Enviados</th>
              <th>Status</th>
              <th>Usuário</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="lote in lotes"
              :key="lote.id"
              :class="{
                'linha-confirmada':
                  lote.confirmados > 0 &&
                  lote.confirmados === lote.totalEnvios,
              }"
            >
              <td data-label="Data">
                <NuxtLink
                  :to="`/lote/${lote.id}`"
                  :aria-label="`Abrir detalhes do lote de ${formatarData(lote.criadoEm)}`"
                >
                  {{ formatarData(lote.criadoEm) }}
                </NuxtLink>
              </td>
              <td data-label="Órgão / Sessão">
                {{ lote.orgao || '-' }} /
                {{ lote.dataSessao || '-' }}
              </td>
              <td data-label="Etiqueta(s)">
                {{ lote.etiquetas }}
              </td>
              <td data-label="Enviados">
                {{ lote.enviados }}/{{ lote.totalEnvios }}
                <span v-if="lote.falhas">({{ lote.falhas }} falhas)</span>
              </td>
              <td data-label="Status">
                <TagStatus :status="lote.status" />
              </td>
              <td data-label="Usuário">
                {{ lote.usuario }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
