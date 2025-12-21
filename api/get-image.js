
import { head } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' });
    }

    const { userId, imageType } = req.query; // imageType will be 'result' or 'upper_body'

    if (!userId || !imageType) {
      return res.status(400).json({ error: 'User ID and imageType are required' });
    }

    let baseFileName;
    if (imageType === 'result') {
      baseFileName = 'fashion_image.jpg';
    } else if (imageType === 'upper_body') {
      baseFileName = 'upper_image.jpg';
    } else {
      return res.status(400).json({ error: 'Invalid imageType' });
    }

    const fileName = `fashion-king/${userId}/${baseFileName}`;

    try {
      // Check if the file exists and get its metadata including the URL
      const blob = await head(fileName);
      return res.status(200).json({ url: blob.url });
    } catch (headError) {
      if (headError.message.includes('NOT_FOUND')) {
        return res.status(404).json({ error: 'Image not found for this user.' });
      }
      console.error('Error checking blob head:', headError);
      return res.status(500).json({ error: 'Error checking image existence.' });
    }

  } catch (error) {
    console.error('Failed to get image:', error);
    return res.status(500).json({ error: error.message });
  }
}
