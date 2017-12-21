// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/** This module loads all the resources which are needed to initialize the microsim UI. */

import * as _ from 'lodash';
import * as three from 'three';
import * as MTLLoader from 'three-mtl-loader';

import {AdditionalResponse, Network, ScenarioName, SimulationState, SumoSettings} from './api';
import {loadOBJFile} from './three-utils';
import {promiseObject, FeatureCollection} from './utils';

import {SUPPORTED_VEHICLE_CLASSES} from './constants';

export interface InitResources {
  availableScenarios: ScenarioName[];
  settings: SumoSettings | null;
  network: Network;
  vehicles: {[vehicleClass: string]: three.Object3D[]};
  additional: AdditionalResponse | null;
  arrows: {
    left: three.Object3D;
    right: three.Object3D;
    uturn: three.Object3D;
    straight: three.Object3D;
  };
  water: FeatureCollection;
  simulationState: SimulationState;
  webSocket: WebSocket;
  reactRootEl: HTMLElement;
  sumoRootEl: HTMLElement;
  isProjection: boolean;
}

const {hostname} = window.location;
const WEB_SOCKETS_ENDPOINT = `ws://${hostname}:5678/`;

const textureLoader = new three.TextureLoader();
const mtlLoader = new MTLLoader() as three.MTLLoader;

function getOrThrow(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Unable to get element #${id}.`);
  }
  return el;
}

function loadMaterial(url: string): three.MeshBasicMaterial {
  return new three.MeshBasicMaterial({
    map: textureLoader.load(url),
  });
}

async function loadObjMtl(objFile: string, mtlFile: string): Promise<three.Object3D> {
  return new Promise<three.Object3D>((resolve, reject) => {
    mtlLoader.load(
      mtlFile,
      materials => {
        materials.preload();
        const objLoader = new three.OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load(
          objFile,
          obj => {
            resolve(obj);
          },
          () => {},
          reject,
        );
      },
      () => {},
      reject,
    );
  });
}

function loadVehicles(): {[vehicleClass: string]: Promise<three.Object3D[]>} {
  // map each vehicle class to an array of all possible models
  return _.mapValues(SUPPORTED_VEHICLE_CLASSES, (v, k) =>
    Promise.all(
      _.map(v.models, async model => {
        const {materialUrl, scale} = model;
        let obj;
        if (materialUrl) {
          if (materialUrl.endsWith('.mtl')) {
            obj = await loadObjMtl(model.objectUrl, materialUrl);
          } else {
            obj = await loadOBJFile(model.objectUrl, loadMaterial(materialUrl));
          }
        } else {
          obj = await loadOBJFile(model.objectUrl);
        }
        if (scale) {
          obj.scale.setScalar(scale);
        }
        return obj;
      }),
    ),
  );
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (response.status !== 200) {
    console.log('non-200', url);
    throw new Error(`Unable to load ${url}, response: ${response}`);
  }
  const val = (await response.json()) as T;
  console.log(`Loaded ${url}`);
  return val;
}

async function fetchJsonAllowFail<T>(url: string): Promise<T | null> {
  const response = await fetch(url);
  if (response.status === 404) {
    console.log(`Request for ${url} 404'd.`);
    return null;
  }
  const val = (await response.json()) as T;
  console.log(`Loaded ${url}`);
  return val;
}

export default async function init(): Promise<InitResources> {
  const loadStartMs = window.performance.now();
  const simulationState = await fetchJson<SimulationState>('/state');
  const network = await fetchJson<Network>('network');
  const isProjection =
    network.net.location.projParameter.length > 0 && network.net.location.projParameter !== '!';

  const domPromise = new Promise((resolve, reject) => {
    if (document.readyState !== 'loading') {
      resolve();
    } else {
      window.addEventListener('DOMContentLoaded', resolve);
    }
  });

  const webSocket = new WebSocket(WEB_SOCKETS_ENDPOINT);
  const webSocketPromise = new Promise((resolve, reject) => {
    webSocket.onopen = () => resolve(webSocket);
    webSocket.onerror = reject;
  });

  try {
    const {dom, ...resources} = await promiseObject({
      additional: fetchJsonAllowFail<AdditionalResponse>('additional'),
      availableScenarios: fetchJson<ScenarioName[]>('/scenarios'),
      vehicles: promiseObject(loadVehicles()),
      water: fetchJson<FeatureCollection>('water'),
      settings: fetchJsonAllowFail<SumoSettings>('settings'),
      arrows: promiseObject({
        left: loadOBJFile('/arrows/LeftArrow.obj'),
        right: loadOBJFile('/arrows/RightArrow.obj'),
        uturn: loadOBJFile('/arrows/UTurnArrow.obj'),
        straight: loadOBJFile('/arrows/StraightArrow.obj'),
      }),
      dom: domPromise,
      webSocket: webSocketPromise,
    });

    getOrThrow('loading').remove();

    const loadEndMs = window.performance.now();
    console.log('Loaded static resources in ', loadEndMs - loadStartMs, ' ms.');

    return {
      ...resources,
      simulationState,
      network,
      webSocket,
      isProjection,
      reactRootEl: getOrThrow('sidebar'),
      sumoRootEl: getOrThrow('canvas-wrapper'),
    };
  } catch (e) {
    webSocket.close();
    throw e;
  }
}
