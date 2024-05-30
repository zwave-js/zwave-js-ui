<template>
	<v-treeview
		v-if="items.length > 0"
		ref="treeview"
		open-all
		dense
		:items="items"
	>
		<template v-slot:label="{ item }">
			<v-row class="ma-0 pa-0" dense>
				<strong class="tree-item-name" style="white-space: pre-wrap">{{
					item.name
				}}</strong>
				<div
					class="tree-item-value"
					:class="item.name === 'payload' ? 'mono' : ''"
					v-if="item.value !== undefined"
					style="white-space: pre-wrap"
				>
					{{ item.value }}
				</div>
			</v-row>
		</template>
	</v-treeview>

	<!-- created nested divs that will format like a tree and each nested value should be indentend to right with a left border -->
	<!-- <div :style="{ marginLeft: level * 10 + 'px' }" class="tree">
		<div v-for="item in items" :key="item.id" class="tree-item">
			<div
				:style="{
					border: level === 0 ? 'none' : '',
					borderColor: $vuetify.theme.dark ? '#ccc' : '#333',
				}"
				class="tree-item-label"
			>
				<strong class="tree-item-name" style="white-space: pre-wrap">{{
					item.name
				}}</strong>
				<div
					class="tree-item-value"
					v-if="item.value"
					style="white-space: pre-wrap"
				>
					{{ item.value }}
				</div>
			</div>
			<div class="tree-item-children"></div>
			<CCTreeView :value="item.children" :level="level + 1" />
		</div>
	</div> -->
</template>

<script>
/**
 * The format of the `entry` will be an object like:
 * interface FrameCCLogEntry {
		tags: string[]
		message?: {
			[key: string]: string | number | boolean | FrameCCLogEntry[]
		}
		encapsulated?: FrameCCLogEntry[]
    }

    Starting from that we will parse it to the following format:
    items: [
        {
            id: 'root',
            name: tags.join(', '),
            children: [
                {
                    id: 'root.<property>',
                    name: '<message[property]>',
                }
                ...
                {
                    id: 'root.encapsulated',
                    name: root.encapsulated.tags.join(', '),
                    children: [
                        // repeat above recursively
                    ]
                }
            ]

 */

export default {
	name: 'CCTreeView',
	props: {
		value: {
			type: [Object, Array],
			default: () => ({}),
		},
		level: {
			type: Number,
			default: 0,
		},
	},
	data: () => ({
		items: [],
	}),
	watch: {
		value: {
			immediate: true,
			handler() {
				if (Array.isArray(this.value)) {
					this.items = this.value
				} else {
					// trick used to reset the treeview and expand all nodes on change
					this.items = []
					this.$nextTick(() => {
						this.items = this.parseEntry(this.value)
					})
				}
			},
		},
	},
	methods: {
		parseEntry(entry, root = 'root') {
			const items = []
			const children = []
			this.openIds = []
			for (const key in entry) {
				if (key === 'tags') {
					items.push({
						id: root,
						name: entry.tags.join(' - '),
						children,
					})
				} else if (key === 'message') {
					for (const prop in entry.message) {
						const value = entry.message[prop]
						children.push({
							id: `${root}.${prop}`,
							name: `${prop}`,
							value:
								typeof value === 'string'
									? value.trimStart()
									: value,
						})
					}
				} else if (key === 'encapsulated') {
					for (let i = 0; i < entry.encapsulated.length; i++) {
						const encapsulated = entry.encapsulated[i]
						children.push(
							...this.parseEntry(
								encapsulated,
								`${root}.encapsulated[${i}]`,
							),
						)
					}
				}
			}

			return items
		},
	},
}
</script>

<style scoped>
/* .tree {
	display: flex;
	flex-direction: column;
}

.tree-item {
	display: flex;
	flex-direction: column;
}

.tree-item-label {
	border-left: 1px solid #ccc;
	display: flex;
	padding-left: 5px;
	padding-top: 2px;
} */

.tree-item-name {
}

.tree-item-value {
	color: #666;
	padding-left: 5px;
}

.v-treeview::v-deep .v-treeview-node__root {
	min-height: 20px;
}
</style>
