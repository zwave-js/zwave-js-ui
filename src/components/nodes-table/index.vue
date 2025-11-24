<template>
	<v-data-table
		v-if="managedNodes"
		v-model="managedNodes.selected"
		:headers="managedNodes.tableHeaders"
		:items="managedNodes.filteredItems"
		v-model:expanded="expanded"
		@update:options="managedNodes.tableOptions = $event"
		:items-per-page="managedNodes.tableOptions.itemsPerPage"
		:group-by="managedNodes.groupBy"
		:sort-by="managedNodes.tableOptions.sortBy"
		item-key="id"
		class="elevation-1 nodes-table"
		expand-on-click
		show-expand
		show-select
		return-object
		:search="search"
		style="margin-bottom: 50px; padding-bottom: 0 !important"
	>
		<template #top>
			<v-row class="my-4 ml-1" justify-start>
				<v-text-field
					v-model="search"
					clearable
					variant="outlined"
					hide-details
					class="ma-2"
					style="max-width: 250px; min-width: 250px"
					prepend-inner-icon="search"
					label="Search"
				></v-text-field>
				<v-menu
					v-model="headersMenu"
					:close-on-content-click="false"
					@update:model-value="
						managedNodes.tableColumns = managedNodes.tableColumns
					"
				>
					<template #activator="{ props }">
						<v-btn
							class="my-auto"
							color="primary"
							variant="outlined"
							v-bind="props"
						>
							<v-icon start size="small">table_chart</v-icon>
							Columns
						</v-btn>
					</template>
					<v-card>
						<v-card-text>
							<draggable
								v-model="managedNodes.tableColumns"
								handle=".handle"
								item-key="name"
							>
								<template #item="{ element: col }">
									<v-checkbox
										:key="col.name"
										v-model="col.visible"
										hide-details
										:label="
											managedNodes.propDefs[col.name]
												.label
										"
									>
										<template #prepend>
											<v-icon
												class="handle"
												style="cursor: move"
												>drag_indicator</v-icon
											>
										</template>
									</v-checkbox>
								</template>
							</draggable>
						</v-card-text>
						<v-card-actions>
							<v-btn
								@click="
									managedNodes.tableColumns =
										managedNodes.initialTableColumns
								"
								>Reset</v-btn
							>
						</v-card-actions>
					</v-card>
				</v-menu>
				<v-btn
					color="primary"
					class="my-auto"
					variant="text"
					v-tooltip:bottom="'Show only selected nodes'"
					@click="managedNodes.setFilterToSelected()"
					:disabled="managedNodes.selected.length === 0"
				>
					Filter Selected
				</v-btn>
				<v-btn
					color="primary"
					class="my-auto"
					variant="text"
					v-tooltip:bottom="'Reset all table settings'"
					@click="managedNodes.reset()"
				>
					Reset Table
				</v-btn>
			</v-row>
		</template>
		<template
			v-for="column in managedNodes.tableHeaders"
			#[`header.${column.key}`]="{ isSorted, getSortIcon }"
			:key="column.key"
		>
			<span>
				<column-filter
					v-model="managedNodes.filters[column.key]"
					v-model:group-by="managedNodes.groupBy"
					:column="column"
					:items="managedNodes.propValues[column.key]"
					@update:filter="
						managedNodes.setPropFilter(column.key, $event)
					"
				></column-filter>
				<span style="padding-right: 1px">{{ column.title }}</span>
			</span>
			<span v-if="isSorted(column)">
				<v-icon>{{ getSortIcon(column) }}</v-icon>
			</span>
		</template>
		<template
			#[`group-header`]="{ item, columns, toggleGroup, isGroupOpen }"
		>
			<tr>
				<td :colspan="columns.length">
					<v-btn @click="toggleGroup(item)" size="x-small" icon>
						<v-icon>{{
							isGroupOpen(item) ? 'remove' : 'add'
						}}</v-icon>
					</v-btn>
					<span>{{ groupValue(item) }}</span>
					<v-btn size="x-small" icon @click="toggleGroup(item)"
						><v-icon>close</v-icon></v-btn
					>
				</td>
			</tr>
		</template>
		<template #[`item.id`]="{ item }">
			<div class="d-flex align-center">
				<!-- Broadcast nodes: show icon instead of ID -->
				<v-icon
					v-if="item.virtual && (item.id === 255 || item.id === 4095)"
					color="purple"
					v-tooltip:bottom="item.name"
				>
					sensors
				</v-icon>
				<!-- Regular nodes: show ID chip -->
				<v-chip v-else>{{
					item.id.toString().padStart(3, '0')
				}}</v-chip>

				<reinterview-badge
					v-if="!item.virtual"
					class="ml-1"
					:node="item"
				></reinterview-badge>

				<firmware-update-badge
					v-if="!item.virtual"
					class="ml-1"
					:node="item"
				></firmware-update-badge>
			</div>
		</template>
		<template #[`item.minBatteryLevel`]="{ item }">
			<rich-value :value="richValue(item, 'minBatteryLevel')" />
		</template>
		<template #[`item.manufacturer`]="{ item }">
			<!-- For broadcast nodes, show the name here instead -->
			<span v-if="item.virtual && (item.id === 255 || item.id === 4095)">
				{{ item.name }}
			</span>
			<span v-else>
				{{ item.manufacturer }}
			</span>
		</template>
		<template #[`item.productDescription`]="{ item }">
			{{ item.productDescription }}
		</template>
		<template #[`item.productLabel`]="{ item }">
			{{ item.productLabel }}
		</template>
		<template #[`item.name`]="{ item }">
			<div class="d-flex align-center">
				<!-- For broadcast nodes, don't show name (it's in manufacturer column) -->
				<span
					v-if="item.virtual && (item.id === 255 || item.id === 4095)"
				>
					<!-- Empty for broadcast nodes -->
				</span>
				<!-- For multicast groups, show the name -->
				<span v-else-if="item.virtual">
					{{ item.name }}
				</span>
				<!-- For physical nodes, show name or empty -->
				<span v-else>{{ item.name || '' }}</span>
				<v-chip
					v-if="item.virtual"
					size="x-small"
					color="purple"
					class="ml-2"
				>
					VIRTUAL
				</v-chip>
			</div>
		</template>
		<template #[`item.virtual`]="{ item }">
			<rich-value :value="richValue(item, 'virtual')" />
		</template>
		<template #[`item.loc`]="{ item }">
			{{ item.loc || '' }}
		</template>
		<template #[`item.security`]="{ item }">
			<rich-value
				v-if="!item.isControllerNode && !item.virtual"
				:value="richValue(item, 'security')"
			/>
			<div v-else></div>
		</template>
		<template #[`item.supportsBeaming`]="{ item }">
			<rich-value
				v-if="!item.isControllerNode && !item.virtual"
				:value="richValue(item, 'supportsBeaming')"
			/>
			<div v-else></div>
		</template>
		<template #[`item.zwavePlusVersion`]="{ item }">
			<rich-value
				v-if="!item.isControllerNode && !item.virtual"
				:value="richValue(item, 'zwavePlusVersion')"
			/>
			<div v-else></div>
		</template>
		<template #[`item.protocol`]="{ item }">
			<rich-value
				v-if="!item.isControllerNode && !item.virtual"
				:value="richValue(item, 'protocol')"
			/>
			<div class="d-flex" v-else-if="item.isControllerNode">
				<rich-value class="mr-1" :value="getProtocolIcon(false)" />
				<rich-value
					v-if="item.supportsLongRange"
					:value="getProtocolIcon(true)"
				/>
			</div>
			<div v-else></div>
		</template>
		<template #[`item.failed`]="{ item }">
			<rich-value
				v-if="!item.isControllerNode && !item.virtual"
				:value="richValue(item, 'failed')"
			/>
			<div v-else></div>
		</template>
		<template #[`item.status`]="{ item }">
			<rich-value
				v-if="!item.isControllerNode && !item.virtual"
				:value="richValue(item, 'status')"
			/>
			<div v-else></div>
		</template>
		<template #[`item.rebuildRoutesProgress`]="{ item }">
			<div v-if="!item.isControllerNode">
				<v-progress-circular
					class="ml-3"
					v-if="item.rebuildRoutesProgress === 'pending'"
					indeterminate
					size="20"
					color="primary"
				></v-progress-circular>

				<v-icon
					v-else-if="
						getRebuildRoutesIcon(item.rebuildRoutesProgress) !==
						undefined
					"
					class="ml-3"
					v-tooltip:bottom="item.rebuildRoutesProgress.toUpperCase()"
					:color="
						getRebuildRoutesIcon(item.rebuildRoutesProgress).color
					"
				>
					{{ getRebuildRoutesIcon(item.rebuildRoutesProgress).icon }}
				</v-icon>
				<div v-else>{{ item.rebuildRoutesProgress }}</div>
			</div>
			<div v-else></div>
		</template>
		<template #[`item.interviewStage`]="{ item }">
			<div
				v-if="!item.isControllerNode && !item.virtual"
				class="d-flex flex-column align-center pa-1"
			>
				<v-chip
					size="small"
					:color="interviewStageColor(`${item.interviewStage}`)"
					>{{ item.interviewStage }}</v-chip
				>
				<v-progress-circular
					v-if="item.interviewStage !== 'Complete'"
					indeterminate
					class="mt-1"
					size="20"
					color="primary"
				></v-progress-circular>
			</div>
			<div v-else></div>
		</template>
		<template #[`item.firmwareVersion`]="{ item }">
			<div style="text-align: center">
				<div
					v-if="item.firmwareUpdate && !item.isControllerNode"
					class="d-flex flex-column align-center pa-1"
				>
					<v-progress-circular
						:model-value="item.firmwareUpdate.progress"
						size="50"
						class="my-1"
						color="primary"
					>
						<span class="text-caption">{{
							item.firmwareUpdate.progress
						}}</span>
					</v-progress-circular>
					<p class="text-caption font-weight-bold mb-0 mt-1">
						{{ item.firmwareUpdate.currentFile }}/{{
							item.firmwareUpdate.totalFiles
						}}: {{ getProgress(item) }}%
					</p>
				</div>
				<div
					style="white-space: pre"
					v-text="
						`${
							item.firmwareVersion
								? 'FW: v' + item.firmwareVersion
								: '-----'
						}${item.sdkVersion ? `\nSDK: v${item.sdkVersion}` : ''}`
					"
					v-else
				></div>
			</div>
		</template>
		<template #[`item.lastActive`]="{ item }">
			<statistics-arrows
				v-if="!item.virtual"
				:node="item"
			></statistics-arrows>
			<div v-else></div>
		</template>
		<template #[`expanded-row`]="{ columns: headers, item }">
			<td :colspan="$vuetify.display.xs ? 1 : headers.length">
				<expanded-node
					:headers="headers"
					:node="item"
					:socket="socket"
				/>
			</td>
		</template>
	</v-data-table>
</template>
<script src="./nodes-table.js"></script>
<style scoped src="./nodes-table.css"></style>
<style lang="scss">
.nodes-table {
	table {
		tr {
			th {
				white-space: nowrap;
			}
			th,
			td {
				padding: 0 8px !important;
			}
		}
	}
}
</style>
