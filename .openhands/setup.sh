#!/bin/bash
set -e

# Force git identity for commits created by OpenHands
git config --global user.name "yaeliavni"
git config --global user.email "yaelavni2019@gmail.com"

# Extra-hard override (covers tools that ignore git config)
export GIT_AUTHOR_NAME="yaeliavni"
export GIT_AUTHOR_EMAIL="yaelavni2019@gmail.com"
export GIT_COMMITTER_NAME="yaeliavni"
export GIT_COMMITTER_EMAIL="yaelavni2019@gmail.com"
