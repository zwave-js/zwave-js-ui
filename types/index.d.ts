import { CommandClass, InterviewStage, NodeStatus, ValueType } from 'zwave-js'

export type Z2MValueIdState = {
  text: string
  value: number
}

export type Z2MValueId = {
  id: string
  nodeId: number
  commandClass: CommandClass
  commandClassName: string
  endpoint?: number
  property: string | number
  propertyKey?: string | number
  propertyKeyName?: string
  type: ValueType
  readable: boolean
  writeable: boolean
  description?: string
  label?: string
  default: any
  stateless: boolean
  ccSpecific: Record<string, any>
  min?: number
  max?: number
  step?: number
  unit?: string
  minLenght?: number
  maxLength?: number
  states?: ZValueIdState[]
  list: boolean
  lastUpdate?: number
}

export type Z2MDeviceClass = {
  basic: string
  generic: string
  specific: string
}

export type Z2MNodeGroups = {
  text: string
  value: number
  maxNodes: number
  isLifeline: boolean
  multiChannel: boolean
}

export type HassDevice = {
  type:
    | 'sensor'
    | 'light'
    | 'binary_sensor'
    | 'cover'
    | 'climate'
    | 'lock'
    | 'switch'
  object_id: string
  discovery_payload: Map<string, any>
  discoveryTopic: string
  values: string[]
  persistent: boolean
  ignoreDiscovery: boolean
}

export type Z2MNode = {
  id: number
  manufacturerId: number
  productId: number
  productLabel: string
  productDescription: string
  productType: number
  manufacturer: string
  firmwareVersion: string
  zwaveVersion: string
  isSecure: boolean
  isBeaming: boolean
  isListening: boolean
  isFrequentListening: boolean
  isRouting: boolean
  keepAwake: boolean
  deviceClass: Z2MDeviceClass
  neighbors: number[]
  loc: string
  name: string
  hassDevices: Map<string, HassDevice>
  deviceId: string
  hexId: string
  values: Map<string, Z2MValueId>
  groups: Z2MNodeGroups[]
  ready: boolean
  failed: boolean
  lastActive: number
  interviewCompleted: boolean
  maxBaudRate: number
  interviewStage: InterviewStage
  status: NodeStatus
}
