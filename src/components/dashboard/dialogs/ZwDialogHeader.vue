<template>
	<div class="zw-dlg__header">
		<div v-if="icon" class="zw-dlg__chip" :class="tone">
			<component :is="icon" :size="ICON_SIZE.topbar" />
		</div>
		<div class="zw-dlg__titles">
			<h2 v-if="title" class="zw-dlg__title">{{ title }}</h2>
			<div v-if="subtitle" class="zw-dlg__subtitle">{{ subtitle }}</div>
		</div>
		<ZwCloseButton v-if="showClose" flush @click="emit('close')" />
	</div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import ZwCloseButton from '@/components/dashboard/atoms/ZwCloseButton.vue'
import { ICON_SIZE } from '@/lib/icons'

// Styles live in ZwDialog's non-scoped block alongside the rest of the chrome
withDefaults(
	defineProps<{
		title?: string
		subtitle?: string
		icon?: Component | null
		tone?: string
		showClose?: boolean
	}>(),
	{
		title: '',
		subtitle: '',
		icon: null,
		tone: '',
		showClose: true,
	},
)

const emit = defineEmits<{ close: [] }>()
</script>
