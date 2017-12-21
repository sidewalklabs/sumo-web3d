#!/bin/bash
# This runs Prettier (https://github.com/prettier/prettier/) with our custom format options.
find frontend | egrep '\.(ts|tsx|css)$' | grep -v '.min.' | xargs prettier "$@"
