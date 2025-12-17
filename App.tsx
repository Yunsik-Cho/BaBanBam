import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { analyzeFashion, generateNoddingVideo } from './services/geminiService';
import { CritiqueResult, ImageFile, VideoGenerationState } from './types';
import ApiKeySettings from './components/ApiKeySettings';
import { hasStoredKey } from './utils/storage';

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // State for revealing spicy content
  const [showSpicy, setShowSpicy] = useState(false);

  const [critiqueState, setCritiqueState] = useState<{
    loading: boolean;
    data: CritiqueResult | null;
    error: string | null;
  }>({ loading: false, data: null, error: null });

  // Video Generation State
  const [videoState, setVideoState] = useState<VideoGenerationState>({
    status: 'idle',
    url: null
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHasApiKey(hasStoredKey());
  }, []);

  // Auto-save logic: Triggered when analysis data is available
  useEffect(() => {
    if (critiqueState.data && resultRef.current) {
      const captureAndSave = async () => {
        try {
          // Wait for DOM animations and images to settle (1.5s)
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          if (!resultRef.current) return;

          // Capture the result container
          const canvas = await html2canvas(resultRef.current, {
            useCORS: true,
            backgroundColor: '#111111',
            scale: 2 // High resolution
          });
          
          // Use JPEG for cloud storage to optimize size
          const base64Image = canvas.toDataURL('image/jpeg', 0.9);
          
          await saveToCloud({ image: base64Image });
        } catch (e) {
          console.error("Auto-save failed", e);
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
        // Extract pure Base64
        const base64Data = result.split(',')[1];
        
        setSelectedImage({
          file,
          preview: result,
          base64Data,
          mimeType: file.type
        });
        
        // Reset states
        setCritiqueState({ loading: false, data: null, error: null });
        setVideoState({ status: 'idle', url: null });
        setShowSpicy(false);
      };
      
      reader.readAsDataURL(file);
    }
  };

  const saveToCloud = async (payload: { image?: string; video?: string }) => {
    try {
      // Auto-save to Vercel Blob
      await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          timestamp: Date.now()
        })
      });
      console.log('Media auto-saved to cloud');
    } catch (e) {
      // Fail silently if API is not available (e.g. local dev without vercel)
      console.warn('Auto-save failed (API might be unavailable)');
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

    // 1. Start Analysis
    setCritiqueState({ loading: true, data: null, error: null });
    setVideoState({ status: 'idle', url: null });
    
    // Execute Analysis
    analyzeFashion(selectedImage.base64Data, selectedImage.mimeType)
      .then(result => {
        setCritiqueState({ loading: false, data: result, error: null });
        // Auto-save is now handled by useEffect
      })
      .catch(err => {
        const errorMsg = err.message?.includes("API Key") 
          ? "API 키를 확인해주세요." 
          : "분석 실패... AI가 도망갔나봐.";
        setCritiqueState({ loading: false, data: null, error: errorMsg });
      });
  };

  const handleGenerateVideo = async () => {
    if (!selectedImage) return;

    setVideoState({ status: 'generating', url: null });

    try {
      const videoUrl = await generateNoddingVideo(selectedImage.base64Data, selectedImage.mimeType);
      setVideoState({ status: 'completed', url: videoUrl });

      // Auto-save video logic
      try {
        const base64Video = await blobUrlToBase64(videoUrl);
        await saveToCloud({ video: base64Video });
      } catch (saveErr) {
        console.warn("Video auto-save failed", saveErr);
      }
      
    } catch (error: any) {
      console.error("Video generation failed", error);
      let errorMsg = "영상 생성 실패";
      if (error.message.includes("429")) errorMsg = "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";
      if (error.message.includes("403")) errorMsg = "API 키 권한을 확인해주세요 (Billing 설정 필요).";
      setVideoState({ status: 'error', url: null, error: errorMsg });
    }
  };

  const handleDownloadResult = async () => {
    if (!resultRef.current) return;

    try {
      const canvas = await html2canvas(resultRef.current, {
        useCORS: true,
        backgroundColor: '#111111', // Match background
        scale: 2 // High res
      });

      const link = document.createElement('a');
      link.download = `fashion-king-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error("Failed to capture image", err);
      alert("이미지 저장에 실패했습니다.");
    }
  };

  const resetApp = () => {
    setSelectedImage(null);
    setCritiqueState({ loading: false, data: null, error: null });
    setVideoState({ status: 'idle', url: null });
    setShowSpicy(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderScoreColor = (score: number) => {
    if (score >= 90) return 'text-blue-400';
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const renderDetailBar = (label: string, score: number) => (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400 font-medium">{label}</span>
        <span className={`font-bold ${renderScoreColor(score)}`}>{score}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ease-out ${
            score >= 90 ? 'bg-blue-500' :
            score >= 70 ? 'bg-green-500' :
            score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111111] text-gray-100 font-sans selection:bg-gray-700 selection:text-white pb-20">
      <ApiKeySettings 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        onKeyUpdate={(exists) => setHasApiKey(exists)}
      />

      <nav className="absolute top-0 right-0 p-6 z-20">
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className={`p-3 rounded-full transition-all border ${hasApiKey ? 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white' : 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20'}`}
          title="API 설정"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!hasApiKey && (
            <span className="absolute top-2 right-2 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </button>
      </nav>

      <main className="container mx-auto max-w-5xl px-6 py-12 relative">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-white mb-4">
            바보이반 패션왕 분석기
          </h1>
          <p className="text-gray-400 text-lg font-light">AI가 분석하는 당신의 스타일 레벨</p>
        </header>

        {/* Main Content Area */}
        <div className="transition-all duration-700 opacity-100 translate-y-0">
          
          {/* Upload Section */}
          {!selectedImage && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-700 hover:border-gray-500 hover:bg-[#1a1a1a] rounded-2xl h-[400px] flex flex-col items-center justify-center cursor-pointer transition-all duration-300 group bg-[#161616]"
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
              <div className="text-6xl mb-6 text-gray-600 group-hover:text-gray-400 transition-colors">📸</div>
              <p className="text-3xl font-display text-gray-300 group-hover:text-white transition-colors">
                사진 업로드
              </p>
              <p className="mt-3 text-gray-500 font-light">전신이 잘 나온 사진을 선택해주세요</p>
            </div>
          )}

          {/* Result Section */}
          {selectedImage && (
            <div ref={resultRef} className="grid grid-cols-1 lg:grid-cols-2 gap-10 p-4 rounded-3xl bg-[#111111]">
              
              {/* Left Column: Image Only */}
              <div className="space-y-4">
                {/* Changed: Removed aspect-[9/16] and object-cover to respect image ratio */}
                <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 group">
                  
                  {/* Display Image or Video */}
                  {videoState.status === 'completed' && videoState.url ? (
                     <video 
                       src={videoState.url} 
                       autoPlay 
                       loop 
                       playsInline 
                       controls
                       className="w-full h-auto block"
                     />
                  ) : (
                    <img 
                      src={selectedImage.preview} 
                      alt="Upload" 
                      className="w-full h-auto block"
                    />
                  )}

                  {/* Initial Start Overlay */}
                  {!critiqueState.loading && !critiqueState.data && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]" data-html2canvas-ignore>
                       <button 
                        onClick={handleStartProcess}
                        className="bg-white text-black text-xl font-bold py-4 px-10 rounded-full hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] border border-transparent hover:border-white/50"
                       >
                         측정하기
                       </button>
                     </div>
                  )}
                  
                  {/* Loading overlay for image side during critique */}
                  {critiqueState.loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                      <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                    </div>
                  )}

                   {/* Video Generating Overlay */}
                   {videoState.status === 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-6 text-center">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-white font-bold text-lg animate-pulse">패션왕 인증 영상 생성 중...</p>
                      <p className="text-gray-400 text-sm mt-2">
                        Veo 3.1 (고화질) 모델이 영상을 만들고 있습니다.<br/>
                        (약 3~5분 정도 소요됩니다. 조금만 기다려주세요!)
                      </p>
                    </div>
                  )}

                  {/* Video Error Overlay */}
                  {videoState.status === 'error' && (
                     <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 p-6 text-center">
                       <div className="text-4xl mb-2">⚠️</div>
                       <p className="text-red-400 font-bold mb-2">{videoState.error}</p>
                       <button 
                         onClick={() => setVideoState({status: 'idle', url: null})}
                         className="text-gray-400 hover:text-white underline text-sm"
                       >
                         닫기
                       </button>
                     </div>
                  )}
                </div>
                
                <div className="flex flex-col gap-2" data-html2canvas-ignore>
                  <div className="flex gap-2">
                    <button 
                      onClick={resetApp}
                      className="flex-1 py-3 text-gray-500 hover:text-white transition-colors text-sm font-medium flex items-center justify-center gap-2 group border border-gray-800 rounded-xl hover:bg-gray-800"
                    >
                      <span className="group-hover:-translate-x-1 transition-transform">←</span> 다시하기
                    </button>
                    {critiqueState.data && (
                      <button 
                        onClick={handleDownloadResult}
                        className="flex-1 py-3 text-blue-400 hover:text-blue-300 transition-colors text-sm font-medium flex items-center justify-center gap-2 group border border-blue-900/30 rounded-xl hover:bg-blue-900/20"
                      >
                        <span>📥</span> 결과 저장
                      </button>
                    )}
                  </div>

                  {/* Create Video Button - Only Show when critique is done and video is not yet created */}
                  {critiqueState.data && videoState.status === 'idle' && (
                    <button
                      onClick={handleGenerateVideo}
                      className="w-full py-4 bg-gradient-to-r from-purple-900/40 to-blue-900/40 border border-purple-500/30 hover:border-purple-500/60 rounded-xl text-purple-200 font-bold flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                    >
                      <span>🎬</span> 패션왕 인정 영상 만들기 (Veo 3.1 HQ)
                    </button>
                  )}
                </div>
              </div>

              {/* Right Column: Critique Analysis */}
              <div className="flex flex-col gap-5">
                
                {/* Critique Loading */}
                {critiqueState.loading && (
                   <div className="flex-1 bg-[#161616] rounded-2xl p-8 border border-gray-800 flex flex-col items-center justify-center text-center animate-pulse">
                     <div className="w-12 h-12 border-4 border-gray-700 border-t-white rounded-full animate-spin mb-6"></div>
                     <p className="text-xl text-white font-medium">분석 중...</p>
                     <p className="text-gray-500 mt-2 text-sm">스타일을 정밀 스캔하고 있습니다<br/>(얼굴, 색감, 비율, 조합, 아이템)</p>
                   </div>
                )}

                {/* Critique Content */}
                {critiqueState.data && (
                  <div className="flex-1 space-y-5 animate-fadeIn">
                    
                    {/* Main Score Card with Details */}
                    <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-gray-800 relative overflow-hidden">
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Total Score */}
                        <div className="flex-1 flex flex-col justify-center items-center md:items-start">
                           <h2 className="text-gray-400 text-sm font-bold tracking-widest uppercase mb-2">Total Score</h2>
                           <div className="flex items-baseline gap-2 mb-4">
                             <span className={`text-7xl font-display font-bold ${renderScoreColor(critiqueState.data.totalScore)}`}>
                               {critiqueState.data.totalScore}
                             </span>
                             <span className="text-xl text-gray-600 font-light">/ 100</span>
                           </div>
                           <div className="text-lg font-medium text-white pl-4 border-l-2 border-white/20 w-full">
                             "{critiqueState.data.oneLiner}"
                           </div>
                        </div>

                        {/* Detail Scores */}
                        <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-700 pt-4 md:pt-0 md:pl-6 grid grid-cols-1 gap-1">
                           {renderDetailBar('분위기 / 관리', critiqueState.data.details.face)}
                           {renderDetailBar('색감 / 톤', critiqueState.data.details.color)}
                           {renderDetailBar('비율 / 핏', critiqueState.data.details.ratio)}
                           {renderDetailBar('아이템 조합', critiqueState.data.details.combination)}
                           {renderDetailBar('아이템 선정', critiqueState.data.details.item)}
                        </div>
                      </div>
                    </div>

                    {/* Gentle Version */}
                    <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-gray-800">
                       <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                         <span className="text-gray-500">🤖</span> 
                         <span>AI 분석</span>
                       </h3>
                       <p className="text-gray-300 leading-relaxed text-[15px] whitespace-pre-wrap">
                         {critiqueState.data.gentleCritique}
                       </p>
                    </div>

                    {/* Spicy Version */}
                    <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-red-900/30 relative group overflow-hidden">
                       <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                         <span>💬</span> 
                         <span>AI의 솔직한 분석 후기</span>
                       </h3>
                       
                       <div className="relative min-h-[100px]">
                         <p className={`text-gray-300 leading-relaxed text-[15px] whitespace-pre-wrap transition-all duration-700 ${showSpicy ? 'blur-0 opacity-100' : 'blur-lg opacity-50 select-none'}`}>
                           {critiqueState.data.sincereCritique}
                         </p>

                         {/* Cover Overlay */}
                         {!showSpicy && (
                           <div className="absolute inset-0 flex items-center justify-center z-10 bg-gradient-to-t from-[#1a1a1e] via-[#1a1a1e]/80 to-transparent" data-html2canvas-ignore>
                             <button 
                              onClick={() => setShowSpicy(true)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold py-2 px-5 rounded-full border border-red-500/50 hover:border-red-400 transition-all backdrop-blur-md"
                             >
                               후기 보기
                             </button>
                           </div>
                         )}
                       </div>
                    </div>
                  </div>
                )}
                
                {!critiqueState.loading && !critiqueState.data && !selectedImage && (
                  <div className="flex-1 bg-[#161616] rounded-2xl p-8 border border-gray-800 flex items-center justify-center text-gray-600 text-lg">
                    사진을 업로드하면 분석이 시작됩니다
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;