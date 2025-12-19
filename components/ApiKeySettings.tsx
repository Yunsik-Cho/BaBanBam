
import React from 'react';

/**
 * This component is deprecated. 
 * API key management is now handled through the window.aistudio global integration 
 * as required by the application guidelines for Veo and Gemini models.
 */
const ApiKeySettings: React.FC<{ isOpen: boolean; onClose: () => void; onKeyUpdate: (hasKey: boolean) => void }> = () => {
  return null;
};

export default ApiKeySettings;
