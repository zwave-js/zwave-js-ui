<template>
	<div>
		<v-subheader class="valueid-label">{{ label }} </v-subheader>

		<div v-if="!value.writeable">
			<div class="readonly mt-5">
				{{ parsedValue + (value.unit ? ' ' + value.unit : '') }}
			</div>

			<div v-if="help" class="caption mt-1">
				{{ help }}
			</div>
		</div>

		<div class="d-flex align-center" v-else>
			<v-tooltip v-if="value.toUpdate" bottom>
				<template v-slot:activator="{ on }">
					<v-progress-circular
						v-on="on"
						indeterminate
						class="mr-2"
						size="20"
						:color="
							node?.status === 'Asleep' ? 'warning' : 'primary'
						"
					></v-progress-circular>
				</template>
				<span>{{
					node?.status === 'Asleep'
						? 'Wake up your device in order to send commands'
						: 'Set value in progress...'
				}}</span>
			</v-tooltip>
			<v-text-field
				v-if="
					!value.list &&
					(value.type === 'string' || value.type === 'buffer')
				"
				:append-outer-icon="!disable_send ? 'send' : null"
				:suffix="value.unit"
				persistent-hint
				:hint="help"
				v-model="value.newValue"
				@click:append-outer="updateValue(value)"
			></v-text-field>

			<v-text-field
				v-if="!value.list && value.type === 'number'"
				type="number"
				:append-outer-icon="!disable_send ? 'send' : null"
				:suffix="value.unit"
				:min="value.min != value.max ? value.min : null"
				:step="1"
				persistent-hint
				:max="value.min != value.max ? value.max : null"
				:hint="help"
				v-model.number="value.newValue"
				@click:append-outer="updateValue(value)"
			></v-text-field>

			<v-text-field
				v-if="!value.list && value.type === 'any'"
				:append-outer-icon="!disable_send ? 'send' : null"
				:suffix="value.unit"
				persistent-hint
				:error="!!error"
				:error-messages="error"
				:hint="help"
				v-model="parsedValue"
				@click:append-outer="updateValue(value)"
			></v-text-field>

			<div style="display: flex" v-if="value.type === 'duration'">
				<v-text-field
					:type="value.type === 'number' ? 'number' : 'text'"
					:min="value.min != value.max ? value.min : null"
					:step="1"
					persistent-hint
					:readonly="disable_send"
					:max="value.min != value.max ? value.max : null"
					:hint="help"
					v-model.number="value.newValue.value"
				></v-text-field>
				<v-select
					style="margin-left: 10px; min-width: 105px; width: 135px"
					:items="durations"
					v-model="value.newValue.unit"
					:readonly="disable_send"
					persistent-hint
					:append-outer-icon="!disable_send ? 'send' : null"
					@click:append-outer="updateValue(value)"
				></v-select>
			</div>

			<v-text-field
				style="max-width: 250px; margin-top: 10px"
				flat
				solo
				v-if="value.type === 'color'"
				v-model="color"
				persistent-hint
				:append-outer-icon="!disable_send ? 'send' : null"
				:hint="help"
				@click:append-outer="updateValue(value)"
			>
				<template v-slot:append>
					<v-menu
						v-model="menu"
						top
						nudge-bottom="105"
						nudge-left="16"
						:close-on-content-click="false"
					>
						<template v-slot:activator="{ on }">
							<div :style="pickerStyle" v-on="on" />
						</template>
						<v-card>
							<v-card-text class="pa-0">
								<v-color-picker
									hide-mode-switch
									v-model="color"
									flat
								/>
							</v-card-text>
						</v-card>
					</v-menu>
				</template>
			</v-text-field>

			<v-select
				v-if="value.list && !value.allowManualEntry"
				:items="items"
				:style="{
					'max-width': $vuetify.breakpoint.smAndDown
						? '280px'
						: $vuetify.breakpoint.smOnly
						? '400px'
						: 'auto',
				}"
				:hint="help"
				persistent-hint
				:return-object="false"
				:item-text="itemText"
				item-value="value"
				:suffix="value.unit"
				:append-outer-icon="!disable_send ? 'send' : null"
				v-model="value.newValue"
				@click:append-outer="updateValue(value)"
			>
				<template v-slot:selection="{ item }">
					<span>
						{{ itemText(selectedItem || item) }}
					</span>
				</template>
			</v-select>

			<v-combobox
				v-if="value.list && value.allowManualEntry"
				:items="items"
				:style="{
					'max-width': $vuetify.breakpoint.smAndDown
						? '280px'
						: $vuetify.breakpoint.smOnly
						? '400px'
						: 'auto',
				}"
				:hint="help"
				persistent-hint
				chips
				:suffix="value.unit"
				:item-text="itemText"
				item-value="value"
				:type="value.type === 'number' ? 'number' : 'text'"
				:return-object="false"
				:append-outer-icon="!disable_send ? 'send' : null"
				v-model="value.newValue"
				ref="myCombo"
				@click:append-outer="updateValue(value)"
			>
				<template v-slot:selection="{ attrs, item, selected }">
					<v-chip v-bind="attrs" :input-value="selected">
						<span>
							{{ itemText(selectedItem || item) }}
						</span>
					</v-chip>
				</template>
			</v-combobox>

			<div
				v-if="
					value.type == 'boolean' && value.writeable && value.readable
				"
			>
				<v-btn-toggle class="mt-4" v-model="value.newValue" rounded>
					<v-btn
						outlined
						height="40px"
						:value="true"
						:style="{
							background:
								value.newValue === true ? '#4CAF50' : '',
						}"
						:color="value.newValue === true ? 'white' : 'green'"
						dark
						@click="updateValue(value, true)"
					>
						ON
					</v-btn>
					<v-btn
						outlined
						height="40px"
						:value="false"
						:style="{
							background:
								value.newValue === false ? '#f44336' : '',
						}"
						:color="value.newValue === false ? 'white' : 'red'"
						@click="updateValue(value, false)"
						dark
					>
						OFF
					</v-btn>
				</v-btn-toggle>
				<div v-if="help" class="caption mt-2">{{ help }}</div>
			</div>

			<v-tooltip v-if="value.type == 'boolean' && !value.readable" right>
				<template v-slot:activator="{ on }">
					<v-btn
						max-width="100%"
						small
						v-on="on"
						color="primary"
						dark
						@click="updateValue(value)"
						class="mb-2 mt-2"
						>{{ value.label }}</v-btn
					>
				</template>
				<span>{{ '[' + value.id + '] ' + help }}</span>
			</v-tooltip>
		</div>
	</div>
</template>

<style>
.valueid-label {
	font-weight: bold !important;
	padding-left: 0 !important;
	margin-bottom: -10px !important;
}

.readonly {
	font-size: x-large !important;
	font-weight: bold !important;
}
</style>

<script>
export default {
	props: {
		value: {
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
			menu: false,
			error: null,
		}
	},
	computed: {
		selectedItem() {
			const value =
				this.value.type === 'number'
					? Number(this.value.newValue)
					: this.value.newValue
			if (!this.value.states) return null
			else return this.value.states.find((s) => s.value === value)
		},
		items() {
			if (this.selectedItem) {
				return this.value.states
			} else {
				return [
					{ value: this.value.newValue, text: 'Custom' },
					...this.value.states,
				]
			}
		},
		label() {
			return '[' + this.value.id + '] ' + this.value.label
		},
		help() {
			return (
				(this.value.description ? this.value.description + ' ' : '') +
				(this.value.default !== undefined && !this.value.list
					? `(Default: ${this.value.default})`
					: '')
			)
		},
		color: {
			get: function () {
				return '#' + (this.value.newValue || 'ffffff').toUpperCase()
			},
			set: function (v) {
				this.value.newValue = v ? v.substr(1, 7) : null
			},
		},
		parsedValue: {
			get: function () {
				if (typeof this.value.newValue === 'object') {
					return JSON.stringify(this.value.newValue)
				} else if (
					this.value.states &&
					this.value.newValue !== undefined
				) {
					return this.itemText(
						this.selectedItem || this.value.newValue
					)
				}
				return this.value.newValue
			},
			set: function (v) {
				try {
					if (this.value.type === 'any') {
						this.value.newValue = JSON.parse(v)
					} else if (
						typeof v === 'string' &&
						this.value.type === 'number'
					) {
						this.value.newValue = Number(v)
					}

					this.error = null
				} catch (error) {
					this.error = 'Value not valid'
				}
			},
		},
		pickerStyle() {
			if (this.value.type !== 'color') return null
			return {
				backgroundColor: this.color,
				cursor: 'pointer',
				border:
					'1px solid ' +
					(this.$vuetify.theme.dark ? 'white' : 'black'),
				height: '30px',
				width: '30px',
				borderRadius: this.menu ? '50%' : '4px',
				transition: 'border-radius 200ms ease-in-out',
			}
		},
	},
	methods: {
		itemText(item) {
			if (typeof item === 'object') {
				return `[${item.value}] ${item.text}${
					this.value.default === item.value ? ' (Default)' : ''
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
				this.value.newValue = this.$refs.myCombo.$refs.input._value
			}

			if (customValue !== undefined) {
				v.newValue = customValue
			}

			this.$emit('updateValue', v, customValue)
		},
	},
}
</script>
