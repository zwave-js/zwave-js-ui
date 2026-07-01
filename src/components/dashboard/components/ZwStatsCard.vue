<template>
	<section class="zw-sc" :class="{ 'zw-sc--ledger': layout === 'ledger' }">
		<div class="zw-sc__header">
			<span class="zw-sc__title">{{ title }}</span>
			<span v-if="hint" class="zw-sc__hint">{{ hint }}</span>
		</div>
		<div v-if="layout === 'ledger'" class="zw-sc__ledger">
			<div
				v-for="(item, i) in items"
				:key="item.label"
				class="zw-sc__row"
				:class="{ 'zw-sc__row--first': i === 0 }"
			>
				<span class="zw-sc__row-label">{{ item.label }}</span>
				<span
					class="zw-sc__row-value"
					:class="{ 'zw-sc__row-value--muted': isMuted(item) }"
				>
					{{ formatValue(item) }}
				</span>
			</div>
		</div>
		<div
			v-else
			class="zw-sc__body"
			:style="{
				gridTemplateColumns: `repeat(auto-fit, minmax(${minCellWidth}px, 1fr))`,
			}"
		>
			<div v-for="item in items" :key="item.label" class="zw-sc__cell">
				<div class="zw-sc__label">{{ item.label }}</div>
				<div
					class="zw-sc__value"
					:class="{ 'zw-sc__value--muted': isMuted(item) }"
				>
					{{ formatValue(item) }}
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
export type StatsItem = {
	label: string
	value: number | string
}

withDefaults(
	defineProps<{
		title: string
		hint?: string
		items: StatsItem[]
		layout?: 'grid' | 'ledger'
		minCellWidth?: number
	}>(),
	{ layout: 'grid', minCellWidth: 96 },
)

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

.zw-sc:not(.zw-sc--ledger) {
	padding-bottom: 8px;
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

/* ── Grid layout (default) ── */
.zw-sc__body {
	display: grid;
	gap: 1px;
	background: var(--zw-line);
}

.zw-sc__cell {
	display: flex;
	flex-direction: column;
	gap: 3px;
	padding: 8px 10px;
	background: var(--zw-card);
}

.zw-sc__label {
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.4px;
}

.zw-sc__value {
	font-family: var(--zw-mono);
	font-size: 15px;
	font-weight: 500;
	color: var(--zw-fg);
	font-variant-numeric: tabular-nums;
}

.zw-sc__value--muted {
	color: var(--zw-muted);
}

/* ── Ledger layout ── */
.zw-sc__ledger {
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

.zw-sc__row-label {
	font-family: var(--zw-mono);
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-sc__row-value {
	font-family: var(--zw-mono);
	font-size: 14px;
	font-weight: 500;
	color: var(--zw-fg);
	font-variant-numeric: tabular-nums;
}

.zw-sc__row-value--muted {
	color: var(--zw-muted);
}
</style>
