import type { Request, Response } from 'express'
import type express from 'express'
import jwt from 'jsonwebtoken'
import type { JwtPayload, VerifyErrors } from 'jsonwebtoken'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type { PublicUser, User } from '../config/store.ts'
import store from '../config/store.ts'
import { sessionSecret } from '../config/app.ts'
import jsonStore from '../lib/jsonStore.ts'
import * as loggers from '../lib/logger.ts'
import * as utils from '../lib/utils.ts'
import { getErrorMessage } from '../lib/errors.ts'
import { isAuthEnabled } from '../runtime/AppRuntime.ts'

const logger = loggers.module('App')

declare module 'express-session' {
	export interface SessionData {
		/**
		 * The authenticated user record for this session.
		 *
		 * This is honestly typed as `User | PublicUser` (NOT just
		 * `PublicUser`) because the runtime genuinely assigns both shapes
		 * to this field depending on the code path:
		 *  - `/api/authenticate` assigns a `PublicUser` (passwordHash
		 *    already stripped via destructuring) - see below.
		 *  - `isAuthenticated`'s JWT-fallback path (`parseJWT`) and
		 *    `PUT /api/password` both assign the full `User` record
		 *    looked up from `users.json`, **including `passwordHash`**.
		 *
		 * In other words: `req.session.user` - and therefore whatever
		 * `express-session`'s file-based session store persists to disk
		 * under `storeDir/sessions` - can and does genuinely contain a
		 * user's `passwordHash` for a subset of login/refresh flows. This
		 * is a real, pre-existing quirk (a session file on disk carrying a
		 * password hash that never gets sent to any client - responses
		 * are always separately sanitized to `PublicUser` before being
		 * `res.json()`-ed, see `/api/authenticate`/`PUT /api/password`
		 * below), not something this PR changes or "fixes" - it's called
		 * out here, and characterized by
		 * `test/lib/http/sessionSerialization.test.ts`, as a documented
		 * follow-up rather than fixed in this pass (fixing it would mean
		 * changing what `isAuthenticated`/`PUT /api/password` persist to
		 * the session store, i.e. an actual behavior change, which is out
		 * of scope here).
		 */
		user?: User | PublicUser
	}
}

/**
 * Claims decoded from a JWT that `jwt.verify` accepted as validly signed by
 * this server.
 *
 * `jwt.verify`'s callback overload only proves two things: the signature is
 * valid, and the decoded payload is a plain object (as opposed to a bare
 * `string` payload, which is rejected below). It does NOT validate that any
 * particular claim - `username` in particular - is present, or is a
 * `string` when present: that's simply whatever object was originally
 * passed to `jwt.sign()`. Every property inherited from `PublicUser` is
 * therefore modeled as optional/unvalidated (`Partial<PublicUser>`) here,
 * even though every token this server itself ever signs
 * (`/api/authenticate`) in fact carries a full `PublicUser`. This looseness
 * is intentional: it honestly reflects "object-shaped, otherwise
 * unvalidated claims", rather than asserting a false guarantee. Tightening
 * this with real runtime claim validation (e.g. a schema check after
 * decode) is a documented follow-up, not done in this pass - see
 * `test/lib/http/auth.test.ts`/`test/lib/socket/auth.test.ts` for the
 * characterized (unvalidated) current behavior.
 */
export type JwtUserPayload = Partial<PublicUser> & JwtPayload

// apis response codes
export const RESPONSE_CODES = {
	OK: 'OK',
	GENERAL_ERROR: 'General Error',
	INVALID: 'Invalid data',
	AUTH_FAILED: 'Authentication failed',
	PERMISSION_ERROR: 'Insufficient permissions',
} as const
export type RESPONSE_CODES =
	(typeof RESPONSE_CODES)[keyof typeof RESPONSE_CODES]

/**
 * Typed wrapper around `jwt.verify`'s async (callback) form. `jwt.verify`'s
 * own overloads type a successfully decoded payload as `JwtPayload | string`
 * (or `Jwt` when `complete: true`, not used here); the cast below is the one
 * narrow, documented boundary where we assert the decoded payload is at
 * least object-shaped and treat its claims as `JwtUserPayload` - itself
 * already honestly modeling every `PublicUser`-derived claim as optional/
 * unvalidated (see `JwtUserPayload` above).
 */
export function verifyJWT(
	token: string,
	secret: string,
): Promise<JwtUserPayload> {
	return new Promise((resolve, reject) => {
		jwt.verify(token, secret, (err: VerifyErrors | null, decoded) => {
			if (err || !decoded || typeof decoded === 'string') {
				reject(err ?? new Error('Invalid token payload'))
				return
			}
			resolve(decoded as JwtUserPayload)
		})
	})
}

export async function parseJWT(req: Request): Promise<User> {
	// if not authenticated check if he has a valid token
	let token = req.headers['x-access-token'] || req.headers.authorization // Express headers are auto converted to lowercase
	token = Array.isArray(token) ? token[0] : token
	if (token && token.startsWith('Bearer ')) {
		// Remove ****** string
		token = token.slice(7, token.length)
	}

	// third-party cookies must be allowed in order to work
	if (!token) {
		throw Error('Invalid token header')
	}
	const decoded = await verifyJWT(token, sessionSecret)

	// Successfully authenticated, token is valid and the user _id of its content
	// is the same of the current session
	const users = jsonStore.get(store.users)

	const user = users.find((u) => u.username === decoded.username)

	if (user) {
		return user
	} else {
		throw Error('User not found')
	}
}

// middleware to check if user is authenticated
export async function isAuthenticated(
	req: Request,
	res: Response,
	next: () => void,
): Promise<void> {
	// if user is authenticated in the session, carry on
	if (req?.session?.user || !isAuthEnabled()) {
		return next()
	}

	// third-party cookies must be allowed in order to work
	try {
		const user = await parseJWT(req)
		req.session.user = user
		next()
	} catch (error) {
		logger.debug('Authentication failed', error)

		res.json({
			success: false,
			message: RESPONSE_CODES.GENERAL_ERROR,
			code: 3,
		})
	}
}

export interface AuthRoutesDeps {
	apisLimiter: RateLimitRequestHandler
	loginLimiter: RateLimitRequestHandler
}

export function registerAuthRoutes(
	app: express.Express,
	{ apisLimiter, loginLimiter }: AuthRoutesDeps,
): void {
	// logout the user
	app.get('/api/auth-enabled', apisLimiter, function (req, res) {
		res.json({ success: true, data: isAuthEnabled() })
	})

	// api to authenticate user
	app.post('/api/authenticate', loginLimiter, async function (req, res) {
		const token = req.body.token
		let user: User | undefined

		try {
			// token auth, mostly used to restore sessions when user refresh the page
			if (token) {
				const decoded = await verifyJWT(token, sessionSecret)

				// Successfully authenticated, token is valid and the user _id of its content
				// is the same of the current session
				const users = jsonStore.get(store.users)

				user = users.find((u) => u.username === decoded.username)
			} else {
				// credentials auth
				const users = jsonStore.get(store.users)

				const username = req.body.username
				const password = req.body.password

				user = users.find((u) => u.username === username)

				if (
					user &&
					!(await utils.verifyPsw(password, user.passwordHash))
				) {
					user = undefined
				}
			}

			const result: {
				success: boolean
				code?: number
				message: string
				user?: PublicUser
			} = {
				success: !!user,
				code: undefined,
				message: '',
				user: undefined,
			}

			// Captured before the narrowing below: some TS versions fail to
			// track that `user` can still be `undefined` inside the `else`
			// branch here, given the `await`-guarded reassignment above.
			const attemptedUsername = user?.username || req.body.username

			if (user) {
				// don't edit the original user object, remove the password from jwt payload
				const { passwordHash: _passwordHash, ...userWithoutHash } = user

				const token = jwt.sign(userWithoutHash, sessionSecret, {
					expiresIn: '1d',
				})
				const userData: PublicUser = { ...userWithoutHash, token }
				req.session.user = userData
				result.user = userData
				if (req.ip) {
					loginLimiter.resetKey(req.ip)
				}
				logger.info(
					`User ${user.username} logged in successfully from ${req.ip}`,
				)
			} else {
				result.code = 3
				result.message = RESPONSE_CODES.GENERAL_ERROR
				logger.error(
					`User ${attemptedUsername} failed to login from ${req.ip}: wrong credentials`,
				)
			}

			res.json(result)
		} catch (error) {
			res.json({
				success: false,
				message: 'Authentication failed',
				code: 3,
			})

			logger.error(
				`User ${
					user?.username || req.body.username
				} failed to login from ${req.ip}: ${getErrorMessage(error)}`,
			)
		}
	})

	// logout the user
	app.get('/api/logout', apisLimiter, isAuthenticated, function (req, res) {
		req.session.destroy((err) => {
			if (err) {
				res.json({ success: false, message: err.message })
			} else {
				res.json({ success: true, message: 'User logged out' })
			}
		})
	})

	// update user password
	app.put(
		'/api/password',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const users = jsonStore.get(store.users)

				// `req.session.user` can genuinely be `undefined` here (e.g.
				// with auth disabled and no prior login): `isAuthenticated`
				// still calls `next()` in that case. Guard it explicitly and
				// fall through to the same clean "User not found" response a
				// stale/unknown username gets below, instead of throwing a
				// raw TypeError on `.username` of `undefined`.
				const user = req.session.user
				const oldUser = user
					? users.find((u) => u.username === user.username)
					: undefined

				if (!oldUser) {
					return res.json({
						success: false,
						message: 'User not found',
					})
				}

				if (
					!(await utils.verifyPsw(
						req.body.current,
						oldUser.passwordHash,
					))
				) {
					return res.json({
						success: false,
						message: 'Current password is wrong',
					})
				}

				if (req.body.new !== req.body.confirmNew) {
					return res.json({
						success: false,
						message: "Passwords doesn't match",
					})
				}

				oldUser.passwordHash = await utils.hashPsw(req.body.new)

				req.session.user = oldUser

				await jsonStore.put(store.users, users)

				// don't leak the password hash to the client (mirrors /api/authenticate)
				const { passwordHash: _passwordHash, ...userData } = oldUser

				res.json({
					success: true,
					message: 'Password updated',
					user: userData,
				})
			} catch (error) {
				res.json({
					success: false,
					message: 'Error while updating passwords',
					error: getErrorMessage(error),
				})
				logger.error('Error while updating password', error)
			}
		},
	)
}
