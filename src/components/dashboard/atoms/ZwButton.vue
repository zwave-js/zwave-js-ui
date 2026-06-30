<template>
	<Button.Root
		class="zw-btn zw-focus-ring"
		:class="[`zw-btn--${variant}`, `zw-btn--${size}`]"
		:disabled="disabled"
		@click="emit('click', $event)"
	>
		<span v-if="$slots.icon" class="zw-btn__icon">
			<slot name="icon" />
		</span>
		<slot />
	</Button.Root>
</template>

<script setup lang="ts">
import { Button } from '@vuetify/v0'

type Variant = 'primary' | 'outline' | 'destructive' | 'ghost' | 'mono-outline'

withDefaults(
	defineProps<{
		variant?: Variant
		size?: 'sm' | 'md'
		disabled?: boolean
	}>(),
	{ variant: 'primary', size: 'md', disabled: false },
)

const emit = defineEmits<{ click: [MouseEvent] }>()
</script>

<style>
.zw-btn {
	appearance: none;
	cursor: pointer;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	background: var(--btn-bg);
	color: var(--btn-color);
	border: 1px solid var(--btn-border, transparent);
	box-shadow: var(--btn-shadow, none);
	font-family: var(--zw-font);
	font-weight: 600;
	letter-spacing: 0.4px;
	text-transform: uppercase;
	border-radius: 6px;
	transition:
		background 0.12s,
		border-color 0.12s,
		color 0.12s,
		box-shadow 0.12s;
	white-space: nowrap;
}

.zw-btn[data-disabled='true'] {
	opacity: 0.5;
	pointer-events: none;
}

.zw-btn:hover:not([data-disabled='true']) {
	background: var(--btn-bg-hover, var(--btn-bg));
}

.zw-btn--md {
	padding: 7px 14px;
	font-size: 12px;
}

.zw-btn--sm {
	padding: 5px 10px;
	font-size: 11px;
}

.zw-btn__icon {
	display: inline-flex;
	align-items: center;
}

.zw-btn--primary {
	--btn-bg: var(--zw-accent);
	--btn-bg-hover: var(--zw-accent-dark);
	--btn-color: rgb(var(--v0-on-primary));
	--btn-shadow: 0 1px 2px rgba(var(--v0-primary), 0.3);
}

.zw-btn--outline {
	--btn-bg: var(--zw-card);
	--btn-bg-hover: var(--zw-bg-soft);
	--btn-color: rgba(var(--v0-on-surface), 0.78);
	--btn-border: var(--zw-line);
}

.zw-btn--destructive {
	--btn-bg: var(--zw-danger-soft);
	--btn-bg-hover: rgba(var(--v0-danger-soft), 0.7);
	--btn-color: rgb(var(--v0-error-darken-1));
	--btn-border: rgba(var(--v0-error), 0.3);
}

.zw-btn--ghost {
	--btn-bg: transparent;
	--btn-bg-hover: rgba(var(--v0-on-surface), 0.04);
	--btn-color: var(--zw-fg-soft);
	text-transform: none;
	letter-spacing: 0;
	font-weight: 500;
}

/* node-details Advanced tab grid — mono caps on an outlined chip. */
.zw-btn--mono-outline {
	--btn-bg: var(--zw-card);
	--btn-bg-hover: var(--zw-bg-soft);
	--btn-color: var(--zw-fg);
	--btn-border: var(--zw-line);
	font: var(--zw-text-mono-small);
	letter-spacing: 0.4px;
}
</style>
