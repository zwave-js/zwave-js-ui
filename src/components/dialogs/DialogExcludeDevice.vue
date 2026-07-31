<template>
	<ZwDialog
		:model-value="modelValue"
		size="md"
		severity="warning"
		:icon="TrashIcon"
		title="Exclude Device"
		:persistent="running"
		:actions="dialogActions"
		@update:model-value="onModel"
		@after-leave="reset"
	>
		<div class="zw-exclude">
			<template v-if="removed">
				<span class="zw-exclude__chip zw-tone-ok">
					<CheckIcon :size="ICON_SIZE.drawerHeader" />
				</span>
				<p class="zw-exclude__title">Node {{ removed.id }} removed</p>
				<p class="zw-exclude__sub">
					The device was excluded from the network.
				</p>
			</template>
			<template v-else-if="stopped">
				<span class="zw-exclude__chip zw-tone-warn">
					<AlertIcon :size="ICON_SIZE.drawerHeader" />
				</span>
				<p class="zw-exclude__title">No device excluded</p>
				<p class="zw-exclude__sub">
					Exclusion ended before a device was removed.
				</p>
			</template>
			<template v-else>
				<v-progress-circular
					indeterminate
					color="error"
					:size="48"
					:width="4"
				/>
				<p class="zw-exclude__title">Exclusion started</p>
				<p class="zw-exclude__sub">
					Put the device you want to remove into exclusion mode now.
				</p>
			</template>
		</div>
	</ZwDialog>
</template>

<script>
import { mapState } from 'pinia'
import useBaseStore from '../../stores/base.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import ZwDialog from '@/components/dashboard/dialogs/ZwDialog.vue'
import { AlertIcon, CheckIcon, ICON_SIZE, TrashIcon } from '@/lib/icons'
import { confirmAction } from '@/lib/dashboard-types'

// Wait for a trailing nodeRemoved because it can lag the "stopped" status
const SETTLE_MS = 3000

export default {
	name: 'DialogExcludeDevice',
	components: { ZwDialog, AlertIcon, CheckIcon },
	mixins: [InstancesMixin],
	emits: ['update:modelValue', 'close'],
	props: {
		modelValue: Boolean,
		socket: Object,
	},
	data() {
		return {
			phase: 'running',
			removed: null,
			settleTimer: null,
			TrashIcon,
			ICON_SIZE,
		}
	},
	computed: {
		...mapState(useBaseStore, ['appInfo']),
		controllerStatus() {
			return this.appInfo?.controllerStatus?.status
		},
		running() {
			return this.phase === 'running' || this.phase === 'stopping'
		},
		stopped() {
			return this.phase === 'stopped'
		},
		dialogActions() {
			if (this.phase === 'stopping') {
				return [
					confirmAction('Stopping…', undefined, {
						tone: 'danger',
						disabled: true,
					}),
				]
			}
			if (this.phase === 'running') {
				return [confirmAction('Stop', this.stop, { tone: 'danger' })]
			}
			return [confirmAction('Close', this.close)]
		},
	},
	watch: {
		modelValue(v) {
			if (v) this.begin()
		},
		controllerStatus(status) {
			if (
				!status ||
				(this.phase !== 'running' && this.phase !== 'stopping') ||
				this.removed
			)
				return
			if (/exclusion/i.test(status) && /stopped/i.test(status)) {
				this.settle()
			}
		},
	},
	methods: {
		begin() {
			this.phase = 'running'
			this.removed = null
			this.subscribeChannels(['nodes'])
			this.bindEvent('nodeRemoved', this.onNodeRemoved.bind(this))
			this.app.apiRequest('startExclusion', [], {
				infoSnack: true,
				errorSnack: true,
			})
		},
		onNodeRemoved(node) {
			this.clearSettle()
			this.removed = node
			this.phase = 'removed'
		},
		async stop() {
			this.phase = 'stopping'
			await this.app.apiRequest('stopExclusion', [], {
				infoSnack: false,
				errorSnack: true,
			})
			this.settle()
		},
		settle() {
			this.clearSettle()
			this.settleTimer = setTimeout(() => {
				if (!this.removed) this.phase = 'stopped'
			}, SETTLE_MS)
		},
		clearSettle() {
			if (this.settleTimer) {
				clearTimeout(this.settleTimer)
				this.settleTimer = null
			}
		},
		onModel(v) {
			if (!v) this.close()
		},
		close() {
			this.$emit('update:modelValue', false)
			this.$emit('close')
		},
		reset() {
			if (this.phase === 'running') {
				this.app.apiRequest('stopExclusion', [], {
					infoSnack: false,
					errorSnack: false,
				})
			}
			this.clearSettle()
			this.unbindEvents()
			this.phase = 'running'
			this.removed = null
		},
	},
	beforeUnmount() {
		this.reset()
	},
}
</script>

<style scoped>
.zw-exclude {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	gap: 4px;
	padding: 18px 8px 10px;
}

.zw-exclude__chip {
	width: 48px;
	height: 48px;
	border-radius: var(--zw-radius-lg);
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: var(--tone-bg);
	color: var(--tone-fg);
	margin-bottom: 6px;
}

.zw-exclude__title {
	margin: 8px 0 0;
	font: var(--zw-text-h-m);
	color: var(--zw-fg);
}

.zw-exclude__sub {
	margin: 0;
	font: var(--zw-text-body);
	color: var(--zw-muted);
	max-width: 340px;
}
</style>
