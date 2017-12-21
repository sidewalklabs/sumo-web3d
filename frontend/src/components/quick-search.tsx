import RaisedButton from 'material-ui/RaisedButton';
import TextField from 'material-ui/TextField';
import * as React from 'react';

import {RootProps} from './root';

const projectionString = 'OSM ID / Lat, Long (float, float) / X,Y (int, int)';
const sumoString = 'X,Y (float, float)';

export interface QuicSearchState {
  inputText: string;
}

export default class QuickSearch extends React.Component<RootProps, QuicSearchState> {
  constructor(props: RootProps) {
    super(props);
    this.state = {
      inputText: '',
    };
  }

  render() {
    return (
      <div>
        <TextField
          className="pnc-ignore"
          hintText={this.props.isProjection ? projectionString : sumoString}
          value={this.state.inputText}
          errorText={this.state.inputText && this.props.searchBoxErrorMessage}
          onChange={(e, v) => this.setState({inputText: v})}
        />
        <br />
        <RaisedButton
          label="Search"
          primary={true}
          onClick={() => this.props.handleSearch(this.state.inputText)}
          disabled={this.state.inputText.length === 0}
        />
      </div>
    );
  }
}
