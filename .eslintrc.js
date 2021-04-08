// https://eslint.org/docs/user-guide/configuring

module.exports = {
  root: true,
  env: {
    browser: true,
    mocha: true,
    node: true
  },
  extends: [
    // https://github.com/vuejs/eslint-plugin-vue#priority-a-essential-error-prevention
    // consider switching to `plugin:vue/strongly-recommended` or `plugin:vue/recommended` for stricter rules.
    'plugin:vue/essential',
    // https://github.com/standard/standard/blob/master/docs/RULES-en.md
    'standard'
  ],
  // required to lint *.vue files
  plugins: ['vue', 'babel'],
  // add your custom rules here
  rules: {
    // allow async-await
    'vue/no-v-for-template-key-on-child': 'off',
    'vue/no-v-for-template-key': 'off',
    'vue/no-template-key': 'off',
    'vue/valid-v-for': 'off',
    'vue/require-v-for-key': 'off',
    'generator-star-spacing': 'off',
    'vue/no-deprecated-v-bind-sync': 'off',
    'vue/no-mutating-props': 'off',
    'vue/experimental-script-setup-vars': 'off',
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-unused-vars': ['error', { vars: 'local' }]
  }
}
