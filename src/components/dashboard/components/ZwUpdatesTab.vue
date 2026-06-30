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

		<!-- available updates -->
		<div class="zw-fw__list">
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
					<button
						type="button"
						class="zw-fw__btn"
						:class="
							c.downgrade
								? 'zw-fw__btn--ghost'
								: 'zw-fw__btn--accent'
						"
						@click="installOTA(c)"
					>
						<DownloadIcon :size="ICON_SIZE.dense" />
						{{ c.downgrade ? 'Downgrade' : 'Install' }}
					</button>
				</div>
				<div v-if="c.changelogLines.length" class="zw-fw__changelog">
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
							v-for="(line, li) in c.changelogLines"
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
								c.changelogLines.length > 3
							"
							class="zw-fw__changelog-fade"
						/>
					</div>
					<button
						v-if="c.changelogLines.length > 3"
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
				:accept="FW_EXTENSIONS.join(',')"
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
				<span class="zw-fw__drop-hint">{{
					FW_EXTENSIONS.join(' · ')
				}}</span>
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
				<button
					type="button"
					class="zw-fw__btn zw-fw__btn--accent"
					@click="flashFile"
				>
					<ZapIcon :size="ICON_SIZE.dense" /> Flash
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { padVersion } from '@zwave-js/shared'
import { compare } from 'semver'
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
import type {
	Device,
	DeviceAction,
	FirmwareUpdateInfo,
} from '@/lib/dashboard-types'

interface FwCandidate {
	version: string
	channel: 'stable' | 'prerelease'
	changelogLines: string[]
	downgrade: boolean
	latest: boolean
	raw: FirmwareUpdateInfo
}

const FW_EXTENSIONS = ['.gbl', '.otz', '.ota', '.hex', '.bin', '.hec'] as const

const props = defineProps<{ device: Device }>()
const emit = defineEmits<{ action: [Device, DeviceAction] }>()

const includePre = ref(false)
const showDown = ref(false)
const checking = ref(false)
const lastChecked = ref('—')
const expandedLogs = ref<Set<string>>(new Set())
const uploadFile = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

function isLatest(u: FirmwareUpdateInfo, all: FirmwareUpdateInfo[]): boolean {
	if (u.downgrade) return false
	const upgrades = all.filter((c) => !c.downgrade)
	if (upgrades.length === 0) return false
	let best = upgrades[0]
	for (let i = 1; i < upgrades.length; i++) {
		try {
			if (
				compare(
					padVersion(upgrades[i].version),
					padVersion(best.version),
				) > 0
			) {
				best = upgrades[i]
			}
		} catch {
			// invalid semver — keep current best
		}
	}
	return u.version === best.version
}

const candidates = computed<FwCandidate[]>(() => {
	const updates = props.device.availableFirmwareUpdates
	if (!updates?.length) return []
	const sorted = [...updates].sort((a, b) => {
		try {
			return compare(padVersion(b.version), padVersion(a.version))
		} catch {
			return 0
		}
	})
	return sorted.map((u) => ({
		version: u.version,
		channel: u.channel ?? 'stable',
		changelogLines: u.changelog
			? u.changelog.split('\n').filter((l) => l.trim())
			: [],
		downgrade: u.downgrade ?? false,
		latest: isLatest(u, sorted),
		raw: u,
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
	emit('action', props.device, { type: 'check-firmware-updates' })
	setTimeout(() => {
		checking.value = false
		lastChecked.value = 'just now'
	}, 1300)
}

function installOTA(c: FwCandidate) {
	emit('action', props.device, { type: 'firmware-install', update: c.raw })
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

function flashFile() {
	const file = fileInput.value?.files?.[0]
	if (!file) return
	emit('action', props.device, { type: 'firmware-upload', file })
	uploadFile.value = null
	if (fileInput.value) fileInput.value.value = ''
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
	color: var(--zw-on-accent);
	box-shadow: 0 1px 2px rgba(var(--v0-on-surface), 0.18);
}

.zw-fw__btn--ghost {
	background: var(--zw-card);
	color: var(--zw-fg);
	border-color: var(--zw-line);
}

.zw-fw__btn--danger {
	background: transparent;
	color: var(--zw-danger);
	border-color: var(--zw-danger);
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
