# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
"""Utility code for working with XML files."""

import xmltodict


def parse_xml_file(filepath):
    if filepath:
        with open(filepath) as f:
            return xmltodict.parse(f.read(), attr_prefix='')
    else:
        return None


def get_only_key(d):
    """Access the only key in a dict.

    This is useful for SUMO XML files, where the outermost tag name is inconsistent.
    """
    assert d, 'Expected dict but got %s' % d
    assert len(d.keys()) == 1, 'Expected one key but got multiple %s' % d.keys()
    return d[list(d.keys())[0]]
