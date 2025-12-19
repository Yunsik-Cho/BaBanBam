
import React, { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { analyzeFashion, generateNoddingVideo } from './services/geminiService';
import { CritiqueResult, ImageFile, VideoGenerationState } from './types';

// process.env.API_KEY 접근을 위한 선언, test
declare var process: { env: { API_KEY: string } };

const NAME_MAPPING: Record<string, number> = {
  '안치훈': 1, '김성민': 2, '김성휘': 3, '김태호': 4, '김태훈': 5,
  '박영민': 6, '박준형': 7, '변정욱': 8, '송현섭': 9, '신준휘': 10,
  '이민재': 11, '전시완': 12, '조윤식': 13, '김상우': 14
};

const App: React.FC = () => {
  const [userName, setUserName] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
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
  const critiquePanelRef = useRef<HTMLDivElement>(null);

  const sortedNames = Object.keys(NAME_MAPPING).sort((a, b) => a.localeCompare(b, 'ko'));

  /**
   * 이미지를 2:3 비율로 크롭
   */
  const cropToAspect = async (base64: string, aspectW: number, aspectH: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject('Canvas context not found'); return; }

        const targetAspect = aspectW / aspectH;
        const sourceAspect = img.width / img.height;

        let sW, sH, sX, sY;
        if (sourceAspect > targetAspect) {
          sH = img.height;
          sW = sH * targetAspect;
          sX = (img.width - sW) / 2;
          sY = 0;
        } else {
          sW = img.width;
          sH = sW / targetAspect;
          sX = 0;
          sY = 0; 
        }

        canvas.width = 800; 
        canvas.height = 1200;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, sX, sY, sW, sH, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = base64;
    });
  };

  /**
   * 결과를 클라우드(Vercel Blob)에 자동 저장
   */
  const saveToCloud = async (payload: { image?: string; video?: string; type: 'upper_body' | 'result' | 'video' }) => {
    const trimmedName = userName.trim();
    if (!trimmedName || !NAME_MAPPING[trimmedName]) return;
    
    try {
      await fetch('/api/save-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...payload, 
          userId: NAME_MAPPING[trimmedName], 
          type: payload.type 
        })
      });
    } catch (e) { 
      console.warn('Auto-save failed', e); 
    }
  };

  /**
   * 분석 결과가 나오면 자동으로 캡처하여 저장 시퀀스 실행
   */
  useEffect(() => {
    if (critiqueState.data && critiquePanelRef.current && selectedImage) {
      const captureAndSave = async () => {
        try {
          const originalSpicy = showSpicy;
          setShowSpicy(true); // 캡처를 위해 잠시 보이기
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          if (!critiquePanelRef.current) return;
          
          // 1. 상반신 크롭 이미지 저장
          const croppedBase64 = await cropToAspect(selectedImage.preview, 2, 3);
          await saveToCloud({ image: croppedBase64, type: 'upper_body' });

          // 2. 전체 결과지 캡처
          const canvas = await html2canvas(critiquePanelRef.current, {
            useCORS: true,
            backgroundColor: '#111111',
            scale: 2,
            logging: false,
          });
          
          const resultBase64 = canvas.toDataURL('image/jpeg', 0.85);
          await saveToCloud({ image: resultBase64, type: 'result' });
          
          setShowSpicy(originalSpicy); // 원래 상태로 복구
        } catch (e) { 
          console.error("Auto-save sequence failed", e); 
        }
      };
      captureAndSave();
    }
  }, [critiqueState.data, selectedImage, userName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        const base64Data = result.split(',')[1];
        setSelectedImage({ file, preview: result, base64Data, mimeType: file.type });
        setCritiqueState({ loading: false, data: null, error: null });
        setVideoState({ status: 'idle', url: null });
        setShowSpicy(false);
      };
      reader.readAsDataURL(file);
    }
  };

  /**
   * API Key 존재 여부를 견고하게 확인합니다.
   */
  const ensureApiKey = async () => {
    const envKey = process.env.API_KEY;
    // Vite define에 의해 "undefined" 문자열이 들어올 수 있음을 방지
    if (envKey && envKey !== "undefined" && envKey !== "") {
      return;
    }

    // @ts-ignore
    if (window.aistudio) {
      // @ts-ignore
      if (!(await window.aistudio.hasSelectedApiKey())) {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      }
      return;
    }

    throw new Error("API Key가 설정되지 않았습니다. Vercel 환경 변수 설정을 완료해주세요.");
  };

  const handleStartProcess = async () => {
    if (!selectedImage) return;
    
    setCritiqueState({ loading: true, data: null, error: null });
    setVideoState({ status: 'idle', url: null });

    try {
      await ensureApiKey();
      const result = await analyzeFashion(selectedImage.base64Data, selectedImage.mimeType);
      setCritiqueState({ loading: false, data: result, error: null });
    } catch (err: any) {
      console.error("Process failed:", err);
      setCritiqueState({ loading: false, data: null, error: err.message || "분석 실패" });
    }
  };

  const handleGenerateVideo = async () => {
    if (!selectedImage) return;
    
    setVideoState({ status: 'generating', url: null });
    try {
      await ensureApiKey();
      const croppedBase64WithHeader = await cropToAspect(selectedImage.preview, 2, 3);
      const croppedBase64 = croppedBase64WithHeader.split(',')[1];

      const videoUrl = await generateNoddingVideo(croppedBase64, 'image/jpeg');
      setVideoState({ status: 'completed', url: videoUrl });
      
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          saveToCloud({ video: reader.result as string, type: 'video' });
        }
      };
      reader.readAsDataURL(blob);
    } catch (error: any) {
      console.error("Video generation failed:", error);
      setVideoState({ status: 'error', url: null, error: error.message || "영상 생성 실패" });
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] text-gray-100 font-sans pb-20">
      {!userName && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-6">
          <div className="w-full max-w-lg bg-[#1a1a20] border border-gray-800 rounded-3xl p-8 shadow-2xl">
            <h2 className="text-2xl font-display text-white mb-6 text-center">사용자 본인의 이름을 선택해주세요</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {sortedNames.map(name => (
                <button
                  key={name}
                  onClick={() => setUserName(name)}
                  className="py-3 px-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-[#FC6E22] hover:text-[#FC6E22] transition-all text-sm font-medium"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto max-w-5xl px-6 py-12 relative flex flex-col items-center">
        <header className="text-center mb-10 w-full">
          <div className="inline-block px-4 py-1 rounded-full bg-orange-500/10 text-[#FC6E22] text-xs font-bold mb-4 border border-[#FC6E22]/20 uppercase tracking-widest">
            Welcome, {userName}
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-4">도전 패션왕</h1>
          <button onClick={() => setUserName('')} className="text-gray-600 hover:text-white text-xs underline transition-all">이름 다시 선택</button>
        </header>

        {selectedImage && (
          <div className="w-full flex flex-col items-center gap-10">
            {!critiqueState.data && !critiqueState.loading && (
              <div className="w-full max-w-md relative rounded-3xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10 aspect-[2/3]">
                <img src={selectedImage.preview} alt="Upload" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                  <button onClick={handleStartProcess} className="bg-white text-black text-xl font-bold py-4 px-10 rounded-full shadow-2xl hover:scale-105 transition-transform">측정하기</button>
                </div>
              </div>
            )}

            {critiqueState.loading && (
              <div className="w-full flex flex-col items-center justify-center min-h-[500px] space-y-6">
                <div className="w-16 h-16 border-4 border-white/10 border-t-[#FC6E22] rounded-full animate-spin"></div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-bold text-white">음.. 이럴꺼면..</p>
                  <p className="text-gray-500 font-medium italic">"If I were you.."</p>
                </div>
              </div>
            )}

            {critiqueState.error && (
              <div className="w-full max-w-md bg-red-900/20 border border-red-500/50 rounded-2xl p-6 text-center">
                <p className="text-red-400 font-bold mb-4">{critiqueState.error}</p>
                <button onClick={() => setCritiqueState({loading: false, data: null, error: null})} className="text-white bg-red-500/40 px-6 py-2 rounded-full hover:bg-red-500/60 transition-all">다시 시도</button>
              </div>
            )}

            {critiqueState.data && (
              <div className="flex flex-col items-center gap-8 w-full max-w-3xl">
                <div 
                  ref={critiquePanelRef} 
                  className="w-full bg-[#111111] border border-gray-800/50 shadow-2xl overflow-hidden flex flex-col p-6 md:p-10 justify-center gap-6 min-h-[800px] h-auto"
                >
                  <div className="flex-1 flex flex-col gap-8">
                    <div className="bg-[#1a1a1e] rounded-3xl p-4 border border-gray-800 shadow-xl flex flex-col items-center justify-center w-fit mx-auto px-12">
                      <h2 className="text-gray-500 text-[10px] font-bold uppercase mb-1 tracking-widest">TOTAL SCORE</h2>
                      <div className="flex items-center gap-2">
                        <span className="text-5xl font-display font-bold text-[#FC6E22] leading-none">{critiqueState.data.totalScore}</span>
                        <span className="text-base text-gray-700 font-bold pt-2">/ 100</span>
                      </div>
                    </div>

                    <div className="bg-[#1a1a1e] rounded-3xl p-10 border border-gray-800/50 shadow-lg w-full">
                      <h3 className="text-[11px] font-bold text-[#FC6E22]/80 uppercase mb-5 tracking-widest border-b border-[#FC6E22]/20 pb-2">AI 분석</h3>
                      <p className="text-gray-100 leading-snug text-3xl md:text-4xl font-bold italic">
                        "{critiqueState.data.gentleCritique}"
                      </p>
                    </div>

                    <div className="bg-[#1a1a1e] rounded-3xl p-10 border border-red-900/20 relative overflow-hidden shadow-lg flex-1 flex flex-col min-h-[300px] w-full">
                      <h3 className="text-[11px] font-bold text-red-500/80 uppercase mb-5 tracking-widest border-b border-red-900/20 pb-2">바보이반식 분석</h3>
                      <div className="relative flex-1 flex items-center">
                        <p className={`text-gray-200 leading-relaxed text-2xl md:text-3xl font-bold transition-all duration-700 ${showSpicy ? '' : 'blur-3xl opacity-5 select-none'}`}>
                          {critiqueState.data.sincereCritique}
                        </p>
                        {!showSpicy && (
                          <div className="absolute inset-0 flex items-center justify-center" data-html2canvas-ignore>
                            <button onClick={() => setShowSpicy(true)} className="bg-red-500/10 text-red-400 font-bold py-4 px-10 rounded-full border border-red-500/40 hover:bg-red-500/20 transition-all font-fun text-2xl shadow-2xl">
                              후기 보기 (매운맛)
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-col gap-4" data-html2canvas-ignore>
                  {videoState.status === 'idle' && (
                    <button onClick={handleGenerateVideo} className="w-full py-5 bg-gradient-to-r from-[#FC6E22]/30 to-[#FC6E22]/60 border border-[#FC6E22]/40 rounded-2xl text-white font-bold hover:brightness-125 transition-all text-xl shadow-2xl">
                      🎬 패션왕 인정 영상 만들기
                    </button>
                  )}
                  
                  {videoState.status === 'generating' && (
                    <div className="w-full bg-gray-900/50 rounded-2xl p-8 border border-gray-800 flex flex-col items-center gap-4">
                      <div className="w-10 h-10 border-4 border-[#FC6E22] border-t-transparent rounded-full animate-spin"></div>
                      <div className="text-center">
                        <p className="text-white font-bold text-lg">AI가 당신의 모습을 생생하게 만드는 중...</p>
                        <p className="text-gray-500 text-sm">당신의 패션이 영상으로 완성됩니다.</p>
                      </div>
                    </div>
                  )}

                  {videoState.status === 'completed' && videoState.url && (
                    <div className="w-full bg-gray-900 rounded-2xl p-4 border border-gray-800 shadow-xl">
                       <video src={videoState.url} autoPlay loop playsInline controls className="w-full rounded-xl mb-4 aspect-[9/16] bg-black" />
                       <p className="text-center text-[#FC6E22] font-bold">✨ 패션왕 인정 영상이 생성되었습니다!</p>
                    </div>
                  )}

                  {videoState.status === 'error' && (
                    <div className="w-full bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-center">
                      <p className="text-red-400 font-bold">{videoState.error}</p>
                      <button onClick={handleGenerateVideo} className="mt-2 text-sm underline hover:text-white">다시 시도</button>
                    </div>
                  )}

                  <button onClick={() => { setSelectedImage(null); setCritiqueState({loading: false, data: null, error: null}); setVideoState({status: 'idle', url: null}); }} className="w-full py-4 text-gray-500 border border-gray-800 rounded-xl hover:bg-gray-800 hover:text-white text-base font-medium transition-all">
                    새로운 사진으로 다시하기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedImage && !critiqueState.loading && (
          <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-lg border-2 border-dashed border-gray-700 hover:border-[#FC6E22]/50 hover:bg-[#1a1a1a] rounded-2xl h-[450px] flex flex-col items-center justify-center cursor-pointer bg-[#161616] transition-all shadow-xl group">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <div className="text-7xl mb-6 text-gray-600 group-hover:scale-110 transition-transform">📸</div>
            <p className="text-3xl font-display text-gray-300">전신 사진 업로드</p>
            <p className="text-gray-500 mt-2 font-medium">심사위원들이 당신의 착장을 기다리고 있습니다</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
