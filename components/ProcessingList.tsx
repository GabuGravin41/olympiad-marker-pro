
import React, { useRef, useMemo } from 'react';
import { PaperRecord, PaperConfig, AppState } from '../types';

interface Props {
  papers: PaperRecord[];
  config: PaperConfig;
  onFileUpload: (files: File[]) => void;
  onCancelUpload: () => void;
  isProcessing: boolean;
  isUploading: boolean;
  uploadProgress: AppState['uploadProgress'];
}

const ProcessingList: React.FC<Props> = ({ papers, config, onFileUpload, onCancelUpload, isProcessing, isUploading, uploadProgress }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const maxPossiblePoints = useMemo(() => config.problems.reduce((sum, p) => sum + p.maxPoints, 0), [config.problems]);

  return (
    <div className="flex flex-col h-full space-y-8">
      <div 
        className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all ${isUploading ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-slate-200 hover:border-indigo-400 cursor-pointer'}`}
        onClick={() => !isProcessing && !isUploading && fileInputRef.current?.click()}
      >
        <input type="file" multiple accept=".pdf" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files && onFileUpload(Array.from(e.target.files))} />
        {isUploading ? (
          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">Processing {uploadProgress.current} / {uploadProgress.total}</p>
            <p className="text-sm text-slate-500 mt-2 mb-4 truncate max-w-xs">{uploadProgress.currentFileName}</p>
            <button onClick={(e) => { e.stopPropagation(); onCancelUpload(); }} className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-xs font-bold">Cancel</button>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-800">Drop student PDFs here or click to upload</p>
            <p className="text-sm text-slate-500 mt-1">Ready for 2,000+ papers</p>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="px-6 py-3 w-1/3">Student / School</th>
                <th className="px-6 py-3 w-40">Status</th>
                <th className="px-6 py-3">Progress</th>
                <th className="px-6 py-3 w-32 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {papers.map((paper) => {
                const totalScore = paper.results.reduce((acc, r) => acc + r.score, 0);
                const progress = (paper.processedProblemCount / config.problems.length) * 100;
                return (
                  <tr key={paper.id} className="hover:bg-slate-50/50 transition-colors h-16">
                    <td className="px-6 py-2 truncate">
                      <div className="font-bold text-slate-800 text-sm truncate">{paper.extractedStudentName || paper.studentName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{paper.schoolName || 'Awaiting detection...'}</div>
                    </td>
                    <td className="px-6 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                        paper.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        paper.status === 'processing' ? 'bg-indigo-100 text-indigo-700 animate-pulse' :
                        paper.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}>{paper.status}</span>
                    </td>
                    <td className="px-6 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full transition-all duration-500 ${paper.status === 'completed' ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{Math.round(progress)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-2 text-right font-bold text-slate-700 text-sm">
                      {totalScore} <span className="text-slate-300 font-normal">/ {maxPossiblePoints}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {papers.length === 0 && <div className="p-12 text-center text-slate-400 italic text-sm">No papers uploaded yet.</div>}
        </div>
      </div>
    </div>
  );
};

export default ProcessingList;
