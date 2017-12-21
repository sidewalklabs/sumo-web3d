# Copyright 2018 Sidewalk Labs | http://www.eclipse.org/legal/epl-v20.html
from nose.tools import assert_raises, eq_

from .xml_utils import get_only_key


def test_get_only_key():
    eq_('bar', get_only_key({'foo': 'bar'}))
    eq_({'foo': 1}, get_only_key({'foo': {'foo': 1}}))
    assert_raises(AssertionError, lambda: get_only_key({'foo': 'bar', 'baz': 'quux'}))
    assert_raises(AssertionError, lambda: get_only_key(None))
