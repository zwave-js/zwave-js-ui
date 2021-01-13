<template>
  <div v-if="!value.writeable && !value.list">
    <v-text-field
      :label="'[' + value.id + '] ' + value.label"
      readonly
      :suffix="value.unit"
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
      :label="'[' + value.id + '] ' + value.label"
      :type="value.type === 'number' ? 'number' : 'text'"
      :append-outer-icon="!disable_send ? 'send' : null"
      :suffix="value.unit"
      :min="value.min != value.max ? value.min : null"
      :step="1"
      :max="value.min != value.max ? value.max : null"
      :hint="value.description || ''"
      v-model="value.newValue"
      @click:append-outer="updateValue(value)"
    ></v-text-field>

    <v-text-field
      v-if="
            value.type === 'duration'
      "
      :label="'[' + value.id + '] ' + value.label"
      :type="value.type === 'number' ? 'number' : 'text'"
      :append-outer-icon="!disable_send ? 'send' : null"
      :suffix="value.value ? value.value.unit : value.unit"
      :min="value.min != value.max ? value.min : null"
      :step="1"
      :max="value.min != value.max ? value.max : null"
      :hint="value.description || ''"
      v-model.number="value.newValue.value"
      @click:append-outer="updateValue(value)"
    ></v-text-field>

    <v-select
      v-if="value.list"
      :items="value.states"
      :label="'[' + value.id + '] ' + value.label"
      :hint="value.description || ''"
      :append-outer-icon="!disable_send || value.writeable ? 'send' : null"
      v-model="value.newValue"
      :readonly="!value.writeable"
      @click:append-outer="updateValue(value)"
    ></v-select>

    <div v-if="value.type == 'boolean' && value.writeable && value.readable">
      <v-subheader style="padding-left: 0"
        >{{ '[' + value.id + '] ' + value.label }}
      </v-subheader>
      <div style="display: flex">
        <v-btn
          outlined
          class="on-button"
          :style="{ background: value.value ? '#4CAF50' : '' }"
          :color="value.value ? 'white' : 'green'"
          dark
          @click="updateValue(value, true)"
        >
          ON
        </v-btn>
        <v-btn
          outlined
          class="off-button"
          :style="{ background: !value.value ? '#f44336' : '' }"
          :color="!value.value ? 'white' : 'red'"
          @click="updateValue(value, false)"
          dark
        >
          OFF
        </v-btn>
      </div>
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
      <span>{{ '[' + value.id + '] ' + (value.description || '') }}</span>
    </v-tooltip>
  </div>
</template>

<style scoped>
.on-button {
  border-radius: 20px 0 0 20px;
  margin-right: 0;
}
.off-button {
  border-radius: 0 20px 20px 0;
  margin-right: 0;
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
  computed: {},
  methods: {
    updateValue (v, customValue) {
      this.$emit('updateValue', v, customValue)
    }
  }
}
</script>
