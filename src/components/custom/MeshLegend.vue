<template>
	<div class="mesh-legend">
		<v-card v-if="open" density="compact" class="mesh-legend-card">
			<v-card-title class="d-flex align-center text-subtitle-1 py-1">
				Legend
				<v-spacer></v-spacer>
				<v-btn
					icon="close"
					size="x-small"
					variant="text"
					@click="open = false"
				></v-btn>
			</v-card-title>
			<v-card-text class="pt-0 text-body-2">
				<div class="mesh-legend-cols">
					<div>
						<div class="mesh-legend-head">Nodes, by hops</div>
						<div
							v-for="[label, color] in hops"
							:key="label"
							class="mesh-legend-row"
						>
							<svg width="22" height="14">
								<circle cx="11" cy="7" r="6" :fill="color" />
							</svg>
							{{ label }}
						</div>
						<div class="mesh-legend-head mt-2">Shapes</div>
						<div
							v-for="[label, svg] in shapes"
							:key="label"
							class="mesh-legend-row"
						>
							<svg
								width="22"
								height="14"
								viewBox="0 0 24 24"
								v-html="svg"
							/>
							{{ label }}
						</div>
					</div>
					<div>
						<div class="mesh-legend-head">Routes, by speed</div>
						<div
							v-for="[label, color] in rates"
							:key="label"
							class="mesh-legend-row"
						>
							<svg width="40" height="14">
								<line
									x1="1"
									y1="7"
									x2="39"
									y2="7"
									:stroke="color"
									stroke-width="4"
								/>
							</svg>
							{{ label }}
						</div>
						<div class="mesh-legend-head mt-2">Lines</div>
						<div
							v-for="[label, attrs] in lines"
							:key="label"
							class="mesh-legend-row"
						>
							<svg width="40" height="14">
								<line
									x1="1"
									y1="7"
									x2="39"
									y2="7"
									v-bind="attrs"
								/>
							</svg>
							{{ label }}
						</div>
					</div>
					<div>
						<div class="mesh-legend-head">Marks</div>
						<div class="mesh-legend-row">
							<svg width="22" height="18">
								<circle
									cx="11"
									cy="9"
									r="7"
									fill="none"
									:stroke="health.warn"
									stroke-width="2.5"
								/>
							</svg>
							Health warning
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="18">
								<circle
									cx="11"
									cy="9"
									r="7"
									fill="none"
									:stroke="health.bad"
									stroke-width="2.5"
								/>
							</svg>
							Health problem
						</div>
						<div class="mesh-legend-row">
							<span
								class="mesh-legend-bang"
								:style="{ background: health.warn }"
								>!</span
							>
							Weak hop (red: very weak)
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<circle
									cx="11"
									cy="7"
									r="4.5"
									:fill="ghost.fill"
									:stroke="ghost.stroke"
								/>
							</svg>
							Hidden repeater
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<circle
									cx="11"
									cy="7"
									r="4.5"
									fill="none"
									:stroke="ghost.stroke"
									stroke-dasharray="2 2"
								/>
							</svg>
							Repeater, rough spot
						</div>
						<div class="mesh-legend-row">
							<span
								class="mesh-legend-batt"
								:style="{ background: health.warn }"
								>23%</span
							>
							Battery (amber ≤ {{ battery.warn }}%, red ≤
							{{ battery.bad }}%)
						</div>
					</div>
				</div>
			</v-card-text>
		</v-card>
		<!-- stays put under the card, so it closes it again -->
		<v-btn
			size="small"
			variant="elevated"
			prepend-icon="legend_toggle"
			:active="open"
			@click="open = !open"
			>Legend</v-btn
		>
	</div>
</template>

<script>
import { ProtocolDataRate } from '@zwave-js/core'
import {
	BATTERY_LOW,
	CONTROLLER_COLOR,
	GHOST_COLORS,
	HEALTH_COLORS,
	HOP_LEGEND,
	LINE_STYLES,
	RATE_LEGEND,
	nodeShapeSvg,
	rateColor,
} from '@/lib/meshView.js'

// a sample for each line the map draws, in the map's styles
const ROUTE_SAMPLE = rateColor(ProtocolDataRate.ZWave_100k)
const LINES = [
	['main', 'Route (last working)'],
	['backup', 'Backup route'],
	['backupOnly', 'Backup route, no main route known'],
	['neighbor', 'Neighbors'],
	['failed', 'Failed hop'],
	['oneWay', 'One-way neighbor'],
].map(([kind, label]) => {
	const s = LINE_STYLES[kind]
	return [
		label,
		{
			stroke: s.color ?? ROUTE_SAMPLE,
			'stroke-width': s.weight,
			'stroke-dasharray': s.dashArray,
			'stroke-linecap': s.lineCap,
			opacity: s.opacity,
		},
	]
})

const UNSHADED = '#9e9e9e'
const SHAPES = [
	['Controller', nodeShapeSvg('controller', CONTROLLER_COLOR)],
	['Mains powered', nodeShapeSvg('mains', UNSHADED)],
	['Battery', nodeShapeSvg('battery', UNSHADED)],
]

export default {
	name: 'MeshLegend',
	data() {
		return {
			open: false,
			hops: HOP_LEGEND,
			rates: RATE_LEGEND,
			health: HEALTH_COLORS,
			battery: BATTERY_LOW,
			ghost: GHOST_COLORS,
			lines: LINES,
			shapes: SHAPES,
		}
	},
}
</script>

<style scoped>
.mesh-legend {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
}

.mesh-legend-card {
	max-height: 70vh;
	overflow-y: auto;
	max-width: min(720px, calc(100vw - 48px));
}

.mesh-legend-cols {
	display: flex;
	flex-wrap: wrap;
	gap: 8px 24px;
}

.mesh-legend-head {
	font-weight: 500;
	margin-bottom: 2px;
}

.mesh-legend-row {
	display: flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
	line-height: 1.6;
}

.mesh-legend-bang {
	display: inline-block;
	width: 16px;
	height: 16px;
	margin: 0 3px;
	border-radius: 50%;
	color: #fff;
	font-weight: bold;
	font-size: 12px;
	line-height: 16px;
	text-align: center;
}

.mesh-legend-batt {
	padding: 0 3px;
	border-radius: 3px;
	color: #fff;
	font-size: 10px;
}
</style>
