
import { AppState, PaperRecord, PaperConfig } from '../types';

const STORAGE_KEY = 'olympiad_marker_state';

export function saveState(state: AppState) {
  try {
    // Only save the metadata, ensure we NEVER save base64 strings to localstorage
    const stateToSave = {
      ...state,
      isProcessing: false, // Don't persist processing state
      papers: state.papers.map(p => ({
        ...p,
        status: p.status === 'processing' ? 'paused' : p.status // Reset processing to paused
      }))
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
  } catch (err) {
    console.error("Storage error:", err);
  }
}

export function loadState(): AppState | null {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return null;
  try {
    const state = JSON.parse(data);
    return state;
  } catch {
    return null;
  }
}

export function exportResults(papers: PaperRecord[], config: PaperConfig) {
  if (papers.length === 0) return;
  const header = ['Name', 'School', 'ID', ...config.problems.map(p => p.name), 'Total', 'Status'];
  const rows = papers.map(paper => {
    const scores = config.problems.map(p => paper.results.find(r => r.problemId === p.id)?.score ?? 'N/A');
    return [
      paper.extractedStudentName || paper.studentName,
      paper.schoolName || 'N/A',
      paper.id,
      ...scores,
      paper.results.reduce((a, b) => a + b.score, 0),
      paper.status
    ];
  });
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Olympiad_Results_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
