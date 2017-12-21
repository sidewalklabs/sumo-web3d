import * as _ from 'lodash';
import FlatButton from 'material-ui/FlatButton';
import * as React from 'react';

import {VehicleInfo} from '../api';
import {NameAndUserData} from '../sumo3d';

import {LatLng} from '../coords';

import {RootProps} from './root';

import {SUPPORTED_VEHICLE_CLASSES} from '../constants';

const SelectedPoint = (props: {point: LatLng}) => {
  const {lat, lng} = props.point;
  const googleMapsUrl = `https://www.google.com/maps/search/${lat},${lng}`;
  const osmUrl = `http://www.openstreetmap.org/#map=18/${lat}/${lng}`;
  return (
    <div>
      Lat, Lng: ({lat.toFixed(6)}, {lng.toFixed(6)})
      <div>
        <a target="_blank" href={googleMapsUrl}>
          Open in Google Maps
        </a>
      </div>
      <div>
        <a target="_blank" href={osmUrl}>
          Open in OpenStreetMap
        </a>
      </div>
    </div>
  );
};

const SelectedSumoPoint = (props: {point: number[]}) => {
  const [x, y] = props.point;
  return (
    <div>
      SUMO coordinates: ({x.toFixed(2)}, {y.toFixed(2)})
    </div>
  );
};

const SelectedVehicle = (props: {id: string; info: VehicleInfo}) => (
  <div className="clicked-vehicle-info">
    {props.id}: {JSON.stringify(props.info, null, '  ')}
  </div>
);

const VehicleCounter = (props: {vehicleCounts: {[vehicleClass: string]: number}}) => {
  const {vehicleCounts} = props;
  return (
    <div className="vehicle-counter">
      {_.map(vehicleCounts, (count, vClass) => {
        const supportedVehicle = SUPPORTED_VEHICLE_CLASSES[vClass];
        const label = supportedVehicle ? supportedVehicle.label : vClass;
        return (
          <div key={vClass}>
            {label}(s): {count}
          </div>
        );
      })}
    </div>
  );
};

const SelectedObject = (props: {
  object: NameAndUserData;
  followObjectPOV: (object: string) => any;
  edgesHighlighted: boolean;
  toggleRouteObjectHighlighted: (object: string) => any;
}) => {
  const {name, vClass, osmId} = props.object;
  if (osmId) {
    const osmUrl = `http://www.openstreetmap.org/${osmId.type}/${osmId.id}`;
    return (
      <li>
        <a href={osmUrl} target="_blank">
          {name}
        </a>
      </li>
    );
  } else if (vClass && SUPPORTED_VEHICLE_CLASSES[vClass]) {
    return (
      <li>
        {name}
        <div className="flex-container">
          <FlatButton label="Follow" onClick={() => props.followObjectPOV(name)} primary />
          <FlatButton
            label={props.edgesHighlighted ? 'Hide Route' : 'Show Route'}
            onClick={() => props.toggleRouteObjectHighlighted(name)}
            secondary
          />
        </div>
      </li>
    );
  } else {
    return <li>{name}</li>;
  }
};

export default (props: RootProps) => {
  const {
    clickedObjects,
    clickedSumoPoint,
    clickedPoint,
    clickedVehicleId,
    clickedVehicleInfo,
    followObjectPOV,
    edgesHighlighted,
    stats,
    toggleRouteObjectHighlighted,
  } = props;

  const noClickData =
    _.isEmpty(clickedObjects) &&
    _.isEmpty(clickedSumoPoint) &&
    _.isEmpty(clickedPoint) &&
    _.isEmpty(clickedVehicleId) &&
    _.isEmpty(clickedVehicleInfo);

  const timeSecs = stats.time / 1000;
  const payloadKb = stats.payloadSize / 1024;
  const simulateMs = stats.simulateSecs * 1000;
  const snapshotMs = stats.snapshotSecs * 1000;

  return (
    <div className="metadata-info">
      <h3>Stats</h3>
      <div className="metadata-section">
        <div>time: {timeSecs.toFixed(3)} s</div>
        <div>payload: {payloadKb.toFixed(1)} KB</div>
        <div>simulate: {simulateMs.toFixed(2)} ms</div>
        <div>snapshot: {snapshotMs.toFixed(2)} ms</div>
      </div>
      <h3>Vehicle Summary</h3>
      <div className="metadata-section">
        <VehicleCounter vehicleCounts={stats.vehicleCounts} />
      </div>
      <h3>Click Summary</h3>
      <div className="metadata-section">
        {noClickData && <div>N/A</div>}
        {clickedPoint && <SelectedPoint point={clickedPoint} />}
        {clickedSumoPoint && <SelectedSumoPoint point={clickedSumoPoint} />}
      </div>
      {!_.isEmpty(clickedObjects) && (
        <div className="metadata-section">
          Objects at point:
          <div>
            {_.map(clickedObjects, (object, i) => (
              <SelectedObject
                key={i}
                object={object}
                followObjectPOV={followObjectPOV}
                edgesHighlighted={edgesHighlighted}
                toggleRouteObjectHighlighted={toggleRouteObjectHighlighted}
              />
            ))}
          </div>
        </div>
      )}
      <div className="metadata-section">
        {clickedVehicleId &&
          clickedVehicleInfo && <SelectedVehicle id={clickedVehicleId} info={clickedVehicleInfo} />}
      </div>
    </div>
  );
};
