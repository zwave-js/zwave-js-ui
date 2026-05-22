// src/lib/icons.ts
//
// Central re-export of the dashboard's icon vocabulary. Each Lucide
// glyph is aliased to a semantic name suffixed `Icon` so call sites
// read `<AddIcon :size="ICON_SIZE.button" />`.
//
// Call sites import directly:
//   import { AddIcon, ICON_SIZE } from '@/lib/icons'
//
// Lucide ships per-icon ESM entry points; Vite tree-shakes unused aliases.
//
// A few Lucide glyphs back two semantic roles:
//   - Sun → DimmerIcon (dimmable lights) and SunIcon (weather/illuminance)
//   - Thermometer → ThermostatIcon (climate device) and TempIcon (sensor)
// Kept as distinct aliases so call sites express intent — a future swap
// to a dedicated glyph touches one line here, not every consumer.

export {
	Plus as AddIcon,
	ArrowDown as ArrowDownIcon,
	ArrowUp as ArrowUpIcon,
	TriangleAlert as AlertIcon,
	Battery as BatteryIcon,
	Bell as BellIcon,
	Blinds as ShadeIcon,
	Lightbulb as BulbIcon,
	ChartLine as GraphIcon,
	Check as CheckIcon,
	ChevronDown as ChevronDownIcon,
	ChevronRight as ChevronRightIcon,
	ChevronUp as ChevronUpIcon,
	CircleCheck as StatusIcon,
	ClipboardList as InterviewIcon,
	Clock as ClockIcon,
	Cpu as ControllerIcon,
	DoorClosed as ContactIcon,
	Download as DownloadIcon,
	Droplet as LeakIcon,
	Filter as FilterIcon,
	House as LocationsIcon,
	LayoutGrid as GridIcon,
	Layers as SceneIcon,
	Link as LinkIcon,
	List as ListIcon,
	Lock as LockIcon,
	Menu as MenuIcon,
	Moon as MoonIcon,
	MoreHorizontal as MoreIcon,
	Network as NetworkIcon,
	Pencil as EditIcon,
	Play as PlayIcon,
	Plug as PlugIcon,
	Power as PowerIcon,
	QrCode as QrIcon,
	Radio as MotionIcon,
	RefreshCw as RefreshIcon,
	Search as SearchIcon,
	Settings as SettingsIcon,
	Signal as SignalIcon,
	SignalHigh as SignalHighIcon,
	SignalLow as SignalLowIcon,
	SignalMedium as SignalMedIcon,
	Siren as SirenIcon,
	Sun as DimmerIcon,
	Sun as SunIcon,
	Tablet as RemoteIcon,
	Thermometer as ThermostatIcon,
	Thermometer as TempIcon,
	ToggleRight as SwitchIcon,
	Trash2 as TrashIcon,
	Type as TypeIcon,
	Upload as UploadIcon,
	X as XIcon,
	Zap as ZapIcon,
	Activity as PulseIcon,
} from '@lucide/vue'

/**
 * Closed vocabulary of icon sizes used across the dashboard.
 * Call sites read `<AddIcon :size="ICON_SIZE.button" />` — numeric
 * literals are forbidden in dashboard components.
 *
 * Sharing a numeric value across aliases is fine (button covers three
 * surfaces); adding a new numeric value is a design decision.
 */
export const ICON_SIZE = {
	pill: 10, // pill leading glyph, popover check / chevron
	chip: 11, // chip glyph, table-row inline icon, segmented glyph, columns-menu filter
	sortArrow: 12, // header chevrons, sort-direction arrows
	update: 13, // expanded update-notifier (between chip and button)
	button: 14, // primary button leading icon, table-row archetype glyph, search-input prepend
	nav: 16, // sidebar nav row, top-bar search glyph
	topbar: 18, // top-bar icon buttons, menu icon, status icons, drawer close button
	drawerHeader: 22, // drawer header icon stamp
} as const

export type IconSize = (typeof ICON_SIZE)[keyof typeof ICON_SIZE]
