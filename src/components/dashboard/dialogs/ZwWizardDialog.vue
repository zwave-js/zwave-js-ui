<template>
	<ZwDialog
		:model-value="modelValue"
		:size="size"
		:persistent="persistent"
		:loading="loading"
		:actions="actions"
		:title="railLayout ? steps[current] : ''"
		:subtitle="railLayout ? subtitle : ''"
		@update:model-value="(v) => emit('update:modelValue', v)"
		@close="emit('close')"
		@after-leave="emit('afterLeave')"
	>
		<!-- Wide: vertical rail spanning header+body. Narrow: circular header. -->
		<template v-if="railLayout" #rail>
			<ZwDialogStepRail
				:title="title"
				:steps="steps"
				:current="current"
			/>
		</template>
		<template v-else #header>
			<ZwDialogStepProgress
				:steps="steps"
				:current="current"
				:subtitle="subtitle"
				@close="requestClose"
			/>
		</template>

		<slot />

		<template #footer-left>
			<slot name="footer-left" />
		</template>
	</ZwDialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ZwDialog from './ZwDialog.vue'
import ZwDialogStepRail from './ZwDialogStepRail.vue'
import ZwDialogStepProgress from './ZwDialogStepProgress.vue'
import { TWO_PANE_BREAKPOINT } from '@/lib/dashboard-breakpoints'
import type { DialogAction, DialogSize } from '@/lib/dashboard-types'

withDefaults(
	defineProps<{
		modelValue: boolean
		steps: string[]
		current: number
		title: string
		subtitle?: string
		size?: DialogSize
		persistent?: boolean
		loading?: boolean
		actions?: DialogAction[]
	}>(),
	{
		subtitle: '',
		size: 'xl',
		persistent: false,
		loading: false,
		actions: () => [],
	},
)

const emit = defineEmits<{
	'update:modelValue': [boolean]
	close: []
	afterLeave: []
}>()

// Switch to circular header below the two-pane breakpoint
const mql =
	typeof window !== 'undefined'
		? window.matchMedia(`(min-width: ${TWO_PANE_BREAKPOINT}px)`)
		: null
const railLayout = ref(mql?.matches ?? true)
function onBreakpoint(e: MediaQueryListEvent) {
	railLayout.value = e.matches
}
onMounted(() => mql?.addEventListener('change', onBreakpoint))
onBeforeUnmount(() => mql?.removeEventListener('change', onBreakpoint))

function requestClose() {
	emit('update:modelValue', false)
	emit('close')
}
</script>
