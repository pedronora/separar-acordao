<script setup lang="ts">
const route = useRoute();
const tituloPagina = computed(() => route.meta.title as string | undefined);

useHead({
  title: tituloPagina,
  titleTemplate: (titulo?: string) =>
    titulo ? `${titulo} · Separar Acórdãos` : 'Separar Acórdãos',
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
