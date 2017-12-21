// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/**
 * Materials used in three.js scenes.
 */
import * as three from 'three';

const textureLoader = new three.TextureLoader();

const loadRepeatedTexture = (url: string) =>
  textureLoader.load(url, texture => {
    texture.wrapS = texture.wrapT = three.RepeatWrapping;
  });

const railroadTie = loadRepeatedTexture('/rail64.png');
const sidewalkTexture = loadRepeatedTexture('/sidewalk256.jpg');
const asphaltTexture = loadRepeatedTexture('/asphalt256.jpg');
const crossingTexture = loadRepeatedTexture('/zebra.jpg');

export const LAND = new three.MeshPhysicalMaterial({
  color: 0x888888,
  metalness: 0.1,
  roughness: 1.0,
  clearCoat: 0.1,
  clearCoatRoughness: 1.0,
  reflectivity: 0.05,
  // We use polygonOffset to counter z-fighting with roadways.
  polygonOffset: true,
  polygonOffsetFactor: +2,
  polygonOffsetUnits: 1,
});
export const WATER = new three.MeshPhysicalMaterial({
  side: three.DoubleSide,
  color: 0xaaaaaa,
  metalness: 0,
  roughness: 0.8,
  clearCoat: 0.7,
  clearCoatRoughness: 0.5,
  reflectivity: 0.9,
});
export const BUILDING_TOP = new three.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0.8,
  clearCoat: 0.6,
  clearCoatRoughness: 1.0,
  reflectivity: 0.2,
});
export const BUILDING_SIDE = new three.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0.8,
  clearCoat: 0.6,
  clearCoatRoughness: 1.0,
  reflectivity: 0.2,
});

export const BUILDING = new three.MeshFaceMaterial([BUILDING_TOP, BUILDING_SIDE]);

export const ROAD = new three.MeshPhysicalMaterial({
  map: asphaltTexture,
  side: three.DoubleSide, // one side is visible from above, the other casts shadows.
  metalness: 0,
  roughness: 0.8,
  clearCoat: 0.6,
  clearCoatRoughness: 1.0,
  reflectivity: 0.2,
});
export const BUS_STOP = new three.MeshPhysicalMaterial({
  side: three.DoubleSide,
  color: 0xdddd00,
});
export const CYCLEWAY = new three.MeshPhysicalMaterial({
  color: 0xaa0000,
  side: three.DoubleSide,
});
export const CROSSING = new three.MeshPhysicalMaterial({
  map: crossingTexture,
  side: three.DoubleSide, // one side is visible from above, the other casts shadows.
  metalness: 0,
  roughness: 0.8,
  clearCoat: 0.6,
  clearCoatRoughness: 1.0,
  reflectivity: 0.2,
  polygonOffset: true, // this resolves z-fighting between crosswalks and junctions.
  polygonOffsetFactor: -3,
  polygonOffsetUnits: 1,
});
export const RAILWAY = new three.MeshPhysicalMaterial({
  map: railroadTie,
  transparent: true,
  side: three.DoubleSide,
});
export const WALKWAY = new three.MeshPhysicalMaterial({
  map: sidewalkTexture,
  side: three.DoubleSide,
});
export const HIGHLIGHT = new three.MeshPhysicalMaterial({
  color: 0xff0000,
  depthTest: true,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: 1.1,
  transparent: true,
  opacity: 0.9,
  side: three.DoubleSide,
});
export const JUNCTION = new three.MeshPhysicalMaterial({
  color: 0x373737,
  reflectivity: 0.2,
  polygonOffset: true, // this resolves z-fighting between the junctions and street.
  polygonOffsetFactor: -2,
  polygonOffsetUnits: 1,
});

export const TRAFFIC_LIGHTS: {[color: string]: three.MeshLambertMaterial} = {
  g: new three.MeshLambertMaterial({
    color: 0x00ff00,
    side: three.DoubleSide,
  }),
  y: new three.MeshLambertMaterial({
    color: 0xffff00,
    side: three.DoubleSide,
  }),
  r: new three.MeshLambertMaterial({
    color: 0xff0000,
    side: three.DoubleSide,
  }),
  x: new three.MeshLambertMaterial({
    color: 0x000000,
    side: three.DoubleSide,
  }),
};
