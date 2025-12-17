import React, { useState, useEffect } from 'react';
import { saveApiKey, getApiKey } from '../utils/storage';
import { validateApiKey } from '../services/geminiService';

interface ApiKeySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyUpdate: (hasKey: boolean) => void;
}

const ApiKeySettings: React.FC<ApiKeySettingsProps> = ({ isOpen, onClose, onKeyUpdate }) => {
  const [inputKey, setInputKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      const current = getApiKey();
      if (current) setInputKey(current);
      setStatus('idle');
    }
  }, [isOpen]);

  const handleTestAndSave = async () => {
    if (!inputKey.trim()) return;

    setStatus('testing');
    const isValid = await validateApiKey(inputKey);

    if (isValid) {
      saveApiKey(inputKey);
      setStatus('success');
      onKeyUpdate(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } else {
      setStatus('error');
      onKeyUpdate(false);
    }
  };

  const handleClear = () => {
    saveApiKey('');
    setInputKey('');
    setStatus('idle');
    onKeyUpdate(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#1a1a20] border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold text-white mb-2">API 설정</h2>
        <p className="text-gray-400 text-sm mb-6">
          Google Gemini API 키를 입력해주세요.<br/>
          키는 로컬 브라우저에 암호화되어 저장됩니다.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">API Key</label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => {
                setInputKey(e.target.value);
                setStatus('idle');
              }}
              placeholder="AIzaSy..."
              className="w-full bg-[#111111] border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleTestAndSave}
              disabled={status === 'testing' || !inputKey}
              className={`flex-1 font-bold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2
                ${status === 'success' ? 'bg-green-500 text-white' : 
                  status === 'error' ? 'bg-red-500 text-white' : 
                  'bg-white text-black hover:bg-gray-200'}`}
            >
              {status === 'testing' && <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>}
              {status === 'idle' && '연결 테스트 및 저장'}
              {status === 'testing' && '연결 확인 중...'}
              {status === 'success' && '연결 성공!'}
              {status === 'error' && '연결 실패 (키 확인 필요)'}
            </button>
            
            <button
              onClick={handleClear}
              className="px-4 py-3 rounded-lg border border-gray-700 text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
              title="키 삭제"
            >
              🗑️
            </button>
          </div>
          
          <div className="text-center mt-4">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs text-blue-400 hover:underline"
            >
              API Key 발급받기 →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;