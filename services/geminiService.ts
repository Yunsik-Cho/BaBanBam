// @ts-ignore
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CritiqueResult } from "../types";
import { getApiKey } from "../utils/storage";

const getAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in settings.");
  }
  return new GoogleGenAI({ apiKey });
};

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: "Hello" }] }
    });
    return true;
  } catch (error) {
    console.error("API Key validation failed:", error);
    return false;
  }
};

export const analyzeFashion = async (base64Image: string, mimeType: string): Promise<CritiqueResult> => {
  const ai = getAIClient();
  
  const schema: Schema = {
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
  - 상대방의 노력을 비웃고, 감히 이런 옷을 입고 사진을 찍었다는 사실 자체를 조롱하세요.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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

    if (response.text) {
      return JSON.parse(response.text) as CritiqueResult;
    }
    throw new Error("No response text");
  } catch (error) {
    console.error("Fashion analysis failed", error);
    throw error;
  }
};

export const generateNoddingVideo = async (base64Image: string, mimeType: string): Promise<string> => {
  const ai = getAIClient();
  const apiKey = getApiKey();

  const prompt = `A highly realistic 5-second cinematic video. 
  The person from the source image starts by performing a deep, respectful 90-degree belly button bow (traditional Asian respectful bow). 
  Immediately after the bow, they stand up and walk naturally and confidently forward towards the camera. 
  As they reach a medium distance, they stop, cross their arms confidently over their chest, and give a slow, firm, and proud nod of approval while looking directly into the camera lens with a subtle smile. 
  The person's face, hair, and entire outfit must remain 100% identical to the source photo. 
  Consistent background, high-quality cinematic lighting, photorealistic 4k rendering.`;

  try {
    // @ts-ignore
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
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
      await new Promise(resolve => setTimeout(resolve, 5000));
      // TypeScript 빌드 에러(TS2345) 방지를 위해 any 캐스팅 사용
      operation = await (ai.operations as any).getVideosOperation({ operation: operation });
      
      if (operation.error) {
        throw new Error(operation.error.message || "영상 생성 실패");
      }
    }

    const downloadLink = (operation as any).response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) {
      throw new Error("영상이 생성되었으나 주소를 가져올 수 없습니다.");
    }

    const response = await fetch(`${downloadLink}&key=${apiKey}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Requested entity was not found. API Key 권한이나 프로젝트 설정을 확인해주세요.");
      }
      throw new Error(`영상 다운로드 실패: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error: any) {
    console.error("Video generation error:", error);
    throw error;
  }
};