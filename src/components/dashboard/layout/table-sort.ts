// table-sort.ts
//
// Plan 75 took over the canonical sort + comparator implementation
// (`src/lib/deviceFilter.ts`). This module stays as a re-export shim
// so existing imports (`./table-sort`) keep working without churn —
// `ZwTableBody` and `ZwAppShell` import the same symbols either way.

export {
	DEFAULT_SORT,
	SORTABLE_KEYS,
	compareDevices,
	nextSort,
} from '../../../lib/deviceFilter.ts'
export type { SortDir, SortKey, SortState } from '../../../lib/deviceFilter.ts'
