import React, { useEffect, useState } from 'react';

interface ApiKeyManagerProps {
  onReady: () => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onReady }) => {
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkKey = async () => {
    try {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        if (selected) {
          setHasKey(true);
          onReady();
        } else {
          setHasKey(false);
        }
      } else {
        // Fallback for dev environments where window.aistudio might not be injected yet
        console.warn("AI Studio client not found on window object.");
      }
    } catch (e) {
      console.error("Error checking API key:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkKey();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      try {
        await window.aistudio.openSelectKey();
        // Assume success after closing dialog (or rely on next check)
        // Re-checking immediately might be racy, but the instruction says:
        // "Assume the key selection was successful after triggering openSelectKey() and proceed"
        setHasKey(true);
        onReady();
      } catch (e) {
        console.error("Failed to select key:", e);
        // If it fails with "Requested entity was not found", we reset
        setHasKey(false);
      }
    }
  };

  if (loading) return <div className="text-center p-4 text-neon-blue animate-pulse">시스템 초기화 중...</div>;

  if (hasKey) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a20] border-2 border-neon-pink p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_30px_rgba(255,0,255,0.3)]">
        <h2 className="text-3xl font-display mb-4 text-white">입장권 필요</h2>
        <p className="mb-6 text-gray-300">
          이 구역은 힙스터 전용이야. <br/>
          Veo 영상 생성을 위해 유료 GCP 프로젝트 키가 필요해.
        </p>
        
        <button
          onClick={handleSelectKey}
          className="w-full bg-neon-pink hover:bg-neon-purple text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-105 shadow-lg"
        >
          🔑 API 키 선택하기
        </button>
        
        <div className="mt-6 text-xs text-gray-500">
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            rel="noreferrer"
            className="underline hover:text-neon-blue"
          >
            과금 정책 확인하기 (필독)
          </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyManager;