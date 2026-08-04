<template>
	<ZwDialog
		:model-value="modelValue"
		size="md"
		severity="warning"
		:icon="TrashIcon"
		title="Exclude Device"
		:dismiss="busy ? 'button' : 'all'"
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
			<template v-else-if="phase === 'stopped'">
				<span class="zw-exclude__chip zw-tone-warn">
					<AlertIcon :size="ICON_SIZE.drawerHeader" />
				</span>
				<p class="zw-exclude__title">No device excluded</p>
				<p class="zw-exclude__sub">
					Exclusion ended before a device was removed.
				</p>
			</template>
			<template v-else>
				<ZwSpinner
					tone="danger"
					:size="48"
					label="Waiting for a device to exclude"
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
import ZwSpinner from '@/components/dashboard/atoms/ZwSpinner.vue'
import { AlertIcon, CheckIcon, ICON_SIZE, TrashIcon } from '@/lib/icons'
import { confirmAction, pendingAction } from '@/lib/dashboard-types'

// Wait for a trailing nodeRemoved because it can lag the "stopped" status
const SETTLE_MS = 3000

export default {
	name: 'DialogExcludeDevice',
	components: { ZwDialog, ZwSpinner, AlertIcon, CheckIcon },
	mixins: [InstancesMixin],
	emits: ['update:modelValue', 'close'],
	props: {
		modelValue: Boolean,
		socket: Object,
	},
	data() {
		return {
			// `idle` until exclusion actually starts, so teardown before the
			// dialog is ever opened doesn't fire a stray stopExclusion
			phase: 'idle',
			removed: null,
			settleTimer: null,
			run: 0,
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
		// Exclusion is live on the controller and must not be silently dropped
		busy() {
			return this.running || this.phase === 'settling'
		},
		dialogActions() {
			if (this.phase === 'stopping' || this.phase === 'settling') {
				return [pendingAction('Stopping…', { tone: 'danger' })]
			}
			if (this.running) {
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
			if (!status || !this.running || this.removed) return
			if (/exclusion/i.test(status) && /stopped/i.test(status)) {
				this.settle()
			}
		},
	},
	methods: {
		begin() {
			this.clearSettle()
			this.run++
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
			const run = this.run
			this.phase = 'stopping'
			await this.app.apiRequest('stopExclusion', [], {
				infoSnack: false,
				errorSnack: true,
			})
			// Bail out because a close-and-reopen during the await can start a
			// new run that must settle its own exclusion, not this one
			if (run !== this.run) return
			this.settle()
		},
		settle() {
			this.clearSettle()
			// Leaves `running`, so the footer stops offering Stop while the
			// trailing nodeRemoved is still expected
			this.phase = 'settling'
			const run = this.run
			this.settleTimer = setTimeout(() => {
				if (run === this.run && !this.removed) this.phase = 'stopped'
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
			// Stop the controller now rather than on `after-leave`: the leave
			// transition can be cancelled, and Vue then never emits it
			this.abandon()
			this.$emit('update:modelValue', false)
			this.$emit('close')
		},
		// Release a live exclusion without reporting an outcome to a dialog
		// that is on its way out
		abandon() {
			if (!this.running) return
			this.phase = 'idle'
			this.app
				.apiRequest('stopExclusion', [], {
					infoSnack: false,
					errorSnack: false,
				})
				.catch((err) => console.error('Failed to stop exclusion', err))
		},
		reset() {
			this.abandon()
			this.run++
			this.clearSettle()
			this.unbindEvents()
			this.phase = 'idle'
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
