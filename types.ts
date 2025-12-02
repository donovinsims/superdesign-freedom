export enum ContentType {
  TEXT = 'TEXT',
  CODE = 'CODE',
  IMAGE = 'IMAGE',
  UNKNOWN = 'UNKNOWN'
}

export interface DesignElement {
  id: string;
  type: ContentType;
  content: string; // Text content or Base64 Image string
  title?: string;
  prompt: string;
  timestamp: number;
  metadata?: {
    language?: string; // For code
    width?: string;    // For images
    height?: string;
  };
}

export enum ModelType {
  DESIGN = 'gemini-2.5-flash',
  IMAGE = 'gemini-2.5-flash-image', // Nano Banana
  THINKING = 'gemini-2.5-flash' // Using flash with thinking config if needed, or stick to standard
}