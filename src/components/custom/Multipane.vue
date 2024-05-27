<template>
	<div
		:class="classnames"
		:style="{ cursor, userSelect }"
		@mousedown="onMouseDown"
		@touchstart="onMouseDown"
	>
		<slot></slot>
	</div>
</template>

<script>
const LAYOUT_HORIZONTAL = 'horizontal'
const LAYOUT_VERTICAL = 'vertical'

export default {
	name: 'multipane',

	props: {
		layout: {
			type: String,
			default: LAYOUT_VERTICAL,
		},
	},

	data() {
		return {
			isResizing: false,
		}
	},

	computed: {
		classnames() {
			return [
				'multipane',
				'layout-' + this.layout.slice(0, 1),
				this.isResizing ? 'is-resizing' : '',
			]
		},
		cursor() {
			return this.isResizing
				? this.layout == LAYOUT_VERTICAL
					? 'col-resize'
					: 'row-resize'
				: ''
		},
		userSelect() {
			return this.isResizing ? 'none' : ''
		},
	},

	methods: {
		getPageXY(e) {
			return e.touches?.[0] || e
		},
		onMouseDown(e) {
			const resizer = e.target
			if (
				resizer.className &&
				resizer.className.match('multipane-resizer')
			) {
				let { $el: container, layout } = this
				const { pageX: initialPageX, pageY: initialPageY } =
					this.getPageXY(e)

				let pane = resizer.previousElementSibling
				let {
					offsetWidth: initialPaneWidth,
					offsetHeight: initialPaneHeight,
				} = pane

				let usePercentage = !!(pane.style.width + '').match('%')

				const { addEventListener, removeEventListener } = window

				const resize = (initialSize, offset = 0) => {
					if (layout == LAYOUT_VERTICAL) {
						let containerWidth = container.clientWidth
						let paneWidth = initialSize + offset

						return (pane.style.width = usePercentage
							? (paneWidth / containerWidth) * 100 + '%'
							: paneWidth + 'px')
					}

					if (layout == LAYOUT_HORIZONTAL) {
						let containerHeight = container.clientHeight
						let paneHeight = initialSize + offset

						return (pane.style.height = usePercentage
							? (paneHeight / containerHeight) * 100 + '%'
							: paneHeight + 'px')
					}
				}

				// This adds is-resizing class to container
				this.isResizing = true

				// Resize once to get current computed size
				let size = resize()

				// Trigger paneResizeStart event
				this.$emit('paneResizeStart', pane, resizer, size)

				const onMouseMove = (e) => {
					const { pageX, pageY } = this.getPageXY(e)
					size =
						layout == LAYOUT_VERTICAL
							? resize(initialPaneWidth, pageX - initialPageX)
							: resize(initialPaneHeight, pageY - initialPageY)

					this.$emit('paneResize', pane, resizer, size)
				}

				const onMouseUp = () => {
					// Run resize one more time to set computed width/height.
					size =
						layout == LAYOUT_VERTICAL
							? resize(pane.clientWidth)
							: resize(pane.clientHeight)

					// This removes is-resizing class to container
					this.isResizing = false

					removeEventListener('mousemove', onMouseMove)
					removeEventListener('mouseup', onMouseUp)

					removeEventListener('touchmove', onMouseMove)
					removeEventListener('touchend', onMouseUp)

					this.$emit('paneResizeStop', pane, resizer, size)
				}

				addEventListener('mousemove', onMouseMove)
				addEventListener('mouseup', onMouseUp)

				addEventListener('touchmove', onMouseMove)
				addEventListener('touchend', onMouseUp)
			}
		},
	},
}
</script>

<style lang="scss">
.multipane {
	display: flex;

	&.layout-h {
		flex-direction: column;
	}

	&.layout-v {
		flex-direction: row;
	}
}

.multipane > div {
	position: relative;
	z-index: 1;
}

.multipane-resizer {
	display: flex;
	align-items: center;
	justify-content: center;

	z-index: 2 !important;
	margin: 0;

	--color: #e0e0e0;
	--theme-color: white; // Add a variable for theme color

	&:hover {
		--color: #999;
	}

	&.dark {
		--theme-color: #121212;
	}
}

.layout-h > .multipane-resizer {
	width: 100%;
	height: 5px;
	margin-top: -5px;
	top: 5px;
	cursor: row-resize;

	background-image: linear-gradient(
		to bottom,
		transparent 40%,
		var(--color) 40%,
		var(--color) 60%,
		transparent 60%
	);

	&:before {
		display: block;
		content: '';
		width: 40px;
		height: 3px;

		background-image: linear-gradient(
			to right,
			var(--theme-color) 24%,
			var(--color) 24%,
			var(--color) 32%,
			var(--theme-color) 32%,
			var(--theme-color) 47%,
			var(--color) 47%,
			var(--color) 54%,
			var(--theme-color) 54%,
			var(--theme-color) 69%,
			var(--color) 69%,
			var(--color) 77%,
			var(--theme-color) 77%
		);

		background-repeat: repeat-y;
	}
}

.layout-v > .multipane-resizer {
	width: 5px;
	height: 100%;
	margin-left: -5px;
	left: 5px;
	cursor: col-resize;

	background-image: linear-gradient(
		to right,
		transparent 40%,
		var(--color) 40%,
		var(--color) 60%,
		transparent 60%
	);

	&:before {
		display: block;
		content: '';
		width: 3px;
		height: 40px;

		background-image: linear-gradient(
			to bottom,
			var(--theme-color) 24%,
			var(--color) 24%,
			var(--color) 32%,
			var(--theme-color) 32%,
			var(--theme-color) 47%,
			var(--color) 47%,
			var(--color) 54%,
			var(--theme-color) 54%,
			var(--theme-color) 69%,
			var(--color) 69%,
			var(--color) 77%,
			var(--theme-color) 77%
		);

		background-repeat: repeat-x;
	}
}
</style>
