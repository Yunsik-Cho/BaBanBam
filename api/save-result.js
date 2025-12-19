
import { put, list } from '@vercel/blob';

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
      
      const baseName = type === 'upper_body' ? 'upper_image.jpg' : 'fashion_image.jpg';
      const targetPath = `fashion-king/${userId}/${baseName}`;
      
      // 1. 기존 파일이 존재하는지 확인합니다.
      const { blobs } = await list({ prefix: targetPath });
      const alreadyExists = blobs.some(b => b.pathname === targetPath);
      
      let finalName = baseName;
      if (alreadyExists) {
        // 2. 존재한다면 파일명에 _v2를 붙입니다. (예: upper_image_v2.jpg)
        const nameParts = baseName.split('.');
        const ext = nameParts.pop();
        finalName = `${nameParts.join('.')}_v2.${ext}`;
      }

      filename = `fashion-king/${userId}/${finalName}`;
      contentType = 'image/jpeg';
    } else if (video) {
      const base64Data = video.split(';base64,').pop();
      buffer = Buffer.from(base64Data, 'base64');
      
      // 영상은 요청사항에 없으므로 기존 방식 유지 (video.mp4)
      filename = `fashion-king/${userId}/video.mp4`;
      contentType = 'video/mp4';
    }

    const blob = await put(filename, buffer, { 
      access: 'public',
      contentType: contentType,
      addRandomSuffix: false // 버전 이름을 직접 제어하므로 랜덤 접미사는 비활성화
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (error) {
    console.error('Blob upload failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
