// src/lib/icons.ts
//
// Central re-export of the dashboard's icon vocabulary. Each Lucide
// glyph is aliased to a semantic name suffixed `Icon` so call sites
// read `<AddIcon :size="ICON_SIZE.inline" />`.
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
 *
 * The five tabled sizes (chip / inline / nav / topbar / drawerHeader)
 * come verbatim from the handoff's Iconography section
 * (`.design-handoff/project/design-system.jsx:1206`); the three
 * untabled sizes (pill / caret / dense) are implicit usages from the
 * design's component code (e.g. PillA leading glyph at size=10,
 * expandable section chevron at size=12, update-notifier at size=13).
 *
 * Call sites read `<AddIcon :size="ICON_SIZE.inline" />` — numeric
 * literals are forbidden in dashboard components. Sharing a numeric
 * value across aliases is fine; adding a new value is a design call.
 */
export const ICON_SIZE = {
	pill: 10, // pill leading glyph; popover-menu check / chevron
	chip: 11, // chips
	caret: 12, // expandable section chevron (sort / group headers)
	dense: 13, // update notifier; dense action buttons (refresh / trash)
	inline: 14, // table rows / inline
	nav: 16, // nav rows
	topbar: 18, // top bar / icon buttons
	drawerHeader: 22, // drawer header
} as const

export type IconSize = (typeof ICON_SIZE)[keyof typeof ICON_SIZE]
