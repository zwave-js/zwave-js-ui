<template>
	<nav class="zw-rail">
		<div v-if="title" class="zw-rail__title">{{ title }}</div>
		<div v-for="(s, i) in steps" :key="i" class="zw-rail__step">
			<div class="zw-rail__marks">
				<span class="zw-rail__num" :class="markClass(i)">
					<CheckIcon v-if="i < current" :size="ICON_SIZE.chip" />
					<template v-else>{{ i + 1 }}</template>
				</span>
				<span
					v-if="i < steps.length - 1"
					class="zw-rail__line"
					:class="{ 'zw-rail__line--done': i < current }"
				/>
			</div>
			<div class="zw-rail__label" :class="labelClass(i)">
				{{ s }}
			</div>
		</div>
	</nav>
</template>

<script setup lang="ts">
import { CheckIcon, ICON_SIZE } from '@/lib/icons'

const props = defineProps<{
	title?: string
	steps: string[]
	current: number
}>()

function markClass(i: number) {
	if (i < props.current) return 'zw-rail__num--done'
	if (i === props.current) return 'zw-rail__num--active'
	return 'zw-rail__num--todo'
}
function labelClass(i: number) {
	if (i < props.current) return 'zw-rail__label--done'
	if (i === props.current) return 'zw-rail__label--active'
	return 'zw-rail__label--todo'
}
</script>

<style scoped>
.zw-rail {
	width: 210px;
	flex-shrink: 0;
	background: var(--zw-bg-soft);
	border-right: 1px solid var(--zw-line-soft);
	padding: var(--zw-dlg-pad-top) var(--zw-dlg-pad-x);
}

.zw-rail__title {
	font: var(--zw-text-overline);
	letter-spacing: 1.2px;
	color: var(--zw-accent);
	text-transform: uppercase;
	margin-bottom: 18px;
}

.zw-rail__step {
	display: flex;
	gap: 12px;
}

.zw-rail__marks {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.zw-rail__num {
	width: 22px;
	height: 22px;
	border-radius: var(--zw-radius-pill);
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font: var(--zw-text-caption);
	font-weight: 600;
}

.zw-rail__num--done {
	background: rgba(var(--v0-success), 0.12);
	color: var(--zw-ok);
}

.zw-rail__num--active {
	background: var(--zw-accent);
	color: var(--zw-on-accent);
}

.zw-rail__num--todo {
	background: var(--zw-chip-bg);
	color: var(--zw-muted);
}

.zw-rail__line {
	width: 2px;
	flex: 1;
	min-height: 22px;
	background: var(--zw-line);
	margin: 4px 0;
}

.zw-rail__line--done {
	background: rgba(var(--v0-success), 0.12);
}

.zw-rail__label {
	font: var(--zw-text-body);
	line-height: 1.3;
	padding-top: 1px;
	padding-bottom: 16px;
}

.zw-rail__step:last-child .zw-rail__label {
	padding-bottom: 0;
}

.zw-rail__label--done {
	color: var(--zw-fg-soft);
}

.zw-rail__label--active {
	color: var(--zw-fg);
	font-weight: 600;
}

.zw-rail__label--todo {
	color: var(--zw-muted);
}
</style>
