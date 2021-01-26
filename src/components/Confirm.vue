<template>
  <v-dialog
    v-model="show"
    :max-width="options.width"
    :style="{ zIndex: options.zIndex }"
    @keydown.esc="cancel"
  >
    <v-card>
      <v-toolbar :color="options.color" dark dense flat>
        <v-toolbar-title class="white--text">{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text v-if="!options.inputs" v-show="!!message" class="pa-4">{{ message }}</v-card-text>
      <v-card-text v-else class="pa-4">
         <v-container grid-list-md>
            <v-layout wrap>
              <v-flex v-for="(input, index) in options.inputs" :key="index" xs12>
                <v-text-field
                  v-if="input.type === 'text' || input.type === 'number'"
                  v-model="values[input.key]"
                  :label="input.label"
                  :hint="input.hint"
                  :type="input.type || 'text'"
                  :required="input.required"
                  :min="input.min"
                  :max="input.max"
                ></v-text-field>
                <v-switch
                  v-if="input.type === 'boolean'"
                  v-model="values[input.key]"
                  :label="input.label"
                  :hint="input.hint"
                  :persistent-hint="!!input.hint"
                  :required="input.required"
                ></v-switch>
                <v-select
                  v-if="input.type === 'list'"
                  v-model="values[input.key]"
                  :item-text="input.itemText || 'text'"
                  :item-value="input.itemValue || 'value'"
                  :items="input.items"
                  :label="input.label"
                  :hint="input.hint"
                  :required="input.required"
                ></v-select>
              </v-flex>
            </v-layout>
         </v-container>
      </v-card-text>

      <v-card-actions class="pt-0">
        <v-spacer></v-spacer>
        <v-btn @click="agree" text :color="options.color">{{ options.confirmText }}</v-btn>
        <v-btn @click="cancel" text>{{ options.cancelText }}</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
/**
 * Vuetify Confirm Dialog component
 *
 * Insert component where you want to use it:
 * <confirm ref="confirm"></confirm>
 *
 * Call it:
 * this.$refs.confirm.open('Delete', 'Are you sure?', { color: 'red' }).then((confirm) => {})
 * Or use await:
 * if (await this.$refs.confirm.open('Delete', 'Are you sure?', { color: 'red' })) {
 *   // yes
 * }
 * else {
 *   // cancel
 * }
 *
 * Alternatively you can place it in main App component and access it globally via this.$root.$confirm
 * <template>
 *   <v-app>
 *     ...
 *     <confirm ref="confirm"></confirm>
 *   </v-app>
 * </template>
 *
 * mounted() {
 *   this.$root.$confirm = this.$refs.confirm.open
 * }
 */
export default {
  data: () => ({
    dialog: false,
    resolve: null,
    reject: null,
    message: null,
    values: {},
    title: null,
    options: null,
    defaultOptions: {
      color: 'primary',
      width: 290,
      zIndex: 200,
      confirmText: 'Yes',
      cancelText: 'Cancel'
    }
  }),
  computed: {
    show: {
      get () {
        return this.dialog
      },
      set (value) {
        this.dialog = value
        if (value === false) {
          this.cancel()
        }
      }
    }
  },
  methods: {
    open (title, message, options) {
      this.dialog = true
      this.title = title
      this.message = message
      this.options = Object.assign(this.options, options)
      if (options.inputs) {
        for (const input of options.inputs) {
          this.values[input.key] = input.default
        }
      }
      return new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    agree () {
      this.dialog = false
      this.resolve(this.options.inputs ? this.values : true)
      this.reset()
    },
    cancel () {
      this.dialog = false
      this.resolve(false)
      this.reset()
    },
    reset () {
      this.options = Object.assign({}, this.defaultOptions)
    }
  },
  created () {
    this.reset()
  }
}
</script>
