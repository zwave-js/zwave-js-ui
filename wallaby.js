module.exports = function() {
  return {
    files: [
      'lib/**/*.js', 
    ],

    tests: ['test/**/*.test.js'],

    testFramework: 'mocha',

    env: {
      type: 'node'
    },

    workers: { recycle: true }
  };
};