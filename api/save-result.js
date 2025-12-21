
import { put } from '@vercel/blob';

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
      
      let baseName;
      if (type === 'upper_body') {
        baseName = 'upper_image_v2.jpg'; // Save as _v2
      } else if (type === 'result') {
        baseName = 'fashion_image_v2.jpg'; // Save as _v2
      } else {
        return res.status(400).json({ error: 'Invalid image type for saving.' });
      }

      filename = `fashion-king/${userId}/${baseName}`;
      contentType = 'image/jpeg';
    } else if (video) {
        // 비디오 저장 로직은 현재 요청 범위에 포함되지 않음
        return res.status(400).json({ error: 'Video saving not implemented in this context.' });
    }

    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: contentType,
      addRandomSuffix: false // 파일 이름이 같으면 덮어쓰기
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Blob upload failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
