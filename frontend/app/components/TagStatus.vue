<script setup lang="ts">
import type { StatusEnvio, StatusLote } from '~/types';
import { classeTag, rotuloStatus } from '~/utils/status';

const props = withDefaults(
  defineProps<{
    status: StatusEnvio | StatusLote;
    emEnvio?: boolean;
  }>(),
  { emEnvio: false }
);
</script>

<template>
  <span class="tag" :class="classeTag(props.status)">
    {{ rotuloStatus(props.status, props.emEnvio) }}
  </span>
</template>
