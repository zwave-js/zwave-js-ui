// Per-type renderer registry for ZwPrimaryDisplay.
//
// Adding a new primary-value type is:
//   1. Extend PrimaryValueType in @/lib/dashboard-types.
//   2. Map the projection in plan 70 (`projectPrimaryValue`).
//   3. Add the corresponding shape to DeviceAction.
//   4. Create ZwPrimary<NewType>.vue here.
//   5. Add the entry to PRIMARY_RENDERERS — TypeScript's
//      `Record<PrimaryKey, Component>` exhaustiveness will fail the
//      build until this is done.

import type { Component } from 'vue'
import type { PrimaryValueType } from '@/lib/dashboard-types'

import Toggle from './ZwPrimaryToggle.vue'
import Dim from './ZwPrimaryDim.vue'
import Lock from './ZwPrimaryLock.vue'
import Reading from './ZwPrimaryReading.vue'
import State from './ZwPrimaryState.vue'
import Thermostat from './ZwPrimaryThermostat.vue'

export type PrimaryKey = PrimaryValueType

export const PRIMARY_RENDERERS: Record<PrimaryKey, Component> = {
	toggle: Toggle,
	dim: Dim,
	lock: Lock,
	reading: Reading,
	state: State,
	thermostat: Thermostat,
}
