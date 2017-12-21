# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
"""Utility code for working with deltas between frames."""
import math


def round_vehicles(vehicles):
    """Round values for vehicles to reduce data size. Mutates vehicles."""
    for v in vehicles.values():
        v['x'] = round(v['x'], 2)
        v['y'] = round(v['y'], 2)
        v['speed'] = int(round(v['speed']))
        v['angle'] = int(round(v['angle']))


def safe_isnan(val):
    """math.isnan only works on floats.

    This wrapper returns False for non-number non-nan inputs
    """
    return type(val) == float and math.isnan(val)


def diff(before, after):
    """Calculate a diff between two dicts, ignoring nan values.

    We assume that no keys are deleted.
    """
    return {
        k: v
        for k, v in after.items()
        if before.get(k) != v and not safe_isnan(v)
    }


def diff_dicts(before, after):
    """Calculate a diff between two dicts.

    Returns a tuple:
        (creation dict, update dict, deleted keys)

    Where (update dict) is a dict of diffs between old & new values for the same key
    and (creation dict) is a dict of objects that were added to after
    and (deleted keys) is a list of keys that were removed between before and after.

    If a before[k] == after[k], then k will not appear in the update dict.
    """
    creations = {}
    update = {}
    deleted_keys = []
    for k in before.keys():
        if k not in after.keys():
            deleted_keys.append(k)

    for k, v in after.items():
        if k in before:
            d = diff(before[k], v)
            if len(d):
                update[k] = d
        else:
            creations[k] = v

    return {'creations': creations, 'updates': update, 'removals': deleted_keys}
