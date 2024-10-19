#!/bin/bash

# deploy.sh
# copy this file to the root folder
# Change to the directory where your application is located
cd stuk_bot/

# Pull the latest code from the repository
git pull origin main

# Install dependencies (in case there are new ones)
npm install

# Build the application
npm run build

# Find and stop the existing forever process
forever stop dist/app.js

# Wait a moment to ensure the process has fully stopped
sleep 5

# Start the application with forever
forever start -o out.log -e err.log dist/app.js

# Log the deployment
echo "Deployment completed at $(date)" >> out.log