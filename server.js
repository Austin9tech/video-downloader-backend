const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Configure for Render deployment
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Enhanced yt-dlp command with fallbacks
const getYTDLPCommand = (url) => {
  // Try preferred formats first
  return `yt-dlp --dump-json --no-check-certificates --format "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${url}"`;
};

app.get('/fetch', async (req, res) => {
  try {
    const videoUrl = req.query.url;
    
    if (!videoUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    console.log(`Processing request for: ${videoUrl}`);

    const result = await executeYTDLP(videoUrl);
    res.json(result);
  } catch (error) {
    console.error('Error in /fetch:', error);
    res.status(500).json({ 
      error: 'Failed to process video',
      details: isProduction ? undefined : error.message
    });
  }
});

async function executeYTDLP(url) {
  return new Promise((resolve, reject) => {
    const command = getYTDLPCommand(url);
    
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        console.warn('Command execution warning:', stderr);
        // Don't reject - we'll try to parse anyway
      }

      try {
        const info = JSON.parse(stdout);
        
        const formats = processFormats(info);
        if (formats.length === 0 && info.url) {
          formats.push(createFallbackFormat(info.url));
        }

        resolve({
          title: info.title || 'Untitled Video',
          author: info.uploader || info.channel || 'Unknown',
          thumbnail: getBestThumbnail(info),
          duration: info.duration || 0,
          formats: formats
        });
      } catch (parseError) {
        console.error('Parse error:', parseError);
        reject(new Error('Failed to parse video information'));
      }
    });
  });
}

function processFormats(info) {
  return (info.formats || [])
    .filter(f => f.url && f.url.startsWith('http'))
    .map(f => ({
      quality: cleanQualityString(f),
      type: f.ext || (f.vcodec === 'none' ? 'm4a' : 'mp4'),
      size: formatFileSize(f.filesize),
      url: f.url,
      hasAudio: f.acodec && f.acodec !== 'none',
      hasVideo: f.vcodec && f.vcodec !== 'none'
    }));
}

function cleanQualityString(format) {
  if (format.format_note) return format.format_note;
  if (format.height) return `${format.height}p`;
  if (format.quality) return String(format.quality);
  return 'Unknown';
}

function formatFileSize(bytes) {
  if (!bytes) return 'Unknown';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getBestThumbnail(info) {
  if (info.thumbnail) return info.thumbnail;
  if (info.thumbnails?.length) {
    return info.thumbnails.reduce((best, current) => 
      (current.width > (best?.width || 0)) ? current : best
    ).url;
  }
  return null;
}

function createFallbackFormat(url) {
  return {
    quality: 'Direct',
    type: url.includes('.mp4') ? 'mp4' : 'm4a',
    size: 'Unknown',
    url: url,
    hasAudio: !url.includes('.mp4'),
    hasVideo: url.includes('.mp4')
  };
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(!isProduction && { details: err.message })
  });
});

app.listen(PORT, () => {
  console.log(`
  Server running on port ${PORT}
  Environment: ${isProduction ? 'Production' : 'Development'}
  Ready to process requests...
  `);
});
