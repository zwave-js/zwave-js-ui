<template>
  <div class="node-item">
    <div class="node-col1">
      <div :class="(node.color + '--text')" style="font-size:larger;padding-top:0.3rem">{{ node.id }}</div>
      <v-icon style="margin-top:-0.7rem" :color="node.color">{{ node.icon }}</v-icon>
    </div>
    <div class="node-col2">
      <div style="color:#888;font-size:0.7rem;line-height:0.7rem;padding-top:0.4rem">{{ node.manu }}</div>
      <div style="margin:2px 0 4px 0;line-height:1rem">{{ node.desc }}</div>
      <div style="font-size:0.9rem;margin-top:-0.3rem">{{ node.prod }}</div>
    </div>
    <div class="node-col3">
      <div style="opacity:0.8;height:24px">
        <v-icon v-if="node.sec" small>lock</v-icon>
        <v-icon v-if="node.beam" small style="margin-left:0.5rem">contactless</v-icon>
        <!-- <v-icon v-if="node.isFailed" small>battery_full</v-icon><small v-if="node.isFailed">98%</small> -->
      </div>
      <div style="line-height:0.95rem">{{ node.status }}</div>
      <div style="color:#777;font-size:0.7rem;margin-top:-0.1rem">{{ node.ago }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'NodeItem',
  props: {
    node: Object,
    socket: Object
  },
  components: {
  },
  data () {
    return {}
  }
}
</script>
<style scoped>

.node-grid>div{
flex:1;min-width:300px;border-radius:5px;display:flex;margin:0.3rem;border-width:1px;border-color:#dfdfdf;border-style:solid
}
.theme--dark .node-grid>div{border-color:#333}

.node-col1{
  min-width:30px;text-align:center;background-color:#dfdfdf;margin-right:0.4rem
}
.theme--dark .node-col1{background-color:#333}

.node-col2{
  flex: 1
}
.node-col3{
  text-align:right;padding-right:0.4rem
}
</style>