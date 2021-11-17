// https://eslint.org/docs/user-guide/configuring

module.exports = {
	root: true,
	env: {
		browser: true,
		mocha: true,
		node: true,
		es2021: true,
	},
	extends: [
		// https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
		// consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
		'eslint:recommended',
		'plugin:vue/essential',
		'prettier',
	],
	// required to lint *.vue files
	plugins: ['vue', 'babel'],
	// add your custom rules here
	rules: {
		// allow async-await
		'generator-star-spacing': 'off',
		'vue/no-deprecated-v-bind-sync': 'off',
		'vue/no-mutating-props': 'off',
		'vue/experimental-script-setup-vars': 'off',
		'vue/no-side-effects-in-computed-properties': 'off',
		// allow debugger during development
		'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
		'no-unused-vars': ['error', { vars: 'local' }],
	},
	overrides: [
		{
			files: ['*.ts', '*.tsx'],
			parserOptions: {
				ecmaVersion: 12,
				parser: '@typescript-eslint/parser',
				sourceType: 'module',
				project: './tsconfig.eslint.json',
			},
			extends: [
				// https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
				// consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
				'plugin:@typescript-eslint/recommended',
				'plugin:@typescript-eslint/recommended-requiring-type-checking',
				// Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
				'prettier',
			],
			// add your custom rules here
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
			},
		},
	],
}
