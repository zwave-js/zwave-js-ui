Vue 2 and Vuetify 2 are EOL so now it's time to refactor the frontend in order to use the new majors of both projects.

## Chore

Check for vue2 deps and bump to vue3 version of them.

- [ ] v-snackbars: drop in favor of vuetify-sonner
- [ ] vue: bump to 3
- [ ] vue-prism-editor: use ^2.0.0-alpha.2
- [ ] vue-router bump to latest v4
- [ ] vuedraggable: bump to v4
- [ ] vuetify: bump to v3
- [ ] add eslint-plugin-vuetify to auto fix some compatibility issues (add it to eslint config)
- [ ] drop @vitejs/plugin-vue2 in favor of @vitejs/plugin-vue
- [ ] Bump all vite-related deps to latest
- [ ] Fix vite config

Once this step is finished run `npm run lint-fix` to auto fix some lint issues then start with the UI refactor.

## Vue 3

Follow migration guide: <https://v3-migration.vuejs.org/>

Additional steps:

- [ ] check for duplicate attributes on specific components
- [ ] Use `defineAsyncComponent` to load async components
- [ ] check if the conversion value-> modelValue was done on all component props
- [ ] The `.native` modifier for v-on has been removed.
- [ ] Ensure that the component emit the right event in the `emits` property
- [ ] Array watchers should use `deep: 1`. Reacivity in Vue3 use Proxies and they don't intercept push/splice etc operations on array like vue2

## Vuetify 3

Follow migration guide: <https://vuetifyjs.com/en/getting-started/upgrade-guide/#setup>

Additional steps:

- [ ] Stepper is quite different and should be migrated carefully [VStepper](https://vuetifyjs.com/en/components/steppers/#dynamic-steps)
- [ ] Use [Vuetify global defaults](https://vuetifyjs.com/en/features/global-configuration) to to set default prop values globally or per component when setting up your application. Example in order to keep inputs like them are in Vuetify 2 we should set default variant to `underlined`. For buttons we should set default variant to `text` and use `icon` property on button instead of putting the v-icon inside button default slot
- [ ] `$vuetify.breakpoint` renamed to `$vuetify.display`
- [ ] `v-list-item-content` has been removed. Now v-list-item have `title` `subtitle` props and `<template v-slot:append>` `<template v-slot:prepend>`, use them. In our lists we should use `append` slot
- [ ] `v-list-item-icon` has been removed, wrap the `v-icon` into a `<template #prepend>`
- [ ] `v-image`, `contains` is removed, use `cover`
- [ ] `v-avatar`, remove `min-width`, `min-height`, replace `width` and `height` with `size`
- [ ] `nudge-*` attributes must be replaced with `offset`, you can pass a pair of numbers to get the exact feeling as before
- [ ] `lazy-validation` has been removed, use `validate-on="lazy"`
- [ ] `v-date-picker` `range` ahs been removed, use `multiple="range"`, `locale` has been removed, check if the mapping is done correctly in the Vuetify option ([see](https://vuetifyjs.com/en/components/date-pickers/#internationalization))
- [ ] `v-list-item-group` has been removed, assign the item’s key to the value prop of each v-list-item and bind v-model:selected on the v-list to get the selected value
- [ ] `v-list-item-avatar` have been removed, wrap the `v-avatar` into a `<template #prepend>`
- [ ] `v-data-table`, `item-class` and `item-style` have been combined into `row-props`
- [ ] Server side tables using `server-items-length` must be replaced with `<v-data-table-server items-length />`
- [ ] Forms `validate()` function is now async
- [ ] Replace `var(--` with Vue3 CSS `v-bind` using current theme
- [ ] Seems that theme `secondary` color could no more be set, on dark or light theme is always a `teal` color (see top bar). I've tried to set the old one for dark theme (dark grey) but when switch to light remains always the same color

## General

- [ ]  move to [Vuetify Sonner](https://github.com/wobsoriano/vuetify-sonner) for notifications, drop v-snackbars
- [ ] `v-edit-dialog` is not available in Vuetify 3, [this issue](https://github.com/vuetifyjs/vuetify/issues/19028) suggests to use `v-confirm-edit`
- [ ] Find all `<draggable` usage and change:
 	- `list` prop becomes `v-model`
 	- Add `item-key` prop to unique identify items in draggable
 	- Remove `v-for` from default slot. Use item slot instead `<template #item="{ element, index }">`

After doing all the changes ensure that `npm run dev` command works, if there are errors fix them then run it again till all errors are fixed.

Do the same with `npm run lint-fix` command, if it show some errors try to fix them
