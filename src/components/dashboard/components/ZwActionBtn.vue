<template>
	<div class="zw-ab" :class="{ 'zw-ab--danger': tone === 'danger' }">
		<span
			class="zw-ab__icon"
			:class="{ 'zw-ab__icon--danger': tone === 'danger' }"
		>
			<slot name="icon" />
		</span>
		<div class="zw-ab__body">
			<div class="zw-ab__title">{{ title }}</div>
			<div v-if="description" class="zw-ab__desc">{{ description }}</div>
		</div>
		<div class="zw-ab__actions">
			<button
				v-for="(action, i) in actions"
				:key="i"
				type="button"
				class="zw-ab__btn"
				:class="{
					'zw-ab__btn--danger': tone === 'danger',
					'zw-ab__btn--accent': tone === 'accent',
					'zw-ab__btn--done': states[i] === 'done',
					'zw-ab__btn--busy': states[i] === 'busy',
				}"
				:disabled="states[i] !== 'idle'"
				@click="run(i)"
			>
				<RefreshIcon
					v-if="states[i] === 'busy'"
					:size="ICON_SIZE.caret"
					class="zw-ab__spin"
				/>
				<CheckIcon
					v-else-if="states[i] === 'done'"
					:size="ICON_SIZE.caret"
				/>
				{{
					states[i] === 'busy'
						? (action.busyLabel ?? action.label)
						: states[i] === 'done'
							? (action.doneLabel ?? action.label)
							: action.label
				}}
			</button>
		</div>
	</div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { CheckIcon, ICON_SIZE, RefreshIcon } from '@/lib/icons'

export interface ActionDef {
	label: string
	busyLabel?: string
	doneLabel?: string
}

const props = withDefaults(
	defineProps<{
		title: string
		description?: string
		actions: ActionDef[]
		tone?: 'default' | 'accent' | 'danger'
	}>(),
	{ description: undefined, tone: 'default' },
)

const emit = defineEmits<{ run: [index: number] }>()

type BtnState = 'idle' | 'busy' | 'done'
const states = reactive<BtnState[]>(props.actions.map(() => 'idle'))

function run(i: number) {
	if (states[i] !== 'idle') return
	emit('run', i)
	if (props.actions[i].busyLabel) {
		states[i] = 'busy'
		setTimeout(() => {
			states[i] = 'done'
			setTimeout(() => {
				states[i] = 'idle'
			}, 1400)
		}, 1300)
	} else {
		states[i] = 'done'
		setTimeout(() => {
			states[i] = 'idle'
		}, 1400)
	}
}
</script>

<style scoped>
.zw-ab {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 11px 12px;
}

.zw-ab__icon {
	width: 30px;
	height: 30px;
	border-radius: 6px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: var(--zw-chip-bg);
	color: var(--zw-accent);
	flex: 0 0 30px;
}

.zw-ab__icon--danger {
	background: rgba(229, 57, 53, 0.1);
	color: #e53935;
}

.zw-ab__body {
	flex: 1;
	min-width: 0;
}

.zw-ab__title {
	font-size: 12px;
	font-weight: 600;
	color: var(--zw-fg);
}

.zw-ab--danger .zw-ab__title {
	color: #c62828;
}

.zw-ab__desc {
	font-size: 11px;
	color: var(--zw-muted);
	line-height: 1.4;
	text-wrap: pretty;
}

.zw-ab__actions {
	display: flex;
	gap: 6px;
	flex-shrink: 0;
}

.zw-ab__btn {
	appearance: none;
	cursor: pointer;
	padding: 6px 12px;
	border-radius: 5px;
	font: var(--zw-text-caption);
	font-weight: 600;
	letter-spacing: 0.3px;
	min-width: 76px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 5px;
	border: 1px solid var(--zw-line2);
	background: var(--zw-card);
	color: var(--zw-fg);
	transition:
		background 0.15s,
		color 0.15s,
		border-color 0.15s;
}

.zw-ab__btn--accent {
	background: var(--zw-accent);
	color: #fff;
	border-color: transparent;
}

.zw-ab__btn--danger {
	background: transparent;
	color: #c62828;
	border-color: rgba(229, 57, 53, 0.45);
}

.zw-ab__btn--done {
	background: rgba(67, 160, 71, 0.12);
	color: #2e7d32;
	border-color: transparent;
}

.zw-ab__btn--busy {
	opacity: 0.75;
	cursor: default;
}

.zw-ab__spin {
	animation: zw-spin 0.9s linear infinite;
}

@keyframes zw-spin {
	to {
		transform: rotate(360deg);
	}
}
</style>
