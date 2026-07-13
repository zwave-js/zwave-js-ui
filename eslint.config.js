import { defineConfig, globalIgnores } from 'eslint/config'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

import globals from 'globals'
import vue from 'eslint-plugin-vue'
import vuetify from 'eslint-plugin-vuetify'
import importPlugin from 'eslint-plugin-import'
import unicorn from 'eslint-plugin-unicorn'
import tsParser from '@typescript-eslint/parser'
import js from '@eslint/js'

import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

const backendImportMessage = 'Imports targeting api/ must use #api/*'
const backendImportRules = (pattern) => {
	const selectorPattern = pattern.replaceAll('/', '\\/')
	const loaderMethod =
		'/^(?:createMockFromModule|deepUnmock|doMock|doUnmock|dontMock|importActual|importMock|mock|requireActual|requireMock|resolve|setMock|unmock|unstable_mockModule|unstable_unmockModule)$/'
	const restrictions = [
		`ImportExpression[source.value=/${selectorPattern}/]`,
		`ImportExpression[source.expressions.length=0][source.quasis.0.value.raw=/${selectorPattern}/]`,
		`TSImportType[argument.literal.value=/${selectorPattern}/]`,
		`TSImportType[argument.literal.expressions.length=0][argument.literal.quasis.0.value.raw=/${selectorPattern}/]`,
		`CallExpression[callee.name='require'][arguments.0.value=/${selectorPattern}/]`,
		`CallExpression[callee.name='require'][arguments.0.expressions.length=0][arguments.0.quasis.0.value.raw=/${selectorPattern}/]`,
		`CallExpression[callee.object.name=/^(?:jest|require|vi)$/][callee.property.name=${loaderMethod}][arguments.0.value=/${selectorPattern}/]`,
		`CallExpression[callee.object.name=/^(?:jest|require|vi)$/][callee.property.name=${loaderMethod}][arguments.0.expressions.length=0][arguments.0.quasis.0.value.raw=/${selectorPattern}/]`,
	]

	return {
		'no-restricted-imports': [
			'error',
			{
				patterns: [
					{
						regex: pattern,
						message: backendImportMessage,
					},
				],
			},
		],
		'no-restricted-syntax': [
			'error',
			...restrictions.map((selector) => ({
				selector,
				message: backendImportMessage,
			})),
		],
	}
}

export default defineConfig([
	{
		ignores: ['.github/**'],

		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
			},
		},

		extends: compat.extends(
			'eslint:recommended',
			'plugin:vue/vue3-essential',
			'plugin:vuetify/base',
			'plugin:prettier/recommended',
		),

		plugins: {
			vue,
			vuetify,
		},

		rules: {
			'generator-star-spacing': 'off',
			'vue/no-deprecated-v-bind-sync': 'off',
			'vue/no-mutating-props': 'off',
			'vue/experimental-script-setup-vars': 'off',
			'vue/no-side-effects-in-computed-properties': 'off',
			'no-debugger':
				process.env.NODE_ENV === 'production' ? 'error' : 'off',

			'no-unused-vars': 'off',

			'vue/multi-word-component-names': 'off',
			'vue/no-v-text-v-html-on-component': 'off',
		},
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		ignores: ['.github/**'],

		languageOptions: {
			ecmaVersion: 12,
			sourceType: 'module',

			parserOptions: {
				parser: '@typescript-eslint/parser',
				project: './tsconfig.eslint.json',
			},
		},

		plugins: {
			import: importPlugin,
			unicorn: unicorn,
		},

		extends: compat.extends(
			'plugin:@typescript-eslint/recommended',
			'plugin:@typescript-eslint/recommended-requiring-type-checking',
			'plugin:prettier/recommended',
		),

		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/restrict-template-expressions': 'off',
			'@typescript-eslint/restrict-plus-operands': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-implied-eval': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-enum-comparison': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-require-imports': 'off',

			// Enforce type-only imports
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					fixStyle: 'separate-type-imports',
				},
			],

			// Enforce .ts extensions for local imports
			'import/extensions': [
				'error',
				'always',
				{
					ignorePackages: true,
					pathGroupOverrides: [
						{
							pattern: '#api/**',
							action: 'ignore',
						},
					],
				},
			],

			// Enforce node: protocol for Node.js built-in modules
			'unicorn/prefer-node-protocol': 'error',
		},
	},
	{
		files: ['**/*.{cts,mts}'],
		languageOptions: {
			parser: tsParser,
		},
	},
	{
		files: ['**/*.jsx'],
		languageOptions: {
			parserOptions: {
				ecmaFeatures: {
					jsx: true,
				},
			},
		},
	},
	{
		files: ['**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx,vue}'],
		ignores: ['.github/**/*.d.ts', 'api/**', 'src/**'],
		rules: backendImportRules(
			String.raw`^(?:@api/|@server/|#api/.+\.[cm]?[jt]sx?$|(?:\.\.?/)+(?:[^/]+/)*api(?:/(?!\.\.(?:/|$))|$))`,
		),
	},
	{
		files: ['.github/**/*.d.{cts,mts,ts}'],
		languageOptions: {
			parser: tsParser,
		},
		rules: backendImportRules(
			String.raw`^(?:@api/|@server/|#api/.+\.[cm]?[jt]sx?$|(?:\.\.?/)+(?:[^/]+/)*api(?:/(?!\.\.(?:/|$))|$))`,
		),
	},
	{
		files: ['src/**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx,vue}'],
		rules: backendImportRules(
			String.raw`^(?:@api/|#api/.+\.[cm]?[jt]sx?$|(?:\.\.?/)+(?:[^/]+/)*api(?:/(?!\.\.(?:/|$))|$))`,
		),
	},
	{
		files: ['api/**/*.{cjs,cts,js,jsx,mjs,mts,ts,tsx}'],
		rules: backendImportRules(
			String.raw`^(?:@api/|@server/|#api/.+\.[cm]?[jt]sx?$|\.\.?/)`,
		),
	},
	globalIgnores([
		'build/',
		'config/',
		'dist/',
		'server/',
		'snippets/',
		'store/',
		'dev-dist/',
	]),
])
