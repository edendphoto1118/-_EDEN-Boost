
import { GoogleGenAI } from "@google/genai";
import { UploadedImage, GenerationParams, PromptResult } from "../types";

// Helper to check API Key safely across different environments (Vercel/Vite/Next/CRA)
const getAIClient = () => {
  let apiKey: string | undefined = undefined;

  // 1. Try standard process.env (Node/Webpack/Next.js/CRA)
  try {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY || 
               process.env.NEXT_PUBLIC_API_KEY || 
               process.env.REACT_APP_API_KEY;
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }

  // 2. Try Vite import.meta.env
  if (!apiKey) {
    try {
      // @ts-ignore - Check for Vite environment
      if (typeof import.meta !== 'undefined' && import.meta.env) {
         // @ts-ignore
         apiKey = import.meta.env.VITE_API_KEY || import.meta.env.PUBLIC_API_KEY || import.meta.env.API_KEY;
      }
    } catch (e) {
      // Ignore syntax errors in non-module environments
    }
  }

  if (!apiKey) {
    throw new Error("API Key is missing. If deploying to Vercel, please set 'VITE_API_KEY' or 'NEXT_PUBLIC_API_KEY' in your Environment Variables.");
  }
  
  return new GoogleGenAI({ apiKey });
};

const fileToPart = async (file: File) => {
  return new Promise<{ inlineData: { data: string; mimeType: string } }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      try {
        const base64String = reader.result as string;
        // Ensure valid base64 string
        if (!base64String || !base64String.includes(',')) {
          reject(new Error("Failed to process image file."));
          return;
        }
        const base64Data = base64String.split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type,
          },
        });
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (e) => reject(new Error("File reading failed"));
    reader.readAsDataURL(file);
  });
};

const getBestAspectRatio = (width?: number, height?: number): string => {
  if (!width || !height) return "1:1";
  
  const ratio = width / height;
  
  // Supported: "1:1", "3:4", "4:3", "9:16", "16:9"
  // Ratios: 1.0, 0.75, 1.33, 0.5625, 1.77
  
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
    // Do not throw here, just return original to keep app usable
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

  // System Instruction construction
  const systemInstruction = `
    You are a world-class Senior Architectural Visualizer and AI Prompt Engineering Expert.
    Your task is to analyze the provided architectural inputs and generate a highly technical, photorealistic text-to-image prompt optimized for high-end rendering engines (like Midjourney v6, Stable Diffusion XL, or Imagen 3).

    ### INPUTS TO ANALYZE:
    1. Main Sketch: The first attached image.
    2. Aerial/Site Context: ${context ? 'The second attached image.' : 'Not provided.'}
    3. Style References: ${references.length > 0 ? 'Subsequent attached images.' : 'Not provided.'}
    
    ### USER PARAMETERS:
    - User Vision: "${userPrompt || 'Not specified'}"
    - Lighting: ${params.lighting}
    - Sun Direction: ${params.sunDirection}
    - Weather: ${params.weather}
    - Target Language: ${params.language}

    ### PROCESS:
    1. **Geometry:** Strictly respect the form in the 'Main Sketch'.
    2. **Vision:** "User Vision" takes precedence. Blend it with the sketch geometry.
    3. **Context:** If Context image exists, emphasize "Photorealistic aerial montage".
    4. **Style:** Extract from User Vision first, then References.
    5. **Lighting/Weather:** specific keywords based on parameters.

    ### OUTPUT FORMAT:
    Provide ONLY the final optimized prompt in ${params.language}.
    Structure: "[Subject Description] + [Environment] + [Material/Style] + [Lighting/Weather] + [Technical Tags]"
  `;

  // Add images to content parts
  try {
    textParts.push(await fileToPart(sketch.file));
    if (context) textParts.push(await fileToPart(context.file));
    for (const ref of references) {
      textParts.push(await fileToPart(ref.file));
    }
    
    // We send a trigger message to start the generation
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

  try {
    if (onStatusUpdate) onStatusUpdate('generating');

    const imageParts = [];
    imageParts.push(await fileToPart(sketch.file));
    
    const aspectRatio = getBestAspectRatio(sketch.width, sketch.height);

    // CRITICAL UPDATE: Master Style is prioritized ABOVE the calculated prompt
    const imageGenPrompt = `
      [TASK]
      Create a photorealistic architectural rendering based on the provided sketch image.
      
      [CRITICAL STYLE INSTRUCTIONS]
      ${masterStylePrompt ? `>>> MASTER STYLE ACTIVE: ${masterStylePrompt} \n>>> NOTE: This style instruction is MANDATORY. It must OVERPOWER original colors and generic lighting.` : 'Use standard photorealistic lighting.'}

      [GENERAL VISUALIZATION DESCRIPTION]
      ${optimizedPrompt}

      [GEOMETRY RULES]
      1. IGNORE the sketch style (lines, paper texture). 
      2. Use the provided image ONLY for structural geometry.
      3. Output must be a high-quality, fully rendered 8k architectural visualization.
    `;

    imageParts.push({ text: imageGenPrompt });

    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: imageParts },
      config: {
         imageConfig: { 
           aspectRatio: aspectRatio,
         }
      }
    });

    for (const part of imageResponse.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        generatedImageData = part.inlineData.data;
        break;
      }
    }

  } catch (error) {
    // Image generation is optional (can fail gracefully), but good to log
    console.error("Gemini Image API Error:", error);
  }

  return {
    id: Date.now().toString(),
    prompt: optimizedPrompt,
    imageData: generatedImageData,
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
    { text: `
      [TASK]
      Apply a specific photographic filter and atmosphere to the provided architectural rendering.

      [INPUT CONTEXT]
      The input image is an existing architectural visualization. 
      Original description: "${originalPrompt}"

      [MASTER STYLE INSTRUCTION]
      Apply this style strictly: "${stylePrompt}"

      [STRICT GEOMETRY CONSTRAINTS]
      1. **DO NOT CHANGE THE BUILDING GEOMETRY.** The shape, volume, perspective, and structure MUST remain identical to the input image.
      2. **DO NOT REPLACE THE BUILDING.** You are only changing the camera filter, lighting, color grading, and adding atmospheric details (fog, reflections, street life).
      3. You may enhance textures (make concrete more realistic, make glass more reflective).
      4. You may change the background sky or weather if the style demands it (e.g., night mode, sunset).
      5. Output must be High Fidelity 8k Photorealism.
    `}
  ];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
    });

    let styledImageData = "";
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        styledImageData = part.inlineData.data;
        break;
      }
    }
    
    if (!styledImageData) throw new Error("The model did not return an image. It might have been blocked by safety settings.");
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
      { text: `
         [TASK]
         Edit the first image provided (the architectural visualization).
         Use the second image provided as a MASK.
         
         [INSTRUCTIONS]
         1. The white areas in the mask image indicate the EXACT regions to modify.
         2. The black areas in the mask image must remain UNCHANGED.
         3. Change the masked area to match this description: "${editPrompt}".
         4. Ensure the new content blends seamlessly with the existing lighting, perspective, and style of the original image.
         5. Return the full image with the edits applied.
      `}
   ];

   try {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
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
