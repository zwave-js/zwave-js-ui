/**
 * Inbound `SUBSCRIBE`/`UNSUBSCRIBE` Socket.IO handlers, extracted verbatim
 * (same behavior, same wire contract) from `api/app.ts`'s `setupSocket()`.
 *
 * Unlike the other inbound handlers, these never touch the gateway/zniffer
 * - they only manage this socket's Socket.IO room membership against the
 * static `channelMap`/`ALL_CHANNELS` catalog - so they take no `AppRuntime`.
 */
import type { Socket } from 'socket.io'
import { ALL_CHANNELS, channelMap, inboundEvents } from '../lib/SocketEvents.ts'
import { noop, type SocketAck } from './types.ts'

/** Request payload accepted by both handlers below. */
export interface ChannelSubscriptionRequest {
	channels?: unknown
}

export interface ChannelSubscriptionAck {
	channels: string[]
}

function currentSubscriptions(socket: Socket): string[] {
	// report current subscriptions (exclude socket's auto-joined room)
	return [...socket.rooms].filter(
		(r) => r !== socket.id && Object.hasOwn(channelMap, r),
	)
}

function requestedChannels(
	data: ChannelSubscriptionRequest | undefined,
): string[] {
	return Array.isArray(data?.channels)
		? data.channels.filter((c: unknown) => typeof c === 'string')
		: []
}

/**
 * Registers the `SUBSCRIBE`/`UNSUBSCRIBE` handlers. Preserved quirk:
 * `SUBSCRIBE`'s `"all"` expands to every channel in `ALL_CHANNELS`, but
 * `UNSUBSCRIBE` has no equivalent special case - a client that
 * unsubscribes from `"all"` matches no real channel, so nothing is
 * removed (asymmetric with subscribe).
 */
export function registerSubscriptionHandlers(socket: Socket): void {
	socket.on(
		inboundEvents.subscribe,
		async (
			data: ChannelSubscriptionRequest | undefined,
			cb: SocketAck<ChannelSubscriptionAck> = noop,
		) => {
			const channels = requestedChannels(data)

			const isAll = channels.includes('all')
			const validChannels = isAll
				? ALL_CHANNELS
				: channels.filter((c) => Object.hasOwn(channelMap, c))

			for (const channel of validChannels) {
				await socket.join(channel)
			}

			cb({ channels: currentSubscriptions(socket) })
		},
	)

	socket.on(
		inboundEvents.unsubscribe,
		async (
			data: ChannelSubscriptionRequest | undefined,
			cb: SocketAck<ChannelSubscriptionAck> = noop,
		) => {
			const channels = requestedChannels(data)

			const validChannels = channels.filter((c) =>
				Object.hasOwn(channelMap, c),
			)

			for (const channel of validChannels) {
				await socket.leave(channel)
			}

			cb({ channels: currentSubscriptions(socket) })
		},
	)
}
