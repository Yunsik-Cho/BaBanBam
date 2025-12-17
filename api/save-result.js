import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check for Vercel Blob token
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' });
    }

    const { image, video, timestamp } = req.body;
    
    if (!image && !video) {
      return res.status(400).json({ error: 'No image or video data provided' });
    }

    let buffer;
    let filename;
    let contentType;

    if (image) {
      // Format: "data:image/jpeg;base64,/9j/4AAQSk..."
      const base64Data = image.split(';base64,').pop();
      buffer = Buffer.from(base64Data, 'base64');
      filename = `fashion-king/result-${timestamp}.jpg`;
      contentType = 'image/jpeg';
    } else if (video) {
      // Format: "data:video/mp4;base64,..."
      const base64Data = video.split(';base64,').pop();
      buffer = Buffer.from(base64Data, 'base64');
      filename = `fashion-king/video-${timestamp}.mp4`;
      contentType = 'video/mp4';
    }

    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: contentType
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Blob upload failed:', error);
    // Vercel serverless functions have a 4.5MB payload limit. 
    // If the video is too large, this might fail.
    return res.status(500).json({ error: error.message });
  }
}