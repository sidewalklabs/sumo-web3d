// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/**
 * Type definitions for network endpoints.
 */

export interface VehicleInfo {
  x: number;
  y: number;
  z: number;
  speed: number;
  type: string;
  angle: number;
  width: number;
  length: number;
  signals: number; // bitset of Signals.
  vehicle: string | null; // for a person, are they in a vehicle?
  vClass: string;
}

export enum Signals {
  LEFT = 1 << 0,
  RIGHT = 1 << 1,
  BRAKE = 1 << 3,
}

export interface LightInfo {
  phase: number;
  programID: string;
}

/** Websocket messages */

export interface SnapshotMessage extends Snapshot {
  type: 'snapshot';
}

export interface SimulationStateMessage extends SimulationState {
  type: 'state';
}

export type WebsocketMessage = SnapshotMessage | SimulationStateMessage;

export interface Delta<T> {
  creations: {[id: string]: T};
  updates: {[id: string]: T};
  removals: string[];
}

/** Return type for /snap endpoint. */
export interface Snapshot {
  time: number;
  vehicles: Delta<VehicleInfo>;
  lights: Delta<LightInfo>;
  vehicle_counts: {[vClass: string]: number};
  /** time to run one step of the SUMO simulation */
  simulate_secs: number;
  /** time to construct the snapshot of the update */
  snapshot_secs: number;
}

/** Response type for /state endpoint */
export interface SimulationState {
  scenario: string;
  simulationStatus: SimulationStatus;
  delayMs: number;
}

export type SimulationStatus = 'off' | 'running' | 'paused';

/** Response type for /scenario endpoint */
export interface ScenarioName {
  displayName: string;
  kebabCase: string;
}

/** Response type for /network endpoint */
export interface Network {
  net: Net;
}

export interface Connection {
  dir: string; // "l" = left, "s" = straight, "r" = right, "t" = u-turn
  from: string;
  fromLane: string;
  linkIndex: string;
  state: string;
  tl: string;
  to: string;
  toLane: string;
  via: string;
}

export interface Lane {
  id: string;
  index: string;
  length: string;
  shape: string; // "x1,y1 x2,y2 x3,y3 ..."; guaranteed to have 2+ coordinates.
  speed: string;
  allow?: string;
  width?: string;
}

export type SpreadType = 'center' | 'right';

export interface Edge {
  function: string;
  id: string;
  lane: Lane | Lane[]; // :(
  from: string;
  priority: string;
  to: string;
  type?: string; // matches an ID in net.type.id
  spreadType?: SpreadType;
}

// This list comes from toronto.net.xml. It is mostly likely not exhaustive.
export type JunctionType =
  | 'dead_end'
  | 'internal'
  | 'priority'
  | 'rail_crossing'
  | 'right_before_left'
  | 'traffic_light';

export interface Junction {
  id: string;
  incLanes: string;
  intLanes: string;
  request: any;
  shape: string;
  type: JunctionType;
  x: string;
  y: string;
  z: string;
}

export interface Location {
  convBoundary: string;
  netOffset: string;
  origBoundary: string;
  projParameter: string; // This is set to "!" for non-geographic systems.
}

export interface Phase {
  duration: string;
  state: string;
}

export interface TlLogic {
  id: string;
  offset: string;
  phase: Phase[];
  programID: string;
  type: string;
}

export interface Type {
  id: string;
  priority: string;
  numLanes: string;
  speed: string;
  allow?: string;
  disallow?: string;
  oneway: string; // "0" or "1"
  width?: string;
}

export interface Net {
  connection: Connection[];
  type: Type[];
  edge: Edge[];
  junction: Junction[];
  location: Location;
  tlLogic: TlLogic | TlLogic[];
  version: string;
  'xmlns:xsi': string;
  'xsi:noNamespaceSchemaLocation': string;
}

export interface AdditionalResponse {
  poly?: Polygon[];
  busStop?: BusStop[];
  tlLogic?: TlLogic | TlLogic[];
}

export interface Polygon {
  id: string;
  type: string;
  color: string; // "r,b,g", where 0 <= r, g, b, <= 255
  fill: string;
  layer: string;
  shape: string;
  param?: Param | Param[];
}

export interface Param {
  key: string;
  value: string;
}

export interface BusStop {
  id: string;
  lane: string;
  startPos: string;
  endPos: string;
  lines: string;
}

export interface SumoSettings {
  viewsettings: {
    delay?: {
      value: string;
    };
    scheme?: {
      name: string; // e.g. "real world"
    };
    viewport?: {
      x: string;
      y: string;
      zoom: string; // 100=full scene, 200=half of full scene, etc.
    };
  };
}

export interface Object3DLoaderParam {
  objectUrl: string;
  materialUrl?: string;
  scale?: number;
}

export interface SupportedVehicle {
  label: string; // colloquial name, for display use only
  models: Object3DLoaderParam[];
}
