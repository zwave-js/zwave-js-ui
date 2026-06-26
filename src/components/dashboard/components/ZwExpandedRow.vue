<template>
	<div class="zw-expanded-row">
		<ZwNodeDetailsBody
			:device="device"
			@action="(d, a) => emit('action', d, a)"
		/>
	</div>
</template>

<script setup lang="ts">
import ZwNodeDetailsBody from './ZwNodeDetailsBody.vue'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()
</script>

<style scoped>
.zw-expanded-row {
	background: var(--zw-bg);
	border-bottom: 1px solid var(--zw-line);
	padding: 12px 16px;
}

/* Cap and center the details so they read as a contained panel rather than
   stretching across the full table. */
.zw-expanded-row :deep(.zw-nd) {
	max-width: 820px;
	margin-inline: auto;
	border: 1px solid var(--zw-line);
	border-radius: 8px;
	overflow: hidden;
}
</style>
