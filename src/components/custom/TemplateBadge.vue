<template>
	<v-btn
		v-if="hasPendingTemplates"
		v-tooltip:bottom="tooltipText"
		:style="bStyle"
		@click.stop="applyTemplate"
		variant="flat"
		color="info"
		size="small"
		density="compact"
		icon="content_copy"
		class="my-auto"
	/>
</template>

<script>
import ConfigApis from '../../apis/ConfigApis.js'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import { mapActions } from 'pinia'
import useBaseStore from '../../stores/base.js'

export default {
	mixins: [InstancesMixin],
	props: {
		node: {
			type: Object,
			required: true,
		},
		bStyle: {
			type: Object,
			default: () => ({}),
		},
	},
	computed: {
		hasPendingTemplates() {
			return (
				this.node.pendingConfigTemplates &&
				this.node.pendingConfigTemplates.length > 0
			)
		},
		tooltipText() {
			const templates = this.node.pendingConfigTemplates || []
			const names = templates.map((t) => t.name).join(', ')
			return `Configuration template available: ${names}. Click to apply.`
		},
	},
	methods: {
		...mapActions(useBaseStore, ['showSnackbar']),
		async applyTemplate() {
			const templates = this.node.pendingConfigTemplates || []
			if (templates.length === 0) return

			let templateId = templates[0].id

			if (templates.length > 1) {
				const result = await this.app.confirm(
					'Apply Configuration Template',
					`${templates.length} template(s) match this device`,
					'info',
					{
						confirmText: 'Apply',
						inputs: [
							{
								type: 'list',
								label: 'Template',
								required: true,
								key: 'templateId',
								items: templates.map((t) => ({
									title: t.name,
									value: t.id,
								})),
							},
						],
					},
				)

				if (!result || !result.templateId) return
				templateId = result.templateId
			} else {
				const ok = await this.app.confirm(
					'Apply Configuration Template',
					`Apply template "${templates[0].name}" to node ${this.node.id}?`,
					'info',
				)
				if (!ok) return
			}

			try {
				const response = await ConfigApis.applyConfigurationTemplate(
					templateId,
					this.node.id,
				)
				if (response.success) {
					this.node.pendingConfigTemplates = undefined
				}
				this.showSnackbar(
					response.message,
					response.success ? 'success' : 'error',
				)
			} catch (error) {
				this.showSnackbar(error.message, 'error')
			}
		},
	},
}
</script>
