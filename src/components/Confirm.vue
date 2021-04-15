<template>
  <v-dialog
    v-model="show"
    :max-width="options.width"
    :style="{ zIndex: options.zIndex }"
    @keydown.esc="cancel"
    :persistent="options.persistent"
  >
    <v-card>
      <v-toolbar :color="options.color" dark dense flat>
        <v-toolbar-title class="white--text">{{ title }}</v-toolbar-title>
      </v-toolbar>
      <v-card-text
        v-show="!!message"
        v-html="message"
        class="pa-4"
      ></v-card-text>
      <v-card-text v-if="options.inputs" class="pa-4">
        <v-container grid-list-md>
          <v-form v-model="valid" ref="form" lazy-validation>
            <v-row>
              <v-col
                v-for="(input, index) in options.inputs"
                :key="index"
                cols="12"
              >
                <v-text-field
                  v-if="input.type === 'text'"
                  v-model.trim="values[input.key]"
                  :label="input.label"
                  :hint="input.hint"
                  :rules="input.rules || []"
                  :required="input.required"
                  :min="input.min"
                  :persistent-hint="!!input.hint"
                  :max="input.max"
                ></v-text-field>
                <v-text-field
                  v-if="input.type === 'number'"
                  v-model.number="values[input.key]"
                  :label="input.label"
                  :hint="input.hint"
                  :rules="input.rules || []"
                  type="number"
                  :persistent-hint="!!input.hint"
                  :required="input.required"
                  :min="input.min"
                  :max="input.max"
                ></v-text-field>
                <v-switch
                  v-if="input.type === 'boolean'"
                  v-model="values[input.key]"
                  :rules="input.rules || []"
                  :label="input.label"
                  :hint="input.hint"
                  :persistent-hint="!!input.hint"
                  :required="input.required"
                ></v-switch>
                <v-select
                  v-if="input.type === 'list' && !input.allowManualEntry"
                  v-model="values[input.key]"
                  :item-text="input.itemText || 'text'"
                  :item-value="input.itemValue || 'value'"
                  :items="input.items"
                  :rules="input.rules || []"
                  :label="input.label"
                  :persistent-hint="!!input.hint"
                  :multiple="!!input.multiple"
                  :hint="input.hint"
                  :required="input.required"
                ></v-select>
                <v-combobox
                  v-if="input.type === 'list' && input.allowManualEntry"
                  v-model="values[input.key]"
                  :item-text="input.itemText || 'text'"
                  :item-value="input.itemValue || 'value'"
                  chips
                  :items="input.items"
                  :rules="input.rules || []"
                  :label="input.label"
                  :multiple="!!input.multiple"
                  :persistent-hint="!!input.hint"
                  :hint="input.hint"
                  :return-object="false"
                  :required="input.required"
                >
                </v-combobox>
                <v-container v-if="input.type === 'code'">
                  <p v-html="input.hint"></p>
                  <prism-editor
                    :line-numbers="true"
                    v-model="values[input.key]"
                    language="js"
                    :highlight="highlighter"
                  ></prism-editor>
                </v-container>
              </v-col>
            </v-row>
          </v-form>
        </v-container>
      </v-card-text>

      <v-card-actions class="pt-0">
        <v-spacer></v-spacer>
        <v-btn @click="agree" text :color="options.color">{{
          options.confirmText
        }}</v-btn>
        <v-btn v-if="options.cancelText" @click="cancel" text>{{
          options.cancelText
        }}</v-btn>
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

// import Prism Editor
import { PrismEditor } from 'vue-prism-editor'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css'

export default {
  components: {
    PrismEditor
  },
  data: () => ({
    dialog: false,
    resolve: null,
    reject: null,
    valid: true,
    message: null,
    values: {},
    title: null,
    options: null,
    defaultOptions: {
      color: 'primary',
      width: 290,
      zIndex: 200,
      confirmText: 'Yes',
      cancelText: 'Cancel',
      persistent: false
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
    highlighter (code) {
      return highlight(code, languages.js) // returns html
    },
    open (title, message, options) {
      this.dialog = true
      this.title = title
      this.message = message

      this.options = Object.assign(this.defaultOptions, options)

      if (options.inputs) {
        for (const input of options.inputs) {
          if (input.default !== undefined) {
            // without this code block is bugged, don't simply assign
            this.$set(this.values, input.key, input.default)
          }
        }
      }

      return new Promise((resolve, reject) => {
        this.resolve = resolve
        this.reject = reject
      })
    },
    agree () {
      if (this.options.inputs) {
        if (this.$refs.form.validate()) {
          this.dialog = false
          this.resolve(this.values)
          this.reset()
        }
      } else {
        this.dialog = false
        this.resolve(true)
        this.reset()
      }
    },
    cancel () {
      this.dialog = false
      this.resolve(this.options.inputs ? {} : false)
      this.reset()
    },
    reset () {
      this.options = Object.assign({}, this.defaultOptions)
      this.values = {}
    }
  },
  created () {
    this.reset()
  }
}
</script>
