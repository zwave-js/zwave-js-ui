import { NodeCollection } from '@/modules/NodeCollection'
import filterOptions from '@/components/nodes-table/filter-options.vue'

export default {
  props: {
    nodes: Array,
    showHidden: Boolean
  },
  components: {
    filterOptions
  },
  data: () => ({
    nodeTableItems: 10,
    selectedNode: undefined,
    filters: {},
    headers: [
      { text: 'ID', value: 'id' },
      { text: 'Manufacturer', value: 'manufacturer' },
      { text: 'Product', value: 'productDescription' },
      { text: 'Product code', value: 'productLabel' },
      { text: 'Name', value: 'name' },
      { text: 'Location', value: 'loc' },
      { text: 'Secure', value: 'isSecure' },
      { text: 'Beaming', value: 'isBeaming' },
      { text: 'Failed', value: 'failed' },
      { text: 'Status', value: 'status' },
      { text: 'Interview stage', value: 'interviewStage' },
      { text: 'Last Active', value: 'lastActive' }
    ]
  }),
  methods: {
    initFilters () {
      return {
        id: { type: 'number' },
        manufacturer: { type: 'string' },
        productDescription: { type: 'string' },
        productLabel: { type: 'string' },
        name: { type: 'string' },
        loc: { type: 'string' },
        isSecure: { type: 'boolean' },
        isBeaming: { type: 'boolean' },
        failed: { type: 'boolean' },
        status: { type: 'string' },
        interviewStage: { type: 'string' },
        lastActive: { type: 'date' }
      }
    },
    resetFilter () {
      this.filters = this.initFilters()
    },
    nodeSelected (node) {
      this.selectedNode = node
      this.$emit('node-selected', { node })
    },
    productName (node) {
      const manufacturer = node.manufacturer ? ` (${node.manufacturer})` : ''
      return node.ready ? `${node.product}${manufacturer}` : ''
    }
  },
  mounted () {
    this.filters = this.initFilters()
    const itemsPerPage = parseInt(localStorage.getItem('nodes_itemsPerPage'))
    this.nodeTableItems = !isNaN(itemsPerPage) ? itemsPerPage : 10
  },
  watch: {
    nodeTableItems (val) {
      localStorage.setItem('nodes_itemsPerPage', val)
    }
  },
  computed: {
    nodeCollection () {
      return new NodeCollection(this.nodes)
    },
    relevantNodes () {
      return this.nodeCollection.filter('failed', failed => {
        return this.showHidden ? true : !failed
      })
    },
    filteredNodes () {
      return this.relevantNodes
        .betweenNumber(
          'id',
          this.filters.id ? this.filters.id.min : null,
          this.filters.id ? this.filters.id.max : null
        )
        .equalsAny(
          'id',
          this.filters.id
            ? this.filters.id.selections
              ? this.filters.id.selections
              : []
            : []
        )
        .contains(
          ['manufacturer'],
          this.filters.manufacturer ? this.filters.manufacturer.search : ''
        )
        .equalsAny(
          'manufacturer',
          this.filters.manufacturer
            ? this.filters.manufacturer.selections
              ? this.filters.manufacturer.selections
              : []
            : []
        )
        .contains(
          ['productDescription'],
          this.filters.productDescription
            ? this.filters.productDescription.search
            : ''
        )
        .equalsAny(
          'productDescription',
          this.filters.productDescription
            ? this.filters.productDescription.selections
              ? this.filters.productDescription.selections
              : []
            : []
        )
        .contains(
          ['productLabel'],
          this.filters.productLabel ? this.filters.productLabel.search : ''
        )
        .equalsAny(
          'productLabel',
          this.filters.productLabel
            ? this.filters.productLabel.selections
              ? this.filters.productLabel.selections
              : []
            : []
        )
        .contains(['name'], this.filters.name ? this.filters.name.search : '')
        .equalsAny(
          'name',
          this.filters.name
            ? this.filters.name.selections
              ? this.filters.name.selections
              : []
            : []
        )
        .contains(['loc'], this.filters.loc ? this.filters.loc.search : '')
        .equalsAny(
          'loc',
          this.filters.loc
            ? this.filters.loc.selections
              ? this.filters.loc.selections
              : []
            : []
        )
        .equals(
          'isSecure',
          this.filters.isSecure ? this.filters.isSecure.bool : null
        )
        .equalsAny(
          'isSecure',
          this.filters.isSecure
            ? this.filters.isSecure.selections
              ? this.filters.isSecure.selections
              : []
            : []
        )
        .equals(
          'isBeaming',
          this.filters.isBeaming ? this.filters.isBeaming.bool : null
        )
        .equalsAny(
          'isBeaming',
          this.filters.isBeaming
            ? this.filters.isBeaming.selections
              ? this.filters.isBeaming.selections
              : []
            : []
        )
        .equals('failed', this.filters.failed ? this.filters.failed.bool : null)
        .equalsAny(
          'failed',
          this.filters.failed
            ? this.filters.failed.selections
              ? this.filters.failed.selections
              : []
            : []
        )
        .contains(
          ['status'],
          this.filters.status ? this.filters.status.search : ''
        )
        .equalsAny(
          'status',
          this.filters.status
            ? this.filters.status.selections
              ? this.filters.status.selections
              : []
            : []
        )
        .contains(
          ['interviewStage'],
          this.filters.interviewStage ? this.filters.interviewStage.search : ''
        )
        .equalsAny(
          'interviewStage',
          this.filters.interviewStage
            ? this.filters.interviewStage.selections
              ? this.filters.interviewStage.selections
              : []
            : []
        )
        .betweenDate(
          'lastActive',
          this.filters.lastActive ? this.filters.lastActive.min : null,
          this.filters.lastActive ? this.filters.lastActive.max : null
        )
    },
    values () {
      return {
        id: this.relevantNodes.values('id'),
        manufacturer: this.relevantNodes.values('manufacturer'),
        productDescription: this.relevantNodes.values('productDescription'),
        productLabel: this.relevantNodes.values('productLabel'),
        name: this.relevantNodes.values('name'),
        loc: this.relevantNodes.values('loc'),
        isSecure: this.relevantNodes.values('isSecure'),
        isBeaming: this.relevantNodes.values('isBeaming'),
        failed: this.relevantNodes.values('failed'),
        status: this.relevantNodes.values('status'),
        interviewStage: this.relevantNodes.values('interviewStage'),
        lastActive: this.relevantNodes.values('lastActive')
      }
    },
    tableNodes () {
      return this.filteredNodes.nodes
    }
  }
}
