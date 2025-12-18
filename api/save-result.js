import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' });
    }

    const { image, video, userId, type } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
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
      
      // 상반신 크롭은 upper_image.jpg, 결과지는 fashion_image.jpg로 저장
      const name = type === 'upper_body' ? 'upper_image.jpg' : 'fashion_image.jpg';
      filename = `fashion-king/${userId}/${name}`;
      contentType = 'image/jpeg';
    } else if (video) {
      const base64Data = video.split(';base64,').pop();
      buffer = Buffer.from(base64Data, 'base64');
      
      // 영상은 video.mp4로 저장
      filename = `fashion-king/${userId}/video.mp4`;
      contentType = 'video/mp4';
    }

    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: contentType,
      addRandomSuffix: false // 파일명을 고정하기 위해 랜덤 접미사 제거
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Blob upload failed:', error);
    return res.status(500).json({ error: error.message });
  }
}