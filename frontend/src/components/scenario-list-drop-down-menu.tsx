import DropDownMenu from 'material-ui/DropDownMenu';
import MenuItem from 'material-ui/MenuItem';
import * as React from 'react';

import {RootProps} from './root';

const styles = {
  customWidth: {
    width: 200,
  },
};

export default (props: RootProps) => {
  const listItems = props.availableScenarios.map((scenario, i) => (
    <MenuItem value={scenario.kebabCase} key={i} primaryText={scenario.displayName} />
  ));
  return (
    <div className="scenario-list">
      <DropDownMenu
        value={props.scenario}
        onChange={(e, i, v) => props.changeScenario(v)}
        style={styles.customWidth}>
        {listItems}
      </DropDownMenu>
    </div>
  );
};
