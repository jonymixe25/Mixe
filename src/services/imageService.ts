import { GoogleGenAI } from "@google/genai";

export const generateMixeThumbnail = async (): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: 'A vibrant and attractive live stream thumbnail representing Mixe culture from Oaxaca, Mexico. High-quality digital art style. Features traditional Mixe embroidery patterns (huipil), the beautiful mountains of the Sierra Norte, a musical trumpet or band instrument (traditional Mixe music), and a warm sunset. The composition should be dynamic and suitable for a video preview, with space for text overlays. Cinematic lighting, 16:9 aspect ratio.',
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    return null;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
};
