export interface CritiqueResult {
  score: number;
  gentleCritique: string; // Polite, standard language
  sincereCritique: string; // Slang, raw, banmal
  oneLiner: string;
}

export interface VideoGenerationState {
  status: 'idle' | 'generating' | 'completed' | 'error';
  url: string | null;
  error?: string;
}

export interface ImageFile {
  file: File;
  preview: string; // Base64 or Object URL
  base64Data: string; // Pure Base64 data (no prefix)
  mimeType: string;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}