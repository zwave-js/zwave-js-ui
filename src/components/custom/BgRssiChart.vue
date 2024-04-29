<template>
	<div
		:style="{
			visibility: !isLoading ? 'visible' : 'hidden',
		}"
		ref="chart"
	></div>
</template>

<script>
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { isRssiError } from 'zwave-js/safe'

// eslint-disable-next-line no-unused-vars
function touchZoomPlugin(opts) {
	// eslint-disable-next-line no-unused-vars
	function init(u, opts, data) {
		let over = u.over
		let rect, oxRange, oyRange, xVal, yVal
		let fr = { x: 0, y: 0, dx: 0, dy: 0 }
		let to = { x: 0, y: 0, dx: 0, dy: 0 }

		function storePos(t, e) {
			let ts = e.touches

			let t0 = ts[0]
			let t0x = t0.clientX - rect.left
			let t0y = t0.clientY - rect.top

			if (ts.length == 1) {
				t.x = t0x
				t.y = t0y
				t.d = t.dx = t.dy = 1
			} else {
				let t1 = e.touches[1]
				let t1x = t1.clientX - rect.left
				let t1y = t1.clientY - rect.top

				let xMin = Math.min(t0x, t1x)
				let yMin = Math.min(t0y, t1y)
				let xMax = Math.max(t0x, t1x)
				let yMax = Math.max(t0y, t1y)

				// midpts
				t.y = (yMin + yMax) / 2
				t.x = (xMin + xMax) / 2

				t.dx = xMax - xMin
				t.dy = yMax - yMin

				// dist
				t.d = Math.sqrt(t.dx * t.dx + t.dy * t.dy)
			}
		}

		let rafPending = false

		function zoom() {
			rafPending = false

			let left = to.x
			let top = to.y

			// non-uniform scaling
			//	let xFactor = fr.dx / to.dx;
			//	let yFactor = fr.dy / to.dy;

			// uniform x/y scaling
			let xFactor = fr.d / to.d
			let yFactor = fr.d / to.d

			let leftPct = left / rect.width
			let btmPct = 1 - top / rect.height

			let nxRange = oxRange * xFactor
			let nxMin = xVal - leftPct * nxRange
			let nxMax = nxMin + nxRange

			let nyRange = oyRange * yFactor
			let nyMin = yVal - btmPct * nyRange
			let nyMax = nyMin + nyRange

			u.batch(() => {
				u.setScale('x', {
					min: nxMin,
					max: nxMax,
				})

				u.setScale('y', {
					min: nyMin,
					max: nyMax,
				})
			})
		}

		function touchmove(e) {
			storePos(to, e)

			if (!rafPending) {
				rafPending = true
				requestAnimationFrame(zoom)
			}
		}

		over.addEventListener('touchstart', function (e) {
			rect = over.getBoundingClientRect()

			storePos(fr, e)

			oxRange = u.scales.x.max - u.scales.x.min
			oyRange = u.scales.y.max - u.scales.y.min

			let left = fr.x
			let top = fr.y

			xVal = u.posToVal(left, 'x')
			yVal = u.posToVal(top, 'y')

			document.addEventListener('touchmove', touchmove, { passive: true })
		})

		over.addEventListener('touchend', function () {
			document.removeEventListener('touchmove', touchmove, {
				passive: true,
			})
		})
	}

	return {
		hooks: {
			init,
		},
	}
}

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
			isLoading: false,
		}
	},
	computed: {
		data() {
			// convert bgRSSI to uPlot data format: https://github.com/leeoniya/uPlot/tree/master/docs#data-format
			const timestamps = []
			const channel0 = [[], []]
			const channel1 = [[], []]
			const channel2 = [[], []]
			const channel3 = [[], []]

			if (this.node.bgRSSIPoints && this.node.bgRSSIPoints.length > 0) {
				this.node.bgRSSIPoints.forEach((point) => {
					timestamps.push(point.timestamp / 1000)
					channel0[0].push(
						this.checkRssiError(point.channel0.current),
					)
					channel0[1].push(point.channel0.average)
					channel1[0].push(
						this.checkRssiError(point.channel1.current),
					)
					channel1[1].push(point.channel1.average)

					if (point.channel2) {
						channel2[0].push(
							this.checkRssiError(point.channel2.current),
						)
						channel2[1].push(point.channel2.average)
					}

					if (point.channel3) {
						channel3[0].push(
							this.checkRssiError(point.channel3.current),
						)
						channel3[1].push(point.channel3.average)
					}
				})
			}

			return [
				timestamps,
				...channel0,
				...channel1,
				...channel2,
				...channel3,
			]
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
		checkRssiError(v) {
			return isRssiError(v) ? null : v
		},
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
		createSerie(s, i = 1) {
			const dash = [3, 5, 7]
			const current = {
				// initial toggled state (optional)
				show: true,
				spanGaps: false,
				// in-legend display
				label: '',
				value: (self, rawValue) =>
					rawValue ? rawValue.toFixed(2) + ' dBm' : '---',
				// series style
				stroke: 'red',
				width: 1,
				fill: 'rgba(255, 0, 0, 0.3)',
				dash: [dash[i - 1], dash[i - 1]],
				...s,
			}

			const average = {
				...current,
				label: current.label + ' (avg)',
				width: 4,
				fill: undefined,
			}

			return [current, average]
		},
		setSize() {
			if (this.resizeTimeout) {
				clearTimeout(this.resizeTimeout)
				this.resizeTimeout = null
			}

			this.isLoading = true

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

				this.isLoading = false
			}, 150)
		},
		create() {
			this.destroy()

			if (this.fillSize) {
				const container = this.container || this.$parent.$el
				this.ro = new ResizeObserver(this.setSize.bind(this))
				this.ro.observe(container)
			}

			const width = this.$parent.$el.offsetWidth

			const opts = {
				title: 'Background RSSI',
				// class: "my-chart",
				width,
				height: 500,
				plugins: [touchZoomPlugin()],
				axes: [
					{
						stroke: this.$vuetify.theme.dark ? '#fff' : '#000',
					},
					{
						stroke: this.$vuetify.theme.dark ? '#fff' : '#000',
					},
				],
				series: [
					{}, // timestamp
					...this.createSerie(
						{
							label: 'Channel 0',
							stroke: '#7a5195',
							fill: 'rgba(122, 81, 149, 0.35)',
						},
						3,
					),
					...this.createSerie(
						{
							label: 'Channel 1',
							stroke: '#bc5090',
							fill: 'rgba(188, 80, 144, 0.35)',
						},
						2,
					),
					...this.createSerie(
						{
							label: 'Channel 2',
							stroke: '#ffa600',
							fill: 'rgba(255, 166, 0, 0.35)',
						},
						1,
					),
					...this.createSerie(
						{
							label: 'Channel 3',
							stroke: '#003f5c',
							fill: 'rgba(0, 63, 92, 0.35)',
						},
						1,
					),
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
