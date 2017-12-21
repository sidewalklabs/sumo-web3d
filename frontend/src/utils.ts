// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
/**
 * Await an object of promises, returning an object with the same keys but resolved values.
 *
 * This is similar to Promise.all(), but for objects.
 * It can be used as a workaround for https://github.com/Microsoft/TypeScript/issues/11924
 */
export async function promiseObject<T>(obj: {[k in keyof T]: Promise<T[k]>}): Promise<T> {
  const keys = Object.keys(obj);
  const promises = keys.map(k => (obj as any)[k]);
  const values = await Promise.all(promises);
  const out = {} as any;
  keys.forEach((k, i) => {
    out[k] = values[i];
  });
  return out;
}

/**
 * Convert an array of strings to an object with "true" values, e.g. for fast lookups.
 */
export function makeLookup(array: string[]): {[id: string]: boolean} {
  const o: {[k: string]: boolean} = {};
  array.forEach(key => {
    o[key] = true;
  });
  return o;
}

/**
 * Returns input if it is an array, else input wrapped in an array
 */
export function forceArray<T>(t: T | T[]): T[] {
  return Array.isArray(t) ? t : [t];
}

/** Some handy type aliases. */
export type Feature = GeoJSON.Feature<GeoJSON.GeometryObject>;
export type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
