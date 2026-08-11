<script setup lang="ts">
import { useAuth } from '~/composables/useAuth';
import { mensagemDeErro } from '~/composables/useApi';

const { login } = useAuth();
const router = useRouter();

const email = ref('');
const senha = ref('');
const enviando = ref(false);
const erroMsg = ref('');

async function entrar() {
  enviando.value = true;
  erroMsg.value = '';
  try {
    await login(email.value, senha.value);
    await router.push('/');
  } catch (erro) {
    erroMsg.value = mensagemDeErro(erro);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="card login-card">
      <h1>Separar Acórdãos</h1>
      <p class="subtitulo">Acesso restrito ao gabinete</p>
      <p v-if="erroMsg" class="erro">
        {{ erroMsg }}
      </p>
      <form @submit.prevent="entrar">
        <div class="campo">
          <label for="email">E-mail</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            required
          />
        </div>
        <div class="campo">
          <label for="senha">Senha</label>
          <input
            id="senha"
            v-model="senha"
            type="password"
            autocomplete="current-password"
            required
          />
        </div>
        <button class="btn" type="submit" :disabled="enviando">
          {{ enviando ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.subtitulo {
  color: var(--cor-texto-suave);
  margin-top: 0;
}
</style>
