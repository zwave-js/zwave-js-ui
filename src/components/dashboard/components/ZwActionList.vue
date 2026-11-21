<template>
	<div class="zw-al">
		<slot />
	</div>
</template>

<style scoped>
.zw-al {
	background: var(--zw-card);
	border: 1px solid var(--zw-line);
	border-radius: 6px;
	overflow: hidden;
}

.zw-al > :deep(:not(:first-child)) {
	border-top: 1px solid var(--zw-line);
}
</style>
