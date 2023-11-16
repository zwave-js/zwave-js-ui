import EventEmitter from 'events'
import { applyMixin } from './utils'

/**
 * A type-safe EventEmitter interface to use in place of Node.js's EventEmitter.
 *
 * **Usage:**
 *
 * 1.) Define event signatures
 * ```ts
 * interface TestEvents {
 * 	test1: (arg1: number) => void;
 * 	test2: () => void;
 * }
 * ```
 *
 * 2a.) direct inheritance:
 * ```ts
 * class Test extends TypedEventEmitter<TestEvents> {
 * 	// class implementation
 * }
 * ```
 * 2b.) as a mixin
 * ```ts
 * interface Test extends TypedEventEmitter<TestEvents> {}
 * Mixin([EventEmitter]) // This is a decorator - prepend it with an <at> sign
 * class Test extends OtherClass implements TypedEventEmitter<TestEvents> {
 * 	// class implementation
 * }
 * ```
 */

export type EventHandler =
	// Add more overloads as necessary
	| ((arg1: any, arg2: any, arg3: any, arg4: any) => void)
	| ((arg1: any, arg2: any, arg3: any) => void)
	| ((arg1: any, arg2: any) => void)
	| ((arg1: any) => void)
	| ((...args: any[]) => void)

export interface TypedEventEmitter<
	TEvents extends Record<keyof TEvents, EventHandler>,
> {
	on<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	once<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	prependListener<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	prependOnceListener<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this

	removeListener<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this
	off<TEvent extends keyof TEvents>(
		event: TEvent,
		callback: TEvents[TEvent],
	): this

	removeAllListeners(event?: keyof TEvents): this

	emit<TEvent extends keyof TEvents>(
		event: TEvent,
		...args: Parameters<TEvents[TEvent]>
	): boolean

	setMaxListeners(n: number): this
	getMaxListeners(): number

	listeners<TEvent extends keyof TEvents>(
		eventName: TEvent,
	): TEvents[TEvent][]
	rawListeners<TEvent extends keyof TEvents>(
		eventName: TEvent,
	): TEvents[TEvent][]
	listenerCount<TEvent extends keyof TEvents>(
		event: TEvent,
		listener?: TEvents[TEvent],
	): number

	eventNames(): Array<keyof TEvents>
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class TypedEventEmitter<
	TEvents extends Record<keyof TEvents, EventHandler>,
> {}

// Make TypedEventEmitter inherit from EventEmitter without actually extending
applyMixin(TypedEventEmitter, EventEmitter)
