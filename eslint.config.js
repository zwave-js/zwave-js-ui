const { defineConfig, globalIgnores } = require('eslint/config')

const globals = require('globals')
const vue = require('eslint-plugin-vue')
const vuetify = require('eslint-plugin-vuetify')
const js = require('@eslint/js')

const { FlatCompat } = require('@eslint/eslintrc')

const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

module.exports = defineConfig([
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
