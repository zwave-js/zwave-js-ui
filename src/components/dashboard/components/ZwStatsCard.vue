<template>
	<section class="zw-sc">
		<div class="zw-sc__header">
			<span class="zw-sc__title">{{ title }}</span>
			<span v-if="hint" class="zw-sc__hint">{{ hint }}</span>
		</div>
		<div class="zw-sc__body">
			<div
				v-for="(item, i) in items"
				:key="item.label"
				class="zw-sc__row"
				:class="{ 'zw-sc__row--first': i === 0 }"
			>
				<span class="zw-sc__label">{{ item.label }}</span>
				<span
					class="zw-sc__value"
					:class="{ 'zw-sc__value--muted': isMuted(item) }"
				>
					{{ formatValue(item) }}
				</span>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
export type StatsItem = {
	label: string
	value: number | string
}

defineProps<{
	title: string
	hint?: string
	items: StatsItem[]
}>()

function isMuted(item: StatsItem) {
	return typeof item.value === 'number' && item.value === 0
}

function formatValue(item: StatsItem) {
	if (typeof item.value === 'number') {
		return item.value === 0 ? '—' : item.value.toLocaleString()
	}
	return item.value
}
</script>

<style scoped>
.zw-sc {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.zw-sc__header {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	padding: 8px 12px;
	border-bottom: 1px solid var(--zw-line);
}

.zw-sc__title {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-sc__hint {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-sc__body {
	display: flex;
	flex-direction: column;
}

.zw-sc__row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 7px 12px;
	border-top: 1px solid var(--zw-line);
}

.zw-sc__row--first {
	border-top: none;
}

.zw-sc__label {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-sc__value {
	font-family: var(--zw-mono);
	font-size: 14px;
	font-weight: 500;
	color: var(--zw-fg);
	font-variant-numeric: tabular-nums;
}

.zw-sc__value--muted {
	color: var(--zw-muted);
}
</style>
