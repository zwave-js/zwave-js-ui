<template>
	<div ref="chart"></div>
</template>

<script>
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'

export default {
	props: {
		node: {
			type: Object,
			required: true,
		},
		fillSize: {
			type: Boolean,
			default: false,
		},
		container: {
			type: Element,
			default: null,
		},
		zoom: {
			type: Boolean,
			default: true,
		},
	},
	data() {
		return {
			chart: null,
			ro: null,
			resizeTimeout: null,
		}
	},
	computed: {
		data() {
			// convert bgRSSI to uPlot data format: https://github.com/leeoniya/uPlot/tree/master/docs#data-format
			const timestamps = []
			const channel0 = [[], []]
			const channel1 = [[], []]
			const channel2 = [[], []]
			if (this.node.bgRSSIPoints && this.node.bgRSSIPoints.length > 0) {
				this.node.bgRSSIPoints.forEach((point) => {
					timestamps.push(point.timestamp / 1000)
					channel0[0].push(point.channel0.current)
					channel0[1].push(point.channel0.average)
					channel1[0].push(point.channel1.current)
					channel1[1].push(point.channel1.average)
					channel2[0].push(point.channel2?.current)
					channel2[1].push(point.channel2?.average)
				})
			}

			return [timestamps, ...channel0, ...channel1, ...channel2]
		},
	},
	watch: {
		data(data, prevData) {
			if (!this.chart) {
				this.create()
			} else if (this.isChanged(data, prevData)) {
				this.chart.setData(data)
				// this.chart.redraw();
			}
		},
	},
	mounted() {
		this.create()
	},
	beforeUnmount() {
		this.destroy()
	},
	beforeDestroy() {
		this.destroy()
	},
	methods: {
		isChanged(newT, oldT) {
			newT = newT?.[0]
			oldT = oldT?.[0]
			if (!newT || !oldT) return true

			return newT[newT.length - 1] !== oldT[oldT.length - 1]
		},
		destroy() {
			if (this.chart) {
				this.chart.destroy()
				this.chart = null
			}

			if (this.ro) {
				this.ro.disconnect()
				this.ro = null
			}

			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout)
				this.resizeTimeout = null
			}
		},
		createSerie(s) {
			const current = {
				// initial toggled state (optional)
				show: true,
				spanGaps: false,
				// in-legend display
				label: '',
				value: (self, rawValue) =>
					rawValue ? rawValue.toFixed(2) + ' dBm' : '----- dBm',
				// series style
				stroke: 'red',
				width: 1,
				fill: 'rgba(255, 0, 0, 0.3)',
				dash: [10, 5],
				...s,
			}

			const average = {
				...current,
				label: current.label + ' (avg)',
				dash: [5, 5],
				fill: undefined,
				width: 4,
			}

			return [current, average]
		},
		setSize() {
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout)
				this.resizeTimeout = null
			}

			this.resizeTimeout = setTimeout(() => {
				const container = this.container || this.$parent.$el
				const maxHeight = window.innerHeight - 200
				const width = container.offsetWidth - 100
				let height = container.offsetHeight - 100
				if (height > maxHeight) {
					height = maxHeight
				}

				this.chart.setSize({
					width,
					height,
				})
			}, 500)
		},
		create() {
			this.destroy()

			if (this.fillSize) {
				const container = this.container || this.$parent.$el
				this.ro = new ResizeObserver(this.setSize.bind(this))
				this.ro.observe(container)
			}

			const opts = {
				title: 'Background RSSI',
				// class: "my-chart",
				width: 400,
				height: 400,
				series: [
					{}, // timestamp
					...this.createSerie({
						label: 'Channel 0',
						stroke: 'red',
						fill: 'rgba(255, 0, 0, 0.3)',
					}),
					...this.createSerie({
						label: 'Channel 1',
						stroke: 'green',
						fill: 'rgba(0, 255, 0, 0.3)',
					}),
					...this.createSerie({
						label: 'Channel 2',
						stroke: 'blue',
						fill: 'rgba(0, 0, 255, 0.3)',
					}),
				],
			}

			if (!this.zoom) {
				opts.cursor = {
					drag: {
						setScale: false,
					},
				}
				opts.select = {
					show: false,
				}
			}

			this.chart = new uPlot(opts, this.data, this.$refs.chart)
		},
	},
}
</script>

<style></style>
