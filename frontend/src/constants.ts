// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
import * as _ from 'lodash';

import {Object3DLoaderParam, SupportedVehicle} from './api';

// These are abstract vehicle classes. For a complete list, see:
// http://sumo.dlr.de/wiki/Definition_of_Vehicles,_Vehicle_Types,_and_Routes

// Vehicle colors and types from OpenGameArt (OGA), licensed CC0.
// See http://opengameart.org/content/vehicles-assets-pt1
// There are also types for trucks and vans which we could incorporate.
//const OGA_COLORS = ['blue', 'citrus', 'green', 'orange', 'red', 'silver', 'violet'];
//const OGA_COLORS = ['blue', 'red', 'silver'];
const OGA_TYPES = ['normal', 'hatchback', 'mpv', 'station'];
// The OGA vehicles are scaled to [-1, 1]. This winds up being a bit small, so we scale up.
const OGA_SCALE = 2.2;

function ogaVehicle(type: string, color: string): Object3DLoaderParam {
  return {
    objectUrl: `/vehicles/car-${type}-${color}.obj`,
    materialUrl: `/vehicles/car-${type}-${color}.mtl`,
    scale: OGA_SCALE,
  };
}

export const SUPPORTED_VEHICLE_CLASSES: {[sumoVehicleClass: string]: SupportedVehicle} = {
  passenger: {
    label: 'car',
    models: [
      {
    objectUrl: `/vehicles/car-normal-green.obj`,
    materialUrl: `/vehicles/car-normal-green.mtl`,
    scale: OGA_SCALE,
      },
    ],
  },
  av: {
    label: 'av',
    models: [
      {
    objectUrl: `/vehicles/car-normal-red.obj`,
    materialUrl: `/vehicles/car-normal-red.mtl`,
    scale: OGA_SCALE,
      },
    ],
  },
  bicycle: {
    label: 'bike',
    models: [
      {
        objectUrl: '/vehicles/bicycle.obj',
        materialUrl: '/vehicles/bicycle.png',
      },
    ],
  },
  rail: {
    label: 'train',
    models: [
      {
        objectUrl: '/vehicles/Streetcar.obj',
        materialUrl: '/vehicles/Streetcar.png',
      },
    ],
  },
  pedestrian: {
    label: 'person',
    models: [
      {
        objectUrl: '/vehicles/pedestrian.obj',
        materialUrl: '/vehicles/pedestrian.png',
      },
      {
        objectUrl: '/vehicles/pedestrian_male.obj',
        materialUrl: '/vehicles/pedestrian_male.png',
      },
    ],
  },
  bus: {
    label: 'bus',
    models: [
      {
        objectUrl: '/vehicles/bus.obj',
        materialUrl: '/vehicles/bus.png',
      },
    ],
  },
};
