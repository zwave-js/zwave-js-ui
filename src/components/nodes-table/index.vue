<template>
  <v-data-table
    :headers="headers"
    :items="tableNodes"
    :footer-props="{
      itemsPerPageOptions: [10, 20, 50, 100, -1]
    }"
    :items-per-page.sync="nodeTableItems"
    item-key="id"
    class="elevation-1"
  >
    <template v-slot:top>
      <v-btn color="blue darken-1" text @click.native="resetFilter()"
        >Reset Filter</v-btn
      >
    </template>
    <template v-for="h in headers" v-slot:[`header.${h.value}`]="{ header }">
      <filter-options v-model="filters[`${h.value}`]" :items="values[`${h.value}`]"></filter-options>
      {{ header.text }}
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
        <td>{{ item.id }}</td>
        <td>
          {{ item.ready ? item.manufacturer : '' }}
        </td>
        <td>
          {{ item.ready ? item.productDescription : '' }}
        </td>
        <td>
          {{ item.ready ? item.productLabel : '' }}
        </td>
        <td>{{ item.name || '' }}</td>
        <td>{{ item.loc || '' }}</td>
        <td>{{ item.isSecure ? 'Yes' : 'No' }}</td>
        <td>{{ item.isBeaming ? 'Yes' : 'No' }}</td>
        <td>{{ item.failed ? 'Yes' : 'No' }}</td>
        <td>{{ item.status }}</td>
        <td>{{ item.interviewStage }}</td>
        <td>
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
