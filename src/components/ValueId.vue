<template>
  <div v-if="!value.writeable && !value.list">
    <v-text-field
      :label="value.label + ' (' + value.id + ')'"
      readonly
      :suffix="value.units"
      :hint="value.description || ''"
      v-model="value.value"
    ></v-text-field>
  </div>

  <div v-else>
    <v-text-field
      v-if="
        !value.list &&
          (value.type === 'number' ||
            value.type === 'string' ||
            value.type === 'any')
      "
      :label="value.label + ' (' + value.id + ')'"
      :type="value.type === 'number' ? 'number' : 'text'"
      :append-outer-icon="!disable_send ? 'send' : null"
      :suffix="value.units"
      :min="value.min != value.max ? value.min : null"
      :step="1"
      :max="value.min != value.max ? value.max : null"
      :hint="value.description || ''"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
    ></v-text-field>

    <v-select
      v-if="value.list"
      :items="value.states"
      :label="value.label + ' (' + value.id + ')'"
      :hint="value.description || ''"
      :append-outer-icon="!disable_send || value.writeable ? 'send' : null"
      v-model="value.newValue"
      :readonly="!value.writeable"
      @click:append-outer="updateValue(value)"
    ></v-select>

    <v-switch
      v-if="value.type == 'boolean' && value.writeable && value.readable"
      :label="value.label + ' (' + value.id + ')'"
      :hint="value.description || ''"
      persistent-hint
      v-model="value.newValue"
      @change="updateValue(value)"
    ></v-switch>

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
      <span>{{ ' (' + value.id + ')' + (value.description || '') }}</span>
    </v-tooltip>
  </div>
</template>

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
  computed: {},
  methods: {
    updateValue (v) {
      this.$emit('updateValue', v)
    }
  }
}
</script>
