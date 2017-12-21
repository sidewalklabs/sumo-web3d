#!/bin/bash
# Run the microsim server in development mode, watching for changes to the JS.

# Continually rebuild frontend JavaScript.
yarn watch &

# Run the python server. It would be nice to restart this on changes, too!
python sumo_web3d/sumo_web3d.py $@

# kill any remaining background processes
jobs -p | xargs kill
