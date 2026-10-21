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
						<div class="mesh-legend-row">
							<svg width="22" height="14" viewBox="0 0 24 24">
								<polygon
									points="12,0 15,8 24,9 17,15 19,24 12,19 5,24 7,15 0,9 9,8"
									:fill="controllerColor"
								/>
							</svg>
							Controller
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14" viewBox="0 0 24 24">
								<polygon
									points="12,2 21,7 21,17 12,22 3,17 3,7"
									fill="#9e9e9e"
								/>
							</svg>
							Mains powered
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14" viewBox="0 0 24 24">
								<rect
									x="4"
									y="4"
									width="16"
									height="16"
									rx="2"
									fill="#9e9e9e"
								/>
							</svg>
							Battery
						</div>
					</div>
					<div>
						<div class="mesh-legend-head">Routes, by speed</div>
						<div
							v-for="[label, color] in rates"
							:key="label"
							class="mesh-legend-row"
						>
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="color"
									stroke-width="4"
								/>
							</svg>
							{{ label }}
						</div>
						<div class="mesh-legend-head mt-2">Lines</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="routeSample"
									stroke-width="4"
								/>
							</svg>
							Route (last working)
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="routeSample"
									stroke-width="1.5"
									stroke-dasharray="5 5"
								/>
							</svg>
							Backup route
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="routeSample"
									stroke-width="4"
									stroke-dasharray="10 8"
								/>
							</svg>
							Backup route, no main route known
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="neighborColor"
									stroke-width="1"
									opacity="0.7"
								/>
							</svg>
							Neighbors
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="deadColor"
									stroke-width="1.5"
									stroke-dasharray="2 4"
								/>
							</svg>
							Failed hop
						</div>
						<div class="mesh-legend-row">
							<svg width="22" height="14">
								<line
									x1="1"
									y1="7"
									x2="21"
									y2="7"
									:stroke="health.warn"
									stroke-width="2"
									stroke-dasharray="1 6"
									stroke-linecap="round"
								/>
							</svg>
							One-way neighbor
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
									fill="#9e9e9e"
									stroke="#616161"
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
									stroke="#616161"
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
	DEAD_COLOR,
	HEALTH_COLORS,
	HOP_LEGEND,
	NEIGHBOR_COLOR,
	RATE_LEGEND,
	rateColor,
} from '@/lib/meshView.js'

export default {
	name: 'MeshLegend',
	data() {
		return {
			open: false,
			hops: HOP_LEGEND,
			rates: RATE_LEGEND,
			health: HEALTH_COLORS,
			battery: BATTERY_LOW,
			controllerColor: CONTROLLER_COLOR,
			deadColor: DEAD_COLOR,
			neighborColor: NEIGHBOR_COLOR,
			routeSample: rateColor(ProtocolDataRate.ZWave_100k),
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
