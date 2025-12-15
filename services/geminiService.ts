
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { UploadedImage, GenerationParams, PromptResult } from "../types";

// Helper to check API Key safely across different environments (Vercel/Vite/Next/CRA)
const getAIClient = () => {
  let apiKey = '';

  // 1. Try Vite / Modern Bundlers (Using import.meta.env)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      apiKey = import.meta.env.VITE_API_KEY || import.meta.env.PUBLIC_API_KEY || import.meta.env.API_KEY || '';
    }
  } catch (e) {
    // Ignore syntax errors in environments that don't support import.meta
  }

  // 2. Try Standard Node/Webpack/Next.js/CRA (Using process.env)
  if (!apiKey) {
    try {
      if (typeof process !== 'undefined' && process.env) {
        apiKey = process.env.NEXT_PUBLIC_API_KEY || 
                 process.env.REACT_APP_API_KEY || 
                 process.env.API_KEY || 
                 '';
      }
    } catch (e) {
      // Ignore reference errors
    }
  }

  if (!apiKey) {
    console.error("DEBUG: Environment variables checked. process.env and import.meta.env yielded no keys.");
    throw new Error(
      "API Key is missing.\n\n" +
      "FOR VERCEL USERS:\n" +
      "1. Go to Settings > Environment Variables.\n" +
      "2. Add 'VITE_API_KEY' (Value: your Gemini API Key).\n" +
      "3. IMPORTANT: Go to Deployments and click 'Redeploy' for changes to take effect."
    );
  }
  
  return new GoogleGenAI({ apiKey });
};

// Helper: Resize image to ensure API stability (Max 800px is safer/faster for Flash Image)
const resizeImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxDim = 800; // Reduced from 1024 to 800 for better success rate
        
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
            // Get base64 data only (remove prefix)
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
      throw new Error("Failed to process/resize image. Please try a different file.");
  }
};

const getBestAspectRatio = (width?: number, height?: number): string => {
  if (!width || !height) return "1:1";
  
  const ratio = width / height;
  
  // Supported: "1:1", "3:4", "4:3", "9:16", "16:9"
  const targets = [
    { id: "1:1", val: 1.0 },
    { id: "3:4", val: 0.75 },
    { id: "4:3", val: 1.333 },
    { id: "9:16", val: 0.5625 },
    { id: "16:9", val: 1.777 }
  ];

  // Find closest
  const best = targets.reduce((prev, curr) => {
    return (Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev);
  });

  return best.id;
};

// Maximum permissive safety settings
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

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
          text: `Refine the following user idea into a concise, professional architectural visualization prompt description (approx 50-80 words). Focus on materials, atmosphere, and style. The output must be in ${language}. Input: "${inputPrompt}"` 
        }]
      },
      config: {
        systemInstruction: "You are an expert Architectural Prompt Engineer. Rewrite user inputs into high-quality, descriptive visualization prompts.",
        temperature: 0.7,
      }
    });
    return response.text?.trim() || inputPrompt;
  } catch (e) {
    console.error("Optimization failed", e);
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
  masterStylePrompt?: string // Optional parameter for style override
): Promise<PromptResult> => {
  
  const ai = getAIClient();

  if (onStatusUpdate) onStatusUpdate('analyzing');

  // --- Step 1: Generate Text Prompt ---
  const textParts = [];

  const systemInstruction = `
    You are a world-class Senior Architectural Visualizer.
    Your task is to analyze the provided architectural inputs and generate a highly technical, photorealistic text-to-image prompt.

    ### INPUTS:
    - Main Sketch: Provided as image.
    - User Vision: "${userPrompt || 'Not specified'}"
    - Parameters: ${params.lighting}, ${params.sunDirection}, ${params.weather}
    - Language: ${params.language}

    ### OUTPUT FORMAT:
    Provide ONLY the final optimized prompt in ${params.language}.
    No markdown, no intro.
  `;

  try {
    textParts.push(await fileToPart(sketch.file));
    if (context) textParts.push(await fileToPart(context.file));
    for (const ref of references) {
      textParts.push(await fileToPart(ref.file));
    }
    textParts.push({ text: "Generate the architectural prompt based on these inputs." });
  } catch (err) {
    throw new Error("Failed to process input images. Please ensure they are valid image files.");
  }

  let optimizedPrompt = "";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: textParts },
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.5,
        safetySettings: SAFETY_SETTINGS,
      }
    });

    optimizedPrompt = response.text || "Failed to generate prompt.";
  } catch (error: any) {
    console.error("Gemini Text API Error:", error);
    if (error.message?.includes('API Key')) throw error;
    throw new Error(`Analysis failed: ${error.message || 'Unknown error'}`);
  }

  // --- Step 2: Generate Image ---
  let generatedImageData: string | undefined = undefined;
  let imageGenerationError: string | undefined = undefined;

  try {
    if (onStatusUpdate) onStatusUpdate('generating');

    const imageParts = [];
    imageParts.push(await fileToPart(sketch.file));
    const aspectRatio = getBestAspectRatio(sketch.width, sketch.height);

    const imageGenPrompt = `
      Create a photorealistic architectural rendering.
      ${masterStylePrompt ? `STYLE: ${masterStylePrompt}` : 'Style: Photorealistic, 8k, Unreal Engine 5.'}
      
      DESCRIPTION:
      ${optimizedPrompt.slice(0, 800)} 
      
      CONSTRAINTS:
      - Use the provided sketch image strictly for geometry.
      - High fidelity, detailed textures.
    `;

    imageParts.push({ text: imageGenPrompt });

    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: imageParts },
      config: {
         imageConfig: { 
           aspectRatio: aspectRatio,
         },
         safetySettings: SAFETY_SETTINGS,
      }
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageData = part.inlineData.data;
        break;
      }
    }
    
    if (!generatedImageData) {
       const textPart = imageResponse.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
       throw new Error(textPart || "The model refused to generate an image (Safety/Policy filter triggered). Try a different sketch or description.");
    }

  } catch (error: any) {
    console.error("Gemini Image API Error:", error);
    imageGenerationError = `Image Generation Failed: ${error.message || 'Unknown error'}. You can still use the prompt above with other AI tools (Midjourney/Stable Diffusion).`;
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

    let styledImageData = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        styledImageData = part.inlineData.data;
        break;
      }
    }
    
    if (!styledImageData) throw new Error("The model did not return an image.");
    return styledImageData;
  } catch (error: any) {
    console.error("Master Style Application Error:", error);
    throw new Error(`Filter application failed: ${error.message}`);
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
    
    let editedImageData = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            editedImageData = part.inlineData.data;
            break;
        }
    }
    
    if (!editedImageData) throw new Error("The model did not return an edited image.");
    return editedImageData;
   } catch (error: any) {
      console.error("Edit Error:", error);
      throw new Error(`Editing failed: ${error.message}`);
   }
};
