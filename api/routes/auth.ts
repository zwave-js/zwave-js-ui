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
		// Includes User (with its passwordHash) because parseJWT and PUT /api/password
		// persist the full record here, not just the sanitized PublicUser
		user?: User | PublicUser
	}
}

// Partial because jwt.verify only proves the signature is valid and the payload is
// object-shaped, not that any claim such as username is present
export type JwtUserPayload = Partial<PublicUser> & JwtPayload

export const RESPONSE_CODES = {
	OK: 'OK',
	GENERAL_ERROR: 'General Error',
	INVALID: 'Invalid data',
	AUTH_FAILED: 'Authentication failed',
	PERMISSION_ERROR: 'Insufficient permissions',
} as const
export type RESPONSE_CODES =
	(typeof RESPONSE_CODES)[keyof typeof RESPONSE_CODES]

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
			// JwtPayload doesn't know about our PublicUser claims
			resolve(decoded as JwtUserPayload)
		})
	})
}

export async function parseJWT(req: Request): Promise<User> {
	let token = req.headers['x-access-token'] || req.headers.authorization
	token = Array.isArray(token) ? token[0] : token
	if (token && token.startsWith('Bearer ')) {
		// Strips the "Bearer " prefix (7 chars)
		token = token.slice(7, token.length)
	}

	if (!token) {
		throw Error('Invalid token header')
	}
	const decoded = await verifyJWT(token, sessionSecret)

	const users = jsonStore.get(store.users)

	const user = users.find((u) => u.username === decoded.username)

	if (user) {
		return user
	} else {
		throw Error('User not found')
	}
}

export async function isAuthenticated(
	req: Request,
	res: Response,
	next: () => void,
): Promise<void> {
	if (req?.session?.user || !isAuthEnabled()) {
		return next()
	}

	// Falls back to a JWT token here because session-cookie auth requires third-party cookies to be allowed
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
	app.get('/api/auth-enabled', apisLimiter, function (req, res) {
		res.json({ success: true, data: isAuthEnabled() })
	})

	app.post('/api/authenticate', loginLimiter, async function (req, res) {
		const token = req.body.token
		let user: User | undefined

		try {
			// Token auth restores a session after a page refresh
			if (token) {
				const decoded = await verifyJWT(token, sessionSecret)

				const users = jsonStore.get(store.users)

				user = users.find((u) => u.username === decoded.username)
			} else {
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

			// Captured early because some TS versions lose the undefined narrowing
			// across the awaited reassignment above
			const attemptedUsername = user?.username || req.body.username

			if (user) {
				// Destructure instead of mutating because user is a live reference into the in-memory users store
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

	app.get('/api/logout', apisLimiter, isAuthenticated, function (req, res) {
		req.session.destroy((err) => {
			if (err) {
				res.json({ success: false, message: err.message })
			} else {
				res.json({ success: true, message: 'User logged out' })
			}
		})
	})

	app.put(
		'/api/password',
		apisLimiter,
		isAuthenticated,
		async function (req, res) {
			try {
				const users = jsonStore.get(store.users)

				// req.session.user can be undefined here (e.g. auth disabled with no prior login); guard it so a stale/unknown session falls through to "User not found" below instead of throwing
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

				// Strips passwordHash before sending, mirroring /api/authenticate
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
