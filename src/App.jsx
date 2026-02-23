import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Reader } from './components/Reader';
import { Search } from './components/Search';
import { MagicManager } from './components/MagicManager';
import { KnowledgeSystem } from './components/KnowledgeSystem';
import { BibliographyManager } from './components/BibliographyManager';
import { NoteManager } from './components/NoteManager';
import { PaperManager } from './components/PaperManager';
import { PaperReader } from './components/PaperReader';
import { HighlightManager } from './components/HighlightManager';
import { InspirationManager } from './components/InspirationManager';
import { VoiceMemoManager } from './components/VoiceMemoManager';
import { WeiboManager } from './components/WeiboManager';
import { Corkboard } from './components/Corkboard';
import { TransferStation } from './components/TransferStation';
import { DiscoveryPage } from './components/DiscoveryPage';
import { DeepResearch } from './components/DeepResearch';
import { ResearchBoard } from './components/ResearchBoard';
import { Dashboard } from './components/Dashboard';
import WordInsight from './components/WordInsight';
import { API_BASE_URL } from './utils/api';
import { Toaster } from 'react-hot-toast';

function App() {
  const [chapters, setChapters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chapters`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
           setChapters(data);
        }
        setIsLoading(false);
      })
      .catch(e => {
        console.error(e);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-slate-50">Loading...</div>;
  }

  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <div className="flex h-screen w-screen bg-slate-100 overflow-hidden font-sans">
        <Sidebar 
          collapsed={isSidebarCollapsed} 
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
        />
        <main className="flex-1 h-full relative min-w-0 overflow-hidden">
          <Routes>
            <Route path="/chapter/:id" element={<Reader />} />
            <Route path="/search" element={<Search />} />
            <Route path="/magic" element={<MagicManager />} />
            <Route path="/knowledge" element={<KnowledgeSystem />} />
            <Route path="/questions" element={<BibliographyManager />} />
            <Route path="/notes" element={<NoteManager />} />
            <Route path="/highlights" element={<HighlightManager />} />
            <Route path="/inspirations" element={<InspirationManager />} />
            <Route path="/voice-memos" element={<VoiceMemoManager />} />
            <Route path="/weibo" element={<WeiboManager />} />
            <Route path="/corkboard" element={<Corkboard />} />
            <Route path="/transfer" element={<TransferStation />} />
            <Route path="/discovery" element={<DiscoveryPage />} />
            <Route path="/deep-research" element={<DeepResearch />} />
            <Route path="/research-board" element={<ResearchBoard />} />
            <Route path="/word-insight" element={<WordInsight />} />
            <Route path="/papers" element={<PaperManager />} />
            <Route path="/read-paper/:refId/:attachmentId?" element={<PaperReader />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/" element={<Navigate to="/deep-research" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
