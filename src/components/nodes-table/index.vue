<template>
  <v-data-table
    :headers="headers"
    :items="tableNodes"
    :footer-props="{
      itemsPerPageOptions: [10, 20, 50, 100, -1]
    }"
    :sort-desc.sync="sorting.desc"
    :sort-by.sync="sorting.by"
    :group-by="groupBy"
    @update:group-by="groupBy = $event"
    @group="groupBy = $event"
    :items-per-page.sync="itemsPerPage"
    item-key="id"
    class="elevation-1"
  >
    <template v-slot:top>
      <v-layout row wrap>
        <v-flex xs12 sm3 md2 ml-6>
          <v-switch label="Show hidden nodes" v-model="showHidden"></v-switch>
        </v-flex>
      </v-layout>
      <v-layout row ma-2 justify-start>
        <v-flex xs12>
          <v-btn color="blue darken-1" text @click.native="resetFilters()"
            >Reset Filters</v-btn
          >
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn text color="green" v-on="on" @click="$emit('import')">
                IMPORT
              </v-btn>
            </template>
            <span>Import nodes.json Configuration</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn text color="purple" v-on="on" @click="$emit('export')">
                EXPORT
              </v-btn>
            </template>
            <span>Export nodes.json Configuration</span>
          </v-tooltip>
        </v-flex>
      </v-layout>
    </template>
    <template
      v-for="column in headers"
      v-slot:[`header.${column.value}`]="{ header }"
    >
      <span :key="column.value">
        <column-filter
          :column="column"
          :value="filters[`${column.value}`] || {}"
          :items="values[`${column.value}`] || {}"
          @change="changeFilter(column.value, $event)"
          @update:group-by="groupBy = $event"
        ></column-filter>
        {{ header.text }}
      </span>
    </template>
    <template
      v-slot:[`group.header`]="{ group, headers, toggle, remove, isOpen }"
    >
      <td :colspan="headers.length">
        <v-btn @click="toggle" x-small icon :ref="group">
          <v-icon>{{ isOpen ? 'remove' : 'add' }}</v-icon>
        </v-btn>
        <span>{{ groupByTitle(groupBy, group) }}</span>
        <v-btn x-small icon @click="remove"><v-icon>close</v-icon></v-btn>
      </td>
    </template>
    <template v-slot:item="{ item }">
      <tr
        :style="{
          cursor: 'pointer',
          background:
            selectedNode === item ? $vuetify.theme.themes.light.accent : 'none'
        }"
        @click.stop="nodeSelected(item)"
      >
        <td v-if="groupBy != 'id'">{{ item.id }}</td>
        <td v-if="groupBy != 'manufacturer'">
          {{ item.ready ? item.manufacturer : '' }}
        </td>
        <td v-if="groupBy != 'productDescription'">
          {{ item.ready ? item.productDescription : '' }}
        </td>
        <td v-if="groupBy != 'productLabel'">
          {{ item.ready ? item.productLabel : '' }}
        </td>
        <td v-if="groupBy != 'name'">{{ item.name || '' }}</td>
        <td v-if="groupBy != 'loc'">{{ item.loc || '' }}</td>
        <td v-if="groupBy != 'isSecure'">{{ item.isSecure ? 'Yes' : 'No' }}</td>
        <td v-if="groupBy != 'isBeaming'">
          {{ item.isBeaming ? 'Yes' : 'No' }}
        </td>
        <td v-if="groupBy != 'failed'">{{ item.failed ? 'Yes' : 'No' }}</td>
        <td v-if="groupBy != 'status'">{{ item.status }}</td>
        <td v-if="groupBy != 'interviewStage'">{{ item.interviewStage }}</td>
        <td v-if="groupBy != 'lastActive'">
          {{
            item.lastActive
              ? new Date(item.lastActive).toLocaleString()
              : 'Never'
          }}
        </td>
      </tr>
    </template>
  </v-data-table>
</template>
<script src="./nodes-table.js"></script>
<style scoped src="./nodes-table.css"></style>
