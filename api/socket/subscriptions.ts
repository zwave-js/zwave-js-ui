import type { Socket } from 'socket.io'
import { ALL_CHANNELS, channelMap, inboundEvents } from '../lib/SocketEvents.ts'
import { noop, type SocketAck } from './types.ts'

export interface ChannelSubscriptionRequest {
	channels?: unknown
}

export interface ChannelSubscriptionAck {
	channels: string[]
}

function currentSubscriptions(socket: Socket): string[] {
	// Exclude the socket's own auto-joined room from the reported subscriptions
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

			const isAll = channels.includes('all')
			const validChannels = isAll
				? ALL_CHANNELS
				: channels.filter((c) => Object.hasOwn(channelMap, c))

			for (const channel of validChannels) {
				await socket.leave(channel)
			}

			cb({ channels: currentSubscriptions(socket) })
		},
	)
}
