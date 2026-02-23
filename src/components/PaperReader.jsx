import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Loader2, ArrowLeft, Network, StickyNote, Plus, Trash2, BookOpen, ChevronRight, ChevronLeft, BrainCircuit, Wand2 } from 'lucide-react';
import ReactFlow, { Controls, Background, useNodesState, useEdgesState, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { ReferenceManager } from './ReferenceManager';
import { SelectionMenu } from './SelectionMenu';
import { postToWeibo } from '../utils/weiboPoster';
import { API_BASE_URL } from '../utils/api';

// Reusing minimal components from Reader for consistency

function MindMapView({ content }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!content) return;
    const lines = content.split('\n');
    const newNodes = [];
    const newEdges = [];
    let lastH1 = null;
    let lastH2 = null;
    let yPos = 0;

    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2];
        const id = `node-${index}`;
        const x = (level - 1) * 300;
        yPos += 80;

        newNodes.push({
          id,
          data: { label: text },
          position: { x, y: yPos },
          type: level === 1 ? 'input' : 'default',
          style: { 
            background: level === 1 ? '#eff6ff' : level === 2 ? '#f0fdf4' : '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px',
            width: 200,
            fontWeight: level === 1 ? 'bold' : 'normal'
          }
        });

        if (level === 2 && lastH1) {
          newEdges.push({ id: `edge-${lastH1}-${id}`, source: lastH1, target: id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
        } else if (level === 3 && lastH2) {
          newEdges.push({ id: `edge-${lastH2}-${id}`, source: lastH2, target: id, type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed } });
        }

        if (level === 1) { lastH1 = id; lastH2 = null; } 
        else if (level === 2) { lastH2 = id; }
      }
    });
    setNodes(newNodes);
    setEdges(newEdges);
  }, [content]);

  if (nodes.length === 0) return <div className="flex flex-col items-center justify-center h-full text-slate-400"><Network className="w-12 h-12 mb-4 opacity-50" /><p>暂无结构数据</p></div>;

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
        <Background /><Controls />
      </ReactFlow>
    </div>
  );
}

function PaperNotes({ refId }) {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    
    // Initial fetch
    useEffect(() => {
        fetch(`${API_BASE_URL}/api/references`)
            .then(res => res.json())
            .then(data => {
                const found = data.find(r => r.id === refId);
                if (found) {
                    setNotes(found.notes || []);
                }
            });
    }, [refId]);

    const handleAddNote = async () => {
        if (!newNote.trim()) return;
        
        const noteObj = {
            id: Date.now().toString(),
            content: newNote,
            created_at: new Date().toISOString()
        };

        const updatedNotes = [...notes, noteObj];
        setNotes(updatedNotes);
        setNewNote('');
        
        try {
             await fetch(`${API_BASE_URL}/api/references/${refId}/notes`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify(noteObj)
             });
             
             // Auto-post to Weibo
             const link = `/read-paper/${refId}${attachmentId ? '/' + attachmentId : ''}`;
             postToWeibo(`#阅读笔记# 在阅读论文时，我写下了想法：${noteObj.content.slice(0, 50)}${noteObj.content.length > 50 ? '...' : ''} [查看原文](${link})`);
        } catch (e) {
            console.error(e);
            alert('保存笔记失败');
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b border-slate-200 bg-white font-bold text-slate-700 flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> 论文笔记
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                    <textarea 
                        value={newNote}
                        onChange={e => setNewNote(e.target.value)}
                        placeholder="记录您的想法..."
                        className="w-full min-h-[80px] bg-transparent resize-none focus:outline-none text-sm text-slate-700"
                    />
                    <div className="flex justify-end pt-2 mt-2 border-t border-slate-100">
                        <button onClick={handleAddNote} disabled={!newNote.trim()} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> 添加
                        </button>
                    </div>
                </div>
                
                <div className="space-y-3">
                    {notes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(n => (
                        <div key={n.id} className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 relative group">
                            <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.content}</p>
                            <div className="mt-2 text-xs text-slate-400">{new Date(n.created_at).toLocaleString()}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const TextRenderer = ({ text, references, highlights, onHighlightRef }) => {
    if (typeof text !== 'string') return text;

    // 1. Sort Highlights by length desc
    const sortedHighlights = useMemo(() => 
        [...highlights].sort((a, b) => b.text.length - a.text.length),
    [highlights]);

    // 2. Sort References by length desc
    const sortedRefs = useMemo(() => 
        [...references].sort((a, b) => (b.title?.length || 0) - (a.title?.length || 0)), 
    [references]);

    // We process highlights first (visual priority), then inside non-highlighted text we look for refs.
    // Actually, refs usually don't overlap with user highlights unless user highlights a citation.
    // Let's assume user highlights override ref links for simplicity if they overlap perfectly.
    // Or we can process recursively.
    
    // Step A: Split by Highlights
    let parts = [{ text, type: 'text' }];
    
    sortedHighlights.forEach(hl => {
        const newParts = [];
        parts.forEach(part => {
            if (part.type !== 'text') {
                newParts.push(part);
                return;
            }
            
            // Simple string matching
            // Note: This is brittle for partial overlaps or repeated text. 
            // Ideally we need precise offsets. But without offsets, we highlight ALL occurrences of the string.
            // This is "Good Enough" for a prototype.
            const regex = new RegExp(`(${hl.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
            const split = part.text.split(regex);
            
            if (split.length > 1) {
                split.forEach((s, i) => {
                    if (i % 2 === 1) {
                        newParts.push({ type: 'highlight', text: s, highlight: hl });
                    } else if (s) {
                        newParts.push({ type: 'text', text: s });
                    }
                });
            } else {
                newParts.push(part);
            }
        });
        parts = newParts;
    });

    // Step B: Split remaining 'text' parts by References
    const finalParts = [];
    parts.forEach(part => {
        if (part.type !== 'text') {
            finalParts.push(part);
            return;
        }

        let refParts = [{ text: part.text, type: 'text' }];
        
        sortedRefs.forEach(ref => {
             if (!ref.title || ref.title.length < 4) return;
             
             const newRefParts = [];
             refParts.forEach(rp => {
                 if (rp.type !== 'text') {
                     newRefParts.push(rp);
                     return;
                 }
                 
                 const regex = new RegExp(`(${ref.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                 const split = rp.text.split(regex);
                 
                 if (split.length > 1) {
                     split.forEach((s, i) => {
                         if (i % 2 === 1) {
                             newRefParts.push({ type: 'ref', text: s, refId: ref.id });
                         } else if (s) {
                             newRefParts.push({ type: 'text', text: s });
                         }
                     });
                 } else {
                     newRefParts.push(rp);
                 }
             });
             refParts = newRefParts;
        });
        
        finalParts.push(...refParts);
    });

    return (
        <>
            {finalParts.map((p, i) => {
                if (p.type === 'highlight') {
                    return (
                        <span key={i} className="bg-yellow-200 cursor-pointer" title={p.highlight.comment || 'Highlight'}>
                            {p.text}
                        </span>
                    );
                } else if (p.type === 'ref') {
                    return (
                        <span 
                           key={i} 
                           className="border-b-2 border-dashed border-blue-400 cursor-pointer hover:bg-blue-50 text-blue-700 transition-colors"
                           onClick={(e) => {
                               e.stopPropagation();
                               onHighlightRef(p.refId);
                           }}
                           title="点击查看题录"
                        >
                            {p.text}
                        </span>
                    );
                } else {
                    return p.text;
                }
            })}
        </>
    );
};


function KnowledgeMatchList({ content, isPaper }) {
  const [knowledgeData, setKnowledgeData] = useState([]);
  const [matchedItems, setMatchedItems] = useState([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [candidates, setCandidates] = useState([]); // Extracted candidates
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/knowledge`)
      .then(res => res.json())
      .then(data => {
        setKnowledgeData(data);
      })
      .catch(console.error);
  }, [refreshTrigger]);

  useEffect(() => {
    if (!content || knowledgeData.length === 0) return;
    const allItems = knowledgeData.flatMap(m => m.items);
    const matches = allItems.filter(item => {
      if (!item.term || item.term.length < 2) return false;
      return content.toLowerCase().includes(item.term.toLowerCase());
    });
    const uniqueMatches = Array.from(new Set(matches.map(m => m.id)))
      .map(id => matches.find(m => m.id === id));
    setMatchedItems(uniqueMatches);
  }, [content, knowledgeData]);

  const handleMagicExtract = async () => {
    if (!content) return;
    // Take first 5000 chars for analysis to avoid token limit
    const textToAnalyze = content.slice(0, 5000);
    
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先配置 API Key');
      return;
    }

    setIsExtracting(true);
    setCandidates([]);
    
    try {
        const res = await fetch(`${API_BASE_URL}/api/magic/extract-knowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: textToAnalyze, 
                existingTerms: knowledgeData.flatMap(m => m.items.map(i => i.term)),
                apiKey 
            })
        });
        const data = await res.json();
        if (data.success) {
            setCandidates(data.candidates);
            if (data.candidates.length === 0) {
                alert('未发现新的候选知识点');
            }
        } else {
            alert('提取失败: ' + data.error);
        }
    } catch (e) {
        alert('请求出错');
    } finally {
        setIsExtracting(false);
    }
  };

  const handleAddCandidate = async (candidate) => {
      // Add to first module for now, or default "Uncategorized"
      // We need to call backend to add item
      // We can use the existing POST /api/knowledge logic but we need to fetch, update, save
      // Or we can create a specific endpoint for adding single item.
      // For simplicity, let's assume we add to the first module found.
      
      if (knowledgeData.length === 0) return;
      const targetModuleId = knowledgeData[0].id;
      
      const newItem = {
          id: `k_${Date.now()}`,
          term: candidate.term,
          definition: candidate.definition,
          time: candidate.time || '待定',
          importance: candidate.importance || 3,
          difficulty: candidate.difficulty || 3,
          subModule: candidate.subModule || '',
          relations: [],
          notes: [],
          images: [],
          videos: [],
          attachments: []
      };

      try {
          // We need to get latest data first to avoid race conditions?
          // Ideally backend should handle "add item to module".
          // Let's implement a simple optimistic update here + full save.
          
          const newData = knowledgeData.map(mod => {
              if (mod.id === targetModuleId) {
                  return { ...mod, items: [newItem, ...mod.items] };
              }
              return mod;
          });
          
          await fetch(`${API_BASE_URL}/api/knowledge`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(newData)
          });
          
          // Remove from candidates
          setCandidates(prev => prev.filter(c => c.term !== candidate.term));
          setRefreshTrigger(prev => prev + 1); // Refresh knowledge list
          
          postToWeibo(`#新知发现# 从论文中提取并收录了新知识点：**【${newItem.term}】**\n${newItem.definition}`);

      } catch (e) {
          alert('添加失败');
      }
  };

  return (
    <div className="flex flex-col h-full">
       <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-600" />
            关联知识 ({matchedItems.length})
          </h2>
          {isPaper && (
              <button 
                onClick={handleMagicExtract}
                disabled={isExtracting}
                className="p-1.5 bg-purple-50 text-purple-600 rounded-md hover:bg-purple-100 transition-colors disabled:opacity-50"
                title="AI 自动抽取新知识点"
              >
                  {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </button>
          )}
       </div>
       
       <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Candidates Section */}
          {candidates.length > 0 && (
              <div className="space-y-3 mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between items-center">
                      发现新知识 ({candidates.length})
                      <button onClick={() => setCandidates([])} className="text-slate-400 hover:text-slate-600">清除</button>
                  </h3>
                  {candidates.map((cand, idx) => (
                      <div key={idx} className="p-3 bg-purple-50 rounded-lg border border-purple-100 relative group">
                          <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-purple-900 text-sm">{cand.term}</h4>
                              <button 
                                onClick={() => handleAddCandidate(cand)}
                                className="bg-purple-600 text-white p-1 rounded hover:bg-purple-700 shadow-sm transition-transform active:scale-95"
                                title="添加到知识库"
                              >
                                  <Plus className="w-3 h-3" />
                              </button>
                          </div>
                          <p className="text-xs text-purple-800/80 line-clamp-2">{cand.definition}</p>
                      </div>
                  ))}
                  <div className="h-px bg-slate-100 my-2"></div>
              </div>
          )}

          {/* Matched Items */}
          <div className="space-y-3">
            {matchedItems.length === 0 && candidates.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-xs">
                    暂无关联知识
                </div>
            )}
            {matchedItems.map(item => {
                const imp = item.importance || 3;
                const diff = item.difficulty || 3;
                const impIdx = Math.max(0, Math.min(4, imp - 1));
                const diffIdx = Math.max(0, Math.min(4, diff - 1));
                const dist = impIdx + diffIdx;
                const hue = (dist / 8) * 120;
                const borderColor = `hsla(${hue}, 70%, 40%, 1)`;
                const bgColor = `hsla(${hue}, 70%, 97%, 1)`;

                return (
                <div 
                    key={item.id} 
                    className="p-3 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                    style={{
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                        borderLeftWidth: '4px'
                    }}
                >
                    <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-800 text-sm">{item.term}</h3>
                    <span className="text-[10px] opacity-60 font-mono">
                        {item.importance || 3}★
                    </span>
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.definition}
                    </p>
                </div>
                );
            })}
          </div>
       </div>
    </div>
  );
}

export function PaperReader() {
  const { refId, attachmentId } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('text'); // text | mindmap
  const [title, setTitle] = useState('');
  
  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('notes'); // 'notes' | 'refs'
  const [refRefreshTrigger, setRefRefreshTrigger] = useState(0);
  const [isExtracting, setIsExtracting] = useState(false);

  // Selection Menu State
  const [selection, setSelection] = useState(null); 
  const contentRef = useRef(null);

  const [highlights, setHighlights] = useState([]);
  const [highlightedRefId, setHighlightedRefId] = useState(null);
  const [references, setReferences] = useState([]);

  useEffect(() => {
      if (refId) {
          fetch(`${API_BASE_URL}/api/highlights`)
              .then(res => res.json())
              .then(data => {
                  setHighlights(data.filter(h => h.refId === refId));
              });
      }
  }, [refId, refRefreshTrigger]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/references`)
      .then(res => res.json())
      .then(data => setReferences(data));
  }, [refRefreshTrigger]);

  const handleHighlight = useCallback((refId) => {
      setHighlightedRefId(refId);
      setActiveTab('refs');
      setIsSidebarOpen(true);
  }, []);

  const handleSaveHighlight = async (comment) => {
      if (!selection || !refId) return;
      
      const highlightData = {
          refId,
          attachmentId: attachmentId || null, // Save attachmentId if present
          refTitle: title,
          text: selection.text,
          comment,
          color: 'yellow' // Default for now
      };

      try {
          const res = await fetch(`${API_BASE_URL}/api/highlights`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(highlightData)
          });
          if (res.ok) {
              setRefRefreshTrigger(prev => prev + 1); // Refresh to show new highlight
              clearSelection();
              
              // Auto-post to Weibo
              const link = `/read-paper/${refId}${attachmentId ? '/' + attachmentId : ''}`;
              postToWeibo(`#高亮时刻# 在**《${title}》**中发现一段精彩内容：“${selection.text.slice(0, 100)}${selection.text.length > 100 ? '...' : ''}” ${comment ? `\n\n心得：${comment}` : ''}\n\n[查看原文](${link})`);
          } else {
              alert('保存高亮失败');
          }
      } catch (e) {
          console.error(e);
          alert('保存出错');
      }
  };

  const components = useMemo(() => ({
      p: ({ node, children }) => {
          const processChild = (child) => {
              if (typeof child === 'string') {
                  // We need to handle BOTH highlights and ref links.
                  // This gets complex. Let's create a unified text processor or chain them.
                  // For now, let's nest them: Text -> Highlight Wrapper -> Ref Link Wrapper
                  // But Highlight Wrapper needs to match text.
                  
                  // Let's create a TextRenderer component that handles both
                  return <TextRenderer text={child} references={references} highlights={highlights} onHighlightRef={handleHighlight} />;
              }
              return child;
          };
          return <p className="mb-4 leading-relaxed text-slate-700">{React.Children.map(children, processChild)}</p>;
      },
      li: ({ children }) => <li>{React.Children.map(children, child => typeof child === 'string' ? <TextRenderer text={child} references={references} highlights={highlights} onHighlightRef={handleHighlight} /> : child)}</li>
  }), [references, highlights, handleHighlight]);


  // ... (rest of render)
  // Inside SelectionMenu prop:
  // onHighlight={handleSaveHighlight}


  useEffect(() => {
    loadContent();
  }, [refId, attachmentId]);

  // Handle Text Selection
  useEffect(() => {
    const handleSelection = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        return;
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      // Ensure we are inside content area
      if (contentRef.current && contentRef.current.contains(range.commonAncestorContainer)) {
         setSelection({
           x: rect.left + rect.width / 2 - 60,
           y: rect.bottom,
           text: sel.toString()
         });
      }
    };
    
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const clearSelection = () => {
     setSelection(null);
     window.getSelection().removeAllRanges();
  };

  const handleMagicExtract = async (textOverride = null) => {
    // 1. Get content (override or last 2000 chars)
    let textToExtract = textOverride;
    if (!textToExtract) {
       // Should not happen via selection menu
       return;
    }

    // 2. Get API Key
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先在“魔法管理”页面配置 DeepSeek API Key');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/extract-refs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToExtract,
          apiKey
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`魔法生效！成功提取并新增 ${data.added} 条参考文献。`);
        setRefRefreshTrigger(prev => prev + 1);
        setActiveTab('refs'); // Switch to refs tab to show result
        if (textOverride) clearSelection(); 
      } else {
        alert('提取失败: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('请求出错: ' + e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const loadContent = async () => {
    setIsLoading(true);
    try {
        const res = await fetch(`${API_BASE_URL}/api/references`);
        const refs = await res.json();
        const ref = refs.find(r => r.id === refId);
        
        if (!ref) throw new Error('Reference not found');

        let contentUrl = '';
        let pageTitle = ref.title;

        if (attachmentId) {
            const att = ref.attachments?.find(a => a.id === attachmentId);
            if (att) {
                if (att.contentPath) {
                    contentUrl = `${API_BASE_URL}${att.contentPath}`;
                }
                pageTitle = att.filename || ref.title;
            }
        } else if (ref.contentPath) {
             const filename = ref.contentPath.split('/').pop().replace('.md', '');
             contentUrl = `${API_BASE_URL}/api/references/content/${filename}`;
        } else if (ref.attachments && ref.attachments.length > 0) {
            // Fallback: If no direct content and no attachmentId specified, try first attachment with content
            const firstContentAtt = ref.attachments.find(a => a.contentPath);
            if (firstContentAtt) {
                 contentUrl = `${API_BASE_URL}${firstContentAtt.contentPath}`;
                 pageTitle = firstContentAtt.filename || ref.title;
                 // Ideally we should replace URL in browser so refresh works, but for now just load it
            }
        }

        if (contentUrl) {
            const isStatic = contentUrl.includes('/papers/');
            const contentRes = await fetch(contentUrl);
            
            if (isStatic) {
                const text = await contentRes.text();
                setContent(text);
            } else {
                const json = await contentRes.json();
                setContent(json.content);
            }
        } else {
            setContent('# No content available\n\nUnable to find Markdown content for this paper.');
        }
        
        setTitle(pageTitle);
        setIsLoading(false);
    } catch (e) {
        console.error(e);
        setContent(`# Error\n\nFailed to load paper: ${e.message}`);
        setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full bg-white flex-col">
        {/* Toolbar */}
        <div className="h-14 border-b border-slate-200 flex justify-between items-center px-6 bg-slate-50 shrink-0">
            <div className="flex items-center gap-4">
                <button 
                  onClick={() => navigate('/papers')} 
                  className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label="返回论文列表"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <h1 className="font-bold text-slate-700 truncate max-w-2xl text-lg">{title}</h1>
            </div>
            <div className="flex bg-slate-200 rounded-lg p-1 mr-4">
                 <button
                   onClick={() => setViewMode('text')}
                   className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'text' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                 >
                   文本
                 </button>
                 <button
                   onClick={() => setViewMode('mindmap')}
                   className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'mindmap' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}
                 >
                   导图
                 </button>
            </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex overflow-hidden">
            {/* Left Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 relative bg-white" ref={contentRef}>
                {selection && (
                    <SelectionMenu 
                      position={selection} 
                      onExtract={() => handleMagicExtract(selection.text)} 
                      onHighlight={handleSaveHighlight}
                      onClose={clearSelection}
                    />
                )}
                
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin" />
                        <span className="sr-only">Loading…</span>
                    </div>
                ) : viewMode === 'mindmap' ? (
                    <MindMapView content={content} />
                ) : (
                    <div className="max-w-3xl mx-auto prose prose-slate prose-lg prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-blue-600 prose-img:rounded-lg prose-img:shadow-md">
                        <ReactMarkdown components={components}>{content}</ReactMarkdown>
                    </div>
                )}
            </div>
            
            {/* Right Sidebar */}
            <div className={`bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-lg z-10 shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white">
                  <button
                    onClick={() => setActiveTab('notes')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                      activeTab === 'notes'
                        ? 'border-emerald-500 text-emerald-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <StickyNote className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('knowledge')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                      activeTab === 'knowledge'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BrainCircuit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('refs')}
                    className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
                      activeTab === 'refs'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </div>

                {/* Sidebar Body */}
                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'notes' && <PaperNotes refId={refId} />}
                    {activeTab === 'knowledge' && <KnowledgeMatchList content={content} isPaper={true} />}
                    {activeTab === 'refs' && (
                        <ReferenceManager 
                            refreshTrigger={refRefreshTrigger}
                            onMagicExtract={handleMagicExtract}
                            isExtracting={isExtracting}
                            highlightedRefId={highlightedRefId}
                            // onInsertRef: Not implementing insert ref into paper (read-only)
                        />
                    )}
                </div>
            </div>

            {/* Toggle Sidebar Button */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white border border-slate-200 p-1 rounded-l-md shadow-md z-20 hover:bg-slate-50 text-slate-500"
              style={{ right: isSidebarOpen ? '320px' : '0' }}
            >
              {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
        </div>
    </div>
  );
}
