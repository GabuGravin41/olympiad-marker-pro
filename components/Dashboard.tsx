
import React from 'react';
import { PaperRecord } from '../types';

interface Props {
  papers: PaperRecord[];
  onExport: () => void;
}

const Dashboard: React.FC<Props> = ({ papers, onExport }) => {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onExport}
        disabled={papers.length === 0}
        className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-5 py-2 rounded-full font-semibold text-sm hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Export CSV
      </button>
    </div>
  );
};

export default Dashboard;
