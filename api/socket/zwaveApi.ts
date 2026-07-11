/**
 * Inbound `INITED`/`ZWAVE_API` Socket.IO handlers, extracted verbatim (same
 * behavior, same wire contract) from `api/app.ts`'s `setupSocket()`.
 *
 * Both handlers resolve the live gateway from `runtime` on every call (never
 * a captured/module-level reference) so a gateway replaced mid-restart is
 * observed by the very next event - see `AppRuntime.ts`'s class doc comment.
 */
import type { Socket } from 'socket.io'
import type ZwaveClient from '../lib/ZwaveClient.ts'
import type ZnifferManager from '../lib/ZnifferManager.ts'
import { inboundEvents } from '../lib/SocketEvents.ts'
import type { AppRuntime } from '../runtime/AppRuntime.ts'
import { noop, type SocketAck } from './types.ts'

type ZwaveState = ReturnType<ZwaveClient['getState']>
type ZnifferStatus = ReturnType<ZnifferManager['status']>

/**
 * `INITED`'s ack payload: whatever subset of `ZwaveClient.getState()`'s
 * shape is currently available (empty when no gateway/zwave is attached),
 * plus an optional `zniffer` status and always a `debugCaptureActive` flag.
 */
export interface InitAckState extends Partial<ZwaveState> {
	zniffer?: ZnifferStatus
	debugCaptureActive: boolean
}

/**
 * Registers the `INITED` handshake handler: replies with the gateway's
 * current zwave state (if `gw.zwave` is connected), the zniffer status (if
 * a zniffer is attached), and whether a debug capture session is active.
 */
export function registerInitHandler(socket: Socket, runtime: AppRuntime): void {
	socket.on(
		inboundEvents.init,
		(_data: unknown, cb: SocketAck<InitAckState> = noop) => {
			let state: Partial<ZwaveState> & { zniffer?: ZnifferStatus } = {}

			// Preserved quirk: throws the historical TypeError if no gateway
			// is currently attached.
			const currentGw = runtime.requireGateway('zwave')
			if (currentGw.zwave) {
				state = currentGw.zwave.getState()
			}

			const currentZniffer = runtime.getZniffer()
			if (currentZniffer) {
				state.zniffer = currentZniffer.status()
			}

			cb({
				...state,
				// Add debug session status
				debugCaptureActive: runtime.getDebugManager().isSessionActive(),
			})
		},
	)
}

/** Request payload accepted by the `ZWAVE_API` handler below. */
export interface ZwaveApiRequest {
	api: string
	args?: unknown
}

interface ZwaveApiAck {
	success: boolean
	message: string
	result?: unknown
	args?: unknown[]
	api?: string
}

type DynamicCallApi = (
	apiName: string,
	...args: unknown[]
) => Promise<ZwaveApiAck>

function wireArguments(args: unknown): unknown[] {
	return [...(args as Iterable<unknown>)]
}

/**
 * Registers the `ZWAVE_API` handler: dispatches `data.api` through the live
 * gateway's `ZwaveClient.callApi()`, echoing the requested `api` name back
 * on the ack; replies with a fixed "not connected" ack when `gw.zwave` is
 * absent.
 */
export function registerZwaveApiHandler(
	socket: Socket,
	runtime: AppRuntime,
): void {
	socket.on(
		inboundEvents.zwave,
		async (data: ZwaveApiRequest, cb: SocketAck<ZwaveApiAck> = noop) => {
			const currentGw = runtime.requireGateway('zwave')
			if (currentGw.zwave) {
				if (!data.args) data.args = []
				const callApi = currentGw.zwave.callApi.bind(
					currentGw.zwave,
				) as DynamicCallApi
				const result = await callApi(
					data.api,
					...wireArguments(data.args),
				)
				result.api = data.api
				cb(result)
			} else {
				cb({
					success: false,
					message: 'Zwave client not connected',
				})
			}
		},
	)
}
