import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is not defined in environment variables.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export interface AnalysisResult {
  diseaseName: string;
  scientificName: string;
  confidence: number;
  description: string;
  proactiveAdvice: string;
  steps: string[];
  severity: number;
  error?: string;
}

export async function analyzeLeaf(base64Image: string): Promise<AnalysisResult> {
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please configure it in the Secrets panel.");
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: "Sen Karadeniz bölgesi tarımı (özellikle fındık ve çay) konusunda uzman bir bitki patoloğusun. Bu yaprak fotoğrafını analiz et. Herhangi bir hastalık veya anormallik tespit et. Yanıtı şu JSON formatında ver: { diseaseName: string (Türkçe), scientificName: string, confidence: number (0-100), description: string (Türkçe), proactiveAdvice: string (Türkçe), steps: string[] (Türkçe), severity: number (1-5) }. Eğer görsel bir yaprak değilse veya analiz edilemiyorsa, 'error' alanı içeren bir JSON döndür.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            diseaseName: { type: Type.STRING },
            scientificName: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            description: { type: Type.STRING },
            proactiveAdvice: { type: Type.STRING },
            steps: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            severity: { type: Type.NUMBER },
            error: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text || "{}";
    const result = JSON.parse(text);
    if (result.error) {
      throw new Error(result.error);
    }
    return result;
  } catch (error: any) {
    console.error("Gemini analysis error:", error?.message || String(error));
    throw error;
  }
}
