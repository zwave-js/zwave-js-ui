// Dashboard icon vocabulary: each Lucide glyph is aliased to a semantic
// name suffixed `Icon`, so call sites read `<AddIcon :size="…" />`.
// A few glyphs back two roles (Sun → DimmerIcon and SunIcon; Thermometer
// → ThermostatIcon and TempIcon), kept as distinct aliases so call sites
// express intent.

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
	CircleHelp as UnknownIcon,
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
	// Lucide has no motion/PIR glyph; Radio's waves are the closest.
	Radio as MotionIcon,
	RefreshCw as RefreshIcon,
	Search as SearchIcon,
	Settings as SettingsIcon,
	Signal as SignalIcon,
	SignalHigh as SignalHighIcon,
	SignalLow as SignalLowIcon,
	SignalMedium as SignalMediumIcon,
	Siren as SirenIcon,
	Square as StopIcon,
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
 * Shared icon-size scale; components reference these names rather than
 * raw pixel values.
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
