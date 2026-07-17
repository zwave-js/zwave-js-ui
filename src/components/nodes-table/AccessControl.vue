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
					:disabled="!canAddUser"
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
							@click="openBulkDeleteUsers"
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
												Delete user
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
														credentialTypeSupportsLearn(
															cred.type,
														) &&
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
			:saving="savingUser"
			:users="currentEndpoint ? currentEndpoint.users : []"
			:credentials="currentEndpoint ? currentEndpoint.credentials : []"
			@save="onSaveUser"
		/>

		<DialogAccessControlCredential
			v-model="credentialDialog.show"
			:capabilities="currentEndpoint && currentEndpoint.capabilities"
			:initial="credentialDialog.initial"
			:lock-owner="credentialDialog.lockOwner"
			:saving="savingCredential"
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
						v-if="canCancelLearn"
						color="error"
						variant="text"
						@click="cancelLearn"
					>
						Cancel
					</v-btn>
					<v-btn
						v-if="canRetryLearn"
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
					<v-btn v-if="canCloseLearn" @click="closeLearn">
						Close
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog
			v-model="reassignDialog.show"
			max-width="420"
			:persistent="reassigning"
		>
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
						:disabled="reassigning"
					/>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn
						variant="text"
						:disabled="reassigning"
						@click="reassignDialog.show = false"
					>
						Cancel
					</v-btn>
					<v-btn
						color="primary"
						:disabled="!reassignDialog.destUserId"
						:loading="reassigning"
						@click="performReassign"
					>
						Reassign
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog
			v-model="bulkDeleteUsersDialog.show"
			max-width="480"
			:persistent="deletingAllUsers"
		>
			<v-card>
				<v-card-title>Delete all users</v-card-title>
				<v-card-text>
					All users and their credentials will be deleted. This is
					irreversible.
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn
						variant="text"
						:disabled="deletingAllUsers"
						@click="bulkDeleteUsersDialog.show = false"
					>
						Cancel
					</v-btn>
					<v-btn
						color="error"
						:loading="deletingAllUsers"
						@click="performBulkDeleteUsers"
					>
						Wipe lock
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>

		<v-dialog
			v-model="bulkDeleteDialog.show"
			max-width="480"
			:persistent="deletingCredentials"
		>
			<v-card>
				<v-card-title>Delete credentials matching</v-card-title>
				<v-card-text>
					<v-select
						v-model="bulkDeleteDialog.userId"
						:items="bulkUserItems"
						label="Owner"
						hide-details
						class="mb-3"
						:disabled="deletingCredentials"
					/>
					<v-select
						v-model="bulkDeleteDialog.type"
						:items="bulkTypeItems"
						label="Type"
						hide-details
						:disabled="deletingCredentials"
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
						:disabled="deletingCredentials"
						@click="bulkDeleteDialog.show = false"
					>
						Cancel
					</v-btn>
					<v-btn
						color="error"
						:loading="deletingCredentials"
						@click="performBulkDelete"
					>
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
							v-for="cap in availableLearnableTypeCaps"
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
	maskCredential,
	nextFreeCredentialSlot,
	nextFreeUserSlot,
	escapeHtml,
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

const RETRY_FLASH_STEP_MS = 90
const RETRY_FLASH_COUNT = 3

function eventPayload(event) {
	// Endpoint CC events emit (endpoint, payload)
	return event.args?.[1] ?? event.args?.[0]
}

function eventKey(event) {
	const payload = eventPayload(event)
	return [
		event.time,
		event.event,
		payload?.userId,
		payload?.credentialType,
		payload?.credentialSlot,
		payload?.status,
		payload?.stepsRemaining,
	].join(':')
}

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
			savingUser: false,
			savingCredential: false,
			reassigning: false,
			deletingAllUsers: false,
			deletingCredentials: false,
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
			bulkDeleteUsersDialog: {
				show: false,
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
			lastProcessedAccessControlEvent: null,
			accessControlEventQueueInitialized: false,
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
			return this.availableLearnableTypeCaps.length > 0
		},
		learnableTypeCaps() {
			return (
				this.currentEndpoint?.capabilities.supportedCredentialTypes.filter(
					(t) => t.supportsCredentialLearn,
				) ?? []
			)
		},
		availableLearnableTypeCaps() {
			return this.learnableTypeCaps.filter(
				(type) =>
					nextFreeCredentialSlot(
						this.currentEndpoint.credentials,
						type.type,
						type.numberOfCredentialSlots,
					) !== undefined,
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
		canCancelLearn() {
			return ['waiting', 'starting'].includes(this.learnDialog.state)
		},
		canRetryLearn() {
			return ['timeout', 'aborted'].includes(this.learnDialog.state)
		},
		canCloseLearn() {
			return [
				'success',
				'refused',
				'timeout',
				'busy',
				'aborted',
			].includes(this.learnDialog.state)
		},
		canAddUser() {
			return (
				this.currentEndpoint &&
				nextFreeUserSlot(
					this.currentEndpoint.users,
					this.currentEndpoint.capabilities.maxUsers,
				) !== undefined
			)
		},
		directEntryTypeCaps() {
			return (
				this.currentEndpoint?.capabilities.supportedCredentialTypes.filter(
					(t) =>
						isDirectEntry(t.type) &&
						nextFreeCredentialSlot(
							this.currentEndpoint.credentials,
							t.type,
							t.numberOfCredentialSlots,
						) !== undefined,
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
			return this.currentEndpoint?.adminCodeSet ? 'set' : 'unset'
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
		credentialTypeSupportsLearn(type) {
			return this.learnableTypeCaps.some(
				(capability) => capability.type === type,
			)
		},
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
			if (!this.canAddUser) {
				this.showSnackbar('All user slots are occupied.', 'error')
				return
			}
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
			const learnable = this.availableLearnableTypeCaps
			if (learnable.length === 0) return
			if (learnable.length === 1) {
				this.startLearnForType(user, learnable[0])
				return
			}
			this.learnTypeDialog = { show: true, user }
		},
		startLearnForType(user, cap) {
			const slot = this.nextSlotForType(cap.type)
			if (slot === undefined) {
				this.showSnackbar(
					`No ${credentialTypeLabel(cap.type)} slots are available.`,
					'error',
				)
				return
			}
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
			return nextFreeCredentialSlot(
				this.currentEndpoint.credentials,
				type,
				cap?.numberOfCredentialSlots ?? 0,
			)
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
			const res = await this.app.apiRequest(
				'accessControlCancelCredentialLearn',
				[this.node.id, this.currentEndpoint.endpointIndex],
				{ infoSnack: false, errorSnack: true },
			)
			if (!res.success) return false
			this._stopRetryFlash()
			this.learnDialog.show = false
			return true
		},
		async cancelBusyAndRetry() {
			if (!(await this.cancelLearn())) return
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
			for (let i = 0; i < RETRY_FLASH_COUNT; i++) {
				const onAt = i * 2 * RETRY_FLASH_STEP_MS
				const offAt = onAt + RETRY_FLASH_STEP_MS
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
			// Treat Started as no progress even when the lock reports zero steps.
			const remaining =
				args.status === UserCredentialLearnStatus.Started
					? total
					: Math.min(args.stepsRemaining ?? total, total)
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
			// Started/StepRetry are progress, not completion — zwave-js routes
			// them here when the device reports 0 steps remaining
			if (
				status === UserCredentialLearnStatus.Started ||
				status === UserCredentialLearnStatus.StepRetry
			) {
				this.handleLearnProgress(args)
				return
			}
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
			this.savingUser = true
			try {
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
				} else {
					this.showSnackbar(setUserResultMessage(result), 'error')
				}
			} finally {
				this.savingUser = false
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
			this.savingCredential = true
			try {
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
					this.showSnackbar(
						setCredentialResultMessage(result),
						'error',
					)
				}
			} finally {
				this.savingCredential = false
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
		openBulkDeleteUsers() {
			this.bulkDeleteUsersDialog.show = true
		},
		async performBulkDeleteUsers() {
			if (!this.currentEndpoint) return
			this.deletingAllUsers = true
			try {
				const res = await this.app.apiRequest(
					'accessControlDeleteAllUsers',
					[this.node.id, this.currentEndpoint.endpointIndex],
					{ infoSnack: false, errorSnack: true },
				)
				if (res.success && res.result === SetUserResult.OK) {
					this.showSnackbar('All users deleted.', 'success')
					this.bulkDeleteUsersDialog.show = false
				} else if (res.success) {
					this.showSnackbar(setUserResultMessage(res.result), 'error')
				}
			} finally {
				this.deletingAllUsers = false
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
			const owner = escapeHtml(user?.userName || `User ${cred.userId}`)
			const ok = await this.app.confirm(
				`Delete ${credentialTypeLabel(cred.type)} (slot ${cred.slot})?`,
				`Owner: ${owner}${cascadeMsg}`,
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
			this.reassigning = true
			try {
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
			} finally {
				this.reassigning = false
			}
		},
		openBulkDelete() {
			this.bulkDeleteDialog = { show: true, userId: 0, type: 0 }
		},
		async performBulkDelete() {
			const { userId, type } = this.bulkDeleteDialog
			this.deletingCredentials = true
			try {
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
			} finally {
				this.deletingCredentials = false
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
			const arg = eventPayload(evt)
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
		processAccessControlEvents(events) {
			if (!this.accessControlEventQueueInitialized) {
				const latestEvent = events[events.length - 1]
				this.lastProcessedAccessControlEvent = latestEvent
					? eventKey(latestEvent)
					: null
				this.accessControlEventQueueInitialized = true
				return
			}
			const previousIndex = this.lastProcessedAccessControlEvent
				? events.findIndex(
						(event) =>
							eventKey(event) ===
							this.lastProcessedAccessControlEvent,
					)
				: -1
			const pendingEvents =
				previousIndex >= 0
					? events.slice(previousIndex + 1)
					: this.lastProcessedAccessControlEvent
						? events.slice(-1)
						: events
			for (const event of pendingEvents) {
				const payload = eventPayload(event)
				if (event.event === 'credential learn progress') {
					this.handleLearnProgress(payload)
				} else if (event.event === 'credential learn completed') {
					this.handleLearnCompleted(payload)
				}
			}
			const latestEvent = events[events.length - 1]
			this.lastProcessedAccessControlEvent = latestEvent
				? eventKey(latestEvent)
				: null
		},
	},
	watch: {
		'node.eventsQueue': {
			handler(events) {
				this.processAccessControlEvents(events)
			},
			deep: 1,
		},
	},
	beforeUnmount() {
		this._stopRetryFlash()
	},
	mounted() {
		this._retryFlashTimers = []
		this.processAccessControlEvents(this.node.eventsQueue)
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
					this.currentEndpoint.adminCodeSet === undefined
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
