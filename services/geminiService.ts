import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CritiqueResult } from "../types";

// Helper to get a fresh instance with the selected key
const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const analyzeFashion = async (base64Image: string, mimeType: string): Promise<CritiqueResult> => {
  const ai = getAIClient();
  
  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      score: { type: Type.NUMBER, description: "Rating out of 100" },
      gentleCritique: { type: Type.STRING, description: "Polite, objective fashion advice in formal Korean (Honorifics)" },
      sincereCritique: { type: Type.STRING, description: "Polite tone (Honorifics) but sarcastic, mocking content with profanity used only as exclamations." },
      oneLiner: { type: Type.STRING, description: "A short, impactful summary sentence" }
    },
    required: ["score", "gentleCritique", "sincereCritique", "oneLiner"]
  };

  const prompt = `
    이 사람의 전신 사진을 보고 패션을 평가해줘. 두 가지 버전의 평가를 작성해야 해.

    1. gentleCritique (순한맛):
    - 예의 바르고 객관적인 톤으로 작성해 (해요체).
    - 비속어 없이 스타일링의 장단점을 전문적으로 분석해줘.
    - 패션 매거진 에디터가 조언해주듯이 부드럽게.

    2. sincereCritique (AI의 진심):
    - **중요**: 말투는 1번(순한맛)과 동일하게 정중하고 교양 있는 존댓말(해요체)을 사용해. 절대 반말을 쓰지 마.
    - 하지만 내용은 상대를 은근히 비웃고, 조롱하고, 돌려 까는 내용이어야 해. "웃으면서 맥이는" 우아한 조롱을 해줘.
    - 욕설(씨*, 존*, 개* 등)은 문장 전체를 지배하지 말고, 감탄사나 추임새로만 짧게 섞어서 사용해. 마치 속마음이 실수로 튀어나온 것처럼.
      (예시: "와... 씨*, 정말 눈을 의심하게 만드는 코디네요.", "개* 놀랍습니다. 어떻게 이런 옷을 고르셨죠?")

    [공통]
    - 점수(score)는 냉정하게 매겨.
    - 한줄평(oneLiner)은 임팩트 있게.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { mimeType, data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        systemInstruction: "You are a fashion critic providing both professional advice and sarcastic, mocking feedback masked in polite language."
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
  
  // Prompt engineered for the specific request: crossed arms, looking forward, nodding.
  // Using Veo fast preview for speed.
  const prompt = "A medium shot of this person crossing their arms confidently, looking directly at the camera, and nodding their head slowly in approval. High quality, realistic texture, cinematic lighting.";

  try {
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      image: {
        imageBytes: base64Image,
        mimeType: mimeType,
      },
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' // Portrait for full body/person shots
      }
    });

    // Polling loop
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Check every 5 seconds
      operation = await ai.operations.getVideosOperation({ operation: operation });
      console.log("Veo status:", operation.metadata);
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("Video generation failed to return a URI.");
    }

    // Append API key for access
    return `${videoUri}&key=${process.env.API_KEY}`;
  } catch (error) {
    console.error("Video generation failed", error);
    throw error;
  }
};