<template>
	<div v-if="state && state.supported" class="pa-2 access-control-root">
		<v-select
			v-if="endpointChoices.length > 1"
			v-model="endpointIndex"
			:items="endpointChoices"
			density="compact"
			hide-details
			class="mb-2"
			style="max-width: 220px"
		/>

		<div class="d-flex align-center flex-wrap mb-2 access-control-toolbar">
			<v-tabs v-model="tab" density="compact" class="flex-grow-1">
				<v-tab value="users">
					Users
					<span class="ml-1 text-medium-emphasis">
						({{
							currentEndpoint ? currentEndpoint.users.length : 0
						}})
					</span>
				</v-tab>
				<v-tab value="activity">Activity</v-tab>
				<v-tab v-if="hasLockSettings" value="lock-settings">
					Lock settings
				</v-tab>
			</v-tabs>
			<div class="d-flex align-center ml-auto">
				<v-btn
					color="primary"
					prepend-icon="person_add"
					class="mr-2"
					@click="openAddUser"
				>
					Add user
				</v-btn>
				<v-menu>
					<template #activator="{ props }">
						<v-btn icon="more_vert" variant="text" v-bind="props" />
					</template>
					<v-list density="compact">
						<v-list-item
							prepend-icon="refresh"
							:disabled="refreshing"
							@click="refresh"
						>
							<v-list-item-title>Refresh</v-list-item-title>
						</v-list-item>
						<v-list-item
							prepend-icon="key_off"
							@click="openBulkDelete"
						>
							<v-list-item-title>
								Delete credentials
							</v-list-item-title>
						</v-list-item>
						<v-list-item
							prepend-icon="person_remove"
							class="text-error"
							@click="confirmDeleteAllUsers"
						>
							<v-list-item-title>
								Delete all users
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-menu>
			</div>
		</div>

		<v-tabs-window v-model="tab">
			<!-- USERS TAB -->
			<v-tabs-window-item value="users">
				<v-card v-if="filteredUsers.length === 0" variant="flat">
					<v-card-text class="text-center text-medium-emphasis">
						No users yet
					</v-card-text>
				</v-card>

				<v-expansion-panels v-else multiple variant="accordion">
					<v-expansion-panel
						v-for="user in filteredUsers"
						:key="user.userId"
					>
						<v-expansion-panel-title>
							<div class="d-flex align-center flex-grow-1">
								<span
									class="text-caption text-medium-emphasis mr-4"
								>
									#{{ user.userId }}
								</span>
								<v-tooltip
									:text="user.active ? 'Active' : 'Inactive'"
									location="top"
								>
									<template #activator="{ props: tipProps }">
										<span
											v-bind="tipProps"
											class="user-status-dot mr-4"
											:class="
												user.active
													? 'user-status-dot--active'
													: 'user-status-dot--inactive'
											"
										/>
									</template>
								</v-tooltip>
								<div
									class="d-flex flex-column user-title-block"
								>
									<div class="d-flex align-center flex-wrap">
										<span class="text-subtitle-1 mr-2">
											{{
												user.userName ||
												`User ${user.userId}`
											}}
										</span>
										<v-chip
											v-if="
												user.credentialRule &&
												user.credentialRule > 1
											"
											size="x-small"
											color="info"
											variant="tonal"
											class="mr-2"
										>
											needs
											{{ user.credentialRule }}
											credentials
										</v-chip>
										<v-chip
											v-if="user.expiringTimeoutMinutes"
											size="x-small"
											color="warning"
											variant="tonal"
											class="mr-2"
										>
											expires in
											{{ user.expiringTimeoutMinutes }}
											min
										</v-chip>
									</div>
									<div
										class="text-caption text-medium-emphasis"
									>
										<span
											:class="
												userTypeColor(user.userType)
													? `text-${userTypeColor(user.userType)}`
													: ''
											"
										>
											{{ userTypeLabel(user.userType) }}
										</span>
										<template
											v-if="credentialSubtext(user)"
										>
											· {{ credentialSubtext(user) }}
										</template>
									</div>
								</div>
								<v-menu>
									<template #activator="{ props: menuProps }">
										<v-btn
											icon="more_vert"
											size="small"
											variant="text"
											class="user-actions-btn"
											v-bind="menuProps"
											@click.stop
										/>
									</template>
									<v-list density="compact">
										<v-list-item
											prepend-icon="edit"
											@click="openEditUser(user)"
										>
											<v-list-item-title>
												Edit user
											</v-list-item-title>
										</v-list-item>
										<v-list-item
											prepend-icon="delete"
											class="text-error"
											@click="confirmDeleteUser(user)"
										>
											<v-list-item-title>
												Delete user…
											</v-list-item-title>
										</v-list-item>
									</v-list>
								</v-menu>
							</div>
						</v-expansion-panel-title>
						<v-expansion-panel-text>
							<div
								class="d-flex align-center flex-wrap mb-2 cred-header"
							>
								<span
									class="text-overline text-medium-emphasis"
								>
									Credentials ·
									{{ credentialsFor(user).length }}
								</span>
								<v-spacer />
								<v-btn
									v-if="directEntryTypeCaps.length > 0"
									size="small"
									variant="text"
									color="primary"
									prepend-icon="add"
									@click="openAddCredential(user)"
								>
									Add
								</v-btn>
								<v-btn
									v-if="hasLearnableType"
									size="small"
									variant="text"
									color="primary"
									prepend-icon="fingerprint"
									@click="openEnroll(user)"
								>
									Enroll
								</v-btn>
							</div>
							<div class="cred-grid">
								<v-card
									v-for="cred in credentialsFor(user)"
									:key="`${cred.type}-${cred.slot}`"
									class="cred-card"
								>
									<v-card-text
										class="pa-3 d-flex align-center"
									>
										<v-icon size="small" class="mr-2">
											{{ credentialTypeIcon(cred.type) }}
										</v-icon>
										<span class="font-weight-medium mr-2">
											{{ credentialTypeLabel(cred.type) }}
										</span>
										<span
											class="text-caption text-medium-emphasis mr-3"
										>
											#{{ cred.slot }}
										</span>
										<template
											v-if="isDirectEntry(cred.type)"
										>
											<span
												class="font-monospace text-body-2"
											>
												{{
													credentialValueDisplay(cred)
												}}
											</span>
											<v-btn
												v-if="cred.data"
												:icon="
													revealedCredentials.has(
														credKey(cred),
													)
														? 'visibility_off'
														: 'visibility'
												"
												size="x-small"
												variant="text"
												class="ml-1"
												@click="toggleReveal(cred)"
											/>
										</template>
										<v-spacer />
										<v-menu>
											<template
												#activator="{
													props: menuProps,
												}"
											>
												<v-btn
													icon="more_vert"
													size="x-small"
													variant="text"
													class="cred-menu-btn"
													v-bind="menuProps"
												/>
											</template>
											<v-list density="compact">
												<v-list-item
													v-if="
														isDirectEntry(cred.type)
													"
													prepend-icon="edit"
													@click="
														openReplaceCredential(
															cred,
														)
													"
												>
													<v-list-item-title>
														Replace
													</v-list-item-title>
												</v-list-item>
												<v-list-item
													v-if="
														hasLearnableType &&
														!isDirectEntry(
															cred.type,
														)
													"
													prepend-icon="fingerprint"
													@click="
														reEnrollCredential(cred)
													"
												>
													<v-list-item-title>
														Re-enroll
													</v-list-item-title>
												</v-list-item>
												<v-list-item
													v-if="
														currentEndpoint
															.capabilities
															.supportsCredentialAssignment
													"
													prepend-icon="swap_horiz"
													@click="openReassign(cred)"
												>
													<v-list-item-title>
														Reassign
													</v-list-item-title>
												</v-list-item>
												<v-list-item
													prepend-icon="delete"
													class="text-error"
													@click="
														confirmDeleteCredential(
															cred,
														)
													"
												>
													<v-list-item-title>
														Delete
													</v-list-item-title>
												</v-list-item>
											</v-list>
										</v-menu>
									</v-card-text>
								</v-card>
							</div>
						</v-expansion-panel-text>
					</v-expansion-panel>
				</v-expansion-panels>
			</v-tabs-window-item>

			<!-- ACTIVITY TAB -->
			<v-tabs-window-item value="activity">
				<v-card variant="flat">
					<v-card-text>
						<div
							v-if="activityEvents.length === 0"
							class="text-medium-emphasis text-center"
						>
							No access-control activity recorded yet.
						</div>
						<v-list v-else density="compact" class="font-monospace">
							<v-list-item
								v-for="(evt, idx) in activityEvents"
								:key="idx"
							>
								<template #prepend>
									<v-icon
										:color="activityColor(evt.event)"
										size="small"
									>
										{{ activityIcon(evt.event) }}
									</v-icon>
								</template>
								<v-list-item-title>
									<span class="text-caption mr-2">
										{{
											new Date(evt.time).toLocaleString()
										}}
									</span>
									<strong>{{ evt.event }}</strong>
									<span class="ml-2 text-medium-emphasis">
										{{ activitySummary(evt) }}
									</span>
								</v-list-item-title>
							</v-list-item>
						</v-list>
					</v-card-text>
				</v-card>
			</v-tabs-window-item>

			<!-- LOCK SETTINGS TAB -->
			<v-tabs-window-item v-if="hasLockSettings" value="lock-settings">
				<v-card
					v-if="supportsAdminCode"
					flat
					class="lock-settings-card"
				>
					<v-card-text>
						<div class="text-subtitle-1 mb-1">Admin code</div>
						<div class="text-body-2 text-medium-emphasis mb-4">
							A PIN entered at the keypad that grants on-device
							administrative actions like enrolling credentials
							directly on the lock.
						</div>

						<!-- Inline edit -->
						<div v-if="editingAdminPin" class="d-flex align-start">
							<v-text-field
								ref="adminPinField"
								v-model="adminCodePinDraft"
								type="text"
								inputmode="numeric"
								pattern="\d*"
								maxlength="10"
								label="New PIN"
								:rules="adminPinRules"
								:disabled="adminCodeSaving"
								autocomplete="off"
								autocorrect="off"
								autocapitalize="off"
								spellcheck="false"
								name="zwave-admin-pin"
								data-1p-ignore
								data-1password-ignore
								data-lpignore="true"
								data-bwignore="true"
								data-form-type="other"
								density="compact"
								hide-details="auto"
								autofocus
								placeholder="4–10 digits"
								class="font-monospace admin-pin-field pin-masked"
								@beforeinput="onDigitBeforeInput"
								@keyup.enter="saveAdminCodeInline"
								@keyup.esc="cancelAdminPinEdit"
							/>
							<v-spacer />
							<v-btn
								class="ml-2"
								size="small"
								variant="text"
								:disabled="adminCodeSaving"
								@click="cancelAdminPinEdit"
							>
								Cancel
							</v-btn>
							<v-btn
								size="small"
								variant="text"
								color="primary"
								:disabled="!adminPinValid"
								:loading="adminCodeSaving"
								@click="saveAdminCodeInline"
							>
								Save
							</v-btn>
						</div>

						<!-- Set: admin code configured -->
						<div
							v-else-if="adminCodeState === 'set'"
							class="d-flex align-center"
						>
							<div class="flex-grow-1">
								<span class="set-indicator">
									<span class="set-dot" />
									Admin code is set
								</span>
								<div
									v-if="!supportsAdminCodeDeactivation"
									class="text-caption text-medium-emphasis mt-1"
								>
									Required by this lock
								</div>
							</div>
							<v-btn
								size="small"
								variant="text"
								color="primary"
								@click="startAdminPinEdit"
							>
								Change
							</v-btn>
							<v-btn
								v-if="supportsAdminCodeDeactivation"
								size="small"
								variant="text"
								color="error"
								@click="clearAdminCode"
							>
								Clear
							</v-btn>
						</div>

						<!-- Off / not set -->
						<div v-else class="d-flex align-center">
							<div
								class="flex-grow-1 text-caption text-medium-emphasis"
							>
								<template v-if="supportsAdminCodeDeactivation">
									No admin code
								</template>
								<template v-else>
									Required by this lock
								</template>
							</div>
							<v-btn
								size="small"
								variant="text"
								color="primary"
								@click="startAdminPinEdit"
							>
								Set admin code
							</v-btn>
						</div>
					</v-card-text>
				</v-card>
			</v-tabs-window-item>
		</v-tabs-window>

		<DialogAccessControlUser
			v-model="userDialog.show"
			:capabilities="currentEndpoint && currentEndpoint.capabilities"
			:initial="userDialog.initial"
			:edit-mode="userDialog.editMode"
			:users="currentEndpoint ? currentEndpoint.users : []"
			:credentials="currentEndpoint ? currentEndpoint.credentials : []"
			@save="onSaveUser"
		/>

		<DialogAccessControlCredential
			v-model="credentialDialog.show"
			:capabilities="currentEndpoint && currentEndpoint.capabilities"
			:initial="credentialDialog.initial"
			:lock-owner="credentialDialog.lockOwner"
			:users="currentEndpoint ? currentEndpoint.users : []"
			:edit-mode="credentialDialog.editMode"
			:credentials="currentEndpoint ? currentEndpoint.credentials : []"
			@save="onSaveCredential"
		/>

		<v-dialog v-model="learnDialog.show" max-width="520" persistent>
			<v-card>
				<v-card-title>
					<span>Enroll {{ learnDialog.user?.userName || '' }}</span>
				</v-card-title>
				<v-card-text>
					<div
						v-if="
							learnDialog.state === 'starting' ||
							learnDialog.state === 'waiting'
						"
						class="text-center"
					>
						<v-progress-circular
							:model-value="
								learnDialog.state === 'starting'
									? 0
									: learnDialog.progress
							"
							:indeterminate="
								learnDialog.state === 'starting' ||
								learnDialog.totalSteps <= 1
							"
							:size="120"
							:width="8"
							:color="
								learnDialog.retryFlash ? 'error' : 'primary'
							"
						>
							<div class="d-flex flex-column align-center">
								<v-icon
									size="32"
									:color="
										learnDialog.retryFlash
											? 'error'
											: 'primary'
									"
								>
									{{ credentialTypeIcon(learnDialog.type) }}
								</v-icon>
								<span
									v-if="
										learnDialog.state === 'waiting' &&
										learnDialog.totalSteps > 1
									"
									class="text-caption mt-1"
								>
									{{ learnDialog.completedSteps }} /
									{{ learnDialog.totalSteps }}
								</span>
							</div>
						</v-progress-circular>
						<div class="mt-3">
							<template v-if="learnDialog.state === 'starting'">
								Waiting for the lock…
							</template>
							<template v-else>
								Have
								<b>{{
									learnDialog.user?.userName || 'the user'
								}}</b>
								present their
								<b>{{
									credentialTypeLabel(learnDialog.type)
								}}</b>
								<template
									v-if="
										learnDialog.retry ||
										learnDialog.completedSteps > 0
									"
								>
									again</template
								>.
							</template>
						</div>
					</div>
					<div v-else-if="learnDialogResult.icon" class="text-center">
						<v-icon :color="learnDialogResult.color" :size="120">
							{{ learnDialogResult.icon }}
						</v-icon>
						<div class="mt-3">
							<template v-if="learnDialog.state === 'success'">
								<b>{{
									credentialTypeLabel(learnDialog.type)
								}}</b>
								bound to
								<b>{{
									learnDialog.user?.userName ||
									`User ${learnDialog.userId}`
								}}</b
								>.
							</template>
							<template
								v-else-if="learnDialog.state === 'aborted'"
							>
								Enrollment aborted — the lock stopped responding
								before a credential was captured.
							</template>
							<template
								v-else-if="learnDialog.state === 'timeout'"
							>
								Timed out — the user did not present in time.
							</template>
							<template v-else-if="learnDialog.state === 'busy'">
								Another enrollment is already running on the
								lock.
							</template>
							<template v-else>
								{{
									learnDialog.message ||
									'The lock refused the operation.'
								}}
							</template>
						</div>
					</div>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn
						v-if="
							['waiting', 'starting'].includes(learnDialog.state)
						"
						color="error"
						variant="text"
						@click="cancelLearn"
					>
						Cancel
					</v-btn>
					<v-btn
						v-if="
							['timeout', 'aborted'].includes(learnDialog.state)
						"
						color="primary"
						@click="retryLearn"
					>
						Try again
					</v-btn>
					<v-btn
						v-if="learnDialog.state === 'busy'"
						color="primary"
						@click="cancelBusyAndRetry"
					>
						Cancel that &amp; start mine
					</v-btn>
					<v-btn
						v-if="
							[
								'success',
								'refused',
								'timeout',
								'busy',
								'aborted',
							].includes(learnDialog.state)
						"
						@click="closeLearn"
					>
						Close
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog v-model="reassignDialog.show" max-width="420">
			<v-card>
				<v-card-title>Reassign credential</v-card-title>
				<v-card-text>
					<div class="text-medium-emphasis mb-2">
						Currently bound to user
						<b>{{ reassignDialog.fromName }}</b
						>. The credential value does not change.
					</div>
					<v-select
						v-model="reassignDialog.destUserId"
						:items="reassignDestinations"
						label="Move to user"
						hide-details
					/>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="reassignDialog.show = false">
						Cancel
					</v-btn>
					<v-btn
						color="primary"
						:disabled="!reassignDialog.destUserId"
						@click="performReassign"
					>
						Reassign
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog v-model="bulkDeleteDialog.show" max-width="480">
			<v-card>
				<v-card-title>Delete credentials matching</v-card-title>
				<v-card-text>
					<v-select
						v-model="bulkDeleteDialog.userId"
						:items="bulkUserItems"
						label="Owner"
						hide-details
						class="mb-3"
					/>
					<v-select
						v-model="bulkDeleteDialog.type"
						:items="bulkTypeItems"
						label="Type"
						hide-details
					/>
					<v-alert type="info" class="mt-3" density="compact">
						<b>{{ bulkDeletePreview }}</b> credentials will be
						deleted based on the cached snapshot.
					</v-alert>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn
						variant="text"
						@click="bulkDeleteDialog.show = false"
					>
						Cancel
					</v-btn>
					<v-btn color="error" @click="performBulkDelete">
						Delete {{ bulkDeletePreview }} credentials
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog v-model="learnTypeDialog.show" max-width="420">
			<v-card>
				<v-card-title>Choose credential type</v-card-title>
				<v-card-text>
					<div class="text-medium-emphasis mb-2">
						Which credential type should
						<b>{{
							learnTypeDialog.user?.userName ||
							`User ${learnTypeDialog.user?.userId}`
						}}</b>
						enroll?
					</div>
					<v-list density="compact" lines="one">
						<v-list-item
							v-for="cap in learnableTypeCaps"
							:key="cap.type"
							:prepend-icon="credentialTypeIcon(cap.type)"
							@click="chooseLearnType(cap)"
						>
							<v-list-item-title>
								{{ credentialTypeLabel(cap.type) }}
							</v-list-item-title>
						</v-list-item>
					</v-list>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn variant="text" @click="learnTypeDialog.show = false">
						Cancel
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import InstancesMixin from '../../mixins/InstancesMixin.js'
import {
	UserCredentialType,
	UserCredentialLearnStatus,
	SetUserResult,
	SetCredentialResult,
	AssignCredentialResult,
	userTypeLabel,
	credentialTypeLabel,
	credentialTypeIcon,
	isDirectEntry,
	isBinary,
	maskCredential,
	setUserResultMessage,
	setCredentialResultMessage,
	assignCredentialResultMessage,
	learnStatusMessage,
	userTypeTone,
	isAdminCodeSuccess,
	setAdminCodeResultMessage,
} from '@/lib/accessControl.ts'

const ACCESS_CONTROL_EVENTS = new Set([
	'user added',
	'user modified',
	'user deleted',
	'credential added',
	'credential modified',
	'credential deleted',
	'credential learn progress',
	'credential learn completed',
])

export default {
	mixins: [InstancesMixin],
	props: {
		node: { type: Object, required: true },
	},
	components: {
		DialogAccessControlUser: defineAsyncComponent(
			() => import('@/components/dialogs/DialogAccessControlUser.vue'),
		),
		DialogAccessControlCredential: defineAsyncComponent(
			() =>
				import(
					'@/components/dialogs/DialogAccessControlCredential.vue'
				),
		),
	},
	data() {
		return {
			tab: 'users',
			endpointIndex: null,
			refreshing: false,
			revealedCredentials: new Set(),
			userDialog: {
				show: false,
				initial: null,
				editMode: false,
			},
			credentialDialog: {
				show: false,
				initial: null,
				lockOwner: false,
				editMode: false,
			},
			learnDialog: {
				show: false,
				state: 'starting',
				user: null,
				userId: 0,
				type: UserCredentialType.FingerBiometric,
				slot: 1,
				timeout: 0,
				completedSteps: 0,
				totalSteps: 1,
				progress: 0,
				retry: false,
				retryFlash: false,
				message: '',
			},
			reassignDialog: {
				show: false,
				credential: null,
				fromName: '',
				destUserId: null,
			},
			bulkDeleteDialog: {
				show: false,
				userId: 0,
				type: 0,
			},
			adminCodePinDraft: '',
			adminCodeSaving: false,
			editingAdminPin: false,
			adminPinRules: [
				(v) => /^\d{4,10}$/.test(v) || 'PIN must be 4–10 digits',
			],
			learnTypeDialog: {
				show: false,
				user: null,
			},
		}
	},
	computed: {
		state() {
			return this.node.accessControl
		},
		endpointChoices() {
			if (!this.state) return []
			return this.state.endpoints.map((e) => ({
				title: `Endpoint ${e.endpointIndex}${
					e.endpointIndex === 0 ? ' (root)' : ''
				}`,
				value: e.endpointIndex,
			}))
		},
		currentEndpoint() {
			if (!this.state) return null
			const idx = this.endpointIndex ?? this.state.primaryEndpoint ?? 0
			return (
				this.state.endpoints.find((e) => e.endpointIndex === idx) ??
				this.state.endpoints[0]
			)
		},
		hasLearnableType() {
			return this.learnableTypeCaps.length > 0
		},
		learnableTypeCaps() {
			return (
				this.currentEndpoint?.capabilities.supportedCredentialTypes.filter(
					(t) => t.supportsCredentialLearn,
				) ?? []
			)
		},
		learnDialogResult() {
			switch (this.learnDialog.state) {
				case 'success':
					return { icon: 'check_circle', color: 'success' }
				case 'timeout':
					return { icon: 'hourglass_disabled', color: 'warning' }
				case 'aborted':
					return { icon: 'cancel', color: 'warning' }
				case 'busy':
					return { icon: 'block', color: 'warning' }
				case 'refused':
					return { icon: 'error', color: 'error' }
				default:
					return { icon: '', color: '' }
			}
		},
		directEntryTypeCaps() {
			return (
				this.currentEndpoint?.capabilities.supportedCredentialTypes.filter(
					(t) => isDirectEntry(t.type),
				) ?? []
			)
		},
		filteredUsers() {
			if (!this.currentEndpoint) return []
			return this.currentEndpoint.users
				.slice()
				.sort((a, b) => a.userId - b.userId)
		},
		activityEvents() {
			return this.node.eventsQueue
				.filter((e) => ACCESS_CONTROL_EVENTS.has(e.event))
				.slice()
				.reverse()
		},
		reassignDestinations() {
			if (!this.currentEndpoint) return []
			return this.currentEndpoint.users
				.filter(
					(u) => u.userId !== this.reassignDialog.credential?.userId,
				)
				.map((u) => ({
					title: `${u.userName || `User ${u.userId}`} (slot ${u.userId})`,
					value: u.userId,
				}))
		},
		bulkUserItems() {
			if (!this.currentEndpoint) return []
			return [
				{ title: 'Any user', value: 0 },
				...this.currentEndpoint.users.map((u) => ({
					title: `${u.userName || `User ${u.userId}`}`,
					value: u.userId,
				})),
			]
		},
		bulkTypeItems() {
			if (!this.currentEndpoint) return []
			return [
				{ title: 'Any type', value: 0 },
				...this.currentEndpoint.capabilities.supportedCredentialTypes.map(
					(t) => ({
						title: credentialTypeLabel(t.type),
						value: t.type,
					}),
				),
			]
		},
		bulkDeletePreview() {
			if (!this.currentEndpoint) return 0
			return this.currentEndpoint.credentials.filter(
				(c) =>
					(!this.bulkDeleteDialog.userId ||
						c.userId === this.bulkDeleteDialog.userId) &&
					(!this.bulkDeleteDialog.type ||
						c.type === this.bulkDeleteDialog.type),
			).length
		},
		supportsAdminCode() {
			return !!this.currentEndpoint?.capabilities.supportsAdminCode
		},
		supportsAdminCodeDeactivation() {
			return !!this.currentEndpoint?.capabilities
				.supportsAdminCodeDeactivation
		},
		adminCodeState() {
			if (!this.supportsAdminCode) return 'unsupported'
			const code = this.currentEndpoint?.adminCode
			if (typeof code === 'string' && code.length > 0) return 'set'
			return 'unset'
		},
		hasLockSettings() {
			// Gate the tab on the union of every supported lock-level
			// setting. For now, admin code is the only inhabitant; add more
			// flags here as new settings move into this tab.
			return this.supportsAdminCode
		},
		adminPinValid() {
			return /^\d{4,10}$/.test(this.adminCodePinDraft)
		},
	},
	methods: {
		userTypeLabel,
		credentialTypeLabel,
		credentialTypeIcon,
		isDirectEntry,
		isBinary,
		userTypeColor(t) {
			return userTypeTone[t] && userTypeTone[t] !== 'default'
				? userTypeTone[t]
				: ''
		},
		credKey(c) {
			return `${c.type}:${c.slot}`
		},
		credentialsFor(user) {
			return (
				this.currentEndpoint?.credentials
					.filter((c) => c.userId === user.userId)
					.sort((a, b) =>
						a.type === b.type ? a.slot - b.slot : a.type - b.type,
					) ?? []
			)
		},
		credentialSubtext(user) {
			const counts = new Map()
			for (const c of this.credentialsFor(user)) {
				counts.set(c.type, (counts.get(c.type) ?? 0) + 1)
			}
			if (counts.size === 0) return ''
			return [...counts.entries()]
				.map(
					([type, count]) =>
						`${count} ${credentialTypeLabel(type)}${count > 1 ? 's' : ''}`,
				)
				.join(' · ')
		},
		credentialValueDisplay(cred) {
			if (
				isDirectEntry(cred.type) &&
				cred.data &&
				this.revealedCredentials.has(this.credKey(cred))
			) {
				return cred.data
			}
			return maskCredential(cred)
		},
		toggleReveal(cred) {
			const next = new Set(this.revealedCredentials)
			const k = this.credKey(cred)
			if (next.has(k)) next.delete(k)
			else next.add(k)
			this.revealedCredentials = next
		},
		async refresh() {
			if (!this.currentEndpoint) return
			this.refreshing = true
			try {
				await this.app.apiRequest(
					'accessControlRefreshUsers',
					[this.node.id, this.currentEndpoint.endpointIndex],
					{ infoSnack: false, errorSnack: true },
				)
				await this.app.apiRequest(
					'accessControlRefreshCredentials',
					[this.node.id, this.currentEndpoint.endpointIndex],
					{ infoSnack: false, errorSnack: true },
				)
				if (this.currentEndpoint.capabilities.supportsAdminCode) {
					await this.app.apiRequest(
						'accessControlGetAdminCode',
						[this.node.id, this.currentEndpoint.endpointIndex],
						{ infoSnack: false, errorSnack: false },
					)
				}
			} finally {
				this.refreshing = false
			}
		},
		openAddUser() {
			this.userDialog = {
				show: true,
				editMode: false,
				initial: null,
			}
		},
		openEditUser(user) {
			this.userDialog = {
				show: true,
				editMode: true,
				initial: { ...user },
			}
		},
		openAddCredential(user, type) {
			this.credentialDialog = {
				show: true,
				editMode: false,
				lockOwner: true,
				initial:
					type != null
						? { userId: user.userId, type }
						: { userId: user.userId },
			}
		},
		openReplaceCredential(cred) {
			this.credentialDialog = {
				show: true,
				editMode: true,
				lockOwner: true,
				initial: { ...cred },
			}
		},
		openEnroll(user) {
			const learnable = this.learnableTypeCaps
			if (learnable.length === 0) return
			if (learnable.length === 1) {
				this.startLearnForType(user, learnable[0])
				return
			}
			this.learnTypeDialog = { show: true, user }
		},
		startLearnForType(user, cap) {
			const slot = this.nextSlotForType(cap.type)
			this.startLearn({
				user,
				type: cap.type,
				slot,
				timeout: cap.credentialLearnRecommendedTimeout,
				totalSteps: cap.credentialLearnNumberOfSteps ?? 1,
			})
		},
		chooseLearnType(cap) {
			const user = this.learnTypeDialog.user
			this.learnTypeDialog = { show: false, user: null }
			if (!user) return
			this.startLearnForType(user, cap)
		},
		reEnrollCredential(cred) {
			const user = this.currentEndpoint.users.find(
				(u) => u.userId === cred.userId,
			)
			const cap =
				this.currentEndpoint.capabilities.supportedCredentialTypes.find(
					(t) => t.type === cred.type,
				)
			if (!user || !cap?.supportsCredentialLearn) return
			this.startLearn({
				user,
				type: cred.type,
				slot: cred.slot,
				timeout: cap.credentialLearnRecommendedTimeout,
				totalSteps: cap.credentialLearnNumberOfSteps ?? 1,
			})
		},
		nextSlotForType(type) {
			const cap =
				this.currentEndpoint.capabilities.supportedCredentialTypes.find(
					(t) => t.type === type,
				)
			const used = new Set(
				this.currentEndpoint.credentials
					.filter((c) => c.type === type)
					.map((c) => c.slot),
			)
			for (let i = 1; i <= (cap?.numberOfCredentialSlots ?? 1); i++) {
				if (!used.has(i)) return i
			}
			return 1
		},
		async startLearn({ user, type, slot, timeout, totalSteps }) {
			this.learnDialog = {
				show: true,
				state: 'starting',
				user,
				userId: user.userId,
				type,
				slot,
				timeout: timeout || 0,
				completedSteps: 0,
				totalSteps: totalSteps || 1,
				progress: 0,
				retry: false,
				retryFlash: false,
				message: '',
			}
			const res = await this.app.apiRequest(
				'accessControlStartCredentialLearn',
				[
					this.node.id,
					this.currentEndpoint.endpointIndex,
					user.userId,
					type,
					slot,
					timeout,
				],
				{ infoSnack: false, errorSnack: false },
			)
			if (!res.success) {
				this.learnDialog.state = 'refused'
				this.learnDialog.message = res.message
			}
			// Stay in 'starting' (indeterminate spinner) until the first
			// learn-progress report arrives — handleLearnProgress flips
			// state to 'waiting' once the lock acknowledges with steps.
		},
		async cancelLearn() {
			await this.app.apiRequest(
				'accessControlCancelCredentialLearn',
				[this.node.id, this.currentEndpoint.endpointIndex],
				{ infoSnack: false, errorSnack: false },
			)
			this._stopRetryFlash()
			this.learnDialog.show = false
		},
		async cancelBusyAndRetry() {
			await this.cancelLearn()
			if (this.learnDialog.user) {
				this.openEnroll(this.learnDialog.user)
			}
		},
		retryLearn() {
			if (!this.learnDialog.user) return
			this.startLearn({
				user: this.learnDialog.user,
				type: this.learnDialog.type,
				slot: this.learnDialog.slot,
				timeout: this.learnDialog.timeout,
				totalSteps: this.learnDialog.totalSteps,
			})
		},
		closeLearn() {
			this._stopRetryFlash()
			this.learnDialog.show = false
		},
		_triggerRetryFlash() {
			this._stopRetryFlash()
			const step = 90
			for (let i = 0; i < 3; i++) {
				const onAt = i * 2 * step
				const offAt = onAt + step
				this._retryFlashTimers.push(
					setTimeout(() => {
						this.learnDialog.retryFlash = true
					}, onAt),
					setTimeout(() => {
						this.learnDialog.retryFlash = false
					}, offAt),
				)
			}
		},
		_stopRetryFlash() {
			if (this._retryFlashTimers) {
				for (const t of this._retryFlashTimers) clearTimeout(t)
			}
			this._retryFlashTimers = []
			this.learnDialog.retryFlash = false
		},
		handleLearnProgress(args) {
			if (!this.learnDialog.show) return
			if (
				args.userId !== this.learnDialog.userId ||
				args.credentialType !== this.learnDialog.type ||
				args.credentialSlot !== this.learnDialog.slot
			) {
				return
			}
			const isRetry = args.status === UserCredentialLearnStatus.StepRetry
			this.learnDialog.retry = isRetry
			if (isRetry) {
				this._triggerRetryFlash()
			}
			const total = this.learnDialog.totalSteps || 1
			const remaining = Math.min(args.stepsRemaining ?? total, total)
			const completed = Math.max(0, total - remaining)
			this.learnDialog.completedSteps = completed
			this.learnDialog.progress =
				total > 0 ? (completed / total) * 100 : 0
			// `waiting` lets the user see the prompt even if the
			// initial `starting` state never gets a sync ack.
			if (this.learnDialog.state === 'starting') {
				this.learnDialog.state = 'waiting'
			}
		},
		handleLearnCompleted(args) {
			if (!this.learnDialog.show) return
			if (
				args.userId !== this.learnDialog.userId ||
				args.credentialType !== this.learnDialog.type ||
				args.credentialSlot !== this.learnDialog.slot
			) {
				return
			}
			const status = args.status
			if (args.success && status === UserCredentialLearnStatus.Success) {
				this.learnDialog.state = 'success'
			} else if (status === UserCredentialLearnStatus.Timeout) {
				this.learnDialog.state = 'timeout'
			} else if (status === UserCredentialLearnStatus.AlreadyInProgress) {
				this.learnDialog.state = 'busy'
			} else if (
				status === UserCredentialLearnStatus.EndedNotDueToTimeout
			) {
				this.learnDialog.state = 'aborted'
			} else {
				this.learnDialog.state = 'refused'
				this.learnDialog.message = learnStatusMessage(status)
			}
		},
		async onSaveUser({ payload, credential }) {
			if (!this.currentEndpoint) return
			const api = this.userDialog.editMode
				? 'accessControlSetUser'
				: 'accessControlAddUser'
			const args = this.userDialog.editMode
				? [
						this.node.id,
						this.currentEndpoint.endpointIndex,
						payload.userId,
						payload.options,
					]
				: [
						this.node.id,
						this.currentEndpoint.endpointIndex,
						payload.userId,
						payload.options,
						credential,
					]
			const res = await this.app.apiRequest(api, args, {
				infoSnack: false,
				errorSnack: true,
			})
			if (!res.success) return
			const result = this.userDialog.editMode
				? res.result
				: res.result?.userResult
			if (result === SetUserResult.OK) {
				this.userDialog.show = false
				this.showSnackbar('User saved.', 'success')
				if (
					!this.userDialog.editMode &&
					res.result?.credentialResult !== undefined &&
					res.result.credentialResult !== SetCredentialResult.OK
				) {
					this.showSnackbar(
						`User created, but credential failed: ${setCredentialResultMessage(
							res.result.credentialResult,
						)}`,
						'warning',
					)
				}
				this.refresh()
			} else {
				this.showSnackbar(setUserResultMessage(result), 'error')
			}
		},
		async onSaveCredential({ payload }) {
			if (!this.currentEndpoint) return
			const args = [
				this.node.id,
				this.currentEndpoint.endpointIndex,
				payload.userId,
				payload.type,
				payload.slot,
				payload.data,
			]
			const res = await this.app.apiRequest(
				'accessControlSetCredential',
				args,
				{ infoSnack: false, errorSnack: true },
			)
			if (!res.success) return
			const result = res.result
			if (result === SetCredentialResult.OK) {
				this.credentialDialog.show = false
				this.showSnackbar('Credential saved.', 'success')
			} else {
				this.showSnackbar(setCredentialResultMessage(result), 'error')
			}
		},
		async confirmDeleteUser(user) {
			if (!this.currentEndpoint) return
			const creds = this.credentialsFor(user)
			const credsSummary = creds.length
				? `<br><b>${creds.length}</b> credential(s) will be deleted with this user.`
				: ''
			const ok = await this.app.confirm(
				`Delete user ${user.userName || user.userId}?`,
				`This is irreversible.${credsSummary}`,
				'warning',
				{ confirmText: 'Delete', cancelText: 'Cancel' },
			)
			if (!ok) return
			const res = await this.app.apiRequest(
				'accessControlDeleteUser',
				[this.node.id, this.currentEndpoint.endpointIndex, user.userId],
				{ infoSnack: false, errorSnack: true },
			)
			if (res.success && res.result === SetUserResult.OK) {
				this.showSnackbar('User deleted.', 'success')
			} else if (res.success) {
				this.showSnackbar(setUserResultMessage(res.result), 'error')
			}
		},
		async confirmDeleteAllUsers() {
			if (!this.currentEndpoint) return
			const ok = await this.app.confirm(
				`Delete every user on ${this.node.name || this.node.hexId}?`,
				`All users and their credentials will be deleted. This is irreversible. The lock does not report progress; the list will catch up via live events.`,
				'error',
				{ confirmText: 'Wipe lock', cancelText: 'Cancel' },
			)
			if (!ok) return
			const res = await this.app.apiRequest(
				'accessControlDeleteAllUsers',
				[this.node.id, this.currentEndpoint.endpointIndex],
				{ infoSnack: false, errorSnack: true },
			)
			if (res.success) {
				this.showSnackbar(
					'Wipe acknowledged. The list will refresh as events arrive.',
					'info',
				)
			}
		},
		async confirmDeleteCredential(cred) {
			if (!this.currentEndpoint) return
			const user = this.currentEndpoint.users.find(
				(u) => u.userId === cred.userId,
			)
			const cascade =
				this.currentEndpoint.capabilities
					.requiresCredentialAtUserCreation &&
				this.credentialsFor({ userId: cred.userId }).length === 1
			const cascadeMsg = cascade
				? `<br><b>This is the user's last credential.</b> The user will also be deleted.`
				: ''
			const ok = await this.app.confirm(
				`Delete ${credentialTypeLabel(cred.type)} (slot ${cred.slot})?`,
				`Owner: ${user?.userName || `User ${cred.userId}`}${cascadeMsg}`,
				'warning',
				{ confirmText: 'Delete', cancelText: 'Cancel' },
			)
			if (!ok) return
			const res = await this.app.apiRequest(
				'accessControlDeleteCredential',
				[
					this.node.id,
					this.currentEndpoint.endpointIndex,
					cred.userId,
					cred.type,
					cred.slot,
				],
				{ infoSnack: false, errorSnack: true },
			)
			if (res.success && res.result === SetCredentialResult.OK) {
				this.showSnackbar('Credential deleted.', 'success')
			} else if (res.success) {
				this.showSnackbar(
					setCredentialResultMessage(res.result),
					'error',
				)
			}
		},
		openReassign(cred) {
			const owner = this.currentEndpoint.users.find(
				(u) => u.userId === cred.userId,
			)
			this.reassignDialog = {
				show: true,
				credential: cred,
				fromName: owner?.userName || `User ${cred.userId}`,
				destUserId: null,
			}
		},
		async performReassign() {
			const { credential, destUserId } = this.reassignDialog
			if (!credential || !destUserId) return
			const res = await this.app.apiRequest(
				'accessControlAssignCredential',
				[
					this.node.id,
					this.currentEndpoint.endpointIndex,
					credential.type,
					credential.slot,
					destUserId,
				],
				{ infoSnack: false, errorSnack: true },
			)
			if (res.success && res.result === AssignCredentialResult.OK) {
				this.showSnackbar('Credential reassigned.', 'success')
				this.reassignDialog.show = false
			} else if (res.success) {
				this.showSnackbar(
					assignCredentialResultMessage(res.result),
					'error',
				)
			}
		},
		openBulkDelete() {
			this.bulkDeleteDialog = { show: true, userId: 0, type: 0 }
		},
		async performBulkDelete() {
			const { userId, type } = this.bulkDeleteDialog
			const res = await this.app.apiRequest(
				'accessControlDeleteCredentials',
				[
					this.node.id,
					this.currentEndpoint.endpointIndex,
					{
						userId: userId || undefined,
						credentialType: type || undefined,
					},
				],
				{ infoSnack: false, errorSnack: true },
			)
			if (res.success && res.result === SetCredentialResult.OK) {
				this.showSnackbar(
					'Credentials deletion acknowledged.',
					'success',
				)
				this.bulkDeleteDialog.show = false
			} else if (res.success) {
				this.showSnackbar(
					setCredentialResultMessage(res.result),
					'error',
				)
			}
		},
		startAdminPinEdit() {
			this.adminCodePinDraft = ''
			this.editingAdminPin = true
		},
		onDigitBeforeInput(e) {
			// Block any non-digit insertion (typed or pasted).
			if (e.data != null && !/^\d+$/.test(e.data)) {
				e.preventDefault()
			}
		},
		cancelAdminPinEdit() {
			this.editingAdminPin = false
			this.adminCodePinDraft = ''
		},
		async saveAdminCodeInline() {
			if (!this.adminPinValid || this.adminCodeSaving) return
			this.adminCodeSaving = true
			try {
				const res = await this.app.apiRequest(
					'accessControlSetAdminCode',
					[
						this.node.id,
						this.currentEndpoint.endpointIndex,
						this.adminCodePinDraft,
					],
					{ infoSnack: false, errorSnack: true },
				)
				if (!res.success) return
				const result = res.result?.result
				if (result != null && !isAdminCodeSuccess(result)) {
					this.showSnackbar(
						setAdminCodeResultMessage(result),
						'error',
					)
					return
				}
				this.showSnackbar('Admin code updated.', 'success')
				this.editingAdminPin = false
				this.adminCodePinDraft = ''
			} finally {
				this.adminCodeSaving = false
			}
		},
		async clearAdminCode() {
			const ok = await this.app.confirm(
				'Clear admin code?',
				'The lock will no longer accept the admin PIN.',
				'warning',
				{ confirmText: 'Clear', cancelText: 'Cancel' },
			)
			if (!ok) return false
			const res = await this.app.apiRequest(
				'accessControlSetAdminCode',
				[this.node.id, this.currentEndpoint.endpointIndex, ''],
				{ infoSnack: false, errorSnack: true },
			)
			if (!res.success) return false
			const result = res.result?.result
			if (result != null && !isAdminCodeSuccess(result)) {
				this.showSnackbar(setAdminCodeResultMessage(result), 'error')
				return false
			}
			this.showSnackbar('Admin code cleared.', 'success')
			return true
		},
		activityColor(event) {
			if (event.includes('deleted')) return 'error'
			if (event.includes('added')) return 'success'
			if (event.includes('learn')) return 'warning'
			return 'primary'
		},
		activityIcon(event) {
			if (event.includes('user')) return 'person'
			if (event.includes('credential learn')) return 'fingerprint'
			if (event.includes('credential')) return 'key'
			return 'info'
		},
		activitySummary(evt) {
			const arg = evt.args?.[1] ?? evt.args?.[0]
			if (!arg) return ''
			const bits = []
			if (arg.userId != null) bits.push(`user ${arg.userId}`)
			if (arg.credentialType != null)
				bits.push(credentialTypeLabel(arg.credentialType))
			if (arg.credentialSlot != null)
				bits.push(`slot ${arg.credentialSlot}`)
			if (arg.status != null) bits.push(learnStatusMessage(arg.status))
			return bits.join(' · ')
		},
	},
	watch: {
		'node.eventsQueue.length'(_n, _o) {
			const evt = this.node.eventsQueue[this.node.eventsQueue.length - 1]
			if (!evt) return
			if (evt.event === 'credential learn progress') {
				this.handleLearnProgress(evt.args?.[1] ?? evt.args?.[0])
			} else if (evt.event === 'credential learn completed') {
				this.handleLearnCompleted(evt.args?.[1] ?? evt.args?.[0])
			}
		},
	},
	beforeUnmount() {
		this._stopRetryFlash()
	},
	mounted() {
		this._retryFlashTimers = []
		if (this.state?.primaryEndpoint != null) {
			this.endpointIndex = this.state.primaryEndpoint
		}
		// Prime the cache via a getState call (no network if cache is warm).
		this.app
			.apiRequest('accessControlGetState', [this.node.id], {
				infoSnack: false,
				errorSnack: false,
			})
			.then(() => {
				if (
					this.currentEndpoint?.capabilities.supportsAdminCode &&
					this.currentEndpoint.adminCode === undefined
				) {
					this.app.apiRequest(
						'accessControlGetAdminCode',
						[this.node.id, this.currentEndpoint.endpointIndex],
						{ infoSnack: false, errorSnack: false },
					)
				}
			})
	},
}
</script>

<style scoped>
.font-monospace {
	font-family: 'Roboto Mono', monospace;
}

.access-control-root {
	width: 100%;
	max-width: 100%;
	min-width: 0;
}

.access-control-toolbar > .v-tabs {
	min-width: 0;
	flex: 1 1 auto;
}

.access-control-root :deep(.v-expansion-panel-title) {
	flex-wrap: wrap;
	row-gap: 4px;
}

.user-status-dot {
	display: inline-block;
	width: 10px;
	height: 10px;
	border-radius: 50%;
	flex-shrink: 0;
}

.user-status-dot--active {
	background-color: rgb(var(--v-theme-success));
}

.user-status-dot--inactive {
	background-color: rgb(var(--v-theme-on-surface));
	opacity: 0.3;
}

.user-title-block {
	min-width: 0;
	flex: 1 1 auto;
}

.cred-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
	gap: 12px;
}

.cred-card {
	display: flex;
	flex-direction: column;
}

.cred-card .cred-menu-btn {
	opacity: 0;
	transition: opacity 0.15s ease;
}

.cred-card:hover .cred-menu-btn,
.cred-card:focus-within .cred-menu-btn {
	opacity: 1;
}

@media (hover: none) {
	.cred-card .cred-menu-btn {
		opacity: 1;
	}
}

.access-control-root :deep(.v-expansion-panels) {
	border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
	border-radius: 4px;
	overflow: hidden;
}

.access-control-root :deep(.v-expansion-panel:not(:last-child)) {
	border-bottom: 1px solid
		rgba(var(--v-border-color), var(--v-border-opacity));
}

.access-control-root
	:deep(.v-expansion-panel--active > .v-expansion-panel-title) {
	border-bottom: 1px solid
		rgba(var(--v-border-color), var(--v-border-opacity));
}

.lock-settings-card {
	max-width: 560px;
	border: 1px solid rgba(var(--v-border-color), 0.08);
}

.set-indicator {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	font-weight: 500;
}

.set-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: rgb(var(--v-theme-success));
}

.admin-pin-field {
	max-width: 320px;
}

.pin-masked :deep(input) {
	-webkit-text-security: disc;
	-moz-text-security: disc;
	text-security: disc;
}
</style>
