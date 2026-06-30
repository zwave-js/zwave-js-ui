<template>
	<div class="zw-fw">
		<!-- current + check -->
		<div class="zw-fw__header">
			<div class="zw-fw__current">
				<span class="zw-fw__overline">Current firmware</span>
				<span class="zw-fw__version"
					>v{{ device.firmware?.node ?? '—' }}</span
				>
				<span class="zw-fw__checked"
					>Last checked {{ lastChecked }}</span
				>
			</div>
			<button
				type="button"
				class="zw-fw__check-btn"
				:disabled="checking"
				@click="check"
			>
				<RefreshIcon
					:size="ICON_SIZE.dense"
					:class="{ 'zw-fw__spin': checking }"
				/>
				{{ checking ? 'Checking…' : 'Check for updates' }}
			</button>
		</div>

		<!-- filters -->
		<div class="zw-fw__filters">
			<ZwCheckToggle v-model="includePre" label="Include prereleases" />
			<ZwCheckToggle v-model="showDown" label="Show downgrades" />
		</div>

		<!-- flashing banner -->
		<div v-if="flash" class="zw-fw__flash">
			<div class="zw-fw__flash-head">
				<span class="zw-fw__flash-label">
					<RefreshIcon
						:size="ICON_SIZE.dense"
						class="zw-fw__spin zw-fw__flash-icon"
					/>
					Flashing <span class="zw-fw__mono">{{ flash.version }}</span
					>…
				</span>
				<span class="zw-fw__mono zw-fw__flash-pct"
					>{{ flash.pct }}%</span
				>
			</div>
			<div class="zw-fw__progress-track">
				<div
					class="zw-fw__progress-fill"
					:style="{ width: flash.pct + '%' }"
				/>
			</div>
			<div class="zw-fw__flash-foot">
				<span class="zw-fw__flash-hint"
					>Keep the device powered until this completes.</span
				>
				<button
					type="button"
					class="zw-fw__btn zw-fw__btn--danger"
					@click="abortInstall"
				>
					Abort
				</button>
			</div>
		</div>

		<!-- available updates -->
		<div v-if="!flash" class="zw-fw__list">
			<span class="zw-fw__overline">
				{{
					visible.length
						? `Available updates (${visible.length})`
						: 'Available updates'
				}}
			</span>

			<div v-if="visible.length === 0" class="zw-fw__empty">
				<CheckIcon :size="ICON_SIZE.std" class="zw-fw__empty-icon" />
				<span>
					<strong>You're on the latest stable firmware.</strong>
					<template v-if="hiddenCount > 0">
						{{ ' ' }}{{ hiddenCount }}
						{{ hiddenCount === 1 ? 'version is' : 'versions are' }}
						hidden by the filters above.
					</template>
				</span>
			</div>

			<div v-for="c in visible" :key="c.version" class="zw-fw__card">
				<div class="zw-fw__card-head">
					<span class="zw-fw__card-version">{{ c.version }}</span>
					<span class="zw-fw__card-tags">
						<ZwPill v-if="c.latest" tone="accent" size="sm"
							>latest</ZwPill
						>
						<ZwPill
							v-if="c.channel === 'prerelease'"
							tone="asleep"
							size="sm"
						>
							prerelease
						</ZwPill>
						<ZwPill v-else tone="neutral" size="sm">stable</ZwPill>
						<ZwPill v-if="c.downgrade" tone="warn" size="sm"
							>downgrade</ZwPill
						>
					</span>
					<span class="zw-fw__spacer" />
					<span
						v-if="installed === c.version"
						class="zw-fw__installed"
					>
						<CheckIcon :size="ICON_SIZE.dense" /> Installed
					</span>
					<button
						v-else
						type="button"
						class="zw-fw__btn"
						:class="
							c.downgrade
								? 'zw-fw__btn--ghost'
								: 'zw-fw__btn--accent'
						"
						@click="startInstall(c.version)"
					>
						<DownloadIcon :size="ICON_SIZE.dense" />
						{{ c.downgrade ? 'Downgrade' : 'Install' }}
					</button>
				</div>
				<div v-if="c.changelog?.length" class="zw-fw__changelog">
					<div
						class="zw-fw__changelog-body"
						:class="{
							'zw-fw__changelog-body--clamped': !expandedLogs.has(
								c.version,
							),
							'zw-fw__changelog-body--expanded': expandedLogs.has(
								c.version,
							),
						}"
					>
						<div
							v-for="(line, li) in c.changelog"
							:key="li"
							class="zw-fw__changelog-line"
							:class="{
								'zw-fw__changelog-line--heading':
									line.startsWith('##'),
							}"
						>
							{{
								line.startsWith('##')
									? line.replace(/^##\s*/, '')
									: `• ${line}`
							}}
						</div>
						<div
							v-if="
								!expandedLogs.has(c.version) &&
								c.changelog.length > 3
							"
							class="zw-fw__changelog-fade"
						/>
					</div>
					<button
						v-if="c.changelog.length > 3"
						type="button"
						class="zw-fw__changelog-toggle"
						@click="toggleLog(c.version)"
					>
						<ChevronDownIcon
							:size="ICON_SIZE.caret"
							:class="{
								'zw-fw__chev--open': expandedLogs.has(
									c.version,
								),
							}"
						/>
						{{
							expandedLogs.has(c.version)
								? 'Show less'
								: 'Show full changelog'
						}}
					</button>
				</div>
			</div>
		</div>

		<!-- upload from file -->
		<div class="zw-fw__upload-section">
			<span class="zw-fw__overline">Update from file</span>
			<input
				ref="fileInput"
				type="file"
				accept=".gbl,.otz,.ota,.hex,.bin,.hec"
				class="zw-fw__file-input"
				@change="onFileChange"
			/>
			<button
				v-if="!uploadFile"
				type="button"
				class="zw-fw__drop"
				@click="pickFile"
			>
				<UploadIcon :size="ICON_SIZE.topbar" class="zw-fw__drop-icon" />
				<span class="zw-fw__drop-label">Choose a firmware file</span>
				<span class="zw-fw__drop-hint"
					>.gbl · .otz · .ota · .hex · .bin</span
				>
			</button>
			<div v-else class="zw-fw__file-row">
				<UploadIcon :size="ICON_SIZE.std" class="zw-fw__file-icon" />
				<span class="zw-fw__file-name">{{ uploadFile }}</span>
				<button
					type="button"
					class="zw-fw__file-remove"
					title="Remove"
					@click="uploadFile = null"
				>
					<XIcon :size="ICON_SIZE.inline" />
				</button>
				<button type="button" class="zw-fw__btn zw-fw__btn--accent">
					<ZapIcon :size="ICON_SIZE.dense" /> Flash
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import ZwPill from '@/components/dashboard/atoms/ZwPill.vue'
import ZwCheckToggle from '@/components/dashboard/atoms/ZwCheckToggle.vue'
import {
	CheckIcon,
	ChevronDownIcon,
	DownloadIcon,
	ICON_SIZE,
	RefreshIcon,
	UploadIcon,
	XIcon,
	ZapIcon,
} from '@/lib/icons'
import type { Device, DeviceAction } from '@/lib/dashboard-types'

interface FwCandidate {
	version: string
	channel: 'stable' | 'prerelease'
	changelog: string[]
	downgrade: boolean
	latest?: boolean
}

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const includePre = ref(false)
const showDown = ref(false)
const checking = ref(false)
const lastChecked = ref('—')
const flash = ref<{ version: string; pct: number } | null>(null)
const installed = ref<string | null>(null)
const expandedLogs = ref<Set<string>>(new Set())
const uploadFile = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let flashTimer: ReturnType<typeof setInterval> | null = null

const candidates = computed<FwCandidate[]>(() => {
	const updates = props.device.availableFirmwareUpdates
	if (!updates?.length) return []
	return updates.map((u, i) => ({
		version: u.version,
		channel: u.channel ?? 'stable',
		changelog: u.changelog ?? [],
		downgrade: u.downgrade ?? false,
		latest: i === 0 && !u.downgrade,
	}))
})

const visible = computed(() =>
	candidates.value.filter(
		(c) =>
			(includePre.value || c.channel !== 'prerelease') &&
			(showDown.value || !c.downgrade),
	),
)

const hiddenCount = computed(
	() => candidates.value.length - visible.value.length,
)

function check() {
	if (checking.value) return
	checking.value = true
	emit('action', props.device, {
		type: 'check-firmware-updates',
	} as DeviceAction)
	setTimeout(() => {
		checking.value = false
		lastChecked.value = 'just now'
	}, 1300)
}

function startInstall(version: string) {
	if (flashTimer) clearInterval(flashTimer)
	installed.value = null
	flash.value = { version, pct: 0 }
	flashTimer = setInterval(() => {
		if (!flash.value) return
		if (flash.value.pct >= 100) {
			if (flashTimer) clearInterval(flashTimer)
			installed.value = flash.value.version
			flash.value = null
			return
		}
		flash.value = {
			...flash.value,
			pct: Math.min(100, flash.value.pct + 7),
		}
	}, 300)
}

function abortInstall() {
	if (flashTimer) clearInterval(flashTimer)
	flash.value = null
}

function toggleLog(version: string) {
	const next = new Set(expandedLogs.value)
	if (next.has(version)) next.delete(version)
	else next.add(version)
	expandedLogs.value = next
}

function pickFile() {
	fileInput.value?.click()
}

function onFileChange(e: Event) {
	const input = e.target as HTMLInputElement
	uploadFile.value = input.files?.[0]?.name ?? null
}
</script>

<style scoped>
.zw-fw {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.zw-fw__overline {
	font-family: var(--zw-mono);
	font-size: 10.5px;
	font-weight: 600;
	color: var(--zw-muted);
	text-transform: uppercase;
	letter-spacing: 0.6px;
}

.zw-fw__mono {
	font-family: var(--zw-mono);
}

/* header */
.zw-fw__header {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}

.zw-fw__current {
	display: flex;
	flex-direction: column;
	gap: 3px;
}

.zw-fw__version {
	font-family: var(--zw-mono);
	font-size: 20px;
	font-weight: 600;
}

.zw-fw__checked {
	font-size: 11px;
	color: var(--zw-muted);
}

.zw-fw__check-btn {
	appearance: none;
	border: 1px solid var(--zw-line);
	background: var(--zw-card);
	color: var(--zw-fg);
	padding: 7px 14px;
	border-radius: 6px;
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
}

.zw-fw__check-btn:disabled {
	opacity: 0.7;
	cursor: default;
}

/* filters */
.zw-fw__filters {
	display: flex;
	gap: 16px;
	flex-wrap: wrap;
}

/* flash banner */
.zw-fw__flash {
	background: var(--zw-bg-soft);
	border-radius: 10px;
	padding: 12px;
}

.zw-fw__flash-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 8px;
}

.zw-fw__flash-label {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	font-size: 12px;
	font-weight: 500;
}

.zw-fw__flash-icon {
	color: var(--zw-accent);
}

.zw-fw__flash-pct {
	font-size: 12px;
	color: var(--zw-accent);
}

.zw-fw__progress-track {
	height: 6px;
	border-radius: 3px;
	background: rgba(0, 0, 0, 0.1);
	overflow: hidden;
}

.zw-fw__progress-fill {
	height: 100%;
	background: var(--zw-accent);
	transition: width 0.3s linear;
}

.zw-fw__flash-foot {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-top: 10px;
}

.zw-fw__flash-hint {
	font-size: 11px;
	color: var(--zw-muted);
}

/* buttons */
.zw-fw__btn {
	appearance: none;
	border: 1px solid transparent;
	padding: 7px 14px;
	border-radius: 6px;
	cursor: pointer;
	font: inherit;
	font-size: 12px;
	font-weight: 600;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	white-space: nowrap;
}

.zw-fw__btn--accent {
	background: var(--zw-accent);
	color: #fff;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

.zw-fw__btn--ghost {
	background: var(--zw-card);
	color: var(--zw-fg);
	border-color: var(--zw-line);
}

.zw-fw__btn--danger {
	background: transparent;
	color: #e53935;
	border-color: #e53935;
}

/* empty */
.zw-fw__empty {
	display: flex;
	align-items: center;
	gap: 8px;
	background: var(--zw-bg-soft);
	border-radius: 10px;
	padding: 14px 12px;
	font-size: 12px;
	color: var(--zw-muted);
}

.zw-fw__empty-icon {
	color: var(--zw-ok);
	flex: 0 0 auto;
}

/* list */
.zw-fw__list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

/* card */
.zw-fw__card {
	border: 1px solid var(--zw-line);
	border-radius: 10px;
	background: var(--zw-card);
	overflow: hidden;
}

.zw-fw__card-head {
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 11px 12px;
	flex-wrap: wrap;
}

.zw-fw__card-version {
	font-family: var(--zw-mono);
	font-size: 14px;
	font-weight: 600;
}

.zw-fw__card-tags {
	display: inline-flex;
	gap: 4px;
	flex-wrap: wrap;
}

.zw-fw__spacer {
	flex: 1;
}

.zw-fw__installed {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	font-size: 11px;
	font-weight: 600;
	color: var(--zw-ok);
}

/* changelog */
.zw-fw__changelog {
	padding: 0 12px 11px;
}

.zw-fw__changelog-body {
	position: relative;
	background: var(--zw-bg-soft);
	border-radius: 8px;
	padding: 10px;
}

.zw-fw__changelog-body--clamped {
	max-height: 58px;
	overflow: hidden;
}

.zw-fw__changelog-body--expanded {
	max-height: 220px;
	overflow-y: auto;
}

.zw-fw__changelog-line {
	font-size: 11.5px;
	color: var(--zw-muted);
	line-height: 1.55;
}

.zw-fw__changelog-line--heading {
	color: var(--zw-fg);
	font-weight: 600;
}

.zw-fw__changelog-fade {
	position: absolute;
	left: 0;
	right: 0;
	bottom: 0;
	height: 26px;
	background: linear-gradient(transparent, var(--zw-bg-soft));
	pointer-events: none;
}

.zw-fw__changelog-toggle {
	appearance: none;
	border: none;
	background: transparent;
	cursor: pointer;
	font: inherit;
	color: var(--zw-accent);
	font-size: 11px;
	font-weight: 600;
	padding: 6px 0 0;
	display: inline-flex;
	align-items: center;
	gap: 4px;
}

.zw-fw__chev--open {
	transform: rotate(180deg);
}

/* spin */
.zw-fw__spin {
	animation: zw-spin 0.9s linear infinite;
}

@keyframes zw-spin {
	to {
		transform: rotate(360deg);
	}
}

/* upload */
.zw-fw__upload-section {
	border-top: 1px dashed var(--zw-line);
	padding-top: 10px;
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.zw-fw__file-input {
	display: none;
}

.zw-fw__drop {
	width: 100%;
	appearance: none;
	cursor: pointer;
	font: inherit;
	border: 1.5px dashed var(--zw-line);
	border-radius: 10px;
	background: var(--zw-bg-soft);
	color: var(--zw-muted);
	padding: 16px 12px;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 6px;
}

.zw-fw__drop-icon {
	color: var(--zw-accent);
}

.zw-fw__drop-label {
	font-size: 12px;
	color: var(--zw-fg);
	font-weight: 500;
}

.zw-fw__drop-hint {
	font-family: var(--zw-mono);
	font-size: 10px;
}

.zw-fw__file-row {
	display: flex;
	align-items: center;
	gap: 10px;
	border: 1px solid var(--zw-line);
	border-radius: 10px;
	background: var(--zw-card);
	padding: 10px 12px;
}

.zw-fw__file-icon {
	color: var(--zw-accent);
	flex: 0 0 auto;
}

.zw-fw__file-name {
	flex: 1;
	min-width: 0;
	font-family: var(--zw-mono);
	font-size: 12px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.zw-fw__file-remove {
	appearance: none;
	border: none;
	background: transparent;
	cursor: pointer;
	color: var(--zw-muted);
	padding: 4px;
	display: inline-flex;
}
</style>
