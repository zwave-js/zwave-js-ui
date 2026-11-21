<template>
	<span class="zw-signal-bars" :title="label" role="img" :aria-label="label">
		<span
			v-for="(h, i) in BAR_HEIGHTS"
			:key="i"
			class="zw-signal-bars__bar"
			:class="{
				'zw-signal-bars__bar--filled': i < level,
				'zw-signal-bars__bar--weak': i < level && level <= 1,
			}"
			:style="{ height: h + 'px' }"
		/>
	</span>
</template>

<script setup lang="ts">
defineProps<{
	level: 0 | 1 | 2 | 3 | 4
	label?: string
}>()

const BAR_HEIGHTS = [5, 7, 9, 11]
</script>

<style scoped>
.zw-signal-bars {
	display: inline-flex;
	align-items: flex-end;
	gap: 2px;
	height: 12px;
}

.zw-signal-bars__bar {
	width: 2px;
	border-radius: 1px;
	background: var(--zw-line);
}

.zw-signal-bars__bar--filled {
	background: var(--zw-fg-soft);
}

.zw-signal-bars__bar--weak {
	background: var(--zw-warning);
}
</style>
