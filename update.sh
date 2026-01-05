#!/bin/bash

set -e  # Exit on any error

# Get the project name: try to find PM2 process with matching cwd, fallback to directory name
PROJECT_NAME=$(node -e "
const { execSync } = require('child_process');
const path = require('path');
try {
  const output = execSync('pm2 jlist', { encoding: 'utf8' });
  const list = JSON.parse(output);
  const cwd = process.cwd();
  const proc = list.find(p => p.pm2_env && p.pm2_env.cwd === cwd);
  console.log(proc ? proc.name : path.basename(cwd));
} catch (e) {
  console.log(path.basename(process.cwd()));
}
")

echo "Updating project: $PROJECT_NAME"

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "Error: Not in a git repository"
    exit 1
fi

# Pull changes
echo "Pulling latest changes..."
if ! git pull origin master; then
    echo "Error: Failed to pull changes"
    exit 1
fi

# Check if pnpm is available
if ! command -v pnpm > /dev/null 2>&1; then
    echo "Error: pnpm is not installed"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
if ! pnpm install; then
    echo "Error: Failed to install dependencies"
    exit 1
fi

# Check if pm2 is available
if ! command -v pm2 > /dev/null 2>&1; then
    echo "Error: pm2 is not installed"
    exit 1
fi

# Restart pm2 process
echo "Restarting pm2 process: $PROJECT_NAME"
if ! pm2 restart $PROJECT_NAME; then
    echo "Error: Failed to restart pm2 process $PROJECT_NAME"
    exit 1
fi

echo "Update completed successfully"
