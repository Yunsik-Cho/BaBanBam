
import { list } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured' });
    }

    // 모든 유저 폴더의 score.json 파일을 찾습니다.
    const { blobs } = await list({ prefix: 'fashion-king/' });
    const scoreFiles = blobs.filter(b => b.pathname.endsWith('score.json'));

    // 각 파일의 내용을 읽어옵니다.
    const rankingPromises = scoreFiles.map(async (file) => {
      const response = await fetch(file.url);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        userId: file.pathname.split('/')[1],
        userName: data.userName,
        score: data.score,
        updatedAt: data.updatedAt
      };
    });

    const rankings = (await Promise.all(rankingPromises))
      .filter(item => item !== null)
      .sort((a, b) => b.score - a.score); // 점수 내림차순 정렬

    return res.status(200).json({ rankings });
  } catch (error) {
    console.error('Failed to fetch rankings:', error);
    return res.status(500).json({ error: error.message });
  }
}
