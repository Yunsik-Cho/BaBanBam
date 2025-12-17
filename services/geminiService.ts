import { GoogleGenAI, Type, Schema } from "@google/genai";
import { CritiqueResult } from "../types";
import { getApiKey } from "../utils/storage";

// Helper to get a fresh instance with the stored key
const getAIClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in settings.");
  }
  return new GoogleGenAI({ apiKey });
};

// Test function to validate API Key
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Simple generation task to test auth
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
      totalScore: { type: Type.NUMBER, description: "Total score 0-100 (precise integer, e.g. 73, 82)" },
      details: {
        type: Type.OBJECT,
        properties: {
            face: { type: Type.NUMBER, description: "Score for Vibe/Grooming (0-100)" },
            color: { type: Type.NUMBER, description: "Score for Color Matching (0-100)" },
            ratio: { type: Type.NUMBER, description: "Score for Silhouette/Ratio (0-100)" },
            combination: { type: Type.NUMBER, description: "Score for Outfit Combination (0-100)" },
            item: { type: Type.NUMBER, description: "Score for Item Selection (0-100)" }
        },
        required: ["face", "color", "ratio", "combination", "item"]
      },
      gentleCritique: { type: Type.STRING, description: "Polite, objective fashion advice in formal Korean" },
      sincereCritique: { type: Type.STRING, description: "Highly formal, sarcastic review praising bad choices as philosophical achievements" },
      oneLiner: { type: Type.STRING, description: "A short, impactful summary sentence" }
    },
    required: ["totalScore", "details", "gentleCritique", "sincereCritique", "oneLiner"]
  };

  const prompt = `
    이 사람의 전신 사진을 보고 패션을 평가해줘. 
    
    [중요: 점수 측정 기준]
    - 절대 5점 단위(80, 85, 90)로 뭉뚱그리지 마.
    - 1점 단위로 아주 정밀하고 냉정하게 측정해 (예: 72, 84, 91, 13, 47).
    - AI가 아닌 인간 전문가가 채점하듯 불규칙한 숫자를 사용해.

    1. 평가 항목 (0~100점) - 1점 단위 정밀 측정:
       - **Total Score**: 종합 점수.
       - **Face**: 분위기, 관리 상태, 헤어스타일의 조화.
       - **Color**: 색감 매치 및 톤.
       - **Ratio**: 비율 및 핏.
       - **Combination**: 상하의 및 액세서리 조합.
       - **Item**: 아이템 선정 센스.

    2. gentleCritique (순한맛 - AI 분석):
       - 정중하고 전문적인 AI 어시스턴트의 톤(해요체).
       - 객관적인 스타일 분석과 실질적인 조언.

    3. sincereCritique (AI의 진심 - 격식 있는 고도의 조롱):
       - **페르소나**: 기이한 현상을 목격하고 이를 엄숙하게 기록/평가하는 **'냉소적인 사가(史家)'**.
       - **톤앤매너**: "~하시어", "~함을 높이 사", "~인정하게 되었습니다", "~경의를 표합니다" 같은 극도로 격식 있고 장엄한 문체 사용.
       - **작성 전략**: '상장'이나 '공로패'를 수여한다는 말은 빼고, **그저 그 사실을 웅장하게 서술하여 비꼬아라.** 단점을 치명적인 철학적 시도인 양 포장해.
         - 엉망인 코디 -> "누구도 시도하지 않을 독보적인 길을 개척하시어"
         - 촌스러운 색감 -> "시공간을 초월한 레트로 감각으로 타인의 시신경을 압도하시어"
         - 핏이 이상함 -> "인체 비례에 대한 고정관념을 과감히 타파하시어"
       - **필수 포함 뉘앙스**: 
         "굳이 하지 않아도 될 시도를 함으로써 타인에게 부담을 주었다", 
         "결과는 보는 이들이 각자 감당해야 한다",
         "귀하의 고집과 독보적인 세계관은 아무도 꺾을 수 없다"
       - **예시**:
         "귀하께서는 시공간의 제약을 초월하여 언제 어디서든 혼자만의 드레스 코드를 완성하셨습니다. 그 독보적인 난해함 덕분에 타인의 시선은 놀람을 넘어 경외로 가득 찼으며, ‘도전은 자유, 결과는 각자 감당’이라는 패션 철학을 널리 전파하신 바, 이에 그 경이로운 용기와 꾸준한 자기 만족에 깊은 탄식을 보냅니다."

    [공통]
    - 한줄평(oneLiner): 짧고 굵게 뼈를 때리는 한마디 (비유적 표현 활용).
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
        systemInstruction: "You are a fashion critic. Provide scores in precise 1-point increments. For sincereCritique, use a highly formal, bureaucratic style to sarcastically praise bad fashion choices without explicitly mentioning an award/plaque."
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

  // Veo prompt updated for strict facial identity and short duration
  const prompt = `A short 5-second cinematic video of the exact person provided in the image.
  The person crosses their arms confidently, looks directly at the camera with a cool expression, and nods slowly in approval.
  IMPORTANT: Preserve the facial features, identity, hairstyle, and outfit details EXACTLY as they appear in the original image. Do not change the face.
  Photorealistic, high quality, consistent lighting.`;

  try {
    // Switch to High Quality model (Veo 3.1)
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: prompt,
      image: {
        imageBytes: base64Image,
        mimeType: mimeType,
      },
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '9:16' // Portrait for fashion vibes
      }
    });

    // Poll for completion - High quality model takes longer
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds for HQ model
      operation = await ai.operations.getVideosOperation({operation: operation});
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) {
      throw new Error("Failed to generate video URI");
    }

    // Fetch the video content using the API key to create a local blob URL
    // This avoids CORS/Auth issues when putting the raw URI in a video tag
    const response = await fetch(`${videoUri}&key=${apiKey}`);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Video generation failed", error);
    throw error;
  }
};