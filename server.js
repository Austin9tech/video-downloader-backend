const ytdl = require('ytdl-core');

app.get('/fetch', async (req, res) => {
  try {
    const { url } = req.query;
    if (!ytdl.validateURL(url)) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const info = await ytdl.getInfo(url);
    const formats = ytdl.filterFormats(info.formats, 'videoandaudio');
    
    res.json({
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      thumbnail: info.videoDetails.thumbnails.pop().url,
      formats: formats.map(f => ({
        quality: f.qualityLabel,
        type: f.mimeType.split(';')[0],
        url: f.url,
        size: f.contentLength ? `${(f.contentLength/1024/1024).toFixed(2)}MB` : 'Unknown'
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
