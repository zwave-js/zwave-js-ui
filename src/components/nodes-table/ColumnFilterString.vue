<template>
  <v-card-text>
    <v-row>
      <v-col>
        <v-text-field
          label="Match"
          v-model="value.match"
          clearable
          @change="$emit('change', value)"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-select
          v-model="value.values"
          :items="items"
          label="Values"
          clearable
          chips
          deletableChips
          dense
          multiple
          @change="$emit('change', value)"
        ></v-select>
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
    },
    items: {
      type: Array,
      default: () => [],
      required: true
    }
  }
}
</script>
