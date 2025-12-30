
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PaperConfig, PaperRecord, AppState, ProblemConfig, MarkingResult } from './types';
import Dashboard from './components/Dashboard';
import ConfigurationPanel from './components/ConfigurationPanel';
import ProcessingList from './components/ProcessingList';
import { GoogleGenAI, Type } from "@google/genai";
import * as StorageService from './services/storage';
import * as PDFService from './services/pdf';
import * as ImageDB from './services/db';

const CONCURRENCY_LIMIT = 3; 

const DEFAULT_CONFIG: PaperConfig = {
  paperName: "National Math Olympiad 2024",
  examDuration: "3 Hours",
  problems: [
    { id: 1, name: "Problem 1", maxPoints: 7, rubric: "Standard Olympiad marking (0-7). 0-2 for progress, 6-7 for complete proof." },
    { id: 2, name: "Problem 2", maxPoints: 7, rubric: "Combinatorics. Look for correct bijection or construction." },
    { id: 3, name: "Problem 3", maxPoints: 7, rubric: "Geometry. High rigour required." }
  ],
  additionalInstructions: "Be a skeptical examiner. Most progress that doesn't reach a breakthrough is 0, 1, or 2 points."
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    const saved = StorageService.loadState();
    return saved || {
      config: DEFAULT_CONFIG,
      papers: [],
      isProcessing: false,
      isExtractingScheme: false,
      isUploading: false,
      uploadProgress: { current: 0, total: 0, currentFileName: '' },
      totalTokensUsed: 0
    };
  });

  const stateRef = useRef(state);
  const cancelUploadRef = useRef(false);
  const activeWorkersRef = useRef<number>(0);
  const globalStopSignalRef = useRef<boolean>(false);

  useEffect(() => {
    stateRef.current = state;
    StorageService.saveState(state);
  }, [state]);

  const updateConfig = (config: PaperConfig) => {
    setState(prev => ({ ...prev, config }));
  };

  const handleMarkingSchemeUpload = async (file: File) => {
    setState(prev => ({ ...prev, isExtractingScheme: true }));
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const images = await PDFService.convertPdfToImages(file);
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
          parts: [
            { text: `Extract problems and rubrics from this marking scheme. Format as JSON array of objects with keys: "name", "maxPoints", "rubric".` },
            ...images.map(img => ({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } }))
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { name: { type: Type.STRING }, maxPoints: { type: Type.NUMBER }, rubric: { type: Type.STRING } },
              required: ["name", "maxPoints", "rubric"]
            }
          }
        }
      });
      const extractedProblems: any[] = JSON.parse(response.text || '[]');
      const newProblems: ProblemConfig[] = extractedProblems.map((p, idx) => ({
        id: Date.now() + idx,
        name: p.name,
        maxPoints: p.maxPoints || 7,
        rubric: p.rubric
      }));
      setState(prev => ({
        ...prev,
        isExtractingScheme: false,
        config: { ...prev.config, problems: newProblems },
        papers: prev.papers.map(p => ({ ...p, totalProblems: newProblems.length }))
      }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, isExtractingScheme: false }));
      alert("Failed to process marking scheme.");
    }
  };

  const handleFileUpload = async (files: File[]) => {
    cancelUploadRef.current = false;
    setState(prev => ({ ...prev, isUploading: true, uploadProgress: { current: 0, total: files.length, currentFileName: '' } }));
    for (let i = 0; i < files.length; i++) {
      if (cancelUploadRef.current) break;
      const file = files[i];
      const filenameBase = file.name.replace('.pdf', '');
      setState(prev => ({ ...prev, uploadProgress: { ...prev.uploadProgress, current: i + 1, currentFileName: file.name } }));
      try {
        const images = await PDFService.convertPdfToImages(file);
        const paperId = Math.random().toString(36).substr(2, 9);
        await ImageDB.saveImages(paperId, images);
        const paper: PaperRecord = {
          id: paperId,
          studentName: filenameBase,
          fileName: file.name,
          status: 'pending',
          results: [],
          processedProblemCount: 0,
          totalProblems: stateRef.current.config.problems.length,
          lastUpdated: Date.now(),
          hasImages: true
        };
        setState(prev => ({ ...prev, papers: [...prev.papers, paper] }));
      } catch (err) {
        console.error(err);
      }
    }
    setState(prev => ({ ...prev, isUploading: false }));
  };

  const markPaper = async (paperId: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const paper = stateRef.current.papers.find(p => p.id === paperId);
    if (!paper || !paper.hasImages) return;

    try {
      const images = await ImageDB.getImages(paper.id);
      if (!images.length) throw new Error("Images lost in DB.");

      const startIdx = paper.processedProblemCount;
      let currentExtractedName = paper.extractedStudentName;
      let currentSchoolName = paper.schoolName;
      let currentResults = [...paper.results];

      const systemInstruction = `You are a World-Class Mathematical Olympiad Examiner.
Strictness Level: SKEPTICAL.
Philosophy:
1. THE OLYMPIAD GAP: Scores are usually 0, 1, 2 or 6, 7. 3-5 is rare and only for major structural breakthroughs.
2. LOGICAL AUDIT: Transcribe the student's logic first. If the logic is non-existent or "word salad" with keywords (like 'pigeonhole'), award 0 points.
3. VERIFICATION: Do not assume a claim is true because it is written. Verify if step N implies N+1.
4. PROBLEM 1: Be slightly more welcoming of small lemmas, but maintain rigor.
5. NO GENEROSITY: If you are unsure, deduct. 
Output a score, detailed feedback explaining the logical gaps, and a confidence score.`;

      for (let pIdx = startIdx; pIdx < stateRef.current.config.problems.length; pIdx++) {
        // KILL SWITCH CHECKS
        if (!stateRef.current.isProcessing || globalStopSignalRef.current) {
           throw new Error("PAUSED");
        }

        const problem = stateRef.current.config.problems[pIdx];
        const isFirstProblem = pIdx === 0;

        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: {
              parts: [
                { text: `Paper: ${stateRef.current.config.paperName}. Additional Context: ${stateRef.current.config.additionalInstructions}` },
                { text: `Current Task: Mark Problem "${problem.name}" (Max Points: ${problem.maxPoints}). Rubric: ${problem.rubric}.` },
                { text: isFirstProblem ? "Also extract student name and school if visible." : "Continue with the existing student context." },
                ...images.map(img => ({ inlineData: { mimeType: 'image/jpeg', data: img.split(',')[1] } }))
              ]
            },
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.NUMBER, description: "Calculated points (0 to maxPoints)" },
                  feedback: { type: Type.STRING, description: "Justification of the score and logical audit" },
                  confidence: { type: Type.NUMBER, description: "0 to 1 scale of accuracy" },
                  extractedStudentName: { type: Type.STRING },
                  schoolName: { type: Type.STRING }
                },
                required: ["score", "feedback", "confidence"]
              }
            }
          });

          const data = JSON.parse(response.text || '{}');
          if (isFirstProblem) {
            currentExtractedName = data.extractedStudentName || currentExtractedName;
            currentSchoolName = data.schoolName || currentSchoolName;
          }
          currentResults.push({ problemId: problem.id, score: data.score, feedback: data.feedback, confidence: data.confidence });

          setState(prev => ({
            ...prev,
            papers: prev.papers.map(p => p.id === paperId ? {
              ...p,
              results: [...currentResults],
              extractedStudentName: currentExtractedName,
              schoolName: currentSchoolName,
              processedProblemCount: pIdx + 1,
              lastUpdated: Date.now()
            } : p)
          }));
        } catch (apiErr: any) {
          // QUOTA DETECTION (429)
          if (apiErr.message?.includes('429') || apiErr.status === 429) {
            globalStopSignalRef.current = true;
            throw new Error("QUOTA_EXCEEDED");
          }
          throw apiErr;
        }
      }

      setState(prev => ({ ...prev, papers: prev.papers.map(p => p.id === paperId ? { ...p, status: 'completed' } : p) }));
    } catch (err: any) {
      let status: PaperRecord['status'] = 'failed';
      let errorMsg = err.message;

      if (err.message === "PAUSED") status = 'paused';
      if (err.message === "QUOTA_EXCEEDED") {
        status = 'paused';
        errorMsg = "API Quota Exceeded. Pausing all tasks.";
        stopProcessing();
      }

      setState(prev => ({ ...prev, papers: prev.papers.map(p => p.id === paperId ? { ...p, status, error: errorMsg } : p) }));
    } finally {
      activeWorkersRef.current--;
      triggerNext();
    }
  };

  const triggerNext = () => {
    if (!stateRef.current.isProcessing || globalStopSignalRef.current) return;
    
    while (activeWorkersRef.current < CONCURRENCY_LIMIT) {
      const next = stateRef.current.papers.find(p => p.status === 'pending' || p.status === 'paused');
      if (!next) break;
      
      activeWorkersRef.current++;
      setState(prev => ({ ...prev, papers: prev.papers.map(p => p.id === next.id ? { ...p, status: 'processing' } : p) }));
      markPaper(next.id);
    }

    if (activeWorkersRef.current === 0) {
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const processPapers = () => {
    if (state.isProcessing) return;
    globalStopSignalRef.current = false;
    setState(prev => ({ ...prev, isProcessing: true }));
    stateRef.current.isProcessing = true;
    triggerNext();
  };

  const stopProcessing = () => {
    setState(prev => ({ ...prev, isProcessing: false }));
    stateRef.current.isProcessing = false;
    globalStopSignalRef.current = true;
  };

  const clearRecords = async () => {
    if (confirm("Clear all? This will delete all student records and images.")) {
      await ImageDB.clearAllImages();
      setState(prev => ({ ...prev, papers: [], isProcessing: false }));
      stateRef.current.isProcessing = false;
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <aside className="w-full lg:w-96 bg-white border-r border-slate-200 overflow-y-auto p-6 space-y-8 flex-shrink-0">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Olympiad Marker Pro</h1>
        </div>
        
        <ConfigurationPanel 
          config={state.config} 
          onUpdate={updateConfig} 
          disabled={state.isProcessing || state.isExtractingScheme || state.isUploading} 
          onSchemeUpload={handleMarkingSchemeUpload} 
          isExtractingScheme={state.isExtractingScheme} 
        />

        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-[11px] text-amber-700 space-y-2">
          <p className="font-bold uppercase tracking-wider flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Skeptical Mode Active
          </p>
          <p>The AI is configured as a strict Olympiad examiner. It will verify every step and default to lower marks unless evidence of a breakthrough is provided.</p>
        </div>

        <div className="pt-6 border-t border-slate-100">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between">
            <div><p className="text-xs text-slate-500">Queue</p><p className="text-lg font-bold">{state.papers.length}</p></div>
            <div><p className="text-xs text-slate-500">Completed</p><p className="text-lg font-bold text-indigo-600">{state.papers.filter(p => p.status === 'completed').length}</p></div>
          </div>
        </div>
      </aside>
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={state.isProcessing ? stopProcessing : processPapers} 
              disabled={state.papers.length === 0 || state.isUploading} 
              className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-semibold transition-all ${state.isProcessing ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-600 text-white shadow-md hover:bg-indigo-700'}`}
            >
              {state.isProcessing ? (
                <><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span> Stop Marking</>
              ) : (
                'Start Batch Marking'
              )}
            </button>
            <button onClick={clearRecords} className="text-slate-400 hover:text-red-600 text-sm font-medium transition-colors">Clear All</button>
          </div>
          <Dashboard papers={state.papers} onExport={() => StorageService.exportResults(state.papers, state.config)} />
        </header>
        
        <section className="flex-1 overflow-hidden p-8">
          <ProcessingList 
            papers={state.papers} 
            config={state.config} 
            onFileUpload={handleFileUpload} 
            onCancelUpload={() => cancelUploadRef.current = true} 
            isProcessing={state.isProcessing} 
            isUploading={state.isUploading} 
            uploadProgress={state.uploadProgress} 
          />
        </section>
      </main>
    </div>
  );
};

export default App;
