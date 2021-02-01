import { NodeCollection } from '@/modules/NodeCollection'
import { Settings } from '@/modules/Settings'
import ColumnFilter from '@/components/nodes-table/ColumnFilter.vue'
import ColumnFilterHelper from '@/modules/ColumnFilterHelper'
import ExpandedNode from '@/components/nodes-table/ExpandedNode.vue'

export default {
  props: {
    nodeActions: Array,
    nodes: Array,
    socket: Object
  },
  components: {
    ColumnFilter,
    ExpandedNode
  },
  data: () => ({
    settings: new Settings(localStorage),
    showHidden: undefined,
    itemsPerPage: undefined,
    groupBy: undefined,
    expanded: [],
    filters: {},
    sorting: {},
    selected: [],
    headersMenu: false,
    headers: [
      {
        text: 'ID',
        type: 'number',
        value: 'id',
        groupable: false,
        selectable: false,
        active: true
      },
      {
        text: 'Manufacturer',
        type: 'string',
        value: 'manufacturer',
        selectable: true,
        active: true
      },
      {
        text: 'Product',
        type: 'string',
        value: 'productDescription',
        selectable: true,
        active: true
      },
      {
        text: 'Product code',
        type: 'string',
        value: 'productLabel',
        selectable: true,
        active: false
      },
      {
        text: 'Name',
        type: 'string',
        value: 'name',
        selectable: true,
        active: true
      },
      {
        text: 'Location',
        type: 'string',
        value: 'loc',
        selectable: true,
        active: true
      },
      {
        text: 'Secure',
        type: 'boolean',
        value: 'isSecure',
        selectable: true,
        active: false
      },
      {
        text: 'Beaming',
        type: 'boolean',
        value: 'isBeaming',
        selectable: true,
        active: false
      },
      {
        text: 'Failed',
        type: 'boolean',
        value: 'failed',
        selectable: true,
        active: false
      },
      {
        text: 'Status',
        type: 'string',
        value: 'status',
        selectable: true,
        active: true
      },
      {
        text: 'Interview stage',
        type: 'string',
        value: 'interviewStage',
        selectable: true,
        active: true
      },
      {
        text: 'Last Active',
        type: 'date',
        value: 'lastActive',
        groupable: false,
        selectable: true,
        active: true
      }
    ]
  }),
  methods: {
    filterSelected () {
      this.filters.id = { values: this.selected.map(node => node.id) }
    },
    initFilters () {
      return this.headers.reduce((values, h) => {
        values[h.value] = {}
        return values
      }, {})
    },
    initSorting () {
      return {
        by: ['id'],
        desc: [false]
      }
    },
    loadSetting (key, defaultVal) {
      return this.settings.load(key, defaultVal)
    },
    storeSetting (key, val) {
      this.settings.store(key, val)
    },
    changeFilter (colName, $event) {
      this.filters = this.filters ? this.filters : {}
      this.filters[colName] = $event
      this.storeSetting('nodes_filters', this.filters)
    },
    groupByTitle (groupBy, group) {
      const h = this.headers.find(h => h.value === groupBy[0]) || {}
      let title = ''
      if (h.text) {
        title = `${h.text}: ${group}`
      }
      return title
    },
    resetFilters () {
      this.filters = this.initFilters()
      this.selected = []
      this.groupBy = undefined
      this.storeSetting('nodes_filters', this.filters)
    },
    toggleExpanded (item) {
      this.expanded = this.expanded.includes(item)
        ? this.expanded.filter(i => i !== item)
        : [...this.expanded, item]
    }
  },
  created () {
    this.showHidden = this.settings.load('nodes_showHidden', false)
    this.filters = this.loadSetting('nodes_filters', this.initFilters())
    this.sorting = this.loadSetting('nodes_sorting', this.initSorting())
    this.groupBy = this.loadSetting('nodes_groupBy', [])
    this.itemsPerPage = this.loadSetting('nodes_itemsPerPage', 10)
  },
  watch: {
    showHidden (val) {
      this.settings.store('nodes_showHidden', val)
    },
    groupBy (val) {
      this.settings.store('nodes_groupBy', val)
    },
    itemsPerPage (val) {
      this.storeSetting('nodes_itemsPerPage', val)
    },
    sorting: {
      handler (val) {
        this.storeSetting('nodes_sorting', val)
      },
      deep: true
    }
  },
  computed: {
    activeHeaders () {
      return this.headers.filter(col => col.active)
    },
    selectableHeaders () {
      return this.headers.filter(col => col.selectable)
    },
    nodeCollection () {
      return new NodeCollection(this.nodes)
    },
    relevantNodes () {
      return this.nodeCollection.filter('failed', failed => {
        return this.showHidden ? true : !failed
      })
    },
    filteredNodes () {
      return ColumnFilterHelper.filterByFilterSpec(
        this.relevantNodes,
        this.headers,
        this.filters
      )
    },
    values () {
      return this.headers.reduce((values, h) => {
        values[h.value] = this.relevantNodes.values(h.value)
        return values
      }, {})
    },
    tableNodes () {
      return this.filteredNodes.nodes
    }
  }
}
