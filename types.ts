
export interface ProblemConfig {
  id: number;
  name: string;
  maxPoints: number;
  rubric: string;
}

export interface PaperConfig {
  paperName: string;
  examDuration: string;
  problems: ProblemConfig[];
  additionalInstructions: string;
}

export interface MarkingResult {
  problemId: number;
  score: number;
  feedback: string;
  confidence: number;
}

export interface PaperRecord {
  id: string;
  studentName: string;
  extractedStudentName?: string;
  schoolName?: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused';
  results: MarkingResult[];
  processedProblemCount: number;
  totalProblems: number;
  error?: string;
  lastUpdated: number;
  hasImages: boolean; // Flag to indicate if images exist in IndexedDB
}

export interface AppState {
  config: PaperConfig;
  papers: PaperRecord[];
  isProcessing: boolean;
  isExtractingScheme: boolean;
  isUploading: boolean;
  uploadProgress: {
    current: number;
    total: number;
    currentFileName: string;
  };
  totalTokensUsed: number;
}
