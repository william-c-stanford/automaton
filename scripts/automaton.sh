#!/bin/sh
# Conway Automaton Installer — thin wrapper
# curl -fsSL https://conway.tech/automaton.sh | sh
set -e
git clone https://github.com/william-c-stanford/automaton.git /opt/automaton
cd /opt/automaton
source .env
pnpm install && pnpm build
exec node dist/index.js --run
