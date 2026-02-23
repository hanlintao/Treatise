import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../utils/api';
import { 
  Microscope, Send, Copy, Bot, User, FileText, Layers, 
  Loader2, Plus, MessageSquare, Trash2, Search, 
  ChevronRight, ChevronDown, CheckCircle, Clock,
  MoreHorizontal, PanelLeftClose, PanelLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatCitation } from '../utils/citationFormatter';
import { ResearchRenderer } from './research/ResearchRegistry';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

const ThinkingChain = ({ steps, isFinished }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(!isFinished); // Auto-collapse if finished
  const isComplete = steps.some(s => s.step === 'generating_done');
  
  if (steps.length === 0) return null;

  const getStepLabel = (step) => {
    return t(`deep_research.steps.${step}`) || t('deep_research.steps.processing');
  };

  return (
    <div className="mb-4 mx-4 md:mx-12 my-4">
      <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Loader2 className={`w-3.5 h-3.5 ${isComplete ? '' : 'animate-spin text-violet-600'}`} />
            <span>{t('deep_research.thinking')} ({steps.length} 步)</span>
          </div>
          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        
        {isExpanded && (
          <div className="px-4 py-3 space-y-3 border-t border-slate-200 bg-white">
             {steps.map((step, idx) => (
                <div key={idx} className="flex gap-3 text-xs">
                   <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${
                          step.step.endsWith('_done') ? 'bg-green-500' : 'bg-violet-500 animate-pulse'
                      }`} />
                      {idx !== steps.length - 1 && (
                          <div className="w-px h-full bg-slate-200 my-1" />
                      )}
                   </div>
                   <div className="flex-1 pb-1">
                      <div className="font-medium text-slate-700">
                         {getStepLabel(step.step)}
                      </div>
                      <div className="text-slate-500 mt-0.5 leading-relaxed">
                         {step.detail}
                      </div>
                   </div>
                </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );
};
// Removed standalone getStepLabel


// --- Main DeepResearch Component ---
export function DeepResearch() {
  const { t } = useTranslation();
  // Session State
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Chat State
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState([]); 
  const [isLoading, setIsLoading] = useState(false);
  const [outputMode, setOutputMode] = useState('markdown');
  const [workflowSteps, setWorkflowSteps] = useState([]);
  
  const messagesEndRef = useRef(null);

  // Load Sessions on Mount
  useEffect(() => {
     fetchSessions();
  }, []);

  // Load History when Session Changes
  useEffect(() => {
    if (currentSessionId) {
       loadSessionHistory(currentSessionId);
    } else {
       setHistory([]);
       setWorkflowSteps([]);
    }
  }, [currentSessionId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, workflowSteps]);

  // --- API Actions ---

  const fetchSessions = async () => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/research/sessions`);
        const data = await res.json();
        setSessions(data);
    } catch (e) {
        console.error("Failed to load sessions", e);
    }
  };

  const loadSessionHistory = async (id) => {
      try {
          const res = await fetch(`${API_BASE_URL}/api/research/sessions/${id}`);
          const data = await res.json();
          if (data && data.messages) {
              // Hydrate JSON specs
              const hydrated = data.messages.map(hydrateMessage);
              setHistory(hydrated);
          }
      } catch (e) {
          console.error("Failed to load session history", e);
      }
  };
  
  const hydrateMessage = (msg) => {
      // Check if it's a candidate for hydration
      // We also check outputMode from the message if available, or just try to parse if it looks like JSON
      const isJsonMode = msg.mode === 'json' || (typeof msg.content === 'string' && msg.content.trim().startsWith('{'));
      
      if (msg.role === 'assistant' && isJsonMode && msg.content && !msg.spec) {
          try {
              let jsonStr = msg.content.trim();
              
              // 1. Strip Markdown Code Fences
              jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

              // 2. Extract JSON Object (Find outer braces)
              const firstBrace = jsonStr.indexOf('{');
              const lastBrace = jsonStr.lastIndexOf('}');
              
              if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
                  
                  try {
                      msg.spec = JSON.parse(jsonStr);
                      msg.mode = 'json'; // Force mode to json if successful
                  } catch (e1) {
                      // 3. Retry with escaped newlines
                      try {
                          const fixed = jsonStr.replace(/\n/g, '\\n');
                          msg.spec = JSON.parse(fixed);
                          msg.mode = 'json';
                      } catch (e2) {
                          console.warn("JSON Parse Failed (Retry):", e2);
                      }
                  }
              }
          } catch (e) {
              console.error("Hydration unexpected error:", e);
          }
      }
      return msg;
  };

  const createSession = async (initialTitle) => {
      const res = await fetch(`${API_BASE_URL}/api/research/sessions`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ title: initialTitle })
      });
      const data = await res.json();
      setSessions(prev => [data, ...prev]);
      return data.id;
  };

      const deleteSession = async (e, id) => {
      e.stopPropagation();
      if (!confirm(t('deep_research.delete_confirm'))) return;
      
      await fetch(`${API_BASE_URL}/api/research/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (currentSessionId === id) {
          setCurrentSessionId(null);
      }
  };

  const handleSendMessage = async (e) => {
      e.preventDefault();
      if (!query.trim() || isLoading) return;

      const currentQuery = query;
      setQuery('');
      setIsLoading(true);
      setWorkflowSteps([]);
      
      let targetSessionId = currentSessionId;

      // 1. Create session if needed
      if (!targetSessionId) {
          try {
              targetSessionId = await createSession(currentQuery.slice(0, 30));
              setCurrentSessionId(targetSessionId);
          } catch (e) {
              toast.error(t('deep_research.create_error'));
              setIsLoading(false);
              return;
          }
      }

      const userMsg = { role: 'user', content: currentQuery };
      setHistory(prev => [...prev, userMsg]);

      // 3. SSE Request
      try {
          const res = await fetch(`${API_BASE_URL}/api/research/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  query: currentQuery,
                  history: history,
                  outputMode,
                  sessionId: targetSessionId
              })
          });

          if (!res.ok) throw new Error(res.statusText);

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop();

              for (const line of lines) {
                  const trimmed = line.trim();
                  if (!trimmed.startsWith('data: ')) continue;
                  
                  try {
                      const json = JSON.parse(trimmed.substring(6));
                      if (json.type === 'step') {
                          setWorkflowSteps(prev => [...prev, { step: json.step, detail: json.detail }]);
                      } else if (json.type === 'result') {
                          // Final answer
                          const assistantMsg = {
                              role: 'assistant',
                              content: json.data.answer,
                              sources: json.data.sources,
                              mode: outputMode,
                              spec: null
                          };
                          // Also update outputMode if it was override or just to sync
                          if (json.data.mode) {
                             assistantMsg.mode = json.data.mode;
                          }

                          // Hydrate spec if mode is JSON
                          if (assistantMsg.mode === 'json') {
                              hydrateMessage(assistantMsg);
                          }

                          // Handle fallback from failed JSON mode to markdown
                          if (assistantMsg.mode === 'json' && !assistantMsg.spec) {
                              toast(t('deep_research.generation_error'), { icon: '⚠️' });
                              assistantMsg.mode = 'markdown';
                          }
                          
                          setHistory(prev => {
                             const last = prev[prev.length - 1];
                             if (last && last.role === 'assistant' && last.content === assistantMsg.content) {
                                return prev;
                             }
                             return [...prev, assistantMsg];
                          });
                          
                          // Refresh session title in sidebar if updated
                          fetchSessions(); 
                      } else if (json.type === 'error') {
                          throw new Error(json.message);
                      }
                  } catch (e) {
                      console.error("SSE Parse Error", e);
                  }
              }
          }

      } catch (e) {
          setHistory(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
          toast.error(`Error: ${e.message}`);
      } finally {
          setIsLoading(false);
          // Don't clear workflow steps immediately so user can see what happened
      }
  };

  // --- Render Helpers ---

  const handleCopy = (msg) => {
    // Reuse existing copy logic
    if(!msg.content) return;
    navigator.clipboard.writeText(msg.content);
    toast.success('已复制内容');
  };

  // Group sessions by date could be done here, simple list for now
  
  return (
    <div className="flex h-full w-full bg-slate-50 relative overflow-hidden">
      
      {/* --- Sidebar --- */}
      <div 
        className={`${
           isSidebarOpen ? 'w-[260px] translate-x-0' : 'w-0 -translate-x-full opacity-0'
        } bg-slate-900 h-full flex flex-col transition-all duration-300 ease-in-out shrink-0 z-20 overflow-hidden`}
      >
        <div className="p-3">
            <button 
               onClick={() => { setCurrentSessionId(null); setQuery(''); }}
               className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors border border-white/10"
            >
                <Plus className="w-5 h-5" />
                <span className="text-sm font-medium">开启新研究</span>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
            <div className="text-xs font-semibold text-slate-500 px-2 py-1">最近会话</div>
            {sessions.map(session => (
                <div 
                   key={session.id}
                   onClick={() => setCurrentSessionId(session.id)}
                   className={`group flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                       currentSessionId === session.id 
                       ? 'bg-slate-800 text-white' 
                       : 'text-slate-300 hover:bg-slate-800/50'
                   }`}
                >
                    <MessageSquare className="w-4 h-4 shrink-0 opacity-70" />
                    <div className="flex-1 truncate text-sm">
                        {session.title || '无标题会话'}
                    </div>
                    {currentSessionId === session.id && (
                        <button 
                           onClick={(e) => deleteSession(e, session.id)}
                           className="opacity-60 hover:opacity-100 p-1 hover:bg-red-500/20 hover:text-red-400 rounded"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            ))}
            {sessions.length === 0 && (
                <div className="text-center text-slate-600 text-xs py-10">
                    暂无历史记录
                </div>
            )}
        </div>

        <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center font-bold text-xs">AI</div>
                <div className="text-sm font-medium">学术研究助理</div>
            </div>
        </div>
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col h-full relative min-w-0 bg-white">
        
        {/* Header */}
        <header className="h-14 border-b border-slate-100 flex items-center justify-between px-4 shrink-0 bg-white z-10">
            <div className="flex items-center gap-3">
                <button 
                   onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                   className="text-slate-500 hover:bg-slate-100 p-1.5 rounded-lg transition-colors"
                >
                    {isSidebarOpen ? <PanelLeftClose className="w-5 h-5"/> : <PanelLeft className="w-5 h-5"/>}
                </button>
                <div className="font-semibold text-slate-700 flex items-center gap-2">
                    {currentSessionId 
                       ? (sessions.find(s => s.id === currentSessionId)?.title || t('deep_research.title')) 
                       : t('deep_research.new_session')
                    }
                </div>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-medium">DeepSeek V3</span>
            </div>

            <div className="flex items-center gap-2">
                 <button
                    onClick={() => setOutputMode(m => m === 'markdown' ? 'json' : 'markdown')}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all border ${
                      outputMode === 'json'
                        ? 'bg-violet-50 border-violet-300 text-violet-700 font-medium'
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {outputMode === 'json' ? (
                      <><Layers className="w-3.5 h-3.5" /> {t('deep_research.structured_view')}</>
                    ) : (
                      <><FileText className="w-3.5 h-3.5" /> {t('deep_research.text_view')}</>
                    )}
                  </button>
            </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-8 scroll-smooth">
            {!currentSessionId && history.length === 0 && (
                <div className="flex flex-col items-center justify-center h-[60%] text-center space-y-6 animate-in fade-in duration-500">
                    <div className="w-16 h-16 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center shadow-sm">
                        <Microscope className="w-8 h-8" />
                    </div>
                    <div className="space-y-2 max-w-md">
                        <h2 className="text-2xl font-bold text-slate-800">{t('deep_research.start_research')}</h2>
                        <p className="text-slate-500">
                            {t('deep_research.intro')}
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl px-4">
                        {[
                            t('deep_research.example_questions.0', { defaultValue: "查找关于'人工智能'的最新研究案例" }),
                            t('deep_research.example_questions.1', { defaultValue: "生成一份关于'机器学习'的文献综述大纲" }),
                        ].map((q, i) => (
                             <button 
                                key={i}
                                onClick={() => { setQuery(q); }} 
                                className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50/50 transition-all text-sm text-slate-600 hover:text-slate-900 hover:shadow-sm"
                             >
                                {q}
                             </button>
                        ))}
                    </div>
                </div>
            )}

            {history.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 text-white mt-1">
                            <Bot className="w-5 h-5" />
                        </div>
                    )}
                    
                    <div className={`relative flex flex-col max-w-[85%] md:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Show Thinking Chain for the LATEST assistant message if it's the one we just generated */}
                        {msg.role === 'assistant' && idx === history.length - 1 && workflowSteps.length > 0 && !isLoading && (
                            <ThinkingChain steps={workflowSteps} isFinished={true} />
                        )}

                        <div className={`rounded-xl p-4 shadow-sm text-sm leading-relaxed ${
                             msg.role === 'user' 
                             ? 'bg-slate-800 text-white rounded-tr-none' 
                             : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                        }`}>
                             {msg.role === 'assistant' && msg.spec ? (
                                 <div className="json-render-output">
                                     <ResearchRenderer
                                         spec={msg.spec}
                                         sources={msg.sources || []}
                                         onAction={(action) => {
                                             if (action.type === 'deep-dive') {
                                                 setQuery(typeof action.payload === 'string' ? action.payload : action.payload.topic || '');
                                             } else if (action.type === 'bookmark') {
                                                 toast.success(t('deep_research.bookmarked'));
                                             }
                                         }}
                                     />
                                 </div>
                             ) : (
                                 <div className="prose prose-sm max-w-none dark:prose-invert">
                                     <ReactMarkdown>{msg.content}</ReactMarkdown>
                                 </div>
                             )}
                        </div>
                        
                        {/* Message Meta / Sources */}
                        {msg.role === 'assistant' && msg.sources && (
                             <div className="mt-2 w-full">
                                <details className="group">
                                    <summary className="list-none cursor-pointer text-xs text-slate-400 hover:text-violet-600 flex items-center gap-4 pl-1 select-none transition-colors">
                                        <span className="flex items-center gap-1">
                                           <Search className="w-3 h-3" /> {msg.sources.length} {t('deep_research.sources')}
                                           <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                        </span>
                                        <button 
                                            onClick={(e) => {
                                                e.preventDefault(); // Prevent details toggle when clicking copy
                                                e.stopPropagation();
                                                handleCopy(msg);
                                            }} 
                                            className="hover:text-violet-600 flex items-center gap-1"
                                        >
                                            <Copy className="w-3 h-3" /> {t('deep_research.copy')}
                                        </button>
                                    </summary>
                                    
                                    <div className="mt-3 space-y-2 bg-slate-50 rounded-lg p-3 border border-slate-100 animate-in fade-in slide-in-from-top-1">
                                        {msg.sources.map((src, sIdx) => (
                                            <div key={sIdx} className="text-xs group/item">
                                                <div className="flex items-start gap-2">
                                                    <span className="text-violet-500 font-mono shrink-0 mt-0.5">[{sIdx + 1}]</span>
                                                    <div className="flex-1 space-y-1">
                                                        <a 
                                                            href={`/read-paper/${src.metadata.refId}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="font-medium text-slate-700 hover:text-violet-600 hover:underline block"
                                                        >
                                                            {src.reference?.title || src.metadata.refId}
                                                        </a>
                                                        <div className="text-slate-500 leading-relaxed bg-white p-2 rounded border border-slate-100 italic relative">
                                                            "{src.text.length > 150 ? src.text.substring(0, 150) + '...' : src.text}"
                                                            <a 
                                                                href={`/read-paper/${src.metadata.refId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="absolute bottom-1 right-2 opacity-0 group-hover/item:opacity-100 transition-opacity bg-white px-1 text-[10px] text-violet-500 hover:underline shadow-sm"
                                                            >
                                                                {t('deep_research.view_original')} &rarr;
                                                            </a>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex gap-2">
                                                            <span>{t('deep_research.similarity')}: {(src.score * 100).toFixed(1)}%</span>
                                                            {src.metadata.page && <span>{t('deep_research.page')}: {src.metadata.page}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                             </div>
                        )}
                    </div>

                    {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-600 mt-1">
                            <User className="w-5 h-5" />
                        </div>
                    )}
                </div>
            ))}
            
            {/* Thinking Chain & Loading State (Active Generation) */}
            {isLoading && (
                <div className="max-w-4xl mx-auto w-full">
                     <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center shrink-0 text-white animate-pulse">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                           {/* The Chain */}
                           <ThinkingChain steps={workflowSteps} isFinished={false} />
                           
                           {/* If loading but no steps yet (just started) */}
                           {isLoading && workflowSteps.length === 0 && (
                               <div className="text-sm text-slate-500 flex items-center gap-2 ml-4">
                                   <Loader2 className="w-4 h-4 animate-spin" />
                                   {t('deep_research.init')}
                               </div>
                           )}
                        </div>
                     </div>
                </div>
            )}
            
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="max-w-3xl mx-auto relative group">
                <textarea
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                        }
                    }}
                    placeholder={t('deep_research.placeholder')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 focus:bg-white transition-all resize-none shadow-sm"
                    rows={1}
                    style={{minHeight: '52px', maxHeight: '120px'}}
                />
                <button
                    onClick={handleSendMessage}
                    disabled={!query.trim() || isLoading}
                    className="absolute right-2 bottom-2 p-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </div>
            <div className="text-center mt-2 text-[10px] text-slate-400">
                {t('deep_research.ai_disclaimer')}
            </div>
        </div>

      </div>
    </div>
  );
}
