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
    <template v-slot:header.id="{ header }">
      <filter-options
        v-model="filters.id"
        :items="values.id"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.manufacturer="{ header }">
      <filter-options
        v-model="filters.manufacturer"
        :items="values.manufacturer"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.productDescription="{ header }">
      <filter-options
        v-model="filters.productDescription"
        :items="values.productDescription"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.product="{ header }">
      <filter-options
        v-model="filters.product"
        :items="values.product"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.name="{ header }">
      <filter-options
        v-model="filters.name"
        :items="values.name"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.loc="{ header }">
      <filter-options
        v-model="filters.loc"
        :items="values.loc"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.isSecure="{ header }">
      <filter-options
        v-model="filters.isSecure"
        :items="values.isSecure"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.isBeaming="{ header }">
      <filter-options
        v-model="filters.isBeaming"
        :items="values.isBeaming"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.failed="{ header }">
      <filter-options
        v-model="filters.failed"
        :items="values.failed"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.status="{ header }">
      <filter-options
        v-model="filters.status"
        :items="values.status"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.interviewStage="{ header }">
      <filter-options
        v-model="filters.interviewStage"
        :items="values.interviewStage"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:header.lastActive="{ header }">
      <filter-options
        v-model="filters.lastActive"
        :items="values.lastActive"
      ></filter-options>
      {{ header.text }}
    </template>
    <template v-slot:item="{ item }">
      <tr
        :style="{
          cursor: 'pointer',
          background:
            selectedNode === item
              ? $vuetify.theme.themes.light.accent
              : 'none'
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
