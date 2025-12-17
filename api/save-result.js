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

    const { image, timestamp } = req.body;
    
    if (!image) {
      return res.status(400).json({ error: 'No image data provided' });
    }

    // Convert Base64 Data URL to Buffer
    // Format: "data:image/jpeg;base64,/9j/4AAQSk..."
    const base64Data = image.split(';base64,').pop();
    const buffer = Buffer.from(base64Data, 'base64');

    // Save the analysis result as an image file
    const filename = `fashion-king/result-${timestamp}.jpg`;
    
    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: 'image/jpeg'
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Blob upload failed:', error);
    return res.status(500).json({ error: error.message });
  }
}