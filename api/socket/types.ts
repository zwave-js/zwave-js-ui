/**
 * Shared, tiny plumbing for the inbound Socket.IO event handlers under
 * `api/socket/`. Every handler in `zwaveApi.ts`/`mqttApi.ts`/`hassApi.ts`/
 * `znifferApi.ts`/`subscriptions.ts` accepts an optional per-call `cb`
 * acknowledgement and defaults it to a no-op when the connected client
 * doesn't supply one - mirroring `socket.io`'s own client API, where the
 * ack parameter is optional.
 */

/** A Socket.IO acknowledgement callback, called with the handler's result. */
export type SocketAck<T> = (result: T) => void

/**
 * Default acknowledgement callback used when a client doesn't pass one.
 * A zero-parameter function is structurally assignable to any `SocketAck<T>`
 * (TypeScript permits a callback with fewer declared parameters than the
 * type it's assigned to), so this single `noop` covers every handler below
 * instead of a separate copy per file.
 */
export const noop = (): void => {}
