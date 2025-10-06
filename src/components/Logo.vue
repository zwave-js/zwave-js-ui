<template>
	<v-avatar v-bind="$attrs">
		<img
			src="/logo.svg"
			style="padding: 4px; width: 100%; height: 100%; object-fit: contain"
			alt="Logo"
		/>
	</v-avatar>
</template>

<script>
export default {
	name: 'Logo',
}
</script>
