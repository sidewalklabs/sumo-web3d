// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/**
 * Code to generate three.js shapes for a SUMO network.
 */
import * as _ from 'lodash';
import * as three from 'three';

import {AdditionalResponse, BusStop, Edge, Lane, Network, Polygon, Type} from './api';
import {Transform} from './coords';
import {offsetLineSegment, pointAlongPolyline} from './geometry';
import * as materials from './materials';
import {parseShape} from './sumo-utils';
import {
  extrudedMeshFromVertices,
  featureToGeometry,
  flatMeshFromVertices,
  flatRectMesh,
  lineString,
  mergeMeshWithUserData,
} from './three-utils';

import {forceArray, makeLookup, FeatureCollection} from './utils';

const DEFAULT_LANE_WIDTH_M = 3.2;
const LEVEL_HEIGHT_METERS = 3; // how tall is each floor of a building?

// See
// https://github.com/planetsumo/sumo/blob/9aa071c/sumo/src/utils/common/SUMOVehicleClass.cpp#L48
enum VehicleClass {
  PASSENGER = 'passenger',
  RAIL_ELECTRIC = 'rail_electric',
  RAIL = 'rail',
  RAIL_URBAN = 'rail_urban',
  TRAM = 'tram',
  PEDESTRIAN = 'pedestrian',
  BICYCLE = 'bicycle',
}

interface ClassLookup {
  [vehicleClass: string]: boolean;
}

export interface MeshAndPosition {
  mesh: three.Mesh;
  position: three.Vector3 | null;
}

export interface OsmIdToMesh {
  [osmId: string]: MeshAndPosition[];
}

const osmIdToMeshes: OsmIdToMesh = {};

// This logic mirrors isRailway() in SUMOVehicleClass.cpp
function isRailway(allowed: ClassLookup) {
  return (
    (allowed[VehicleClass.RAIL_ELECTRIC] ||
      allowed[VehicleClass.RAIL] ||
      allowed[VehicleClass.RAIL_URBAN] ||
      allowed[VehicleClass.TRAM]) &&
    !allowed[VehicleClass.PASSENGER]
  );
}

function convertMeshToMeshAndPosition(mesh: three.Mesh) {
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }
  let position = null;
  if (mesh.geometry.boundingBox) {
    position = mesh.geometry.boundingBox.getCenter();
  }
  return {mesh, position};
}

/** Index a SUMO "allowed" attribute, e.g. allowed="pedestrian bicycle". */
function indexAllowedClasses(allow?: string): ClassLookup {
  return makeLookup((allow || '').split(' '));
}

function laneToGeometry(transform: Transform, edge: Edge, lane: Lane): three.Geometry {
  const coords = parseShape(lane.shape);
  const width = lane.width ? Number(lane.width) : DEFAULT_LANE_WIDTH_M;
  const uScaleFactor = 1;
  const style = {
    width,
    uScaleFactor,
  };

  const lineGeometry = lineString(coords, transform, style);
  return lineGeometry;
}

function laneToMaterial(type: Type, allowed: ClassLookup, edge: Edge, lane: Lane): three.Material {
  if (edge.function === 'crossing') {
    return materials.CROSSING;
  } else if (lane.allow && lane.allow.includes('pedestrian')) {
    return materials.WALKWAY;
  } else if (lane.allow && lane.allow.includes('bicycle')) {
    return materials.CYCLEWAY;
  } else if (type && type.allow === 'pedestrian') {
    return materials.WALKWAY;
  } else if (type && type.allow === 'bicycle') {
    return materials.CYCLEWAY;
  } else if (isRailway(allowed)) {
    return materials.RAILWAY;
  } else {
    return materials.ROAD;
  }
}

export function makeEdgeGeometry(
  laneMaterialFn: (edge: Edge, lane: Lane) => three.Material,
  t: Transform,
  edge: Edge,
) {
  return forceArray(edge.lane).map(lane => {
    const geometry = laneToGeometry(t, edge, lane);
    const material = laneMaterialFn(edge, lane);
    return {geometry, material, edge, lane};
  });
}

/**
 * Create a single, merged geometry containing all the roads, footpaths and
 * cycleways in the network.
 */
function makeMergedEdgeGeometry(network: Network, t: Transform) {
  const idToType = _.keyBy(network.net.type || [], 'id');
  const idToAllowed = _.mapValues(idToType, type => indexAllowedClasses(type.allow));

  const edgesByTypes = _.groupBy(network.net.edge, 'type');

  const edgeMaterials: three.Material[] = [
    materials.ROAD,
    materials.CROSSING,
    materials.CYCLEWAY,
    materials.RAILWAY,
    materials.WALKWAY,
  ];
  const mergedGeometry = new three.Geometry();
  _.forEach(edgesByTypes, (edges, typeId) => {
    const allowed = idToAllowed[typeId] ? idToAllowed[typeId] : {};
    const materialFn = laneToMaterial.bind(null, idToType[typeId], allowed);
    const laneGeometries = edges
      .filter(e => e.function !== 'internal' && e.function !== 'walkingarea')
      .map(e => makeEdgeGeometry(materialFn, t, e));

    for (const geometries of laneGeometries) {
      const meshes: three.Mesh[] = [];
      for (const {geometry, material, edge, lane} of geometries) {
        const m = convertMeshToMeshAndPosition(new three.Mesh(geometry, material));
        m.mesh.userData = {
          name: `Edge ${edge.id}, Lane ${lane.id}`,
          // TODO: only add this if the data is from OSM.
          osmId: {
            id: edge.id,
            type: 'way',
          },
        };
        osmIdToMeshes[edge.id] = osmIdToMeshes[edge.id] ? osmIdToMeshes[edge.id].concat([m]) : [m];
        osmIdToMeshes[lane.id] = [m];
        meshes.push(m.mesh);
      }

      for (const child of meshes) {
        const material = child.material;
        const materialIndex = edgeMaterials.indexOf(material);
        const {geometry} = child;
        if (!(geometry instanceof three.Geometry)) return;
        for (const face of geometry.faces) {
          face.materialIndex = materialIndex;
        }
        mergeMeshWithUserData(mergedGeometry, child);
      }
    }
  });

  const mesh = new three.Mesh(mergedGeometry, new three.MeshFaceMaterial(edgeMaterials));
  mesh.receiveShadow = true;
  // TODO(danvk): Make roads cast shadows using two faces, one for the top and one for the bottom.
  // If we set mesh.castShadow = true here, roads seem to cast shadows on themselves, resulting in
  // some banding patterns on them.
  return {
    mesh,
    osmIdToMeshes,
  };
}

function makeMergedJunctions(network: Network, t: Transform): three.Mesh {
  const material = materials.JUNCTION;
  const geometry = new three.Geometry();
  for (const junction of network.net.junction) {
    if (junction.type === 'internal') continue;
    const points = parseShape(junction.shape).map(pt => t.xyToXz(pt));
    const averageX = _.meanBy(points, p => p[0]);
    const averageZ = _.meanBy(points, p => p[1]);
    const position = new three.Vector3(averageX, parseInt(junction.z, 10), averageZ);
    if (points.length < 4) continue; // These are just lines, not polygons.
    let junctionMesh;
    try {
      junctionMesh = flatMeshFromVertices(points, material);
    } catch (e) {
      console.log('Failed to create mesh for ', junction);
      continue;
    }

    if (junction.z) {
      // netconvert does produce 3D coordinates for junction shapes, but they
      // seem to always be flat.
      junctionMesh.position.setY(Number(junction.z));
    }
    junctionMesh.userData = {
      type: 'junction',
      name: `Junction ${junction.id}`,
      osmId: {
        id: junction.id,
        type: 'node',
      },
    };
    osmIdToMeshes[junction.id] = [{mesh: junctionMesh, position}];
    mergeMeshWithUserData(geometry, junctionMesh);
  }

  const mesh = new three.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

function makePolygon(polygon: Polygon, t: Transform): three.Mesh | null {
  if (polygon.type !== 'building') {
    return null;
  }
  const coords = parseShape(polygon.shape);
  const xzCoords = coords.map(pt => t.xyToXz(pt));
  const params = forceArray(polygon.param || []);
  let numLevels = 1;
  for (const param of params) {
    if (param.key === 'building:levels') {
      numLevels = Number(param.value);
    }
    // TODO(danvk): Check for 'building:material', too.
  }
  let obj: three.Mesh;
  try {
    obj = extrudedMeshFromVertices(
      xzCoords,
      (numLevels + 0.5) * LEVEL_HEIGHT_METERS,
      0.25, // uv scaling for the top of the building.
      0.1, // uv scaling for the sides of the building
      [materials.BUILDING_TOP, materials.BUILDING_SIDE],
    );
  } catch (e) {
    console.warn('Unable to make polygon for POI', polygon.id);
    return null;
  }
  obj.userData = {
    type: 'poi',
    name: `POI ${polygon.id}`,
    osmId: {
      id: polygon.id,
      type: 'way',
    },
  };
  osmIdToMeshes[polygon.id] = [convertMeshToMeshAndPosition(obj)];
  return obj;
}

function makeMergedPolygons(polygons: Polygon[], t: Transform): three.Mesh {
  const geometry = new three.Geometry();
  for (const polygon of polygons) {
    const obj = makePolygon(polygon, t);
    if (obj) {
      mergeMeshWithUserData(geometry, obj);
    }
  }
  geometry.sortFacesByMaterialIndex();
  geometry.computeFaceNormals();
  const mesh = new three.Mesh(geometry, materials.BUILDING);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeBusStop(busStop: BusStop, lane: Lane, t: Transform): three.Mesh {
  const shape = parseShape(lane.shape);
  const start = pointAlongPolyline(shape, Number(busStop.startPos));
  let end: number[];
  try {
    end = pointAlongPolyline(shape, Number(busStop.endPos));
  } catch (e) {
    // SUMO is tolerant of this, e.g. bus stop 603 in the LuST scenario.
    end = shape[shape.length - 1];
  }

  // By default, a bus stop is half the width of a lane and straddles its right edge.
  const laneWidth = Number(lane.width || DEFAULT_LANE_WIDTH_M);
  const xys = offsetLineSegment([start, end], laneWidth / 2);
  const geom = lineString(xys, t, {width: laneWidth / 2});
  const stopObj = new three.Mesh(geom, materials.BUS_STOP);
  stopObj.userData = {
    type: 'busstop',
    name: `Bus Stop ${busStop.id}; Lines: ${busStop.lines}`,
  };
  osmIdToMeshes[busStop.id] = [convertMeshToMeshAndPosition(stopObj)];
  return stopObj;
}

function makeMergedBusStops(network: Network, busStops: BusStop[], t: Transform): three.Mesh {
  const geometry = new three.Geometry();
  // Index the lanes.
  const idToLane: {[laneId: string]: Lane} = {};
  for (const edge of network.net.edge) {
    for (const lane of forceArray(edge.lane)) {
      idToLane[lane.id] = lane;
    }
  }
  for (const busStop of busStops) {
    const lane = idToLane[busStop.lane];
    const stopObj = makeBusStop(busStop, lane, t);
    mergeMeshWithUserData(geometry, stopObj);
  }

  geometry.sortFacesByMaterialIndex();
  geometry.computeFaceNormals();
  const mesh = new three.Mesh(geometry, new three.MeshFaceMaterial([materials.BUS_STOP]));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeMergedLakes(lakes: FeatureCollection, t: Transform): three.Mesh {
  const geometry = new three.Geometry();
  for (const feature of lakes.features) {
    feature.geometry.coordinates.forEach((c: number[][]) => {
      for (let i = 0; i < c.length; i++) {
        c[i] = t.xyToXz(c[i]);
      }
    });
    const waterGeometry = featureToGeometry(lakes.features[0]);
    const waterMesh = new three.Mesh(waterGeometry);
    waterMesh.rotation.set(Math.PI / 2, 0, 0);
    waterMesh.userData.name = 'Water';

    mergeMeshWithUserData(geometry, waterMesh);
  }

  geometry.sortFacesByMaterialIndex();
  geometry.computeFaceNormals();
  const mesh = new three.Mesh(geometry, materials.WATER);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Create a group of three.js objects representing the static elements of the scene.
 *
 * This includes the road network, terrain and buildings, but not the moving objects like cars or
 * changing objects like traffic lights.
 *
 * Note that this function is asynchronous -- it will add more (non-essential)
 * features to the group after it returns.
 */
export function makeStaticObjects(
  network: Network,
  additionalResponse: AdditionalResponse | null,
  lakes: FeatureCollection | null,
  t: Transform,
): [three.Group, OsmIdToMesh] {
  const group = new three.Group();
  const [left, top, right, bottom] = network.net.location.convBoundary.split(',').map(Number);

  // Land mesh
  const bgMesh = flatRectMesh({left, top, right, bottom}, materials.LAND);
  bgMesh.name = 'Land';
  bgMesh.receiveShadow = true;
  group.add(bgMesh);

  const {mesh: edgeMesh, osmIdToMeshes: osmIdToMesh} = makeMergedEdgeGeometry(network, t);
  group.add(edgeMesh);
  group.add(makeMergedJunctions(network, t));
  if (lakes) {
    group.add(makeMergedLakes(lakes, t));
  }

  if (additionalResponse) {
    const {busStop} = additionalResponse;
    if (busStop) {
      group.add(makeMergedBusStops(network, busStop, t));
    }

    const {poly} = additionalResponse;
    if (poly) {
      group.add(makeMergedPolygons(poly, t));
    }
  }

  return [group, osmIdToMesh];
}
