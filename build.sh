#!/bin/bash
# Install Python and yt-dlp
apt-get update && apt-get install -y python3 python3-pip
pip3 install yt-dlp

# Install Node.js dependencies
npm install
