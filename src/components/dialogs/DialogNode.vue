<template>
  <v-dialog v-model="value" persistent fullscreen>
    <v-card :class="['node-card', $vuetify.breakpoint.name]">
      <header>
        <nav>
          <v-btn @click="$emit('prev')" icon
            ><v-icon color="#666" :large="$vuetify.breakpoint.smAndUp"
              >keyboard_arrow_left</v-icon
            ></v-btn
          >
          <strong>{{ node.id }}</strong>
          <v-btn @click="$emit('next')" icon
            ><v-icon color="#666" :large="$vuetify.breakpoint.smAndUp"
              >keyboard_arrow_right</v-icon
            ></v-btn
          >
        </nav>
        <div class="node-title">
          <small>{{ node.manu }}</small>
          <strong>{{ node.desc }}</strong>
          <div style="opacity:0.7" v-if="$vuetify.breakpoint.xs && hasLocName">
            {{ node.loc || '' }} {{ node.name || '' }}
          </div>
        </div>
        <div
          v-if="$vuetify.breakpoint.smAndUp"
          class="node-title"
          style="margin-right:2rem;text-align:right;flex:0"
        >
          <small>{{ node.loc || '&#160;' }}</small>
          <strong>{{ node.name || '&#160;' }}</strong>
        </div>
        <v-btn style="margin:1rem" icon @click="$emit('close')"
          ><v-icon>close</v-icon></v-btn
        >
      </header>
      <section class="tab-wrapper">
        <v-tabs
          background-color="#dfdfdf"
          :vertical="$vuetify.breakpoint.smAndUp"
          :grow="$vuetify.breakpoint.smAndDown"
          :icons-and-text="$vuetify.breakpoint.smAndUp"
        >
          <v-tab
            ><div v-if="$vuetify.breakpoint.smAndUp">Info</div>
            <v-icon>info</v-icon></v-tab
          >
          <v-tab
            ><div v-if="$vuetify.breakpoint.smAndUp">Config</div>
            <v-icon>build</v-icon></v-tab
          >
          <v-tab
            ><div v-if="$vuetify.breakpoint.smAndUp">Groups</div>
            <v-icon>dashboard_customize</v-icon></v-tab
          >
          <v-tab
            ><div v-if="$vuetify.breakpoint.smAndUp">Advanced</div>
            <v-icon>label_important</v-icon></v-tab
          >

          <v-tab-item>
            <v-card flat max-width="800">
              <v-card-text>
                <div class="item-chips">
                  <v-chip
                    :color="node.color + ' lighten-4'"
                    :text-color="node.color + ' darken-2'"
                    ><v-icon>{{ node.icon }}</v-icon> {{ node.status }}</v-chip
                  >
                  <v-chip
                    color="indigo lighten-4"
                    text-color="indigo darken-2"
                    icon
                    ><v-icon>add_box</v-icon>
                    {{
                      node.manufacturer === 'Inovelli' ? '500 Series' : 'Plus'
                    }}</v-chip
                  >
                  <v-chip
                    color="amber lighten-4"
                    text-color="amber darken-2"
                    v-if="node.isSecure"
                    icon
                    ><v-icon>lock</v-icon> S2</v-chip
                  >
                  <v-chip
                    color="blue-grey lighten-4"
                    text-color="blue-grey lighten-1"
                    v-if="!node.isSecure"
                    icon
                    ><v-icon>lock_open</v-icon> None</v-chip
                  >
                  <v-chip
                    color="purple lighten-4"
                    text-color="purple darken-2"
                    v-if="node.isBeaming"
                    icon
                    ><v-icon>contactless</v-icon> Beaming</v-chip
                  >
                  <v-chip
                    color="blue-grey lighten-4"
                    text-color="blue-grey lighten-1"
                    v-if="!node.isBeaming"
                    icon
                    ><v-icon>battery_charging</v-icon> Battery</v-chip
                  >
                </div>
                <div
                  style="display:grid;grid-template-columns: repeat(2, 1fr);"
                >
                  <div class="info-item">
                    <div>Model</div>
                    <div style="font-weight:bold">{{ node.productLabel }}</div>
                  </div>
                  <div class="info-item">
                    <div>Device ID</div>
                    <div>{{ `${node.deviceId} (${node.hexId})` }}</div>
                  </div>
                  <div class="info-item">
                    <div>
                      Library type
                      <v-icon
                        style="float:right;margin-top:0.5rem"
                        small
                        color="indigo lighten-2"
                        >help_outline</v-icon
                      >
                    </div>
                    <div>6</div>
                  </div>
                  <div class="info-item">
                    <div>
                      Z-Wave protocol version
                      <v-icon
                        style="float:right;margin-top:0.5rem"
                        small
                        color="indigo lighten-2"
                        >help_outline</v-icon
                      >
                    </div>
                    <div>3.40</div>
                  </div>
                  <div class="info-item">
                    <div>
                      Z-Wave chip firware versions
                      <v-icon
                        style="float:right;margin-top:0.5rem"
                        small
                        color="indigo lighten-2"
                        >help_outline</v-icon
                      >
                    </div>
                    <div>3.25</div>
                  </div>
                  <div class="info-item">
                    <div>
                      Manufacturer ID
                      <v-icon
                        style="float:right;margin-top:0.5rem"
                        small
                        color="indigo lighten-2"
                        >help_outline</v-icon
                      >
                    </div>
                    <div>99</div>
                  </div>
                  <div class="info-item">
                    <div>
                      Product type
                      <v-icon
                        style="float:right;margin-top:0.5rem"
                        small
                        color="indigo lighten-2"
                        >help_outline</v-icon
                      >
                    </div>
                    <div>21079</div>
                  </div>
                  <div class="info-item">
                    <div>
                      Product ID
                      <v-icon
                        style="float:right;margin-top:0.5rem"
                        small
                        color="indigo lighten-2"
                        >help_outline</v-icon
                      >
                    </div>
                    <div>13619</div>
                  </div>
                </div>
                <div>
                  <v-icon>public</v-icon>
                  <a
                    href="https://products.z-wavealliance.org/products/3042?selectedFrequencyId=2"
                    >https://products.z-wavealliance.org/products/3042?selectedFrequencyId=2</a
                  >
                </div>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <v-tab-item>
            <v-card flat max-width="800">
              <v-card-text>
                <p>
                  Sed aliquam ultrices mauris. Donec posuere vulputate arcu.
                  Morbi ac felis. Etiam feugiat lorem non metus. Sed a libero.
                </p>

                <p>
                  Nam ipsum risus, rutrum vitae, vestibulum eu, molestie vel,
                  lacus. Aenean tellus metus, bibendum sed, posuere ac, mattis
                  non, nunc. Aliquam lobortis. Aliquam lobortis. Suspendisse non
                  nisl sit amet velit hendrerit rutrum.
                </p>

                <p class="mb-0">
                  Phasellus dolor. Fusce neque. Fusce fermentum odio nec arcu.
                  Pellentesque libero tortor, tincidunt et, tincidunt eget,
                  semper nec, quam. Phasellus blandit leo ut odio.
                </p>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <v-tab-item>
            <v-card flat max-width="800">
              <v-card-text>
                <p>
                  Morbi nec metus. Suspendisse faucibus, nunc et pellentesque
                  egestas, lacus ante convallis tellus, vitae iaculis lacus elit
                  id tortor. Sed mollis, eros et ultrices tempus, mauris ipsum
                  aliquam libero, non adipiscing dolor urna a orci. Curabitur
                  ligula sapien, tincidunt non, euismod vitae, posuere
                  imperdiet, leo. Nunc sed turpis.
                </p>

                <p>
                  Suspendisse feugiat. Suspendisse faucibus, nunc et
                  pellentesque egestas, lacus ante convallis tellus, vitae
                  iaculis lacus elit id tortor. Proin viverra, ligula sit amet
                  ultrices semper, ligula arcu tristique sapien, a accumsan nisi
                  mauris ac eros. In hac habitasse platea dictumst. Fusce ac
                  felis sit amet ligula pharetra condimentum.
                </p>

                <p>
                  Sed consequat, leo eget bibendum sodales, augue velit cursus
                  nunc, quis gravida magna mi a libero. Nam commodo suscipit
                  quam. In consectetuer turpis ut velit. Sed cursus turpis vitae
                  tortor. Aliquam eu nunc.
                </p>

                <p>
                  Etiam ut purus mattis mauris sodales aliquam. Ut varius
                  tincidunt libero. Aenean viverra rhoncus pede. Duis leo. Fusce
                  fermentum odio nec arcu.
                </p>

                <p class="mb-0">
                  Donec venenatis vulputate lorem. Aenean viverra rhoncus pede.
                  In dui magna, posuere eget, vestibulum et, tempor auctor,
                  justo. Fusce commodo aliquam arcu. Suspendisse enim turpis,
                  dictum sed, iaculis a, condimentum nec, nisi.
                </p>
              </v-card-text>
            </v-card>
          </v-tab-item>

          <v-tab-item>
            <v-card flat max-width="800">
              <v-card-text>
                <p>
                  Fusce a quam. Phasellus nec sem in justo pellentesque
                  facilisis. Nam eget dui. Proin viverra, ligula sit amet
                  ultrices semper, ligula arcu tristique sapien, a accumsan nisi
                  mauris ac eros. In dui magna, posuere eget, vestibulum et,
                  tempor auctor, justo.
                </p>

                <p class="mb-0">
                  Cras sagittis. Phasellus nec sem in justo pellentesque
                  facilisis. Proin sapien ipsum, porta a, auctor quis, euismod
                  ut, mi. Donec quam felis, ultricies nec, pellentesque eu,
                  pretium quis, sem. Nam at tortor in tellus interdum sagittis.
                </p>
              </v-card-text>
            </v-card>
          </v-tab-item>
        </v-tabs>
      </section>
    </v-card>
  </v-dialog>
</template>

<script>
// import AssociationGroups from '@/components/nodes-table/AssociationGroups'
// import HomeAssistant from '@/components/nodes-table/HomeAssistant'
// import NodeDetails from '@/components/nodes-table/NodeDetails'

import { mapGetters } from 'vuex'

export default {
  props: {
    value: Boolean, // show or hide
    node: Object,
    socket: Object
  },
  components: {
    // AssociationGroups,
    // HomeAssistant,
    // NodeDetails
  },
  data () {
    return {
      currentTab: 0
    }
  },
  computed: {
    ...mapGetters(['gateway', 'nodes']),
    hasLocName () {
      return (
        (this.node.name && this.node.name.length > 0) ||
        (this.node.loc && this.node.loc.length > 0)
      )
    }
  },
  methods: {
    copyText () {
      const textToCopy = this.$refs.nodeJsonContent.$el.querySelector(
        'textarea'
      )
      textToCopy.select()
      document.execCommand('copy')
    }
  }
}
</script>

<style scoped>
header {
  display: flex;
  max-width: 980px;
  padding-top: 1rem;
  margin-bottom: 1rem;
}
nav {
  background-color: #dfdfdf;
  border-radius: 0 8px 8px 0;
  min-width: 119px;
  display: flex;
  justify-content: space-between;
  margin-right: 1.5rem;
  align-items: center;
}
.node-card.xs nav {
  min-width: 96px;
  margin-right: 0.8rem;
}
nav > strong {
  color: #666;
  font-size: 1.4rem;
}
.node-card.xs nav > strong {
  font-size: 1.2rem;
}

.node-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  font-size: 1.4rem;
  margin: 0.6rem 0;
}
.node-title > strong {
  margin-top: -0.5rem;
}
.node-card.xs .node-title {
  font-size: 1.1rem;
  line-height: 1.2rem;
}
.node-card.xs .node-title > strong {
  margin-top: 0;
}

.v-tabs {
  border-radius: 0 8px 8px 0;
}
.node-card.xs .v-tabs {
  border-radius: 0;
}

.item-chips {
  margin-bottom: 1rem;
}
.item-chips > span {
  margin: 0 1rem 0.5rem 0;
}
.item-chips > span i {
  margin-right: 0.4rem;
}
.info-item {
  background: #77777710;
  margin: 0 1rem 1rem 0;
  padding: 0.5rem;
}
.info-item > :first-child {
  font-size: 0.7rem;
  color: #888;
}
.info-item > :last-child {
  font-size: 1.1rem;
  font-weight: 500;
  margin-top: -0.4rem;
}

.tab-wrapper {
  height: 80vh; /* Set to desired height of entire tabbed section, or use flex, or ... */
  display: flex;
  flex-direction: column;
}

.tab-wrapper .v-window {
  flex: 1;
}

.tab-wrapper .v-window__container,
.tab-wrapper .v-window-item {
  height: 100%;
}

/* customise the dimensions of the card content here */
.tab-wrapper .v-card {
  height: 100%;
}
</style>
