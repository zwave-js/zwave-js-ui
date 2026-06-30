<template>
	<button
		type="button"
		class="zw-ct"
		@click="emit('update:modelValue', !modelValue)"
	>
		<span class="zw-ct__box" :class="{ 'zw-ct__box--on': modelValue }">
			<CheckIcon
				v-if="modelValue"
				:size="ICON_SIZE.pill"
				class="zw-ct__check"
			/>
		</span>
		<span class="zw-ct__label">{{ label }}</span>
	</button>
</template>

<script setup lang="ts">
import { CheckIcon, ICON_SIZE } from '@/lib/icons'

defineProps<{
	modelValue: boolean
	label: string
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<style scoped>
.zw-ct {
	appearance: none;
	border: none;
	background: transparent;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	gap: 7px;
	padding: 0;
	color: var(--zw-fg);
	font: inherit;
}

.zw-ct__box {
	width: 16px;
	height: 16px;
	border-radius: 4px;
	flex: 0 0 16px;
	border: 1.5px solid rgba(0, 0, 0, 0.3);
	background: transparent;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	transition:
		background 0.12s,
		border-color 0.12s;
}

.zw-ct__box--on {
	background: var(--zw-accent);
	border-color: var(--zw-accent);
}

.zw-ct__check {
	color: #fff;
}

.zw-ct__label {
	font-size: 12px;
}
</style>
