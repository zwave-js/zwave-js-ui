<template>
	<div class="zw-empty">
		<slot>{{ message }}</slot>
	</div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ message?: string }>(), {
	message: 'No devices match the current filters.',
})
</script>

<style scoped>
.zw-empty {
	padding: 48px;
	text-align: center;
	color: var(--zw-fg-soft);
	font-size: 13px;
}
</style>
