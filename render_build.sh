#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm run build

pip install --upgrade pip pipenv
pipenv install --system

flask db upgrade