<template>
	<span
		class="zw-tx"
		:class="[
			`zw-tx--${variant}`,
			{ 'zw-tx--indeterminate': pct === undefined },
		]"
		:title="title"
	>
		<component :is="iconComp" :size="ICON_SIZE.chip" class="zw-tx__icon" />
		<Progress.Root
			as="span"
			class="zw-tx__bar"
			:model-value="pct ?? 0"
			:min="0"
			:max="100"
		>
			<Progress.Fill as="span" class="zw-tx__fill">
				<span class="zw-tx__shimmer" />
			</Progress.Fill>
		</Progress.Root>
		<span v-if="pct !== undefined" class="zw-tx__pct">{{ pct }}%</span>
	</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Progress } from '@vuetify/v0'
import {
	DownloadIcon,
	RefreshIcon,
	InterviewIcon,
	ICON_SIZE,
} from '@/lib/icons'

type ActivityType = 'ota' | 'rebuild' | 'interview'
interface Activity {
	type: ActivityType
	label: string
	progress?: number
}

const props = withDefaults(
	defineProps<{
		activity: Activity
		variant?: 'table' | 'card'
	}>(),
	{ variant: 'table' },
)

const ACTIVITY_ICON = {
	ota: DownloadIcon,
	rebuild: RefreshIcon,
	interview: InterviewIcon,
} as const

const iconComp = computed(() => ACTIVITY_ICON[props.activity.type])

const pct = computed(() =>
	props.activity.progress !== undefined
		? Math.round(props.activity.progress)
		: undefined,
)

const title = computed(() =>
	pct.value !== undefined
		? `${props.activity.label} · ${pct.value}%`
		: props.activity.label,
)
</script>

<style>
.zw-tx {
	display: inline-flex;
	align-items: center;
	font-family: var(--zw-font);
	color: var(--zw-accent-dark);
}

.zw-tx--table {
	gap: 6px;
}

.zw-tx--card {
	gap: 8px;
	flex: 1;
	min-width: 0;
}

.zw-tx__icon {
	flex: 0 0 auto;
	color: var(--zw-accent);
}

.zw-tx__bar {
	position: relative;
	height: 4px;
	background: rgba(var(--v0-primary), 0.18);
	border-radius: 2px;
	overflow: hidden;
}

/* Indeterminate: hide fill, animate a sweep instead. */
.zw-tx--indeterminate .zw-tx__fill {
	display: none;
}

.zw-tx--indeterminate .zw-tx__bar::after {
	content: '';
	position: absolute;
	inset: 0;
	width: 40%;
	background: var(--zw-accent);
	border-radius: 2px;
	animation: zw-tx-indeterminate 1.2s ease-in-out infinite;
}

@keyframes zw-tx-indeterminate {
	0% {
		transform: translateX(-100%);
	}
	100% {
		transform: translateX(300%);
	}
}

.zw-tx--table .zw-tx__bar {
	width: 36px;
	flex: 0 0 36px;
}

.zw-tx--card .zw-tx__bar {
	flex: 1;
	min-width: 24px;
}

.zw-tx__fill {
	display: block;
	height: 100%;
	background: var(--zw-accent);
	border-radius: 2px;
	transition: width 0.3s;
	position: relative;
}

.zw-tx__shimmer {
	position: absolute;
	inset: 0;
	background: linear-gradient(
		to right,
		transparent 0%,
		rgba(255, 255, 255, 0.25) 50%,
		transparent 100%
	);
	transform: translateX(-100%);
	animation: zw-shimmer 4s linear infinite;
	pointer-events: none;
}

.zw-tx__pct {
	font: var(--zw-text-mono-micro);
	min-width: 26px;
	text-align: right;
	font-variant-numeric: tabular-nums;
}
</style>
