import React from 'react';

interface LoadingOverlayProps {
  message: string;
  subMessage?: string;
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message, subMessage }) => {
  return (
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-3xl flex flex-col items-center justify-center z-20 p-6 text-center">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute top-0 left-0 w-full h-full border-4 border-neon-blue rounded-full opacity-25 animate-ping"></div>
        <div className="absolute top-0 left-0 w-full h-full border-4 border-t-neon-pink border-r-neon-blue border-b-neon-purple border-l-transparent rounded-full animate-spin"></div>
      </div>
      <h3 className="text-2xl font-display text-white mb-2 animate-pulse">{message}</h3>
      {subMessage && <p className="text-gray-400 font-fun text-lg">{subMessage}</p>}
    </div>
  );
};

export default LoadingOverlay;