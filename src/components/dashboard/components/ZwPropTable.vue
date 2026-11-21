<template>
	<div v-if="rows.length || title" class="zw-pt">
		<div v-if="title" class="zw-pt__title">{{ title }}</div>
		<div
			v-for="(row, idx) in rows"
			:key="idx"
			class="zw-pt__row"
			:class="{ 'zw-pt__row--last': idx === rows.length - 1 }"
		>
			<span class="zw-pt__label">{{ row[0] }}</span>
			<span class="zw-pt__value">{{ row[1] }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		rows: [string, string | number][]
		title?: string
	}>(),
	{ title: undefined },
)
</script>

<style scoped>
.zw-pt {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.zw-pt__title {
	padding: 6px 10px;
	border-bottom: 1px solid var(--zw-line);
	font-family: var(--zw-mono);
	font-size: 10px;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.4px;
}

.zw-pt__row {
	display: grid;
	grid-template-columns: 110px 1fr;
	gap: 8px;
	padding: 6px 10px;
	border-bottom: 1px solid var(--zw-line);
	font-family: var(--zw-mono);
	font-size: 11px;
}

.zw-pt__row--last {
	border-bottom: none;
}

.zw-pt__label {
	color: var(--zw-muted);
}

.zw-pt__value {
	color: var(--zw-fg);
}
</style>
