import * as _ from 'lodash';
import FlatButton from 'material-ui/FlatButton';
import Slider from 'material-ui/Slider';
import * as React from 'react';

import MetadataInfo from './metadata-info';
import QuickSearch from './quick-search';

import {VehicleInfo} from '../api';
import KeyboardHelp from './keyboard-help';
import {RootProps} from './root';
import ScenarioListDropDownMenu from './scenario-list-drop-down-menu';

import {SUPPORTED_VEHICLE_CLASSES} from '../constants';

export interface SidebarState {
  sliderLocation: number; // between 0 and 1
}

export const MAX_DELAY_MS = 100;

const UnfollowButton = (props: {unfollowObjectPOV: () => any}) => (
  <FlatButton label="Unfollow" secondary={true} onClick={props.unfollowObjectPOV} />
);

const PauseOrResume = (props: RootProps) =>
  props.simulationStatus === 'running' ? (
    <FlatButton label="pause" onClick={props.onPause} />
  ) : (
    <FlatButton label="resume" onClick={props.onResume} />
  );

const VehicleInfo = (props: {id: string; info: VehicleInfo}) => (
  <div className="clicked-vehicle-info">
    {props.id}: {JSON.stringify(props.info, null, '  ')}
  </div>
);

class Sidebar extends React.Component<RootProps, SidebarState> {
  constructor(props: RootProps) {
    super(props);
    this.state = {
      sliderLocation: this.delayMsToSliderLocation(props.delayMs),
    };
  }

  delayMsToSliderLocation(delayMs: number) {
    return 1 - delayMs / MAX_DELAY_MS;
  }

  render() {
    return (
      <div className="sidebar-container">
        <div className="sidebar-header">
          <div className="scenario-row">
            <span>Current Scenario:</span>
            <ScenarioListDropDownMenu {...this.props} />
          </div>
          <div className="button-row">
            {this.props.simulationStatus === 'off' ? (
              <FlatButton
                label="restart"
                onClick={this.props.onStart}
                primary={true}
                disabled={this.props.isLoading}
              />
            ) : (
              <FlatButton label="cancel" onClick={this.props.onCancel} primary={true} />
            )}
            {this.props.simulationStatus !== 'off' && <PauseOrResume {...this.props} />}
            <KeyboardHelp {...this.props} />
          </div>
          <div className="slider-row">
            <span>slow</span>
            <div id="speed-control-slider">
              <Slider
                ref="slider"
                value={this.state.sliderLocation}
                onDragStop={() => {
                  const milliseconds = (1 - this.state.sliderLocation) * MAX_DELAY_MS;
                  this.props.onChangeDelayMs(milliseconds);
                }}
                onChange={(e, v) => this.setState({sliderLocation: v})}
                max={0.99 /* going all the way to 0ms freezes the visualization */}
              />
              <div className="speed-control-slider-label">
                Delay: {((1 - this.state.sliderLocation) * MAX_DELAY_MS).toFixed(1)} ms
              </div>
            </div>
            <span id="fast-symbol">fast</span>
          </div>
          {this.props.followingVehicle && (
            <UnfollowButton unfollowObjectPOV={this.props.unfollowObjectPOV} />
          )}
        </div>
        <div className="sidebar-body">
          <MetadataInfo {...this.props} />
        </div>
        <div className="sidebar-footer">
          <div className="quick-focus-title">Quick Find</div>
          <QuickSearch {...this.props} />
          <div className="quick-focus-buttons">
            {_.map(SUPPORTED_VEHICLE_CLASSES, (v, vClass) => (
              <FlatButton
                label={v.label}
                key={vClass}
                onClick={() => this.props.onFocusOnVehicleOfClass(vClass)}
                disabled={!this.props.stats.vehicleCounts[vClass]}
                primary
              />
            ))}
            <FlatButton label="Light" onClick={() => this.props.onFocusOnTrafficLight()} primary />
          </div>
        </div>
      </div>
    );
  }
}

export default Sidebar;
