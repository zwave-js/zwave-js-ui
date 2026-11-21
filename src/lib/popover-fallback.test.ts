import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const computePosition = vi.hoisted(() => vi.fn())
const autoUpdate = vi.hoisted(() => vi.fn())

vi.mock('@floating-ui/dom', () => ({
	computePosition,
	autoUpdate,
	offset: (px: number) => ({ name: 'offset', px }),
	flip: (opts: unknown) => ({ name: 'flip', opts }),
	shift: (opts: unknown) => ({ name: 'shift', opts }),
}))

import { trackAnchor, DEFAULT_OFFSET_PX } from './popover-fallback.ts'

// autoUpdate normally re-runs the callback on scroll and resize. Here it runs
// once, on demand, and hands back the teardown the tests assert on.
let update: () => void
let stop: ReturnType<typeof vi.fn>

// trackAnchor only ever touches `floating.style.setProperty`, so a stub stands
// in for a real element and the suite stays on the node environment
function fakeElement() {
	const props: Record<string, string> = {}
	const el = {
		style: {
			setProperty: (k: string, v: string, priority?: string) => {
				props[k] = priority ? `${v} !${priority}` : v
			},
		},
	} as never
	return { el, props }
}

beforeEach(() => {
	stop = vi.fn()
	autoUpdate.mockImplementation((_a, _f, cb: () => void) => {
		update = cb
		return stop
	})
	computePosition.mockResolvedValue({ x: 10, y: 20 })
})

afterEach(() => {
	vi.restoreAllMocks()
	vi.clearAllMocks()
})

describe('trackAnchor', () => {
	it('writes the computed position onto the floating element', async () => {
		const floating = fakeElement()
		trackAnchor(fakeElement().el, floating.el, {
			placement: 'top',
			offsetPx: DEFAULT_OFFSET_PX,
		})
		update()
		await vi.waitFor(() => expect(floating.props.top).toBe('20px'))
		expect(floating.props.left).toBe('10px')
	})

	it('drops a position that resolves after teardown', async () => {
		const floating = fakeElement()
		let resolve: (v: { x: number; y: number }) => void = () => {}
		computePosition.mockReturnValue(
			new Promise((r) => {
				resolve = r
			}),
		)

		const untrack = trackAnchor(fakeElement().el, floating.el, {
			placement: 'top',
			offsetPx: DEFAULT_OFFSET_PX,
		})
		update()
		untrack()
		resolve({ x: 10, y: 20 })
		await Promise.resolve()

		expect(stop).toHaveBeenCalledOnce()
		expect(floating.props.top).toBeUndefined()
	})

	it('passes the requested placement and offset through', () => {
		trackAnchor(fakeElement().el, fakeElement().el, {
			placement: 'bottom-end',
			offsetPx: 12,
		})
		update()
		const opts = computePosition.mock.calls[0][2]
		expect(opts.placement).toBe('bottom-end')
		expect(opts.strategy).toBe('fixed')
		expect(opts.middleware[0]).toEqual({ name: 'offset', px: 12 })
	})

	it('only narrows flip when fallbacks are given', () => {
		trackAnchor(fakeElement().el, fakeElement().el, {
			placement: 'bottom-end',
			offsetPx: DEFAULT_OFFSET_PX,
			fallbackPlacements: ['top-end'],
		})
		update()
		expect(computePosition.mock.calls[0][2].middleware[1]).toEqual({
			name: 'flip',
			opts: { fallbackPlacements: ['top-end'] },
		})
	})

	it('logs a failed position instead of rejecting', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {})
		computePosition.mockRejectedValue(new Error('detached'))
		trackAnchor(fakeElement().el, fakeElement().el, {
			placement: 'top',
			offsetPx: DEFAULT_OFFSET_PX,
		})
		update()
		await vi.waitFor(() => expect(err).toHaveBeenCalled())
	})

	it('writes with !important only when asked', async () => {
		const floating = fakeElement()
		trackAnchor(fakeElement().el, floating.el, {
			placement: 'top',
			offsetPx: DEFAULT_OFFSET_PX,
			important: true,
		})
		update()
		await vi.waitFor(() =>
			expect(floating.props.top).toBe('20px !important'),
		)
	})
})
