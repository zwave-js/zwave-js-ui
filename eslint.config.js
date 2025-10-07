import { defineConfig, globalIgnores } from 'eslint/config'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

import globals from 'globals'
import vue from 'eslint-plugin-vue'
import vuetify from 'eslint-plugin-vuetify'
import importPlugin from 'eslint-plugin-import'
import js from '@eslint/js'

import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

export default defineConfig([
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.mocha,
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
				},
			],
		},
	},
	globalIgnores([
		'build/',
		'config/',
		'dist/',
		'server/',
		'snippets/',
		'store/',
		'dev-dist/',
		'.github/',
	]),
])
