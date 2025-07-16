<template>
	<div class="valueid-slot">
		<v-list-subheader class="valueid-label">{{ label }} </v-list-subheader>

		<v-btn
			@click="resetConfig"
			v-if="canResetConfiguration"
			size="x-small"
			color="error"
			>Reset</v-btn
		>

		<!-- Not writeable value -->
		<div v-if="!modelValue.writeable">
			<div class="readonly mt-5">
				{{
					parsedValue + (modelValue.unit ? ' ' + modelValue.unit : '')
				}}

				<v-btn
					@click="idleNotification"
					v-if="canIdleNotification"
					size="small"
					color="primary"
					>Idle</v-btn
				>
			</div>

			<div v-if="help" class="text-caption mt-1 help">
				{{ help }}
			</div>
		</div>

		<div class="d-flex align-center" v-else>
			<!-- ### VALUEID INPUTS ### -->

			<!-- Text Input -->
			<v-text-field
				v-if="
					!modelValue.list &&
					(modelValue.type === 'string' ||
						modelValue.type === 'buffer')
				"
				:append-icon="!disable_send ? 'send' : null"
				:suffix="modelValue.unit"
				persistent-hint
				:hint="help"
				v-model="modelValue.newValue"
				@click:append="updateValue(modelValue)"
			></v-text-field>

			<!-- Number Input -->
			<v-text-field
				v-else-if="!modelValue.list && modelValue.type === 'number'"
				type="number"
				:append-icon="
					!disable_send && !numberOutOfRange ? 'send' : null
				"
				:suffix="modelValue.unit"
				:min="modelValue.min != modelValue.max ? modelValue.min : null"
				:step="modelValue.step || 1"
				persistent-hint
				:max="modelValue.min != modelValue.max ? modelValue.max : null"
				:hint="help"
				:error="numberOutOfRange"
				:error-messages="
					numberOutOfRange
						? `Value must be between ${modelValue.min} and ${modelValue.max}`
						: ''
				"
				v-model.number="modelValue.newValue"
				@click:append="!numberOutOfRange && updateValue(modelValue)"
			></v-text-field>

			<!-- Object Input -->
			<v-text-field
				v-else-if="!modelValue.list && modelValue.type === 'any'"
				:append-icon="!disable_send ? 'send' : null"
				:suffix="modelValue.unit"
				persistent-hint
				:error="!!error"
				:error-messages="error"
				:hint="help"
				v-model="parsedValue"
				@click:append="updateValue(modelValue)"
			></v-text-field>

			<!-- Duration Input -->
			<div
				style="display: flex"
				v-else-if="modelValue.type === 'duration'"
			>
				<v-text-field
					:type="modelValue.type === 'number' ? 'number' : 'text'"
					:min="
						modelValue.min != modelValue.max ? modelValue.min : null
					"
					:step="modelValue.step || 1"
					persistent-hint
					:readonly="disable_send"
					:max="
						modelValue.min != modelValue.max ? modelValue.max : null
					"
					:hint="help"
					v-model.number="modelValue.newValue.value"
				></v-text-field>
				<v-select
					style="margin-left: 10px; min-width: 105px; width: 135px"
					:items="durations"
					v-model="modelValue.newValue.unit"
					:readonly="disable_send"
					persistent-hint
					:append-icon="!disable_send ? 'send' : null"
					@click:append="updateValue(modelValue)"
				></v-select>
			</div>

			<!-- Color Input -->
			<v-text-field
				style="max-width: 250px; margin-top: 10px"
				flat
				variant="solo"
				v-else-if="modelValue.type === 'color'"
				v-model="color"
				persistent-hint
				:append-icon="!disable_send ? 'send' : null"
				:hint="help"
				@click:append="updateValue(modelValue)"
			>
				<template v-slot:append>
					<v-menu
						v-model="showMenu"
						location="top"
						:offset="[16, 105]"
						:close-on-content-click="false"
					>
						<template v-slot:activator="{ props }">
							<div
								class="ml-2"
								:style="pickerStyle"
								v-bind="props"
							/>
						</template>
						<v-card>
							<v-card-text class="pa-0">
								<v-color-picker
									v-if="showMenu"
									v-model="color"
								/>
							</v-card-text>
						</v-card>
					</v-menu>
				</template>
			</v-text-field>

			<!-- Select Input -->
			<v-select
				v-else-if="
					modelValue.list &&
					!modelValue.allowManualEntry &&
					modelValue.type !== 'boolean'
				"
				:items="items"
				:style="{
					'max-width': $vuetify.display.smAndDown
						? '280px'
						: $vuetify.display.sm
							? '400px'
							: 'auto',
				}"
				:hint="help"
				persistent-hint
				:return-object="false"
				:item-title="itemText"
				item-value="value"
				:suffix="modelValue.unit"
				:append-icon="!disable_send ? 'send' : null"
				v-model="modelValue.newValue"
				@click:append="updateValue(modelValue)"
			>
				<template v-slot:selection="{ item }">
					<span>
						{{ itemText(selectedItem || item) }}
					</span>
				</template>
			</v-select>

			<!-- Select Input with Manual Entry -->
			<v-combobox
				v-else-if="
					modelValue.list &&
					modelValue.allowManualEntry &&
					modelValue.type !== 'boolean'
				"
				:items="items"
				:style="{
					'max-width': $vuetify.display.smAndDown
						? '280px'
						: $vuetify.display.sm
							? '400px'
							: 'auto',
				}"
				:hint="help"
				persistent-hint
				chips
				:suffix="modelValue.unit"
				:item-title="itemText"
				item-value="value"
				:type="modelValue.type === 'number' ? 'number' : 'text'"
				:return-object="false"
				:append-icon="!disable_send ? 'send' : null"
				v-model="modelValue.newValue"
				ref="myCombo"
				@click:append="updateValue(modelValue)"
			>
				<template v-slot:chip="{ attrs, item, selected }">
					<v-chip v-bind="attrs" :model-value="selected">
						<span>
							{{ itemText(selectedItem || item) }}
						</span>
					</v-chip>
				</template>
			</v-combobox>

			<!-- On/Off Input -->
			<div
				v-else-if="
					modelValue.type === 'boolean' &&
					((modelValue.writeable && modelValue.readable) ||
						(modelValue.states && modelValue.states.length === 2))
				"
			>
				<v-btn-toggle
					class="my-2"
					v-model="modelValue.newValue"
					rounded
				>
					<v-btn
						variant="outlined"
						height="40px"
						:value="true"
						:style="{
							background:
								modelValue.newValue === true && !modelValue.list
									? '#4CAF50'
									: '',
						}"
						:color="
							modelValue.newValue === true && !modelValue.list
								? 'white'
								: 'success'
						"
						@click="updateValue(modelValue, true)"
						:icon="!trueLabel ? 'horizontal_rule' : undefined"
					>
						<span v-if="trueLabel">{{ trueLabel }}</span>
					</v-btn>
					<v-btn
						variant="outlined"
						height="40px"
						:value="false"
						:style="{
							background:
								modelValue.newValue === false &&
								!modelValue.list
									? '#f44336'
									: '',
						}"
						:color="
							modelValue.newValue === false && !modelValue.list
								? 'white'
								: 'error'
						"
						@click="updateValue(modelValue, false)"
						:icon="
							!falseLabel ? 'radio_button_unchecked' : undefined
						"
					>
						<span v-if="falseLabel">{{ falseLabel }}</span>
					</v-btn>
				</v-btn-toggle>
				<div v-if="help" class="text-caption mt-2 help">{{ help }}</div>
			</div>

			<!-- Button Input -->
			<v-tooltip
				v-else-if="
					modelValue.type === 'boolean' && !modelValue.readable
				"
				location="right"
			>
				<template v-slot:activator="{ props }">
					<v-btn
						max-width="100%"
						size="small"
						v-bind="props"
						color="primary"
						@click="updateValue(modelValue)"
						class="mb-2 mt-2"
						>{{
							trueLabel || falseLabel || modelValue.label
						}}</v-btn
					>
				</template>
				<span class="help">{{
					'[' + modelValue.id + '] ' + help
				}}</span>
			</v-tooltip>

			<!-- Suffix loader with tooltip -->
			<v-progress-circular
				v-if="modelValue.toUpdate"
				v-tooltip:bottom="
					node?.status === 'Asleep'
						? 'Wake up your device in order to send commands'
						: 'Set value in progress...'
				"
				indeterminate
				class="ml-2"
				size="20"
				:color="node?.status === 'Asleep' ? 'warning' : 'primary'"
			></v-progress-circular>
		</div>
	</div>
</template>

<style scoped>
.valueid-label {
	font-weight: bold !important;
	padding-left: 0 !important;
	margin-bottom: -10px !important;
}

.readonly {
	font-size: x-large !important;
	font-weight: bold !important;
}

.valueid-slot :deep(.v-messages__message),
.valueid-slot :deep(.help) {
	white-space: pre-line;
}
</style>

<script>
import { manager, instances } from '../lib/instanceManager'
import useBaseStore from '../stores/base.js'

export default {
	props: {
		modelValue: {
			type: Object,
		},
		disable_send: {
			type: Boolean,
		},
		node: {
			type: Object,
		},
	},
	data() {
		return {
			durations: ['seconds', 'minutes'],
			showMenu: false,
			error: null,
		}
	},
	computed: {
		trueLabel() {
			return this.modelValue.type === 'boolean' &&
				this.modelValue.states?.length > 0
				? this.modelValue.states.find((s) => s.value === true)?.text
				: null
		},
		numberOutOfRange() {
			const min = this.modelValue.min ?? -Infinity
			const max = this.modelValue.max ?? Infinity
			return (
				this.modelValue.type === 'number' &&
				(this.modelValue.newValue < min ||
					this.modelValue.newValue > max)
			)
		},
		falseLabel() {
			return this.modelValue.type === 'boolean' &&
				this.modelValue.states?.length > 0
				? this.modelValue.states.find((s) => s.value === false)?.text
				: null
		},
		selectedItem() {
			const value =
				this.modelValue.type === 'number'
					? Number(this.modelValue.newValue)
					: this.modelValue.newValue
			if (!this.modelValue.states) return null
			else return this.modelValue.states.find((s) => s.value === value)
		},
		canIdleNotification() {
			if (!this.modelValue || this.disable_send) return false

			// feat #3051
			return (
				this.modelValue.commandClassName === 'Notification' &&
				this.modelValue.states?.find((s) => s.value === 0)
			)
		},
		canResetConfiguration() {
			if (!this.modelValue || this.disable_send) return false

			return (
				this.modelValue.writeable &&
				this.modelValue.commandClass === 112 &&
				this.modelValue.commandClassVersion > 3
			)
		},
		items() {
			if (this.selectedItem) {
				return this.modelValue.states
			} else {
				return [
					{ value: this.modelValue.newValue, text: 'Custom' },
					...this.modelValue.states,
				]
			}
		},
		label() {
			return '[' + this.modelValue.id + '] ' + this.modelValue.label
		},
		help() {
			return `${this.modelValue.description ? `${this.modelValue.description} ` : ''}${
				this.modelValue.default !== undefined && !this.modelValue.list
					? `(Default: ${this.modelValue.default}${
							this.modelValue.max !== undefined
								? `, max: ${this.modelValue.max}`
								: ''
						}${
							this.modelValue.min !== undefined
								? `, min: ${this.modelValue.min}`
								: ''
						})`
					: ''
			}`
		},
		color: {
			get: function () {
				return (
					'#' + (this.modelValue.newValue || 'ffffff').toUpperCase()
				)
			},
			set: function (v) {
				this.modelValue.newValue = v ? v.substr(1, 7) : null
			},
		},
		parsedValue: {
			get: function () {
				if (typeof this.modelValue.newValue === 'object') {
					return JSON.stringify(this.modelValue.newValue)
				} else if (
					this.modelValue.states &&
					this.modelValue.newValue !== undefined
				) {
					return this.itemText(
						this.selectedItem || this.modelValue.newValue,
					)
				} else if (this.modelValue === null) {
					return '(unknown)'
				} else if (this.modelValue === undefined) {
					return '(missing)'
				}
				return this.modelValue.newValue
			},
			set: function (v) {
				try {
					if (this.modelValue.type === 'any') {
						this.modelValue.newValue = JSON.parse(v)
					} else if (
						typeof v === 'string' &&
						this.modelValue.type === 'number'
					) {
						this.modelValue.newValue = Number(v)
					}

					this.error = null
				} catch (error) {
					this.error = 'Value not valid'
				}
			},
		},
		pickerStyle() {
			if (this.modelValue.type !== 'color') return null
			return {
				backgroundColor: this.color,
				cursor: 'pointer',
				border:
					'1px solid ' +
					(this.$vuetify.theme.current.dark ? 'white' : 'black'),
				height: '30px',
				width: '30px',
				borderRadius: this.showMenu ? '50%' : '4px',
				transition: 'border-radius 200ms ease-in-out',
			}
		},
	},
	methods: {
		async resetConfig() {
			const app = manager.getInstance(instances.APP)

			const response = await app.apiRequest('sendCommand', [
				{
					nodeId: this.node.id,
					commandClass: 112,
				},
				'reset',
				[this.modelValue.property],
			])

			if (response.success) {
				useBaseStore().showSnackbar('Configuration reset', 'success')
			}
		},
		async idleNotification() {
			const app = manager.getInstance(instances.APP)

			const response = await app.apiRequest(
				'manuallyIdleNotificationValue',
				[this.modelValue],
				{
					infoSnack: false,
					errorSnack: true,
				},
			)

			if (response.success) {
				useBaseStore().showSnackbar(
					'Notification manually idled',
					'success',
				)
			}
		},
		itemText(item) {
			if (typeof item === 'object') {
				return `[${item.value}] ${item.text}${
					this.modelValue.default === item.value ? ' (Default)' : ''
				}`
			} else {
				return item
			}
		},
		updateValue(v, customValue) {
			// needed for on/off control to update the newValue

			if (
				this.$refs.myCombo &&
				this.$refs.myCombo.$refs.input._value !== null
			) {
				// trick used to send the value in combobox without the need to press enter
				this.modelValue.newValue = this.$refs.myCombo.$refs.input._value
			}

			if (customValue !== undefined) {
				v.newValue = customValue
			}

			if (v.type === 'boolean' && v.states?.length === 1) {
				customValue = v.states[0].value
				v.newValue = customValue
			}

			this.$emit('updateValue', v, customValue)
		},
	},
}
</script>
