import React, { useState, useRef } from 'react';
import { analyzeFashion } from './services/geminiService';
import { CritiqueResult, ImageFile } from './types';

const App: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  
  // State for revealing spicy content
  const [showSpicy, setShowSpicy] = useState(false);

  const [critiqueState, setCritiqueState] = useState<{
    loading: boolean;
    data: CritiqueResult | null;
    error: string | null;
  }>({ loading: false, data: null, error: null });

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setShowSpicy(false);
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleStartProcess = async () => {
    if (!selectedImage) return;

    // 1. Start Analysis
    setCritiqueState({ loading: true, data: null, error: null });
    
    // Execute Analysis
    analyzeFashion(selectedImage.base64Data, selectedImage.mimeType)
      .then(result => {
        setCritiqueState({ loading: false, data: result, error: null });
      })
      .catch(err => {
        setCritiqueState({ loading: false, data: null, error: "분석 실패... AI가 도망갔나봐." });
      });
  };

  const resetApp = () => {
    setSelectedImage(null);
    setCritiqueState({ loading: false, data: null, error: null });
    setShowSpicy(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderScoreColor = (score: number) => {
    if (score >= 90) return 'text-blue-400';
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-[#111111] text-gray-100 font-sans selection:bg-gray-700 selection:text-white pb-20">
      
      <main className="container mx-auto max-w-5xl px-6 py-12 relative">
        {/* Header */}
        <header className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-display font-bold tracking-tight text-white mb-4">
            패션왕 선별기
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              
              {/* Left Column: Image Only */}
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-[9/16] shadow-2xl ring-1 ring-white/10">
                  <img 
                    src={selectedImage.preview} 
                    alt="Upload" 
                    className="w-full h-full object-cover"
                  />

                  {/* Initial Start Overlay */}
                  {!critiqueState.loading && !critiqueState.data && (
                     <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
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
                </div>
                
                <button 
                  onClick={resetApp}
                  className="w-full py-3 text-gray-500 hover:text-white transition-colors text-sm font-medium flex items-center justify-center gap-2 group"
                >
                  <span className="group-hover:-translate-x-1 transition-transform">←</span> 다른 사진 선택하기
                </button>
              </div>

              {/* Right Column: Critique Analysis */}
              <div className="flex flex-col gap-5">
                
                {/* Critique Loading */}
                {critiqueState.loading && (
                   <div className="flex-1 bg-[#161616] rounded-2xl p-8 border border-gray-800 flex flex-col items-center justify-center text-center animate-pulse">
                     <div className="w-12 h-12 border-4 border-gray-700 border-t-white rounded-full animate-spin mb-6"></div>
                     <p className="text-xl text-white font-medium">분석 중...</p>
                     <p className="text-gray-500 mt-2 text-sm">스타일을 스캔하고 있습니다</p>
                   </div>
                )}

                {/* Critique Content */}
                {critiqueState.data && (
                  <div className="flex-1 space-y-5 animate-fadeIn">
                    {/* Score Card */}
                    <div className="bg-[#1a1a1e] rounded-2xl p-8 border border-gray-800 relative overflow-hidden">
                      <div className="relative z-10">
                        <h2 className="text-gray-400 text-sm font-bold tracking-widest uppercase mb-2">Total Score</h2>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-8xl font-display font-bold ${renderScoreColor(critiqueState.data.score)}`}>
                            {critiqueState.data.score}
                          </span>
                          <span className="text-2xl text-gray-600 font-light">/ 100</span>
                        </div>
                        <div className="mt-6 text-xl font-medium text-white pl-4 border-l-2 border-white/20">
                          "{critiqueState.data.oneLiner}"
                        </div>
                      </div>
                    </div>

                    {/* Gentle Version */}
                    <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-gray-800">
                       <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                         <span className="text-gray-500">☕</span> 
                         <span>종합 평가</span>
                       </h3>
                       <p className="text-gray-300 leading-relaxed text-[15px] whitespace-pre-wrap">
                         {critiqueState.data.gentleCritique}
                       </p>
                    </div>

                    {/* Spicy Version */}
                    <div className="bg-[#1a1a1e] rounded-2xl p-6 border border-red-900/30 relative group overflow-hidden">
                       <h3 className="text-lg font-bold text-red-400 mb-3 flex items-center gap-2">
                         <span>🌶️</span> 
                         <span>AI의 진심</span>
                       </h3>
                       
                       <div className="relative min-h-[100px]">
                         <p className={`text-gray-300 leading-relaxed text-[15px] whitespace-pre-wrap transition-all duration-700 ${showSpicy ? 'blur-0 opacity-100' : 'blur-lg opacity-50 select-none'}`}>
                           {critiqueState.data.sincereCritique}
                         </p>

                         {/* Cover Overlay */}
                         {!showSpicy && (
                           <div className="absolute inset-0 flex items-center justify-center z-10 bg-gradient-to-t from-[#1a1a1e] via-[#1a1a1e]/80 to-transparent">
                             <button 
                              onClick={() => setShowSpicy(true)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-bold py-2 px-5 rounded-full border border-red-500/50 hover:border-red-400 transition-all backdrop-blur-md"
                             >
                               탭하여 확인하기
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