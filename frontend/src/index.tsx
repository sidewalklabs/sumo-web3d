import * as React from 'react';
import * as ReactDOM from 'react-dom';

import Root from './components/root';
import createStore from './datastore';
import init from './initialization';

(async () => {
  const initResources = await init();
  const store = createStore(initResources);
  const render = () => {
    ReactDOM.render(
      <Root
        {...store.getState()}
        onStart={store.actions.startSimulation}
        onPause={store.actions.pauseSimulation}
        onResume={store.actions.resumeSimulation}
        onCancel={store.actions.cancelSimulation}
        changeScenario={store.actions.changeScenario}
        followObjectPOV={store.actions.followObjectPOV}
        unfollowObjectPOV={store.actions.unfollowObjectPOV}
        toggleRouteObjectHighlighted={store.actions.toggleRouteObjectHighlighted}
        onChangeDelayMs={store.actions.changeDelay}
        onFocusOnVehicleOfClass={store.actions.focusOnVehicleOfClass}
        onFocusOnTrafficLight={store.actions.focusOnTrafficLight}
        handleSearch={store.actions.handleSearch}
        deselectSearch={store.actions.deselectSearch}
      />,
      initResources.reactRootEl,
    );
  };
  store.subscribe(render);
  render();
  store.actions.startSimulation();
})().catch(e => {
  const h = document.createElement('H1');
  h.innerText = '500 Server Error';
  document.body.appendChild(h);
  console.error(e);
});
