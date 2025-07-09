const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// Smart format selection that falls back to available formats
const getYTDLPCommand = (url) => {
  return `yt-dlp --dump-json --no-check-certificates --format "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" "${url}"`;
};

// Alternative command when preferred formats aren't available
const getFallbackCommand = (url) => {
  return `yt-dlp --dump-json --no-check-certificates "${url}"`;
};

app.get('/fetch', async (req, res) => {
  const videoUrl = req.query.url;
  
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  console.log(`Processing: ${videoUrl}`);

  try {
    // First try with preferred format selection
    const result = await tryFetch(videoUrl, getYTDLPCommand);
    
    // If we got formats, return them
    if (result.formats && result.formats.length > 0) {
      return res.json(result);
    }
    
    // If no formats, try fallback command
    console.log('No formats found with preferred selection, trying fallback...');
    const fallbackResult = await tryFetch(videoUrl, getFallbackCommand);
    return res.json(fallbackResult);
    
  } catch (error) {
    console.error('Final error:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch video info',
      details: error.message
    });
  }
});

async function tryFetch(url, commandFn) {
  return new Promise((resolve, reject) => {
    const command = commandFn(url);
    
    exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
      if (error) {
        // Don't reject here - we might want to try fallback
        console.warn('Command warning:', stderr);
      }

      try {
        const info = JSON.parse(stdout);
        const formats = processFormats(info);
        
        const response = {
          title: info.title || 'Untitled',
          author: info.uploader || info.channel || 'Unknown',
          thumbnail: getBestThumbnail(info),
          duration: info.duration || 0,
          formats: formats
        };

        resolve(response);
      } catch (parseErr) {
        reject(parseErr);
      }
    });
  });
}

function processFormats(info) {
  const formats = (info.formats || [])
    .filter(f => f.url && f.url.startsWith('http'))
    .map(f => {
      // Determine quality
      let quality = f.format_note || 
                   (f.height ? `${f.height}p` : null) || 
                   (f.quality ? `${f.quality}` : 'Unknown');
      
      // Clean up quality string
      quality = quality.replace(/\(.*\)/, '').trim();

      return {
        quality: quality,
        type: f.ext || 'mp4',
        size: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(1) + ' MB' : 'Unknown',
        url: f.url,
        vcodec: f.vcodec,
        acodec: f.acodec,
        hasAudio: f.acodec && f.acodec !== 'none',
        hasVideo: f.vcodec && f.vcodec !== 'none'
      };
    });

  // Fallback to direct URL if no formats
  if (formats.length === 0 && info.url) {
    formats.push({
      quality: 'Direct',
      type: info.url.includes('.mp4') ? 'mp4' : 
            info.url.includes('.mp3') ? 'mp3' : 'm4a',
      size: 'Unknown',
      url: info.url,
      hasAudio: !info.url.includes('.mp4'),
      hasVideo: info.url.includes('.mp4')
    });
  }

  return formats;
}

function getBestThumbnail(info) {
  return info.thumbnail || 
         info.thumbnails?.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || 
         null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  Server running on port ${PORT}
  Ready to process downloads...
  `);
});