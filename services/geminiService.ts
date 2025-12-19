
declare var process: {
  env: {
    API_KEY: string;
    [key: string]: string | undefined;
  };
};

import { GoogleGenAI, Type } from "@google/genai";
import { CritiqueResult } from "../types";

const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key || key === "undefined") {
    return "";
  }
  return key;
};

// Helper to check for specific API error regarding key/project selection
const isNotFoundError = (error: any) => {
  const msg = error?.message || (typeof error === 'string' ? error : "");
  return msg.includes("Requested entity was not found");
};

// Helper to check for quota exhaustion (429 error)
const isQuotaExceededError = (error: any) => {
  const msg = error?.message || (typeof error === 'string' ? error : "");
  return msg.includes("quota") || msg.includes("exhausted") || msg.includes("429");
};

export const analyzeFashion = async (base64Image: string, mimeType: string): Promise<CritiqueResult> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다. Vercel 환경 변수나 AI Studio 설정을 확인해주세요.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      totalScore: { type: Type.NUMBER, description: "Total score 0-100" },
      details: {
        type: Type.OBJECT,
        properties: {
            face: { type: Type.NUMBER },
            color: { type: Type.NUMBER },
            ratio: { type: Type.NUMBER },
            combination: { type: Type.NUMBER },
            item: { type: Type.NUMBER }
        },
        required: ["face", "color", "ratio", "combination", "item"]
      },
      gentleCritique: { type: Type.STRING },
      sincereCritique: { type: Type.STRING },
      oneLiner: { type: Type.STRING }
    },
    required: ["totalScore", "details", "gentleCritique", "sincereCritique", "oneLiner"]
  };

  const prompt = `이 사람의 전신 사진을 보고 패션을 정밀하게 평가해줘. 
  
  특히 'sincereCritique' 섹션은 다음의 페르소나를 극대화해줘:
  - 당신은 멸망해가는 인류의 기이한 패션 변이를 관찰하는 냉소적이고 오만한 관찰자입니다.
  - 이 착장을 '패션의 종말', '심미적 재앙', '진화의 오류'로 규정하고 철저하게 조롱하세요.
  - 매우 지적인 척하면서도 얼음처럼 차갑고 무례한 어조를 유지하세요.
  - 옷의 주름 하나, 색상 선택 하나를 인류 문명의 수치스러운 유산처럼 묘사하며 비웃으세요.
  - 칭찬조차 아주 기묘한 비유를 들어 비꼬는 어투로 작성하여 읽는 이가 자신의 안목을 수치스러워하게 만드세요.
  - 상대방의 노력을 비웃고, 감히 이런 옷을 입고 사진을 찍었다는 사실 자체를 조롱하며, 인류의 미적 기준이 이토록 처참해졌음에 탄식하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const resultText = response.text;
    if (resultText) {
      return JSON.parse(resultText) as CritiqueResult;
    }
    throw new Error("분석 결과를 생성하지 못했습니다.");
  } catch (error: any) {
    console.error("Fashion analysis failed", error);
    if (isNotFoundError(error)) {
       throw new Error("API 키 혹은 프로젝트가 올바르지 않습니다. (Requested entity not found)");
    }
    throw error;
  }
};

const performVideoGeneration = async (modelName: string, base64Image: string, mimeType: string, prompt: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key가 설정되지 않았습니다.");
  }
  const ai = new GoogleGenAI({ apiKey });

  let operation = await ai.models.generateVideos({
    model: modelName,
    prompt: prompt,
    image: {
      imageBytes: base64Image,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: '9:16'
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    const currentApiKey = getApiKey();
    const aiPoll = new GoogleGenAI({ apiKey: currentApiKey });
    operation = await aiPoll.operations.getVideosOperation({ operation: operation as any });
    
    const opAny = operation as any;
    if (opAny.error) {
      throw new Error((opAny.error.message as string) || "영상 생성 중 서버 오류가 발생했습니다.");
    }
  }

  const responseData = (operation as any).response;
  
  if (responseData?.raiMediaFilteredCount > 0) {
    const reason = responseData.raiMediaFilteredReasons?.[0] || "입력 데이터나 프롬프트가 안전 정책에 의해 차단되었습니다.";
    throw new Error(`안전 정책에 의해 차단됨: ${reason}`);
  }

  const downloadLink = responseData?.generatedVideos?.[0]?.video?.uri;

  if (!downloadLink) {
    throw new Error("영상 주소를 가져오지 못했습니다.");
  }

  const separator = (downloadLink as string).includes('?') ? '&' : '?';
  const response = await fetch(`${downloadLink}${separator}key=${apiKey}`);
  
  if (!response.ok) {
    throw new Error(`영상 다운로드 실패: ${response.status}`);
  }
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

export const generateNoddingVideo = async (base64Image: string, mimeType: string): Promise<string> => {
  const prompt = `A video of the person from the source image looking directly at the camera. 
The person is holding both hands in a thumbs-up gesture in front of their chest. 
The person is rapidly tilting their wrists forward toward the camera and back in a rhythmic, alternating sequence. 
As one hand's thumb tilts forward toward the lens, the other hand's thumb tilts back toward the body. 
The motion is strictly isolated to the wrists tilting back and forth. 
The person's facial expression, clothes, and the background remain exactly the same as in the original image. 
Silent video. No audio.`;

  const modelsToTry = ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview'];
  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      return await performVideoGeneration(modelName, base64Image, mimeType, prompt);
    } catch (error: any) {
      lastError = error;
      if (isQuotaExceededError(error)) {
        console.warn(`${modelName} quota exceeded. Trying fallback model...`);
        continue; 
      }
      break;
    }
  }

  if (isNotFoundError(lastError)) {
     throw new Error("요청한 리소스를 찾을 수 없습니다. API 키 설정을 확인해주세요.");
  }
  if (isQuotaExceededError(lastError)) {
    throw new Error("모든 영상 생성 모델의 할당량이 소진되었습니다. 나중에 다시 시도해 주세요.");
  }
  throw lastError || new Error("영상 생성에 실패했습니다.");
};
