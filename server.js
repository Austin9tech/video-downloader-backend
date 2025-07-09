const express = require('express');
const cors = require('cors');
const { path: pathToYtDlp } = require('yt-dlp-exec');
const YTDlpWrap = require('yt-dlp-wrap').default;

const ytdlpWrap = new YTDlpWrap(pathToYtDlp);
const app = express();

app.use(cors());
app.use(express.json());

// Welcome route
app.get('/', (req, res) => {
  res.send('✅ Universal Video Downloader API is live! Use /fetch?url=VIDEO_URL');
});

// Main fetch endpoint
app.get('/fetch', async (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  console.log(`Processing: ${videoUrl}`);

  try {
    // Call yt-dlp-wrap with included binary
    const stdout = await ytdlpWrap.execPromise([
      '--no-check-certificates',
      '--dump-json',
      '--format',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      videoUrl
    ]);

    const info = JSON.parse(stdout);
    const formats = processFormats(info);

    const response = {
      title: info.title || 'Untitled',
      author: info.uploader || info.channel || 'Unknown',
      thumbnail: getBestThumbnail(info),
      duration: info.duration || 0,
      formats: formats
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching video info:', error);
    res.status(500).json({
      error: 'Failed to fetch video info',
      details: error.message
    });
  }
});

// Process video formats
function processFormats(info) {
  const formats = (info.formats || [])
    .filter(f => f.url && f.url.startsWith('http'))
    .map(f => {
      let quality = f.format_note ||
                    (f.height ? `${f.height}p` : '') ||
                    (f.quality ? `${f.quality}` : 'Unknown');

      quality = quality ? quality.replace(/\(.*\)/, '').trim() : 'Unknown';

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

  // Fallback direct
  if (formats.length === 0 && info.url) {
    formats.push({
      quality: 'Direct',
      type: info.url.includes('.mp4') ? 'mp4' : 'm4a',
      size: 'Unknown',
      url: info.url,
      hasAudio: !info.url.includes('.mp4'),
      hasVideo: info.url.includes('.mp4')
    });
  }

  return formats;
}

// Pick best thumbnail
function getBestThumbnail(info) {
  return info.thumbnail ||
         (info.thumbnails?.sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url) ||
         null;
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
  ✅ Server running on port ${PORT}
  Ready to process downloads...
  `);
});
