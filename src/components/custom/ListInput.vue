<template>
	<div>
		<v-list dense>
			<v-list-item v-if="input.prefix" v-text="input.prefix" key="prefix">
			</v-list-item>

			<v-icon v-if="input.prefix" class="ml-5">arrow_downward</v-icon>

			<draggable
				v-model="items"
				@start="onStart"
				@end="onEnd"
				@update="onUpdate"
				handle=".handle"
				:sort="true"
			>
				<template v-for="(item, i) in items">
					<v-list-item :key="`${i}_${item}`">
						<v-list-item-action class="mr-0" style="min-width: 0px">
							<slot name="item-action" :item="item"></slot>
						</v-list-item-action>
						<v-list-item-content>
							<v-row class="ma-0 d-block">
								<v-icon
									v-if="toggleEdit"
									class="handle"
									style="cursor: move"
									color="primary lighten-2"
									>drag_indicator</v-icon
								>
								<span class="text-caption"> {{ i + 1 }}.</span>
								<span style="font-size: 0.9rem">
									{{ getItemName(item) }}
								</span>
								<v-btn
									v-if="toggleEdit"
									icon
									small
									@click="deleteItem(i)"
									color="error"
								>
									<v-icon small>delete</v-icon>
								</v-btn>
							</v-row>
						</v-list-item-content>
					</v-list-item>
				</template>
			</draggable>

			<v-icon v-if="input.prefix && items.length > 0" class="ml-5"
				>arrow_downward</v-icon
			>

			<v-list-item v-if="input.suffix" v-text="input.suffix" key="suffix">
			</v-list-item>
		</v-list>
		<div v-if="toggleEdit">
			<v-text-field
				v-if="input.inputType === 'text'"
				v-model.trim="item"
				:label="input.label"
				:hint="input.hint"
				:required="input.required"
				dense
				:maxlength="input.maxLength"
				:persistent-hint="!!input.hint"
				type="text"
				:suffix="input.suffix"
				:prefix="input.prefix"
				@keyup.enter="addItem"
				append-outer-icon="add"
				@click:append-outer="addItem"
			></v-text-field>
			<v-select
				v-if="input.inputType === 'select'"
				v-model="item"
				:label="input.label"
				:hint="input.hint"
				:persistent-hint="!!input.hint"
				:items="inputItems"
				:item-value="input.itemValue"
				:item-text="input.itemText"
				dense
				@change="addItem"
			></v-select>
			<v-autocomplete
				v-if="input.inputType === 'autocomplete'"
				v-model.trim="item"
				:label="input.label"
				:persistent-hint="!!input.hint"
				:hint="input.hint"
				:items="inputItems"
				:item-value="input.itemValue"
				:item-text="input.itemText"
				dense
				@change="addItem"
				@keyup.enter="addItem"
			></v-autocomplete>
			<v-combobox
				v-if="input.inputType === 'combobox'"
				v-model.trim="item"
				:label="input.label"
				:hint="input.hint"
				:persistent-hint="!!input.hint"
				:items="inputItems"
				:item-value="input.itemValue"
				:item-text="input.itemText"
				dense
				@change="addItem"
				@keyup.enter="addItem"
				chips
				deletable-chips
				:return-object="false"
				append-outer-icon="add"
				@click:append-outer="addItem"
			></v-combobox>
		</div>
	</div>
</template>

<script>
import draggable from 'vuedraggable'

export default {
	props: {
		input: Object,
		value: Array,
		toggleEdit: { type: Boolean, default: true },
	},
	components: {
		draggable,
	},
	data: () => ({
		item: null,
		inputItems: [],
		allItems: [],
	}),
	computed: {
		items: {
			get() {
				return this.value || []
			},
			set(val) {
				this.$emit('input', val)
			},
		},
	},
	mounted() {
		this.getItems()
	},
	methods: {
		getItems() {
			if (typeof this.input.items === 'function') {
				this.inputItems = this.input.items()
			} else {
				this.inputItems = this.input.items
			}

			this.allItems = [...this.inputItems]
		},
		getItem(v) {
			return this.allItems.find((i) => i[this.input.itemValue] === v)
		},
		async addItem() {
			if (this.item) {
				this.$emit('add', this.item)
				this.items.push(this.item)
				this.inputItems.splice(
					this.inputItems.indexOf(this.getItem(this.item)),
					1
				)
				await this.$nextTick()
				this.item = null
			}
		},
		deleteItem(i) {
			const item = this.items[i]
			if (item) {
				this.$emit('delete', item)
				this.items.splice(i, 1)
				this.inputItems.push(this.getItem(item))
			}
		},
		getItemName(item) {
			return (
				this.allItems.find((i) => i?.[this.input.itemValue] === item)?.[
					this.input.itemText || 'text'
				] ?? item
			)
		},
		onStart() {
			console.log('start')
		},
		onEnd() {
			console.log('end')
		},
		onUpdate() {
			console.log('update')
		},
	},
}
</script>
