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
		// Preserve passwordHash for legacy auth flows
		user?: User | PublicUser
	}
}

// Signed tokens may omit user claims
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
			resolve(decoded as JwtUserPayload)
		})
	})
}

export async function parseJWT(req: Request): Promise<User> {
	let token = req.headers['x-access-token'] || req.headers.authorization
	token = Array.isArray(token) ? token[0] : token
	if (token && token.startsWith('Bearer ')) {
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

	// Support clients without third-party cookies
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

			const attemptedUsername = user?.username || req.body.username

			if (user) {
				// Avoid mutating the live users-store record
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

				// Preserve the disabled-auth failure
				const user = req.session.user as PublicUser

				const oldUser = users.find((u) => u.username === user.username)

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
