# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
from nose.tools import eq_

from .deltas import diff, round_vehicles, diff_dicts


def test_diff():
    eq_({'x': 1}, diff({'x': 2, 'y': 1}, {'x': 1, 'y': 1}))
    eq_({}, diff({'x': 'a', 'y': 1}, {'x': 'a', 'y': 1}))


def test_round_vehicles():
    vehicles = {
        'veh1': {
            'x': 1234.5678901234,
            'y': 2345.6789012346,
            'speed': 12.123456789,
            'angle': 359.002355689
        }
    }
    round_vehicles(vehicles)
    eq_({
        'veh1': {
            'x': 1234.57,
            'y': 2345.68,
            'speed': 12,
            'angle': 359
        }
    }, vehicles)


def test_diff_vehicles():
    # Some properties of veh2 change, while veh1 is constant.
    eq_({
        'creations': {},
        'updates': {
            'veh2': {
                'x': 12.1,
                'y': 23.2
            }
        },
        'removals': []
    }, diff_dicts({
        'veh1': {
            'x': 1.234,
            'y': 3.456,
            'angle': 354
        },
        'veh2': {
            'x': 1.234,
            'y': 3.456,
            'angle': 234
        }
    }, {
        'veh1': {
            'x': 1.234,
            'y': 3.456,
            'angle': 354
        },
        'veh2': {
            'x': 12.1,
            'y': 23.2,
            'angle': 234
        }
    }))

    # obj1 is created, while obj2 is deleted.
    eq_({
        'creations': {
            'obj1': {
                'x': 1
            }
        },
        'updates': {},
        'removals': ['obj2']
    }, diff_dicts({
        'obj2': {'x': 2},
    }, {
        'obj1': {'x': 1},
    }))

    # All properties of veh1 change, but nan values are ignored
    eq_({
        'creations': {},
        'updates': {
            'veh1': {
                'angle': 270,
            }
        },
        'removals': []
    }, diff_dicts({
        'veh1': {
            'x': 1.234,
            'y': 3.456,
            'angle': 354,
        },
    }, {
        'veh1': {
            'x': float('nan'),
            'y': float('nan'),
            'angle': 270,
        },
    }))
