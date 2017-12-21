// Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
export function parseShape(shape: string): number[][] {
  return shape.split(' ').map(coord => coord.split(',').map(Number));
}
