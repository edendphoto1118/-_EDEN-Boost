
export enum Language {
  English = 'English',
  ChineseTraditional = 'Traditional Chinese',
  Japanese = 'Japanese',
  Korean = 'Korean',
}

export enum LightingTime {
  Sunny = 'Sunny',
  Sunset = 'Sunset',
  Night = 'Night',
}

export enum SunDirection {
  TopLeft = 'Top-Left',
  TopRight = 'Top-Right',
  BottomLeft = 'Bottom-Left',
  BottomRight = 'Bottom-Right',
}

export enum WeatherCondition {
  Clear = 'Clear',
  Cloudy = 'Cloudy',
  Rain = 'Rain',
  Snow = 'Snow',
  ThickFog = 'Thick Fog',
  LightMist = 'Light Mist',
}

export interface UploadedImage {
  file: File;
  previewUrl: string;
  id: string;
  width?: number;
  height?: number;
}

export interface GenerationParams {
  lighting: LightingTime;
  sunDirection: SunDirection;
  weather: WeatherCondition;
  language: Language;
}

export interface PromptResult {
  id: string;
  prompt: string;
  imageData?: string;
  timestamp: number;
}

export interface MasterStyle {
  id: string;
  label: string;
  prompt: string;
  icon?: string;
}
