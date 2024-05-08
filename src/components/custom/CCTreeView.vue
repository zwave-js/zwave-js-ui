<template>
	<v-treeview :items="items"></v-treeview>
</template>

<script>
/**
 * The format of the `entry` will be an object like:
 * interface FrameCCLogEntry {
	tags: string[]
	message?: {
		encapsulated?: FrameCCLogEntry[]
		[key: string]: string | number | boolean | FrameCCLogEntry[]
	}
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
	props: {
		value: Object,
	},
	data: () => ({}),
	computed: {
		items() {
			return this.parseEntry(this.entry)
		},
	},
	methods: {
		parseEntry(entry, root = 'root') {
			const items = []
			const children = []
			for (const key in entry) {
				if (key === 'tags') {
					items.push({
						id: root,
						name: entry.tags.join(' - '),
						children,
					})
				} else if (key === 'message') {
					for (const prop in entry.message) {
						if (prop === 'encapsulated') {
							children.push({
								id: `${root}.encapsulated`,
								name: entry.message.encapsulated.tags.join(
									', ',
								),
								children: entry.message.encapsulated?.map(
									(e, i) =>
										this.parseEntry(
											e,
											`${root}.encapsulated[${i}]`,
										),
								),
							})
						} else {
							children.push({
								id: `${root}.${prop}`,
								name: entry.message[prop],
							})
						}
					}
				}
			}
			return items
		},
	},
}
</script>
