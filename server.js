const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check
app.get('/health', (req, res) => res.send('OK'));

// Video info endpoint
app.get('/fetch', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const info = await ytdl.getInfo(url);
    
    const result = {
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      thumbnail: info.videoDetails.thumbnails.pop()?.url,
      formats: info.formats
        .filter(f => f.hasVideo || f.hasAudio)
        .map(f => ({
          quality: f.qualityLabel || `${f.height}p` || 'Unknown',
          type: f.mimeType.split(';')[0].split('/')[1],
          url: f.url,
          size: f.contentLength 
            ? `${(f.contentLength / (1024 * 1024)).toFixed(2)} MB` 
            : 'Unknown'
        }))
    };

    res.json(result);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch video info',
      details: err.message 
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
