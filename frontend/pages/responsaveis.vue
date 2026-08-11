<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import type { Responsavel } from '~/types';

definePageMeta({ middleware: 'auth' });

const responsaveis = ref<Responsavel[]>([]);
const carregando = ref(false);
const erroMsg = ref('');
const sucessoMsg = ref('');

const novoNome = ref('');
const novoEmail = ref('');

async function listar() {
  carregando.value = true;
  erroMsg.value = '';
  try {
    responsaveis.value = await useApi<Responsavel[]>('/api/responsaveis');
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    carregando.value = false;
  }
}

async function criar() {
  erroMsg.value = '';
  sucessoMsg.value = '';
  try {
    await useApi<Responsavel>('/api/responsaveis', {
      method: 'POST',
      body: { nome: novoNome.value, email: novoEmail.value },
    });
    novoNome.value = '';
    novoEmail.value = '';
    sucessoMsg.value = 'Responsável cadastrado.';
    await listar();
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

async function alternarAtivo(responsavel: Responsavel) {
  erroMsg.value = '';
  try {
    await useApi<Responsavel>(`/api/responsaveis/${responsavel.id}`, {
      method: 'PATCH',
      body: { ativo: !responsavel.ativo },
    });
    await listar();
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

await listar();
</script>

<template>
  <div>
    <h1>Responsáveis</h1>
    <p>
      Pré-cadastro dos destinatários. O processamento de um lote é rejeitado se
      houver responsável no arquivo não cadastrado aqui.
    </p>

    <p v-if="erroMsg" class="erro">
      {{ erroMsg }}
    </p>
    <p v-if="sucessoMsg" class="sucesso">
      {{ sucessoMsg }}
    </p>

    <section class="card">
      <h2>Novo responsável</h2>
      <div class="duas-colunas">
        <div class="campo">
          <label for="nome">Nome</label>
          <input id="nome" v-model="novoNome" placeholder="Nome completo" />
        </div>
        <div class="campo">
          <label for="email">E-mail</label>
          <input
            id="email"
            v-model="novoEmail"
            type="email"
            placeholder="email@trt12.jus.br"
          />
        </div>
      </div>
      <button class="btn" @click="criar">Cadastrar</button>
    </section>

    <section class="card">
      <h2>Lista</h2>
      <table class="tabela">
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Situação</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in responsaveis" :key="r.id">
            <td>{{ r.nome }}</td>
            <td>{{ r.email }}</td>
            <td>
              <span :class="r.ativo ? 'tag tag-verde' : 'tag tag-vermelha'">
                {{ r.ativo ? 'Ativo' : 'Inativo' }}
              </span>
            </td>
            <td>
              <button class="btn btn-secundario" @click="alternarAtivo(r)">
                {{ r.ativo ? 'Desativar' : 'Ativar' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>

<style scoped>
.duas-colunas {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
</style>
