
import React, { useRef } from 'react';
import { PaperConfig, ProblemConfig } from '../types';

interface Props {
  config: PaperConfig;
  onUpdate: (config: PaperConfig) => void;
  onSchemeUpload: (file: File) => void;
  disabled: boolean;
  isExtractingScheme: boolean;
}

const ConfigurationPanel: React.FC<Props> = ({ config, onUpdate, onSchemeUpload, disabled, isExtractingScheme }) => {
  const schemeInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onUpdate({ ...config, [e.target.name]: e.target.value });
  };

  const updateProblem = (index: number, field: keyof ProblemConfig, value: any) => {
    const updated = [...config.problems];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate({ ...config, problems: updated });
  };

  const addProblem = () => {
    onUpdate({
      ...config,
      problems: [...config.problems, { id: Date.now(), name: `Problem ${config.problems.length + 1}`, maxPoints: 7, rubric: "" }]
    });
  };

  const removeProblem = (index: number) => {
    onUpdate({
      ...config,
      problems: config.problems.filter((_, i) => i !== index)
    });
  };

  const handleSchemeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSchemeUpload(e.target.files[0]);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Exam Context</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">Paper Name</label>
            <input
              type="text"
              name="paperName"
              value={config.paperName}
              onChange={handleChange}
              disabled={disabled}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1 ml-1">Duration</label>
            <input
              type="text"
              name="examDuration"
              value={config.examDuration}
              onChange={handleChange}
              disabled={disabled}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all disabled:opacity-60"
            />
          </div>
        </div>
      </section>

      <section className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-3 flex items-center gap-2">
          Official Marking Scheme
          <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded">NEW</span>
        </h2>
        <p className="text-[11px] text-slate-500 mb-3 italic">
          Upload a PDF to automatically extract problems and rubrics.
        </p>
        <input 
          type="file" 
          accept=".pdf" 
          ref={schemeInputRef} 
          className="hidden" 
          onChange={handleSchemeChange}
        />
        <button
          onClick={() => schemeInputRef.current?.click()}
          disabled={disabled || isExtractingScheme}
          className={`w-full py-2.5 rounded-lg border-2 border-dashed font-semibold text-xs transition-all ${
            isExtractingScheme 
            ? 'bg-indigo-100 border-indigo-300 text-indigo-700 animate-pulse'
            : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-400 shadow-sm'
          }`}
        >
          {isExtractingScheme ? 'Extracting Problems...' : 'Upload Scheme PDF'}
        </button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Marking Scheme</h2>
          <button 
            onClick={addProblem} 
            disabled={disabled}
            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-colors"
          >
            + Add Problem
          </button>
        </div>
        <div className="space-y-4">
          {config.problems.map((problem, idx) => (
            <div key={problem.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl relative group">
              {!disabled && (
                <button 
                  onClick={() => removeProblem(idx)}
                  className="absolute -top-2 -right-2 bg-white border border-slate-200 text-slate-400 hover:text-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              )}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={problem.name}
                  onChange={(e) => updateProblem(idx, 'name', e.target.value)}
                  disabled={disabled}
                  className="col-span-2 px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md outline-none focus:border-indigo-400"
                />
                <input
                  type="number"
                  placeholder="Pts"
                  value={problem.maxPoints}
                  onChange={(e) => updateProblem(idx, 'maxPoints', parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="px-2 py-1.5 text-sm bg-white border border-slate-200 rounded-md outline-none focus:border-indigo-400"
                />
              </div>
              <textarea
                placeholder="Rubric / Instructions..."
                value={problem.rubric}
                onChange={(e) => updateProblem(idx, 'rubric', e.target.value)}
                disabled={disabled}
                className="w-full px-2 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none min-h-[60px] focus:border-indigo-400"
              />
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-4">Additional Meta</h2>
        <textarea
          name="additionalInstructions"
          value={config.additionalInstructions}
          onChange={handleChange}
          disabled={disabled}
          placeholder="Global marking principles, etc."
          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:opacity-60 text-sm min-h-[100px]"
        />
      </section>
    </div>
  );
};

export default ConfigurationPanel;
