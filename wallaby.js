module.exports = function () {
	return {
		files: ['lib/**/*.js'],

		tests: ['test/**/*.test.js'],

		env: {
			type: 'node',
		},
		testFramework: 'jest',
		workers: { recycle: true },
	}
}
