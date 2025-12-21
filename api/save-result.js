
import { put, list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' });
    }

    const { image, video, userId, type, score, userName } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // 점수 저장 모드
    if (type === 'score' && score !== undefined) {
      const scoreData = JSON.stringify({ score, userName, updatedAt: new Date().toISOString() });
      const scoreBlob = await put(`fashion-king/${userId}/score.json`, scoreData, {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false
      });
      return res.status(200).json({ success: true, url: scoreBlob.url });
    }

    if (!image && !video) {
      return res.status(400).json({ error: 'No media data provided' });
    }

    let buffer;
    let filename;
    let contentType;

    if (image) {
      const base64Data = image.split(';base64,').pop();
      buffer = Buffer.from(base64Data, 'base64');
      
      const baseName = type === 'upper_body' ? 'upper_image.jpg' : 'fashion_image.jpg';
      const targetPath = `fashion-king/${userId}/${baseName}`;
      
      const { blobs } = await list({ prefix: targetPath });
      const alreadyExists = blobs.some(b => b.pathname === targetPath);
      
      let finalName = baseName;
      if (alreadyExists) {
        const nameParts = baseName.split('.');
        const ext = nameParts.pop();
        finalName = `${nameParts.join('.')}_v2.${ext}`;
      }

      filename = `fashion-king/${userId}/${finalName}`;
      contentType = 'image/jpeg';
    }

    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: contentType,
      addRandomSuffix: false 
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Blob upload failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
