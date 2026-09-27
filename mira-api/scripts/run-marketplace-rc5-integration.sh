#!/usr/bin/env bash
# The RC5 command path now uses the RC6 script so admin commands cannot ignore the verified host and port.
exec "$(cd "$(dirname "$0")" && pwd)/run-marketplace-rc6-integration.sh" "$@"
