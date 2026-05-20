<template>
	<div class="zw-sec">
		<div class="zw-sec__header">Security Keys</div>
		<div
			v-for="entry in entries"
			:key="entry.id"
			class="zw-sec__row"
			:class="{ 'zw-sec__row--missing': !entry.granted }"
		>
			<span class="zw-sec__label">{{ entry.label }}</span>
			<span class="zw-sec__state">
				{{ entry.granted ? '✓ granted' : '—' }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Device, SecurityKey } from '@/lib/dashboard-types'

const props = defineProps<{ device: Device }>()

const KEYS: { id: SecurityKey; label: string }[] = [
	{ id: 'S0', label: 'S0 Legacy' },
	{ id: 'S2_UA', label: 'S2 Unauthenticated' },
	{ id: 'S2_A', label: 'S2 Authenticated' },
	{ id: 'S2_AC', label: 'S2 Access Control' },
]

const entries = computed(() =>
	KEYS.map((k) => ({
		...k,
		granted: props.device.securityKeys.includes(k.id),
	})),
)
</script>

<style scoped>
.zw-sec {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.zw-sec__header {
	padding: 6px 10px;
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-sec__row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 5px 10px;
	font-family: var(--zw-mono);
	font-size: 11px;
}

.zw-sec__label {
	color: var(--zw-fg);
}

.zw-sec__state {
	color: #047857;
}

.zw-sec__row--missing {
	opacity: 0.4;
}

.zw-sec__row--missing .zw-sec__state {
	color: var(--zw-muted);
}

.zw-sec__row--missing .zw-sec__label {
	color: var(--zw-muted);
}
</style>
