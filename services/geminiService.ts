import { GoogleGenAI, Type } from "@google/genai";
import { ContentType, DesignElement } from "../types";

// Helper to generate IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export const generateCreativeContent = async (
  prompt: string, 
  mode: 'auto' | 'image' | 'code'
): Promise<DesignElement> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key is missing");

  const ai = new GoogleGenAI({ apiKey });

  // 1. IMAGE MODE
  if (mode === 'image') {
    try {
      // Using Nano Banana (gemini-2.5-flash-image) for image generation
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [{ text: prompt }],
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1", // Default square for cards
          }
        }
      });

      // Extract image
      let imageBase64 = '';
      if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            imageBase64 = part.inlineData.data;
            break;
          }
        }
      }

      if (!imageBase64) {
        throw new Error("No image data returned from model.");
      }

      return {
        id: generateId(),
        type: ContentType.IMAGE,
        content: imageBase64,
        prompt: prompt,
        timestamp: Date.now(),
        title: "Generated Visualization"
      };

    } catch (e) {
      console.error("Image generation failed", e);
      throw e;
    }
  }

  // 2. TEXT/DESIGN MODE (JSON Structured Output)
  // We use gemini-2.5-flash to structure the output
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are a creative design engine called SuperDesign. 
        Your goal is to interpret the user's prompt and generate a creative response.
        
        If the user asks for code, provide valid code.
        If the user asks for a design concept, describe it vividly.
        If the user asks for a list, format it clearly.
        
        You MUST return the response in JSON format matching the schema provided.
        Determine a catchy short 'title' for the content.
        For 'type', choose between 'TEXT' or 'CODE'.
        If it is code, specify the language in metadata.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            type: { type: Type.STRING, enum: ['TEXT', 'CODE'] },
            content: { type: Type.STRING },
            language: { type: Type.STRING, description: "Programming language if type is CODE, else null" }
          },
          required: ['title', 'type', 'content']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response from AI");

    const data = JSON.parse(text);

    return {
      id: generateId(),
      type: data.type === 'CODE' ? ContentType.CODE : ContentType.TEXT,
      content: data.content,
      title: data.title,
      prompt: prompt,
      timestamp: Date.now(),
      metadata: {
        language: data.language || 'text'
      }
    };

  } catch (e) {
    console.error("Text generation failed", e);
     // Fallback if JSON parsing fails or other error
     return {
        id: generateId(),
        type: ContentType.TEXT,
        content: "I couldn't structure the design properly, but I heard you. Please try again.",
        title: "System Message",
        prompt: prompt,
        timestamp: Date.now()
     };
  }
};