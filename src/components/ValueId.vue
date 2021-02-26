<template>
  <div>
    <v-subheader class="valueid-label">{{ label }} </v-subheader>

    <div v-if="!value.writeable && !value.list">
      <v-text-field
        readonly
        :suffix="value.unit"
        :hint="help"
        persistent-hint
        v-model="value.value"
      ></v-text-field>
    </div>

    <div v-else>
      <v-text-field
        v-if="!value.list && value.type === 'string'"
        :append-outer-icon="!disable_send ? 'send' : null"
        :suffix="value.unit"
        persistent-hint
        :hint="help"
        v-model="value.newValue"
        @click:append-outer="updateValue(value)"
      ></v-text-field>

      <v-text-field
        v-if="!value.list && value.type === 'number'"
        type="number"
        :append-outer-icon="!disable_send ? 'send' : null"
        :suffix="value.unit"
        :min="value.min != value.max ? value.min : null"
        :step="1"
        persistent-hint
        :max="value.min != value.max ? value.max : null"
        :hint="help"
        v-model.number="value.newValue"
        @click:append-outer="updateValue(value)"
      ></v-text-field>

      <v-text-field
        v-if="!value.list && value.type === 'any'"
        :append-outer-icon="!disable_send ? 'send' : null"
        :suffix="value.unit"
        persistent-hint
        :error="!!error"
        :error-messages="error"
        :hint="help"
        v-model="parsedAny"
        @click:append-outer="updateValue(value)"
      ></v-text-field>

      <div style="display:flex" v-if="value.type === 'duration'">
        <v-text-field
          :type="value.type === 'number' ? 'number' : 'text'"
          :min="value.min != value.max ? value.min : null"
          :step="1"
          persistent-hint
          :readonly="!value.writeable || disable_send"
          :max="value.min != value.max ? value.max : null"
          :hint="help"
          v-model.number="value.newValue.value"
        ></v-text-field>
        <v-select
          style="margin-left:10px;min-width:105px;width:135px"
          :items="durations"
          v-model="value.newValue.unit"
          :readonly="!value.writeable || disable_send"
          persistent-hint
          :append-outer-icon="!disable_send ? 'send' : null"
          @click:append-outer="updateValue(value)"
        ></v-select>
      </div>

      <v-text-field
        style="max-width: 250px;margin-top:10px"
        flat
        solo
        v-if="value.type === 'color'"
        v-model="color"
        persistent-hint
        :append-outer-icon="!disable_send ? 'send' : null"
        :hint="help"
        @click:append-outer="updateValue(value)"
      >
        <template v-slot:append>
          <v-menu
            v-model="menu"
            top
            nudge-bottom="105"
            nudge-left="16"
            :close-on-content-click="false"
          >
            <template v-slot:activator="{ on }">
              <div :style="pickerStyle" v-on="on" />
            </template>
            <v-card>
              <v-card-text class="pa-0">
                <v-color-picker hide-mode-switch v-model="color" flat />
              </v-card-text>
            </v-card>
          </v-menu>
        </template>
      </v-text-field>

      <v-select
        v-if="value.list"
        :items="items"
        :style="{
          'max-width': $vuetify.breakpoint.smAndDown
            ? '280px'
            : $vuetify.breakpoint.smOnly
            ? '400px'
            : 'auto'
        }"
        :hint="help"
        persistent-hint
        :append-outer-icon="!disable_send || value.writeable ? 'send' : null"
        v-model="value.newValue"
        :readonly="!value.writeable"
        @click:append-outer="updateValue(value)"
      ></v-select>

      <div v-if="value.type == 'boolean' && value.writeable && value.readable">
        <v-btn-toggle class="mt-4" v-model="value.newValue" rounded>
          <v-btn
            outlined
            height="40px"
            :value="true"
            :style="{
              background: value.newValue ? '#4CAF50' : ''
            }"
            :color="value.newValue ? 'white' : 'green'"
            dark
            @click="updateValue(value, true)"
          >
            ON
          </v-btn>
          <v-btn
            outlined
            height="40px"
            :value="false"
            :style="{
              background: !value.newValue ? '#f44336' : ''
            }"
            :color="!value.newValue ? 'white' : 'red'"
            @click="updateValue(value, false)"
            dark
          >
            OFF
          </v-btn>
        </v-btn-toggle>
        <div v-if="help" class="caption mt-2">{{ help }}</div>
      </div>

      <v-tooltip v-if="value.type == 'boolean' && !value.readable" right>
        <template v-slot:activator="{ on }">
          <v-btn
            v-on="on"
            color="primary"
            dark
            @click="updateValue(value)"
            class="mb-2"
            >{{ value.label }}</v-btn
          >
        </template>
        <span>{{ '[' + value.id + '] ' + help }}</span>
      </v-tooltip>
    </div>
  </div>
</template>

<style scoped>
.valueid-label {
  font-weight: bold;
  color: black;
  padding-left: 0;
  margin-bottom: -10px;
}
</style>

<script>
export default {
  props: {
    value: {
      type: Object
    },
    disable_send: {
      type: Boolean
    }
  },
  data () {
    return {
      durations: ['seconds', 'minutes'],
      menu: false,
      error: false
    }
  },
  computed: {
    items () {
      const items = this.value.states || []
      const defaultValue = this.value.default

      if (defaultValue !== undefined) {
        const item = items.find(i => i.value === defaultValue)
        if (item && !item.text.endsWith(' (Default)')) {
          item.text += ' (Default)'
        }
      }
      return items
    },
    label () {
      return '[' + this.value.id + '] ' + this.value.label
    },
    help () {
      return (
        (this.value.description ? this.value.description + ' ' : '') +
        (this.value.default !== undefined && !this.value.list
          ? `(Default: ${this.value.default})`
          : '')
      )
    },
    color: {
      get: function () {
        return '#' + (this.value.newValue || 'ffffff').toUpperCase()
      },
      set: function (v) {
        this.value.newValue = v ? v.substr(1, 7) : null
      }
    },
    parsedAny: {
      get: function () {
        if (this.value.type === 'any') {
          if (typeof this.value.newValue === 'object') {
            return JSON.stringify(this.value.newValue)
          }
        }
        return this.value.newValue
      },
      set: function (v) {
        if (this.value.type === 'any') {
          if (typeof this.value.value === 'object') {
            try {
              this.value.newValue = JSON.parse(v)
              this.error = false
            } catch (error) {
              this.error = 'Value not valid'
            }
          }
        } else {
          this.value.newValue = v
        }
      }
    },
    pickerStyle () {
      if (this.value.type !== 'color') return null
      return {
        backgroundColor: this.color,
        cursor: 'pointer',
        border: '1px solid ' + (this.$vuetify.theme.dark ? 'white' : 'black'),
        height: '30px',
        width: '30px',
        borderRadius: this.menu ? '50%' : '4px',
        transition: 'border-radius 200ms ease-in-out'
      }
    }
  },
  methods: {
    updateValue (v, customValue) {
      // needed for on/off control to update the newValue
      if (customValue !== undefined) {
        v.newValue = customValue
      }

      this.$emit('updateValue', v, customValue)
    }
  }
}
</script>
