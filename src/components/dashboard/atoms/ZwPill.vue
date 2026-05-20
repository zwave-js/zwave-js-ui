<template>
	<span class="zw-pill" :class="[`zw-tone-${tone}`, `zw-pill--${size}`]">
		<slot />
	</span>
</template>

<script setup lang="ts">
type PillTone =
	| 'neutral'
	| 'accent'
	| 'ok'
	| 'warn'
	| 'danger'
	| 'info'
	| 'asleep'

withDefaults(
	defineProps<{
		tone?: PillTone
		size?: 'sm' | 'md'
	}>(),
	{ tone: 'neutral', size: 'md' },
)
</script>

<style scoped>
/* Tone background / foreground come from the shared .zw-tone-<name>
   utility in tokens.css; this atom only owns shape and density.
   Type role is Caption (handoff design-system.jsx:51 lists "pills"
   under Caption); the sm variant overrides the size to 10px. */
.zw-pill {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
	background: var(--tone-bg);
	color: var(--tone-fg);
	font: var(--zw-text-caption);
	line-height: 1;
	letter-spacing: 0.1px;
	border-radius: var(--zw-radius-pill);
}

.zw-pill--sm {
	padding: 2px 6px;
	font-size: 10px;
}

.zw-pill--md {
	padding: 3px 8px;
}
</style>
