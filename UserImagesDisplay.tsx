
import React, { useEffect, useState } from 'react';

interface UserImagesDisplayProps {
  userId: string;
  userName: string;
  onBack: () => void;
}

const UserImagesDisplay: React.FC<UserImagesDisplayProps> = ({ userId, userName, onBack }) => {
  const [fashionImageUrl, setFashionImageUrl] = useState<string | null>(null);
  const [upperImageUrl, setUpperImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchImages = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [fashionRes, upperRes] = await Promise.all([
          fetch(`/api/get-image?userId=${userId}&imageType=result&t=${Date.now()}`),
          fetch(`/api/get-image?userId=${userId}&imageType=upper_body&t=${Date.now()}`),
        ]);

        const fashionData = await fashionRes.json();
        const upperData = await upperRes.json();

        if (fashionRes.ok && fashionData.url) {
          setFashionImageUrl(fashionData.url);
        } else {
          setFashionImageUrl(null); // Explicitly set to null if not found
          console.warn(`No fashion image found for ${userName}: ${fashionData.error}`);
        }

        if (upperRes.ok && upperData.url) {
          setUpperImageUrl(upperData.url);
        } else {
          setUpperImageUrl(null); // Explicitly set to null if not found
          console.warn(`No upper body image found for ${userName}: ${upperData.error}`);
        }
      } catch (err: any) {
        console.error("Failed to fetch user images:", err);
        setError("이미지를 불러오는 데 실패했습니다: " + err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [userId, userName]);

  return (
    <div className="w-full bg-[#111111] text-gray-100 font-sans p-6 md:p-10 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl md:text-5xl font-display text-white">{userName} 님의 착장</h2>
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-[#FC6E22] text-sm font-bold uppercase tracking-widest transition-colors flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          뒤로가기
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6 text-center">
          <div className="w-16 h-16 border-4 border-white/10 border-t-[#FC6E22] rounded-full animate-spin"></div>
          <p className="text-xl font-bold text-white">이미지를 불러오는 중...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/50 rounded-2xl p-6 text-center mt-8">
          <p className="text-red-400 font-bold">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <div className="bg-[#1a1a20] rounded-3xl overflow-hidden shadow-2xl aspect-[2/3] flex items-center justify-center">
            {upperImageUrl ? (
              <img src={upperImageUrl} alt={`${userName}'s Upper Body`} className="w-full h-full object-cover" />
            ) : (
              <p className="text-gray-500 text-lg">상반신 이미지가 없습니다</p>
            )}
          </div>
          <div className="bg-[#1a1a20] rounded-3xl overflow-hidden shadow-2xl aspect-[2/3] flex items-center justify-center">
            {fashionImageUrl ? (
              <img src={fashionImageUrl} alt={`${userName}'s Full Outfit`} className="w-full h-full object-cover" />
            ) : (
              <p className="text-gray-500 text-lg">전신 이미지가 없습니다</p>
            )}
          </div>
        </div>
      )}
      {!upperImageUrl && !fashionImageUrl && !isLoading && !error && (
        <div className="text-center py-10 text-gray-500 text-lg">
          저장된 이미지가 없습니다.
        </div>
      )}
    </div>
  );
};

export default UserImagesDisplay;
