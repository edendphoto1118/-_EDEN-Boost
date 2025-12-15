
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { UploadedImage, GenerationParams, PromptResult } from "../types";

// Helper to check API Key safely
const getAIClient = () => {
  let apiKey = '';
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      apiKey = import.meta.env.VITE_API_KEY || import.meta.env.PUBLIC_API_KEY || import.meta.env.API_KEY || '';
    }
  } catch (e) {}

  if (!apiKey) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.REACT_APP_API_KEY || process.env.API_KEY || '';
      }
    } catch (e) {}
  }

  if (!apiKey) {
    throw new Error(
      "API Key is missing. Please check your environment variables."
    );
  }
  
  return new GoogleGenAI({ apiKey });
};

// Helper: Wait function for retries
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: Resize image (Max 800px for stability)
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; 
        
        if (width > maxDim || height > maxDim) {
           if (width > height) {
             height = Math.round(height * (maxDim / width));
             width = maxDim;
           } else {
             width = Math.round(width * (maxDim / height));
             height = maxDim;
           }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
            resolve(dataUrl.split(',')[1]);
        } else {
            reject(new Error("Canvas context failed"));
        }
      };
      img.onerror = () => reject(new Error("Failed to load image for resizing"));
      img.src = e.target?.result as string;
    };
    reader.onerror = (e) => reject(new Error("File reading failed"));
    reader.readAsDataURL(file);
  });
};

const fileToPart = async (file: File) => {
  try {
      const base64Data = await resizeImage(file);
      return {
          inlineData: {
              data: base64Data,
              mimeType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
          },
      };
  } catch (error) {
      console.error("Image processing error:", error);
      throw new Error("Failed to process image.");
  }
};

const getBestAspectRatio = (width?: number, height?: number): string => {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  const targets = [
    { id: "1:1", val: 1.0 },
    { id: "3:4", val: 0.75 },
    { id: "4:3", val: 1.333 },
    { id: "9:16", val: 0.5625 },
    { id: "16:9", val: 1.777 }
  ];
  return targets.reduce((prev, curr) => {
    return (Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev);
  }).id;
};

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// --- MAIN FUNCTIONS ---

export const optimizeUserPrompt = async (
  inputPrompt: string,
  language: string
): Promise<string> => {
  if (!inputPrompt.trim()) return "";
  try {
    const ai = getAIClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { 
        parts: [{ 
          text: `Refine this architectural idea into a concise visualization prompt (50 words) in ${language}. Input: "${inputPrompt}"` 
        }]
      },
      config: { temperature: 0.7 }
    });
    return response.text?.trim() || inputPrompt;
  } catch (e) {
    return inputPrompt;
  }
};

export const generateArchitecturalPrompt = async (
  sketch: UploadedImage,
  context: UploadedImage | null,
  references: UploadedImage[],
  params: GenerationParams,
  userPrompt: string, 
  onStatusUpdate?: (status: 'analyzing' | 'generating') => void,
  masterStylePrompt?: string
): Promise<PromptResult> => {
  
  const ai = getAIClient();

  // --- Step 1: Text Analysis ---
  if (onStatusUpdate) onStatusUpdate('analyzing');
  
  let optimizedPrompt = "";
  try {
    const textParts = [];
    textParts.push(await fileToPart(sketch.file));
    if (context) textParts.push(await fileToPart(context.file));
    for (const ref of references) textParts.push(await fileToPart(ref.file));
    
    textParts.push({ text: `
      Analyze these inputs for an architectural visualization.
      User Vision: "${userPrompt || 'Not specified'}"
      Params: ${params.lighting}, ${params.sunDirection}, ${params.weather}
      Output ONLY the final descriptive prompt in ${params.language}.
    `});

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: textParts },
      config: { safetySettings: SAFETY_SETTINGS }
    });

    optimizedPrompt = response.text || "Prompt generation failed.";
  } catch (error: any) {
    console.error("Text Gen Error:", error);
    throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`);
  }

  // --- Step 2: Image Generation (With Retry Logic) ---
  let generatedImageData: string | undefined = undefined;
  let imageGenerationError: string | undefined = undefined;

  // Prepare image parts once to avoid reprocessing
  const imageGenParts = [];
  try {
      imageGenParts.push(await fileToPart(sketch.file));
      const aspectRatio = getBestAspectRatio(sketch.width, sketch.height);
      const imageGenPrompt = `
        Create a photorealistic architectural rendering.
        ${masterStylePrompt ? `STYLE: ${masterStylePrompt}` : 'Style: Photorealistic, 8k, Unreal Engine 5.'}
        DESCRIPTION: ${optimizedPrompt.slice(0, 800)}
        CONSTRAINTS: Use sketch geometry strictly. High fidelity.
      `;
      imageGenParts.push({ text: imageGenPrompt });

      if (onStatusUpdate) onStatusUpdate('generating');

      // Retry Loop
      const MAX_RETRIES = 3;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const imageResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image', 
              contents: { parts: imageGenParts },
              config: {
                imageConfig: { aspectRatio: aspectRatio },
                safetySettings: SAFETY_SETTINGS,
              }
            });

            const candidate = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (candidate?.inlineData?.data) {
                generatedImageData = candidate.inlineData.data;
                break; // Success, exit loop
            } else {
                // If no image data, check for text refusal
                const refusalText = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
                throw new Error(refusalText || "Model returned no image data.");
            }

        } catch (err: any) {
            const msg = err.message || JSON.stringify(err);
            const isQuota = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
            const isOverloaded = msg.includes('503') || msg.includes('Overloaded');

            console.warn(`Attempt ${attempt} failed.`, err);

            if ((isQuota || isOverloaded) && attempt < MAX_RETRIES) {
                // Exponential backoff: 2s, 4s
                const delay = 2000 * attempt; 
                await wait(delay);
                continue; // Retry
            }

            // If we reached here, it's a fatal error or max retries hit.
            // Santize the error message for the UI
            if (isQuota) {
                imageGenerationError = "Daily Quota Exceeded. The free tier for Gemini Image generation is currently exhausted or busy. Please try again later.";
            } else if (msg.includes('Safety') || msg.includes('block')) {
                imageGenerationError = "Safety Block. The model refused the request due to safety guidelines. Try a simpler sketch.";
            } else {
                imageGenerationError = `Generation Failed: ${msg.substring(0, 100)}...`;
            }
            break; // Exit loop
        }
      }

  } catch (setupError: any) {
      imageGenerationError = "Failed to prepare image data: " + setupError.message;
  }

  return {
    id: Date.now().toString(),
    prompt: optimizedPrompt,
    imageData: generatedImageData,
    error: imageGenerationError,
    timestamp: Date.now()
  };
};

export const applyMasterStyle = async (
  currentImageBase64: string,
  originalPrompt: string,
  stylePrompt: string
): Promise<string> => {
  const ai = getAIClient();
  const parts = [
    { inlineData: { data: currentImageBase64, mimeType: 'image/png' } },
    { text: `Apply style: "${stylePrompt}" to this image. Keep geometry. Photorealistic.` }
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
      config: { safetySettings: SAFETY_SETTINGS }
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!data) throw new Error("No image returned.");
    return data;
  } catch (error: any) {
    throw new Error(`Filter failed: ${error.message}`);
  }
};

export const editArchitecturalImage = async (
  originalImageBase64: string,
  maskImageBase64: string,
  editPrompt: string,
): Promise<string> => {
   const ai = getAIClient();
   const parts = [
      { inlineData: { data: originalImageBase64, mimeType: 'image/png' } },
      { inlineData: { data: maskImageBase64, mimeType: 'image/png' } },
      { text: `Edit masked area: "${editPrompt}". Blend seamless.` }
   ];

   try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
        config: { safetySettings: SAFETY_SETTINGS }
    });
    const data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
    if (!data) throw new Error("No edited image returned.");
    return data;
   } catch (error: any) {
      throw new Error(`Edit failed: ${error.message}`);
   }
};
