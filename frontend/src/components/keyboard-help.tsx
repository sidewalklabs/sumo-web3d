import Dialog from 'material-ui/Dialog';
import FlatButton from 'material-ui/FlatButton';
import * as React from 'react';

import {RootProps} from './root';

const Key = (props: {label: string}) => <div className="key">{props.label}</div>;

export interface KeyboardHelpState {
  keyboardHelpVisible: boolean;
}

class KeyboardHelp extends React.Component<RootProps, KeyboardHelpState> {
  constructor(props: RootProps) {
    super(props);
    this.state = {
      keyboardHelpVisible: false,
    };
  }

  toggleKeyboardHelp() {
    this.setState({keyboardHelpVisible: !this.state.keyboardHelpVisible});
  }

  render() {
    return (
      <div>
        <FlatButton
          label="Help"
          onClick={() => this.toggleKeyboardHelp()}
          disabled={this.state.keyboardHelpVisible}
        />
        <Dialog
          open={this.state.keyboardHelpVisible}
          onRequestClose={() => this.toggleKeyboardHelp()}
          actions={[<FlatButton label="ok" onClick={() => this.toggleKeyboardHelp()} />]}>
          <div className="keyboard-help">
            <div>
              Keyboard Controls:
              <ul>
                <li>
                  <Key label="h" /> or <Key label="a" /> pan the camera left
                </li>
                <li>
                  <Key label="j" /> or <Key label="s" /> pan the camera away from the direction it
                  is facing
                </li>
                <li>
                  <Key label="k" /> or <Key label="w" /> pan the camera "forward" or in the
                  direction the camera is facing
                </li>
                <li>
                  <Key label="l" /> or <Key label="d" /> pan the camera right
                </li>
                <li>
                  <Key label="&uarr;" /> rotate the camera upwards along the vertical axis
                </li>
                <li>
                  <Key label="&darr;" /> rotate the camera downwards along the vertical axis
                </li>
                <li>
                  <Key label="&larr;" /> rotate the camera left along the horizontal axis
                </li>
                <li>
                  <Key label="&rarr;" /> rotate the camera right along the horizontal axis
                </li>
                <li>
                  <Key label="ctrl" /> + <Key label="&uarr;" /> move the camera away from the ground
                </li>
                <li>
                  <Key label="ctrl" /> + <Key label="&darr;" /> move the camera towards the ground
                </li>
              </ul>
            </div>
            <div>
              Mouse / Trackpad Controls:
              <ul>
                <li>Holding down the left button engages panning mode</li>
                <li>Holding down the right button engages rotation mode</li>
                <li>Scrolling allows you to zoom in and out of a scene</li>
              </ul>
            </div>
          </div>
        </Dialog>
      </div>
    );
  }
}

export default KeyboardHelp;
