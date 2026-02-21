
export interface LitigantDocument {
  id: string;
  name: string;
  text: string;
}

export interface JudicialResolutionInput {
  documents: LitigantDocument[];
  template: string;
  extraInstructions: string;
}

export interface GenerationState {
  isGenerating: boolean;
  resultHtml: string;
  error: string | null;
}
