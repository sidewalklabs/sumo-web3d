# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
"""Provides "functionalities" across the various python modules.

By functionalities, it is meant that the sumo source code gets thrown onto the PYTHONPATH.
There are also various constants here, functioning like a config file.
"""
import os
import sys


# This config controls which vehicles are simulated
# Params values can be adjusted as needed for each vehicle type
#   prefix <STRING>: used to name each vehicle
#   quantity <INT>: num of vehicles to simulate
#   period <INT>: the interval at which vehicles depart
#   min_distance <FLOAT>: min distance (in meter) between start and end edges of a trip
#   max_distance <FLOAT>: max distance (in meter) between start and end edges of a trip,
#   speed_factor <FLOAT>: vehicle's expected multiplicator for lane speed limit
#                         applied directly to the max speed for pedestrians
#                         can also be a distribution used to sample a vehicle specific speed factor

VEHICLE_PARAMS = {
    'passenger': {
        'prefix': 'veh',
        'quantity': 1800,
        'period': 2,
        'min_distance': 300,
        'max_distance': None,
        'speed_factor': 'normc(1.00,0.10,0.20,2.00)',
    },
    'bicycle': {
        'prefix': 'bike',
        'quantity': 1800,
        'period': 2,
        'min_distance': 300,
        'max_distance': None,
        'speed_factor': 'normc(1.00,0.10,0.20,2.00)',
    },
    'pedestrian': {
        'prefix': 'ped',
        'quantity': 1800,
        'period': 2,
        'min_distance': 300,
        'max_distance': None,
        'speed_factor': '1.3',
    },
}

SUMO_IMPORT_ERROR_MSG = ('please declare environment variable \'SUMO_HOME\' as the root directory'
                         'of your sumo installation (it should contain folders /bin, /tools and'
                         '/docs)')

# we need to import python modules from the $SUMO_HOME/tools directory ....
# this is a hack borrowed from the sumo code base
SUMO_HOME = os.environ.get('SUMO_HOME')
assert SUMO_HOME, 'Make sure the SUMO_HOME environment variable is set.'
try:
    sys.path.append(os.path.join(SUMO_HOME, 'tools'))
except ImportError:
    sys.exit(SUMO_IMPORT_ERROR_MSG)
