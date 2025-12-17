export interface CritiqueResult {
  totalScore: number;
  details: {
    face: number; // 얼굴/분위기
    color: number; // 색감
    ratio: number; // 비율
    combination: number; // 조합
    item: number; // 아이템
  };
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