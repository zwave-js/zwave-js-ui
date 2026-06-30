<template>
	<div class="zw-search">
		<SearchIcon class="zw-search__icon" :size="ICON_SIZE.inline" />
		<input
			type="search"
			class="zw-search__input"
			:value="modelValue"
			:placeholder="placeholder"
			:aria-label="ariaLabel"
			@input="onInput"
		/>
	</div>
</template>

<script setup lang="ts">
import { ICON_SIZE, SearchIcon } from '@/lib/icons'

// Locale-agnostic: callers pass already-translated `placeholder` and
// `ariaLabel`.
defineProps<{
	modelValue: string
	placeholder: string
	ariaLabel: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string] }>()

function onInput(e: Event) {
	emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.zw-search {
	position: relative;
	display: inline-flex;
	width: 100%;
}

.zw-search__icon {
	position: absolute;
	left: 12px;
	top: 50%;
	transform: translateY(-50%);
	color: var(--zw-fg-soft);
	pointer-events: none;
}

.zw-search__input {
	width: 100%;
	appearance: none;
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	padding: 7px 12px 7px 34px;
	font-family: inherit;
	font-size: 13px;
	background: var(--zw-bg-soft);
	color: var(--zw-fg);
	outline: none;
	transition:
		border-color 0.12s,
		background 0.12s;
}

.zw-search__input::placeholder {
	color: var(--zw-fg-soft);
}

.zw-search__input:focus,
.zw-search__input:focus-visible {
	border-color: var(--zw-accent);
	background: var(--zw-card);
}

/* Hide the native cancel-search button which clashes with the design. */
.zw-search__input::-webkit-search-cancel-button {
	appearance: none;
}
</style>
