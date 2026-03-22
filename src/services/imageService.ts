import { GoogleGenAI } from "@google/genai";

export const generateMixeThumbnail = async (): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    // First, get a descriptive prompt for the image
    const promptResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Genera un prompt detallado en inglés para una imagen que represente la cultura Mixe de Oaxaca, México. Debe incluir elementos como vestimenta tradicional, paisajes de la Sierra Norte, instrumentos musicales de viento o arte textil. El prompt debe ser optimizado para un generador de imágenes.",
    });

    const imagePrompt = promptResponse.text || "A beautiful representation of Mixe culture from Oaxaca, Mexico, featuring traditional textiles and the misty mountains of the Sierra Norte.";

    // Now generate the image
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: imagePrompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        },
      },
    });

    for (const part of imageResponse.candidates[0].content.parts) {
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
