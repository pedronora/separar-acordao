<script setup lang="ts">
import { mensagemDeErro, useApi } from '~/composables/useApi';
import type { Configuracoes } from '~/types';

definePageMeta({ middleware: 'auth' });

const config = ref<Configuracoes>({ emailPadraoResponsavelInativo: '' });
const salvo = ref(false);
const erroMsg = ref('');

async function carregar() {
  erroMsg.value = '';
  try {
    config.value = await useApi<Configuracoes>('/api/configuracoes');
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

async function salvar() {
  erroMsg.value = '';
  salvo.value = false;
  try {
    const atualizado = await useApi<Configuracoes>(
      '/api/configuracoes/email_padrao_responsavel_inativo',
      {
        method: 'PUT',
        body: { valor: config.value.emailPadraoResponsavelInativo },
      }
    );
    config.value.emailPadraoResponsavelInativo =
      atualizado.emailPadraoResponsavelInativo;
    salvo.value = true;
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  }
}

await carregar();
</script>

<template>
  <div>
    <h1>Configurações</h1>
    <p>
      E-mail padrão usado quando uma tarefa vem para um responsável cadastrado,
      porém inativo. Deixe vazio para que o lote seja rejeitado até que o
      endereço seja configurado.
    </p>

    <p v-if="erroMsg" class="erro">
      {{ erroMsg }}
    </p>
    <p v-if="salvo" class="sucesso">Configuração salva.</p>

    <section class="card">
      <h2>Responsável inativo</h2>
      <div class="campo">
        <label for="email-padrao">E-mail padrão</label>
        <input
          id="email-padrao"
          v-model="config.emailPadraoResponsavelInativo"
          type="email"
          placeholder="padrao@trt12.jus.br"
        />
      </div>
      <button class="btn" @click="salvar">Salvar</button>
    </section>
  </div>
</template>
