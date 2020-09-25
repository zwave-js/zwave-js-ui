<template>
  <v-dialog v-model="value" max-width="500px" persistent>
    <v-card>
      <v-card-title>
        <span class="headline">{{ title }}</span>
      </v-card-title>

      <v-card-text>
        <v-container grid-list-md>
          <v-form v-model="valid" ref="form" lazy-validation>
            <v-layout wrap>
              <v-flex xs12>
                <v-select
                  v-model="editedValue.device"
                  label="Device"
                  required
                  :rules="[required]"
                  item-text="name"
                  :items="devices"
                ></v-select>
              </v-flex>
              <v-flex xs12>
                <v-select
                  v-model="editedValue.value"
                  label="Value"
                  :hint="editedValue.value ? editedValue.value.help : ''"
                  required
                  return-object
                  :rules="[required]"
                  item-text="label"
                  item-value="value_id"
                  :items="deviceValues"
                >
                  <template v-slot:selection="{ item }">
                    {{
                      item.label +
                        (item.instance > 1
                          ? ' - Instance ' + item.instance
                          : '')
                    }}
                  </template>
                  <template v-slot:item="{ item }">
                    <v-list-item-content>
                      <v-list-item-title>{{
                        item.label +
                          (item.instance > 1
                            ? ' - Instance ' + item.instance
                            : '')
                      }}</v-list-item-title>
                      <v-list-item-subtitle
                        style="max-width:500px"
                        class="text-truncate text-no-wrap"
                        >{{ item.help }}</v-list-item-subtitle
                      >
                    </v-list-item-content>
                  </template>
                </v-select>
              </v-flex>
              <v-flex xs12>
                <v-select
                  v-model="editedValue.device_class"
                  label="Device Class"
                  hint="Specify a device class for Home assistant"
                  item-text="name"
                  :items="deviceClasses"
                ></v-select>
              </v-flex>
              <v-flex v-if="isSensor(editedValue.value)" xs12>
                <v-text-field
                  v-model.number="editedValue.icon"
                  hint="Specify a device icon for Home assistant, format is <prefix>:<icons-alias> (Eg: 'mdi:water'). Check http://materialdesignicons.com/"
                  label="Device Icon"
                ></v-text-field>
              </v-flex>
              <v-flex xs12>
                <v-text-field
                  v-model.trim="editedValue.topic"
                  label="Topic"
                  :rules="[requiredTopic]"
                  required
                ></v-text-field>
              </v-flex>
              <v-flex xs12>
                <v-text-field
                  v-model="editedValue.postOperation"
                  label="Post operation"
                  hint="Example: '/10' '*100' '+20'"
                  required
                ></v-text-field>
              </v-flex>
              <v-flex xs6>
                <v-switch
                  label="Poll"
                  hint="Enable poll of this value"
                  persistent-hint
                  v-model="editedValue.enablePoll"
                ></v-switch>
              </v-flex>
              <v-flex v-if="editedValue.enablePoll" xs6>
                <v-text-field
                  v-model.number="editedValue.pollIntensity"
                  label="Poll intensity"
                  :rules="[requiredIntensity]"
                  required
                  type="number"
                ></v-text-field>
              </v-flex>

              <v-flex xs6>
                <v-switch
                  label="Verify changes"
                  hint="Verify changes of this value"
                  persistent-hint
                  v-model="editedValue.verifyChanges"
                ></v-switch>
              </v-flex>

              <v-flex xs6>
                <v-switch
                  label="Parse send"
                  hint="Create a function that parse the value sent via MQTT"
                  persistent-hint
                  v-model="editedValue.parseSend"
                ></v-switch>
              </v-flex>

              <v-container v-if="editedValue.parseSend">
                <p>
                  Write the function here. Args are <code>value</code>. The
                  function is sync and must return the parsed <code>value</code>
                </p>
                <prism-editor
                  lineNumbers
                  v-model="editedValue.sendFunction"
                  language="js"
                  :highlight="highlighter"
                ></prism-editor>
              </v-container>

              <v-flex xs6>
                <v-switch
                  label="Parse receive"
                  hint="Create a function that parse the received value from MQTT"
                  persistent-hint
                  v-model="editedValue.parseReceive"
                ></v-switch>
              </v-flex>

              <v-container v-if="editedValue.parseReceive">
                <p>
                  Write the function here. Args are <code>value</code>. The
                  function is sync and must return the parsed <code>value</code>
                </p>
                <prism-editor
                  lineNumbers
                  v-model="editedValue.receiveFunction"
                  language="js"
                  :highlight="highlighter"
                ></prism-editor>
              </v-container>
            </v-layout>
          </v-form>
        </v-container>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="blue darken-1" text @click="$emit('close')">Cancel</v-btn>
        <v-btn
          color="blue darken-1"
          text
          @click="$refs.form.validate() && $emit('save')"
          >Save</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script>
// import Prism Editor
import { PrismEditor } from 'vue-prism-editor'
import 'vue-prism-editor/dist/prismeditor.min.css' // import the styles somewhere

// import highlighting library (you can use any library you want just return html string)
import { highlight, languages } from 'prismjs/components/prism-core'
import 'prismjs/components/prism-clike'
import 'prismjs/components/prism-javascript'
import 'prismjs/themes/prism-tomorrow.css' // import syntax highlighting styles

export default {
  components: {
    PrismEditor
  },
  props: {
    value: Boolean,
    gw_type: Number,
    title: String,
    editedValue: Object,
    devices: Array
  },
  watch: {
    // eslint-disable-next-line no-unused-vars
    value (val) {
      this.$refs.form && this.$refs.form.resetValidation()
    }
  },
  computed: {
    deviceValues () {
      var device = this.devices.find(d => d.value == this.editedValue.device) // eslint-disable-line eqeqeq
      return device ? device.values : []
    },
    deviceClasses () {
      var v = this.editedValue.value

      // sensor binary
      if (!v) {
        return []
      } else if (v.class_id === 0x30) {
        // eslint-disable-line eqeqeq
        return [
          'battery',
          'cold',
          'connectivity',
          'door',
          'garage_door',
          'gas',
          'heat',
          'light',
          'lock',
          'moisture',
          'motion',
          'moving',
          'occupancy',
          'opening',
          'plug',
          'power',
          'presence',
          'problem',
          'safety',
          'smoke',
          'sound',
          'vibration',
          'window'
        ]
      } else if (this.isSensor(v)) {
        // sensor multilevel and meters
        return [
          'battery',
          'humidity',
          'illuminance',
          'signal_strength',
          'temperature',
          'power',
          'pressure',
          'timestamp'
        ]
      } else {
        return []
      }
    },
    requiredIntensity () {
      return (
        !this.editedValue.enablePoll ||
        (this.editedValue.enablePoll && this.editedValue.pollIntensity > 0) ||
        'Min value is 1'
      )
    },
    requiredTopic () {
      return this.gw_type !== 2 || !!this.editedValue.topic || 'Topic required'
    }
  },
  data () {
    return {
      valid: true,
      required: v => !!v || 'This field is required'
    }
  },
  methods: {
    highlighter (code) {
      return highlight(code, languages.js) // returns html
    },
    isSensor (v) {
      return v && (v.class_id === 0x31 || v.class_id === 0x32)
    }
  }
}
</script>

<style>
/* optional class for removing the outline */
.prism-editor__textarea:focus {
  outline: none;
}
</style>
