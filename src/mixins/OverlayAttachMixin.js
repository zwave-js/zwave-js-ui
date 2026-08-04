import { ATTACH_KEY } from '@/lib/dashboard-overlay'

// Supplies `zwMenuProps` for the Vuetify controls still living in dialog
// bodies. A dashboard dialog is a native `<dialog>` in the top layer, which
// paints over `.v-overlay-container` — so those menus have to teleport into the
// dialog's own subtree instead. Outside a dialog `attach` is absent and
// Vuetify's default body teleport applies.
export default {
	inject: {
		zwOverlayAttach: { from: ATTACH_KEY, default: undefined },
	},
	computed: {
		zwMenuProps() {
			return this.zwOverlayAttach
				? { attach: this.zwOverlayAttach }
				: undefined
		},
	},
}
