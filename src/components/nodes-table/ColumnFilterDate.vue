<template>
  <v-card-text>
    <v-row>
      <v-col>
        <v-text-field
          type="datetime-local"
          label="From"
          v-model="value.from"
          clearable
          @change="$emit('change', value)"
        ></v-text-field>
        <v-text-field
          type="datetime-local"
          label="Until"
          v-model="value.until"
          clearable
          @change="$emit('change', value)"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-card-text>
</template>

<script>
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'
export default {
  props: {
    value: {
      type: Object,
      default: () => ColumnFilterHelper.defaultFilter('string'),
      required: true
    }
  }
}
</script>
