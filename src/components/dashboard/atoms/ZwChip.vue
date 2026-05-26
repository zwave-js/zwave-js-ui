<template>
	<span class="zw-chip" :class="`zw-tone-${tone}`">
		<slot />
	</span>
</template>

<script setup lang="ts">
type ChipTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'danger' | 'asleep'

withDefaults(defineProps<{ tone?: ChipTone }>(), { tone: 'neutral' })
</script>

<style scoped>
/* Tone background / foreground come from the shared .zw-tone-<name>
   utility in tokens.css; this atom only owns shape, density, and the
   accent variant's 1-px outline. Type role is Mono Micro. */
.zw-chip {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
	padding: 1px 6px;
	border-radius: 4px;
	background: var(--tone-bg);
	color: var(--tone-fg);
	font: var(--zw-text-mono-micro);
	line-height: 16px;
	letter-spacing: 0.1px;
	text-transform: none;
}

.zw-chip.zw-tone-accent {
	border: 1px solid rgba(var(--v0-primary), 0.3);
}
</style>
