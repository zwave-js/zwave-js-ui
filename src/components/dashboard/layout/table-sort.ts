// Re-export shim for the sort helpers in `lib/deviceFilter.ts`.

export {
	DEFAULT_SORT,
	SORTABLE_KEYS,
	compareDevices,
	nextSort,
} from '../../../lib/deviceFilter.ts'
export type { SortDir, SortKey, SortState } from '../../../lib/deviceFilter.ts'
