// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as _ from 'lodash';

import {Delta, ScenarioName, SimulationStatus, VehicleInfo, WebsocketMessage} from './api';
import {SUPPORTED_VEHICLE_CLASSES} from './constants';
import {LatLng} from './coords';
import {InitResources} from './initialization';
import Sumo3D, {NameAndUserData, SumoState, SUMO_ENDPOINT} from './sumo3d';

export interface State {
  availableScenarios: ScenarioName[];
  clickedPoint: LatLng | null;
  clickedSumoPoint: number[] | null;
  clickedObjects: NameAndUserData[] | null;
  clickedVehicleId: string | null;
  clickedVehicleInfo: VehicleInfo | null;
  followingVehicle: boolean;
  edgesHighlighted: boolean;
  delayMs: number;
  simulationStatus: SimulationStatus;
  isLoading: boolean;
  isProjection: boolean;
  scenario: string;
  searchBoxErrorMessage: string;
  stats: SumoState;
}

export default function createStore(init: InitResources) {
  const state: State = {
    availableScenarios: init.availableScenarios,
    clickedPoint: null,
    clickedSumoPoint: null,
    clickedObjects: null,
    clickedVehicleId: null,
    clickedVehicleInfo: null,
    followingVehicle: false,
    edgesHighlighted: false,
    stats: {
      time: 0,
      payloadSize: 0,
      vehicleCounts: {},
      simulateSecs: 0,
      snapshotSecs: 0,
    },
    isLoading: false,
    isProjection: false,
    searchBoxErrorMessage: '',
    ...init.simulationState,
  };

  const {webSocket} = init;
  const sumo3d = new Sumo3D(init.sumoRootEl, init, {
    onClick(point, sumoXY, objects) {
      clickPoint(point, sumoXY, objects);
    },
    onUnfollow: unfollowObjectPOV,
    onRemove: removeVehicleCallback,
    onUnhighlight,
  });

  state.isProjection = init.isProjection;

  webSocket.onmessage = event => {
    const msg: WebsocketMessage = JSON.parse(event.data);
    if (msg.type === 'snapshot') {
      const payloadSize = event.data.length;
      state.stats = {
        time: msg.time,
        payloadSize,
        vehicleCounts: msg.vehicle_counts,
        simulateSecs: msg.simulate_secs,
        snapshotSecs: msg.snapshot_secs,
      };

      processDelta(msg.vehicles, {
        enter: (vehicleId, info) => sumo3d.createVehicleObject(vehicleId, info),
        update: (vehicleId, info) => sumo3d.updateVehicleObject(vehicleId, info),
        exit: vehicleId => sumo3d.removeVehicleObject(vehicleId),
      });

      processDelta(msg.lights, {
        enter: (lightId, delta) => sumo3d.updateLightObject(lightId, delta),
        update: (lightId, delta) => sumo3d.updateLightObject(lightId, delta),
        exit: id => console.warn('Disappearing traffic lights!', id),
      });
      if (state.clickedVehicleId) {
        state.clickedVehicleInfo = sumo3d.getVehicleInfo(state.clickedVehicleId);
      }
      sumo3d.updateStats(state.stats);
      stateChanged();
    } else if (msg.type === 'state') {
      state.simulationStatus = msg.simulationStatus;
      state.delayMs = msg.delayMs;
      stateChanged();
    } else {
      console.error('unrecognized message: ', msg);
    }
  };

  function processDelta<T>(
    delta: Delta<T>,
    callbacks: {
      enter: (id: string, t: T) => any;
      update: (id: string, t: T) => any;
      exit: (id: string) => any;
    },
  ) {
    _.forEach(delta.creations, (v, k) => {
      callbacks.enter(k, v);
    });
    _.forEach(delta.updates, (v, k) => {
      callbacks.update(k, v);
    });
    _.forEach(delta.removals, v => {
      callbacks.exit(v);
    });
  }

  async function startSimulation() {
    webSocket.send(JSON.stringify({type: 'action', action: 'start'}));
  }

  async function pauseSimulation() {
    webSocket.send(JSON.stringify({type: 'action', action: 'pause'}));
  }

  async function resumeSimulation() {
    webSocket.send(JSON.stringify({type: 'action', action: 'resume'}));
  }

  async function cancelSimulation() {
    state.clickedPoint = null;
    state.clickedSumoPoint = null;
    state.clickedObjects = [];
    state.clickedVehicleId = null;
    state.clickedVehicleInfo = null;
    state.stats = {
      time: 0,
      payloadSize: 0,
      vehicleCounts: {},
      simulateSecs: 0,
      snapshotSecs: 0,
    };
    sumo3d.unselectMeshes();
    sumo3d.purgeVehicles();
    webSocket.send(JSON.stringify({type: 'action', action: 'cancel'}));
  }

  async function changeDelay(delayMs: number) {
    webSocket.send(JSON.stringify({type: 'action', action: 'changeDelay', delayLengthMs: delayMs}));
  }

  async function changeScenario(scenario: string) {
    window.location.pathname = `/scenarios/${scenario}/`;
  }

  function clickPoint(
    point: LatLng | null,
    sumoPoint: number[] | null,
    objects: NameAndUserData[],
  ) {
    state.clickedPoint = point;
    state.clickedSumoPoint = sumoPoint;
    state.clickedObjects = objects;
    state.clickedVehicleId = null;
    state.clickedVehicleInfo = null;

    if (state.edgesHighlighted) {
      state.edgesHighlighted = false;
      sumo3d.unhighlightRoute();
      stateChanged();
    }

    sumo3d.unselectMeshes();

    // Check clicked objects for a vehicle
    const validVehicleClasses = Object.keys(SUPPORTED_VEHICLE_CLASSES);
    const clickedVehicle = _.find(objects, object =>
      _.includes(validVehicleClasses, object.vClass),
    );
    state.clickedVehicleId = clickedVehicle ? clickedVehicle.name : null;
    state.clickedVehicleInfo = clickedVehicle ? sumo3d.getVehicleInfo(clickedVehicle.name) : null;

    if (objects.length > 0) {
      objects.forEach(({name}) => {
        sumo3d.highlightByVehicleId(name, false);
        const osmId = _.last(name.split(' '));
        if (osmId) {
          sumo3d.highlightByOsmId(osmId, false);
        }
      });
    }

    stateChanged();
  }

  function followObjectPOV(vehicleId: string) {
    sumo3d.onSelectFollowPOV(vehicleId);
    state.followingVehicle = true;
    stateChanged();
  }

  function unfollowObjectPOV() {
    sumo3d.unfollowPOV();
    state.followingVehicle = false;
    stateChanged();
  }

  function removeVehicleCallback(id: string) {
    if (id === state.clickedVehicleId) {
      state.clickedVehicleId = null;
      state.clickedVehicleInfo = null;
      stateChanged();
    }
  }

  function onUnhighlight() {}

  async function toggleRouteObjectHighlighted(vehicleId: string) {
    if (state.edgesHighlighted) {
      state.edgesHighlighted = false;
      sumo3d.unhighlightRoute();
      stateChanged();
      return;
    }
    const url = `${SUMO_ENDPOINT}/vehicle_route?${vehicleId}`;
    const response = await fetch(url);
    if (response.status !== 200) {
      console.log('non-200', url);
      throw new Error(`Unable to load ${url}, response: ${response}`);
    }
    const edgeIds: string[] = await response.json();
    state.edgesHighlighted = edgeIds.length > 0;
    sumo3d.onShowRouteObject(edgeIds);
    stateChanged();
  }

  function focusOnVehicleOfClass(vehicleClass: string) {
    sumo3d.moveCameraToRandomVehicleOfClass(vehicleClass);
  }

  function focusOnTrafficLight() {
    sumo3d.moveCameraToRandomLight();
  }

  function moveCameraToLatitudeAndLongitude(lat: number, lng: number) {
    sumo3d.moveCameraToLatitudeAndLongitude(lat, lng);
  }

  const sumoXYRegex = /^(\d+),\s*(\d+)$/;
  const latLngRegex = /^(\-?\d+\.\d+?),\s*(\-?\d+\.\d+?)$/;

  const [west, south, east, north] = init.network.net.location.origBoundary.split(',').map(Number);
  const [left, bottom, right, top] = init.network.net.location.convBoundary.split(',').map(Number);

  function validateLatitude(lat: number) {
    return lat >= south && lat <= north;
  }

  function validateLongitude(lng: number) {
    if (west > east) {
      if (lng >= 0) {
        return lng <= east;
      } else {
        return lng >= west;
      }
    } else {
      return lng >= west && lng <= east;
    }
  }

  function validateX(x: number) {
    return x >= left && x <= right;
  }

  function validateY(y: number) {
    return y >= bottom && y <= top;
  }

  function handleSearch(input: string) {
    sumo3d.unselectMeshes();
    sumo3d.unhighlightRoute();

    state.searchBoxErrorMessage = '';
    if (sumoXYRegex.test(input)) {
      const matchRes = input.match(sumoXYRegex);
      if (matchRes) {
        const [, x, y] = matchRes.map(Number);
        if (!validateX(x) || !validateY(y)) {
          state.searchBoxErrorMessage = `Invalid x, y coordinates,
            ${left} < x < ${right}, ${bottom} < y < ${top}.`;
        } else {
          sumo3d.moveCameraTo(x, y, 30);
        }
      }
    } else if (state.isProjection && latLngRegex.test(input)) {
      const matchRes = input.match(latLngRegex);
      if (matchRes) {
        const [, lat, lng] = matchRes.map(parseFloat);
        if (!validateLatitude(lat) || !validateLongitude(lng)) {
          state.searchBoxErrorMessage = `Invalid latitude and longitude coordinates, 
            ${south} < lat < ${north}, ${west} < lng < ${east}.`;
        } else {
          moveCameraToLatitudeAndLongitude(lat, lng);
        }
      }
    } else {
      let found = sumo3d.highlightByVehicleId(input, true) !== null;
      found = sumo3d.highlightByOsmId(input, true).length > 0 || found;
      if (!found) {
        state.searchBoxErrorMessage = 'Search input not found.';
      }
    }
    stateChanged();
  }

  function deselectSearch() {
    sumo3d.unselectMeshes();
    stateChanged();
  }

  const subscribers = [] as Array<() => any>;
  function stateChanged() {
    subscribers.forEach(fn => fn());
  }

  return {
    getState() {
      return state;
    },
    subscribe(callback: () => any) {
      subscribers.push(callback);
    },
    actions: {
      clickPoint,
      startSimulation,
      pauseSimulation,
      cancelSimulation,
      resumeSimulation,
      changeScenario,
      followObjectPOV,
      changeDelay,
      handleSearch,
      deselectSearch,
      unfollowObjectPOV,
      toggleRouteObjectHighlighted,
      moveCameraToLatitudeAndLongitude,
      focusOnVehicleOfClass,
      focusOnTrafficLight,
    },
  };
}
