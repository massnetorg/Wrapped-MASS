#!/usr/bin/env bash

DIST=./dist

if [[ ! -e $DIST ]]; then
  mkdir -p $DIST
elif [[ ! -d $DIST ]]; then
  echo "'$DIST' already exists but not a directory" 1>&2
  exit 1
fi

for contract in "WMASSToken" "WMASSAirdrop"
do
  npx truffle-flattener contracts/$contract.sol > dist/$contract.dist.sol
done