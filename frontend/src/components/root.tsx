import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import * as React from 'react';

import {State} from '../datastore';
import Sidebar from './sidebar';

export interface RootProps extends State {
  isProjection: boolean;
  onStart: () => any;
  onCancel: () => any;
  onResume: () => any;
  onPause: () => any;
  changeScenario: (scenario: string) => any;
  followObjectPOV: (object: string) => any;
  unfollowObjectPOV: () => any;
  toggleRouteObjectHighlighted: (object: string) => any;
  onChangeDelayMs: (delayMs: number) => any;
  onFocusOnVehicleOfClass: (vehicleClass: string) => any;
  onFocusOnTrafficLight: () => any;
  handleSearch: (input: string) => any;
  deselectSearch: () => any;
}

export default class Root extends React.Component<RootProps, {}> {
  render() {
    return (
      <MuiThemeProvider>
        <Sidebar {...this.props} />
      </MuiThemeProvider>
    );
  }
}
