#!/bin/bash
# Install Python and required tools
apt-get update
apt-get install -y python3 python3-pip ffmpeg

# Install yt-dlp with pip
python3 -m pip install --upgrade yt-dlp

# Install Node.js dependencies
npm install
