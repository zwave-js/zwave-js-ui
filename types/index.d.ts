import { ZwavejsServer } from '@zwave-js/server'
import { EventEmitter } from 'events'
import { MqttClient as Client } from 'mqtt'
import { Socket } from 'net'
import {
  CommandClass,
  InterviewStage,
  NodeStatus,
  ValueType,
  ZWaveNode,
  ZWaveOptions
} from 'zwave-js'

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

export enum GatewayType {
  VALUEID,
  NAMED,
  MANUAL
}

export enum PayloadType {
  JSON_TIME_VALUE,
  VALUEID,
  RAW
}

export type GatewayValue = {
  device: string
  value: Z2MValueId
  topic: string
  device_class: string
  icon: string
  postOperation: string
  enablePoll: boolean
  pollInterval: number
  parseSend: boolean
  sendFunction: string
  parseReceive: boolean
  receiveFunction: string
}

export type LogLevel = 'silly' | 'verbose' | 'debug' | 'info' | 'warn' | 'error'

export type GatewayConfig = {
  type: GatewayType
  payloadType: PayloadType
  nodeNames: boolean
  ignoreLoc: boolean
  sendEvents: boolean
  ignoreStatus: boolean
  includeNodeInfo: boolean
  publishNodeDetails: boolean
  retainedDiscovery: boolean
  entityTemplate: string
  hassDiscovery: boolean
  discoveryPrefix: string
  logEnabled: boolean
  logLevel: LogLevel
  logToFile: boolean
  values: GatewayValue[]
}

export type MqttConfig = {
  name: string
  host: string
  port: number
  reconnectPeriod: number
  prefix: string
  qos: 0 | 1 | 2
  retain: boolean
  clean: boolean
  store: boolean
  allowSelfSigned: boolean
  key: string
  cert: string
  ca: string
  auth: boolean
  username: string
  password: string
}

export type ZwaveConfig = {
  port: string
  networkKey: string
  serverEnabled: boolean
  serverPort: number
  logEnabled: boolean
  logLevel: LogLevel
  commandsTimeout: number
  plugin: string
  options: ZWaveOptions
}

export interface MqttClient extends EventEmitter {
  config: MqttConfig
  toSubscribe: string[]
  clientID: string
  client: Client
  error?: string
  closed: boolean
  connected: boolean
  broadcastPrefix: string
  eventsPrefix: string

  on(
    event: 'writeRequest',
    listener: (parts: string[], payload: any) => void
  ): this
  on(
    event: 'broadcastRequest',
    listener: (parts: string[], payload: any) => void
  ): this
  on(
    event: 'apiCall',
    listener: (topic: string, apiNema: string, payload: any) => void
  ): this
  on(event: 'connect', listener: () => void): this
  on(event: 'brokerStatus', listener: (online: boolean) => void): this
  on(event: 'hassStatus', listener: (online: boolean) => void): this
}

export type Z2MDriverInfo = {
  homeId: string
  name: string
  controllerId: string
}

export enum ZwaveClientStatus {
  CONNECTED = 'connected',
  DRIVER_READY = 'driver ready',
  SCAN_DONE = 'scan done',
  DRIVER_FAILED = 'driver failed',
  CLOSED = 'closed'
}

export enum EventSource {
  DRIVER = 'driver',
  CONTROLLER = 'controller',
  NODE = 'node'
}

export interface ZwaveClient extends EventEmitter {
  cfg: ZwaveConfig
  soclet: Socket
  closed: boolean
  driverReady: boolean
  scenes: any[]
  nodes: Z2MNode[]
  storeNodes: Z2MNode[]
  devices: Map<string, Z2MNode>
  driverInfo: Z2MDriverInfo
  status: ZwaveClientStatus
  error: boolean | string
  scanComplete: boolean
  cntStatus: string

  server: ZwavejsServer
  statelessTimeouts: Map<string, NodeJS.Timeout>
  commandsTimeout: NodeJS.Timeout
  reconnectTimeout: NodeJS.Timeout
  healTimeout: NodeJS.Timeout

  on(event: 'nodeStatus', listener: (node: Z2MNode) => void): this
  on(
    event: 'event',
    listener: (source: EventSource, eventName: string, ...args: any) => void
  ): this
  on(event: 'scanComplete', listener: () => void): this
  on(
    event: 'notification',
    listener: (
      node: Z2MNode,
      label: string,
      parameters: string | number | Buffer
    ) => void
  ): this
  on(event: 'nodeRemoved', listener: (node: Z2MNode) => void): this
  on(
    event: 'valueChanged',
    listener: (valueId: Z2MValueId, node: Z2MNode) => void
  ): this
}

export interface Z2MGateway {
  config: GatewayConfig
  mqtt: MqttClient
  zwave: ZwaveClient

  topicValues: Map<string, string>
  discovered: Map<string, HassDevice>
  topicLevels: number[]
}
