import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { analyzeFashion, generateNoddingVideo } from './services/geminiService';
import { CritiqueResult, ImageFile, VideoGenerationState } from './types';
import ApiKeySettings from './components/ApiKeySettings';
import { hasStoredKey } from './utils/storage';

// Updated mapping with '김상우'
const NAME_MAPPING: Record<string, number> = {
  '안치훈': 1,
  '김성민': 2,
  '김성휘': 3,
  '김태호': 4,
  '김태훈': 5,
  '박영민': 6,
  '박준형': 7,
  '변정욱': 8,
  '송현섭': 9,
  '신준휘': 10,
  '이민재': 11,
  '전시완': 12,
  '조윤식': 13,
  '김상우': 14
};

const App: React.FC = () => {
  const [userName, setUserName] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showSpicy, setShowSpicy] = useState(false);

  const [critiqueState, setCritiqueState] = useState<{
    loading: boolean;
    data: CritiqueResult | null;
    error: string | null;
  }>({ loading: false, data: null, error: null });

  const [videoState, setVideoState] = useState<VideoGenerationState>({
    status: 'idle',
    url: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasApiKey(hasStoredKey());
  }, []);

  // Alphabetically sorted names for display (가나다 순)
  const sortedNames = Object.keys(NAME_MAPPING).sort((a, b) => a.localeCompare(b, 'ko'));

  /**
   * Crops the upper body at a 2:3 ratio and resizes to exactly 480x720
   */
  const cropUpperBody = async (base64: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Canvas context not found');
          return;
        }

        const targetW = 480;
        const targetH = 720;
        canvas.width = targetW;
        canvas.height = targetH;

        // Calculate source rectangle for 2:3 ratio from the top area (upper body)
        const targetAspect = targetW / targetH; // 0.666...
        const sourceAspect = img.width / img.height;

        let sW, sH, sX, sY;

        // Always assume we want the top part for the upper body
        if (sourceAspect > targetAspect) {
          // Source is wider than 2:3
          sH = img.height * 0.7; // Take top 70% to ensure upper body
          sW = sH * targetAspect;
          sX = (img.width - sW) / 2;
          sY = 0;
        } else {
          // Source is narrower than 2:3
          sW = img.width;
          sH = sW / targetAspect;
          sX = 0;
          sY = 0;
        }

        ctx.fillStyle = '#000'; // Padding if needed
        ctx.fillRect(0, 0, targetW, targetH);
        ctx.drawImage(img, sX, sY, sW, sH, 0, 0, targetW, targetH);
        
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = base64;
    });
  };

  const saveToCloud = async (payload: { image?: string; video?: string; type: 'upper_body' | 'result' | 'video' }) => {
    if (!userName || !NAME_MAPPING[userName]) return;
    
    try {
      await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          userId: NAME_MAPPING[userName],
          timestamp: Date.now()
        })
      });
      console.log(`${payload.type} auto-saved to cloud for user ${NAME_MAPPING[userName]}`);
    } catch (e) {
      console.warn('Auto-save failed', e);
    }
  };

  // Auto-save logic: Triggered when analysis data is available
  useEffect(() => {
    if (critiqueState.data && resultRef.current && selectedImage) {
      const captureAndSave = async () => {
        try {
          // Wait for animations and layout to settle
          await new Promise(resolve => setTimeout(resolve, 2500));
          if (!resultRef.current) return;

          // 1. Save Upper Body Crop (480x720)
          const croppedBase64 = await cropUpperBody(selectedImage.preview);
          await saveToCloud({ image: croppedBase64, type: 'upper_body' });

          // 2. Save Full Result Capture
          const canvas = await html2canvas(resultRef.current, {
            useCORS: true,
            backgroundColor: '#111111',
            scale: 2
          });
          const resultBase64 = canvas.toDataURL('image/jpeg', 0.85);
          await saveToCloud({ image: resultBase64, type: 'result' });
          
        } catch (e) {
          console.error("Auto-save sequence failed", e);
        }
      };
      captureAndSave();
    }
  }, [critiqueState.data]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        setSelectedImage({
          file,
          preview: result,
          base64Data,
          mimeType: file.type
        });
        setCritiqueState({ loading: false, data: null, error: null });
        setVideoState({ status: 'idle', url: null });
        setShowSpicy(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const blobUrlToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleStartProcess = async () => {
    if (!hasApiKey) {
      setIsSettingsOpen(true);
      return;
    }
    if (!selectedImage) return;
    setCritiqueState({ loading: true, data: null, error: null });
    setVideoState({ status: 'idle', url: null });
    analyzeFashion(selectedImage.base64Data, selectedImage.mimeType)
      .then(result => {
        setCritiqueState({ loading: false, data: result, error: null });
      })
      .catch(err => {
        setCritiqueState({ loading: false, data: null, error: "분석 실패... AI가 도망갔나봐." });
      });
  };

  const handleGenerateVideo = async () => {
    if (!selectedImage) return;
    setVideoState({ status: 'generating', url: null });
    try {
      const videoUrl = await generateNoddingVideo(selectedImage.base64Data, selectedImage.mimeType);
      setVideoState({ status: 'completed', url: videoUrl });
      const base64Video = await blobUrlToBase64(videoUrl);
      await saveToCloud({ video: base64Video, type: 'video' });
    } catch (error: any) {
      setVideoState({ status: 'error', url: null, error: "영상 생성 실패" });
    }
  };

  const handleDownloadResult = async () => {
    if (!resultRef.current) return;
    const canvas = await html2canvas(resultRef.current, { useCORS: true, backgroundColor: '#111111', scale: 2 });
    const link = document.createElement('a');
    link.download = `fashion-king-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const resetApp = () => {
    setSelectedImage(null);
    setCritiqueState({ loading: false, data: null, error: null });
    setVideoState({ status: 'idle', url: null });
    setShowSpicy(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderDetailBar = (label: string, score: number) => (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400 font-medium">{label}</span>
        <span className={`font-bold ${score >= 70 ? 'text-green-400' : 'text-yellow-400'}`}>{score}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-1000 ease-out" style={{ width: `${score}%` }} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111111] text-gray-100 font-sans pb-20">
      <ApiKeySettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onKeyUpdate={(exists) => setHasApiKey(exists)} />

      {/* Name Input Modal */}
      {!userName && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-[#1a1a20] border border-gray-800 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-3xl font-display text-white mb-6 text-center">누구인가?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {sortedNames.map(name => (
                <button
                  key={name}
                  onClick={() => setUserName(name)}
                  className="py-3 px-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-neon-pink hover:text-neon-pink transition-all text-sm font-medium"
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs text-center">목록에 있는 이름만 분석 가능합니다.</p>
          </div>
        </div>
      )}

      <nav className="absolute top-0 right-0 p-6 z-20">
        <button onClick={() => setIsSettingsOpen(true)} className="p-3 rounded-full border bg-gray-900 border-gray-800 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </button>
      </nav>

      <main className="container mx-auto max-w-5xl px-6 py-12 relative">
        <header className="text-center mb-16">
          <div className="inline-block px-4 py-1 rounded-full bg-neon-pink/10 text-neon-pink text-xs font-bold mb-4 border border-neon-pink/20 uppercase tracking-widest">
            Welcome, {userName}
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4">바보이반 패션왕 분석기</h1>
          <button onClick={() => setUserName('')} className="text-gray-600 hover:text-gray-400 text-xs underline">이름 다시 선택</button>
        </header>

        {!selectedImage && (
          <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-700 hover:border-gray-500 hover:bg-[#1a1a1a] rounded-2xl h-[400px] flex flex-col items-center justify-center cursor-pointer bg-[#161616]">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <div className="text-6xl mb-6 text-gray-600">📸</div>
            <p className="text-3xl font-display text-gray-300">사진 업로드</p>
          </div>
        )}

        {selectedImage && (
          <div ref={resultRef} className="grid grid-cols-1 lg:grid-cols-2 gap-10 p-4 rounded-3xl bg-[#111111]">
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 min-h-[400px]">
                {videoState.status === 'completed' && videoState.url ? (
                  <video src={videoState.url} autoPlay loop playsInline controls className="w-full h-auto" />
                ) : (
                  <img src={selectedImage.preview} alt="Upload" className="w-full h-auto" />
                )}
                {!critiqueState.loading && !critiqueState.data && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" data-html2canvas-ignore>
                    <button onClick={handleStartProcess} className="bg-white text-black text-xl font-bold py-4 px-10 rounded-full">측정하기</button>
                  </div>
                )}
                {videoState.status === 'generating' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-6 text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-white font-bold text-lg">패션왕 인정 영상 생성 중...</p>
                    <p className="text-gray-400 text-sm mt-2">약 30~60초가 소요됩니다.</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2" data-html2canvas-ignore>
                <div className="flex gap-2">
                  <button onClick={resetApp} className="flex-1 py-3 text-gray-500 border border-gray-800 rounded-xl hover:bg-gray-800 text-sm">다시하기</button>
                  {critiqueState.data && (
                    <button onClick={handleDownloadResult} className="flex-1 py-3 text-blue-400 border border-blue-900/30 rounded-xl hover:bg-blue-900/20 text-sm">📥 결과 저장</button>
                  )}
                </div>
                {critiqueState.data && videoState.status === 'idle' && (
                  <button onClick={handleGenerateVideo} className="w-full py-4 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 rounded-xl text-purple-200 font-bold">🎬 패션왕 인정 영상 만들기</button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {critiqueState.loading && (
                <div className="flex-1 bg-[#1a1a1e] rounded-2xl p-8 flex flex-col items-center justify-center space-y-4">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  <p className="text-gray-400">AI가 스타일을 정밀 분석 중입니다...</p>
                </div>
              )}
              {critiqueState.data && (
                <div className="flex-1 space-y-5 animate-fadeIn">
                  <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-gray-800">
                    <h2 className="text-gray-400 text-sm font-bold uppercase mb-2">Total Score</h2>
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-7xl font-display font-bold text-blue-400">{critiqueState.data.totalScore}</span>
                      <span className="text-xl text-gray-600">/ 100</span>
                    </div>
                    <div className="text-lg font-medium text-white pl-4 border-l-2 border-white/20">"{critiqueState.data.oneLiner}"</div>
                    <div className="mt-6 space-y-2">
                      {renderDetailBar('분위기', critiqueState.data.details.face)}
                      {renderDetailBar('색감', critiqueState.data.details.color)}
                      {renderDetailBar('비율', critiqueState.data.details.ratio)}
                      {renderDetailBar('조합', critiqueState.data.details.combination)}
                      {renderDetailBar('아이템', critiqueState.data.details.item)}
                    </div>
                  </div>
                  <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-gray-800">
                    <h3 className="text-lg font-bold text-white mb-3">AI 분석</h3>
                    <p className="text-gray-300 leading-relaxed text-[15px]">{critiqueState.data.gentleCritique}</p>
                  </div>
                  <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-red-900/30 relative overflow-hidden">
                    <h3 className="text-lg font-bold text-red-400 mb-3">AI의 솔직한 분석</h3>
                    <div className="relative min-h-[100px]">
                      <p className={`text-gray-300 leading-relaxed text-[15px] transition-all duration-700 ${showSpicy ? '' : 'blur-lg opacity-30 select-none'}`}>{critiqueState.data.sincereCritique}</p>
                      {!showSpicy && (
                        <div className="absolute inset-0 flex items-center justify-center" data-html2canvas-ignore>
                          <button onClick={() => setShowSpicy(true)} className="bg-red-500/10 text-red-400 font-bold py-2 px-5 rounded-full border border-red-500/50 hover:bg-red-500/20 transition-all">후기 보기 (매운맛)</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;