<script setup lang="ts">
import { useAuth } from '~/composables/useAuth';
import { mensagemDeErro } from '~/composables/useApi';

definePageMeta({ title: 'Login' });

const { login } = useAuth();
const router = useRouter();

const email = ref('');
const senha = ref('');
const verSenha = ref(false);
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
          <div class="campo-senha">
            <input
              id="senha"
              v-model="senha"
              :type="verSenha ? 'text' : 'password'"
              autocomplete="current-password"
              required
            />
            <button
              type="button"
              class="botao-senha"
              :aria-label="verSenha ? 'Ocultar senha' : 'Mostrar senha'"
              @click="verSenha = !verSenha"
            >
              {{ verSenha ? 'Ocultar' : 'Mostrar' }}
            </button>
          </div>
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
  align-items: flex-start;
  min-height: calc(100vh - 6rem);
  padding-top: 10vh;
}

.login-card {
  width: 100%;
  max-width: 380px;
}

.subtitulo {
  color: var(--cor-texto-suave);
  margin-top: 0;
}

.campo-senha {
  position: relative;
}

.campo-senha input {
  padding-right: 5.2rem;
}

.botao-senha {
  position: absolute;
  right: 0.3rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--cor-primaria);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.35rem 0.5rem;
  border-radius: 4px;
}

.botao-senha:hover {
  background: #eaf2f8;
}
</style>
