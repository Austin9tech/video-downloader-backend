const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Video info endpoint using yt-dlp
app.get('/fetch', (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  console.log(`Processing: ${url}`);
  
  // Using yt-dlp with JSON output
  const command = `yt-dlp --dump-json --no-check-certificates "${url}"`;

  exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error('Error:', error.message);
      return res.status(500).json({ 
        error: 'Failed to fetch video info',
        details: stderr.toString()
      });
    }

    try {
      const info = JSON.parse(stdout);
      
      // Process the data into a consistent format
      const result = {
        title: info.title || 'Untitled',
        author: info.uploader || 'Unknown',
        thumbnail: info.thumbnail || null,
        formats: []
      };

      // Process available formats
      if (info.formats) {
        result.formats = info.formats
          .filter(f => f.url)
          .map(f => ({
            quality: f.format_note || `${f.height}p` || 'Unknown',
            type: f.ext || 'mp4',
            size: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown',
            url: f.url,
            hasAudio: f.acodec !== 'none',
            hasVideo: f.vcodec !== 'none'
          }));
      }

      // Fallback to direct URL if no formats found
      if (result.formats.length === 0 && info.url) {
        result.formats.push({
          quality: 'Direct',
          type: info.ext || 'mp4',
          url: info.url,
          size: 'Unknown',
          hasAudio: true,
          hasVideo: true
        });
      }

      res.json(result);
    } catch (parseError) {
      console.error('Parse error:', parseError);
      res.status(500).json({ error: 'Failed to parse video info' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
