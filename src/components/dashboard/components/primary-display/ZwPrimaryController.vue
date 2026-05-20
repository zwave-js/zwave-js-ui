<template>
	<div class="zw-pv-controller">
		<div class="zw-pv-controller__node">
			{{ device.firmware?.node ?? '—' }}
		</div>
		<div v-if="device.firmware?.sdk" class="zw-pv-controller__sdk">
			SDK {{ device.firmware.sdk }}
		</div>
	</div>
</template>

<script setup lang="ts">
import type { Device } from '@/lib/dashboard-types'

defineProps<{ device: Device; compact?: boolean }>()
</script>

<style scoped>
.zw-pv-controller {
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.zw-pv-controller__node {
	font-size: 24px;
	font-weight: 600;
	color: var(--zw-fg);
}

.zw-pv-controller__sdk {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}
</style>
