<template>
	<ZwDialog
		v-bind="dialogProps"
		:title="railLayout ? steps[current] : ''"
		:subtitle="railLayout ? subtitle : ''"
		@update:model-value="(v) => emit('update:modelValue', v)"
		@update:content-width="onContentWidth"
		@after-leave="emit('afterLeave')"
	>
		<!-- Switches between a vertical rail (wide) and a circular progress header (narrow). -->
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
				:title="title"
				:subtitle="subtitle"
				:show-close="dismiss !== 'none'"
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
import { computed, ref } from 'vue'
import ZwDialog from './ZwDialog.vue'
import ZwDialogStepRail from './ZwDialogStepRail.vue'
import ZwDialogStepProgress from './ZwDialogStepProgress.vue'
import { TWO_PANE_BREAKPOINT } from '@/lib/dashboard-breakpoints'
import type {
	DialogAction,
	DialogDismiss,
	DialogSize,
} from '@/lib/dashboard-types'

const props = withDefaults(
	defineProps<{
		modelValue: boolean
		steps: string[]
		current: number
		title: string
		subtitle?: string
		size?: DialogSize
		dismiss?: DialogDismiss
		loading?: boolean
		actions?: DialogAction[]
	}>(),
	{
		subtitle: '',
		size: 'xl',
		dismiss: 'all',
		loading: false,
		actions: () => [],
	},
)

const emit = defineEmits<{
	'update:modelValue': [boolean]
	afterLeave: []
}>()

// Forwarded as a group so the wrapper can't silently shrink ZwDialog's API
const dialogProps = computed(() => ({
	modelValue: props.modelValue,
	size: props.size,
	dismiss: props.dismiss,
	loading: props.loading,
	actions: props.actions,
}))

// Switch on the measured content box rather than the window because
// TWO_PANE_BREAKPOINT is a container width and the dialog is narrower than
// the viewport
const railLayout = ref(true)
function onContentWidth(width: number) {
	railLayout.value = width >= TWO_PANE_BREAKPOINT
}

function requestClose() {
	emit('update:modelValue', false)
}
</script>
