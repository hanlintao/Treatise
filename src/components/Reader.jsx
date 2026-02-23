import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { chapters } from '../chapters';
import { SelectionMenu } from './SelectionMenu';
import { ReferenceManager } from './ReferenceManager';
import { formatCitation, sortReferences } from '../utils/citationFormatter';
import { StickyNote, Save, Edit, Eye, Loader2, BookOpen, Plus, Trash2, Copy, Upload, FileText, Wand2, Paperclip, List, Quote, ArrowRight, X, ChevronRight, ChevronLeft, Network, Image as ImageIcon, Maximize2, Minimize2, Palette, BrainCircuit } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';
import toast from 'react-hot-toast';

import ReactFlow, {  
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState,
  MarkerType 
} from 'reactflow';
import 'reactflow/dist/style.css';

// Debounce utility hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Outline Component
function OutlineView({ content, onNavigate }) {
  const [headings, setHeadings] = useState([]);
  
  useEffect(() => {
    if (!content) return;
    const lines = content.split('\n');
    const extracted = [];
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,3})\s+(.+)$/);
      if (match) {
        extracted.push({
          level: match[1].length,
          text: match[2],
          line: index
        });
      }
    });
    setHeadings(extracted);
  }, [content]);

  if (headings.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50 items-center justify-center text-slate-400 text-sm p-4 text-center">
        <List className="w-8 h-8 mb-2 opacity-50" />
        <p>暂无大纲</p>
        <p className="text-xs mt-1">使用 # 标记标题来生成大纲</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="p-4 border-b border-slate-200 bg-white">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <List className="w-5 h-5 text-blue-500" />
          大纲
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {headings.map((h, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(h.text)}
              className={`w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 text-sm truncate transition-colors ${
                h.level === 1 ? 'font-bold text-slate-800' :
                h.level === 2 ? 'pl-4 font-medium text-slate-700' :
                'pl-8 text-slate-600'
              }`}
              title={h.text}
            >
              {h.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// MindMap Component
function MindMapView({ content }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!content) return;
    
    // Parse Markdown to Nodes
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
        
        // Simple layout logic: H1 at x=0, H2 at x=250, H3 at x=500
        const x = (level - 1) * 300;
        // Increment y for vertical spacing, but group by parent?
        // For simplicity, just stack them and let user drag
        yPos += 80;

        newNodes.push({
          id,
          data: { label: text },
          position: { x, y: yPos },
          type: level === 1 ? 'input' : 'default', // H1 as input (root-ish)
          style: { 
            background: level === 1 ? '#eff6ff' : level === 2 ? '#f0fdf4' : '#fff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '10px',
            width: 200,
            fontWeight: level === 1 ? 'bold' : 'normal'
          }
        });

        // Create Edges
        if (level === 2 && lastH1) {
          newEdges.push({
            id: `edge-${lastH1}-${id}`,
            source: lastH1,
            target: id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        } else if (level === 3 && lastH2) {
          newEdges.push({
            id: `edge-${lastH2}-${id}`,
            source: lastH2,
            target: id,
            type: 'smoothstep',
            markerEnd: { type: MarkerType.ArrowClosed },
          });
        }

        // Update tracking
        if (level === 1) {
          lastH1 = id;
          lastH2 = null; // Reset H2 context
        } else if (level === 2) {
          lastH2 = id;
        }
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [content]);

  if (nodes.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center h-full text-slate-400">
         <Network className="w-12 h-12 mb-4 opacity-50" />
         <p>暂无结构数据</p>
         <p className="text-sm">使用标题 (H1, H2, H3) 来生成思维导图</p>
       </div>
     );
  }

  return (
    <div className="w-full h-full bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function ChapterNotesList({ chapterId, refreshTrigger }) {
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chapters/${chapterId}/notes`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotes(data);
      })
      .catch(console.error);
  }, [chapterId, refreshTrigger]);

  const handleDelete = async (noteId) => {
    if (!confirm('确定删除吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/chapters/${chapterId}/notes/${noteId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes);
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  if (notes.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-xs">暂无笔记</div>;
  }

  return (
    <>
      {notes.sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map(n => (
        <div key={n.id} className="bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 relative group">
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.content}</p>
          <div className="mt-2 text-xs text-slate-400 flex justify-between items-center">
            <span>{new Date(n.created_at).toLocaleString()}</span>
            <button 
              onClick={() => handleDelete(n.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function KnowledgeMatchList({ content }) {
  const [knowledgeData, setKnowledgeData] = useState([]);
  const [matchedItems, setMatchedItems] = useState([]);

  useEffect(() => {
    // Fetch all knowledge
    fetch(`${API_BASE_URL}/api/knowledge`)
      .then(res => res.json())
      .then(data => {
        setKnowledgeData(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!content || knowledgeData.length === 0) return;
    
    // Flatten items
    const allItems = knowledgeData.flatMap(m => m.items);
    
    // Find matches (case insensitive)
    // Avoid matching too short terms to prevent noise
    const matches = allItems.filter(item => {
      if (!item.term || item.term.length < 2) return false;
      return content.toLowerCase().includes(item.term.toLowerCase());
    });
    
    // Deduplicate by ID
    const uniqueMatches = Array.from(new Set(matches.map(m => m.id)))
      .map(id => matches.find(m => m.id === id));
      
    setMatchedItems(uniqueMatches);
  }, [content, knowledgeData]);

  if (matchedItems.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center h-full text-slate-400 p-4 text-center">
         <BrainCircuit className="w-12 h-12 mb-4 opacity-50" />
         <p>未发现关联知识点</p>
         <p className="text-xs mt-2">当正文中出现知识库中的术语时，会自动在此显示。</p>
       </div>
     );
  }

  return (
    <div className="flex flex-col h-full">
       <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-purple-600" />
            关联知识 ({matchedItems.length})
          </h2>
       </div>
       <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {matchedItems.map(item => {
             // Calculate color style
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
  );
}

export function Reader() {
  const { id } = useParams();
  
  // Force re-mount on ID change to clear ALL internal state (including debounce timers)
  // This is the safest way to prevent cross-chapter content bleeding.
  return <ReaderContent key={id} id={id} />;
}

function ReaderContent({ id }) {
  const [searchParams] = useSearchParams();
  
  // Chapter state
  const [chapter, setChapter] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  
  // Note state
  const [note, setNote] = useState('');
  const [isNoteSaved, setIsNoteSaved] = useState(false); // Used as refresh trigger now
  const [activeTab, setActiveTab] = useState('outline'); // 'outline', 'notes', 'refs', 'knowledge'

  // Content state
  const [content, setContent] = useState('');
  
  useEffect(() => {
    // Simple word count: split by spaces for en, char count for zh
    if (!content) {
      setWordCount(0);
      return;
    }
    // Remove markdown symbols roughly
    const text = content.replace(/[#*`]/g, '').trim();
    const en = (text.match(/[a-zA-Z0-9]+/g) || []).length;
    const zh = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    setWordCount(en + zh);
  }, [content]);

  const handleInsertRef = (ref, index) => {
    if (!isEditing) {
      alert('请先切换到编辑模式');
      return;
    }
    
    // Insert at cursor or append?
    const textarea = document.querySelector('textarea');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = content;
      const citation = `[${index}]`; // Or ref.authors[0] + ' (' + ref.year + ')'
      const newText = text.substring(0, start) + citation + text.substring(end);
      setContent(newText);
      setIsDirty(true);
      // Restore cursor?
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + citation.length;
        textarea.focus();
      }, 0);
    }
  };
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState('text'); // 'text' | 'mindmap'
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'error'
  const [isDirty, setIsDirty] = useState(false); // Track if content is actually modified
  
  // Ref Preview State
  const [previewRef, setPreviewRef] = useState(null); // If set, shows ref content instead of chapter
  const [refRefreshTrigger, setRefRefreshTrigger] = useState(0); // Add trigger state
  const [isExtracting, setIsExtracting] = useState(false); // Extraction state
  
  // Zen Mode State
  const [isZenMode, setIsZenMode] = useState(false);
  const [zenBg, setZenBg] = useState('white'); // 'white' | 'parchment'

  const debouncedContent = useDebounce(content, 1000);
  const lastSavedContent = useRef(null);
  
  // Selection Menu State
  const [selection, setSelection] = useState(null); // { x, y, text }
  const contentRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API_BASE_URL}/api/upload-image`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            const imageUrl = data.url;
            const imageMarkdown = `\n![Image](${imageUrl})\n`;
            
            // Insert at cursor
            const textarea = textareaRef.current;
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newContent = content.substring(0, start) + imageMarkdown + content.substring(end);
                setContent(newContent);
                setIsDirty(true);
            } else {
                setContent(content + imageMarkdown);
                setIsDirty(true);
            }
        } else {
            alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
    } catch (e) {
        console.error(e);
        alert('Error uploading image');
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Fetch chapter list to find current chapter metadata
  useEffect(() => {
    if (id) {
       fetch(`${API_BASE_URL}/api/chapters`)
         .then(res => res.json())
         .then(data => {
            if (Array.isArray(data)) {
               const found = data.find(c => c.id === id);
               if (found) {
                 setChapter(found);
               }
            }
         })
         .catch(console.error);
    }
  }, [id]);

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
           x: rect.left + rect.width / 2 - 60, // Center menu
           y: rect.bottom,
           text: sel.toString()
         });
      }
    };
    
    // Use mouseup to detect selection end
    document.addEventListener('mouseup', handleSelection);
    return () => document.removeEventListener('mouseup', handleSelection);
  }, []);

  const clearSelection = () => {
     setSelection(null);
     window.getSelection().removeAllRanges();
  };

  // Handle ?ref=ID from URL
  useEffect(() => {
    const refId = searchParams.get('ref');
    if (refId) {
      // We need to fetch references to find the ref object
      fetch(`${API_BASE_URL}/api/references`)
        .then(res => res.json())
        .then(data => {
          const foundRef = data.find(r => r.id === refId);
          if (foundRef) {
            setPreviewRef(foundRef);
            setActiveTab('refs');
          }
        })
        .catch(console.error);
    }
  }, [searchParams]);

  // Load content
  useEffect(() => {
    if (id) {
      // If we are previewing a ref, don't load chapter content
      if (previewRef) return;

      setIsLoading(true);
      setSaveStatus('saved');
      lastSavedContent.current = null; 
      
      fetch(`${API_BASE_URL}/api/chapters/${id}`)
        .then(res => res.json())
        .then(data => {
          const loadedContent = data.content || '';
          setContent(loadedContent);
          
          lastSavedContent.current = loadedContent;
          setIsLoading(false);
          setIsDirty(false); // Reset dirty flag
        })
        .catch(err => {
          console.error('Failed to load chapter:', err);
          setContent('# Error loading chapter\nPlease check if the backend server is running.');
          setIsLoading(false);
          setIsDirty(false);
        });
    }
  }, [id, previewRef]); // Add previewRef dependency

  // Load Ref Content when previewRef changes
  useEffect(() => {
    if (previewRef && previewRef.contentPath) {
      setIsLoading(true);
      setIsEditing(false); // Force read mode for refs
      
      const contentPath = previewRef.contentPath;
      let fetchUrl;
      let isStatic = false;

      if (contentPath.startsWith('/papers/')) {
        // Static file serving for attachments
        fetchUrl = `${API_BASE_URL}${contentPath}`;
        isStatic = true;
      } else {
        // Legacy API fallback for older refs
        const filename = contentPath.split('/').pop().replace('.md', '');
        fetchUrl = `${API_BASE_URL}/api/references/content/${filename}`;
      }

      fetch(fetchUrl)
        .then(async res => {
          if (!res.ok) throw new Error(`Failed to load (Status: ${res.status})`);
          
          if (isStatic) {
            return res.text();
          } else {
            const data = await res.json();
            return data.content;
          }
        })
        .then(text => {
           setContent(text);
           setIsLoading(false);
        })
        .catch(err => {
           console.error('Failed to load ref content:', err);
           setContent(`# Error loading reference content\n\nCould not load content from: ${contentPath}\n\nError: ${err.message}`);
           setIsLoading(false);
        });
    }
  }, [previewRef]);

  // Auto-save content (Only for chapters, not refs)
  useEffect(() => {
    if (!previewRef && !isLoading && isDirty && lastSavedContent.current !== null && debouncedContent !== lastSavedContent.current) {
      saveContent(debouncedContent);
    }
  }, [debouncedContent, isLoading, previewRef, isDirty]);

  const saveContent = async (newContent) => {
    if (!id || previewRef) return;
    setSaveStatus('saving');
    try {
      await fetch(`${API_BASE_URL}/api/chapters/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      });
      setSaveStatus('saved');
      lastSavedContent.current = newContent;
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('error');
      toast.error('章节内容保存失败');
    }
  };

  const handleSaveNote = async () => {
    if (!id || !note.trim()) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/chapters/${id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: note })
      });
      const data = await res.json();
      if (data.success) {
        setNote('');
        setIsNoteSaved(prev => !prev);
        toast.success('笔记已保存');
      } else {
        toast.error('保存失败');
      }
    } catch (e) {
      console.error(e);
      toast.error('保存出错');
    }
  };

  const handleMagicExtract = async (textOverride = null) => {
    // 1. Get content (override or last 2000 chars)
    let textToExtract = textOverride;
    if (!textToExtract) {
       if (!content) return;
       textToExtract = content.slice(-2000);
       if (!confirm('确定要从当前章节末尾提取参考文献吗？这将使用 AI 自动分析。')) return;
    }

    // 2. Get API Key from localStorage
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

  if (!chapter && !isLoading && !previewRef) {
     // If we loaded content but still no chapter metadata, it might be weird but let's allow rendering or show loading
     // Actually, if id exists, we should have found chapter.
     // Let's just wait for chapter or handle 404
  }
  
  // Removed automatic redirect to first chapter to avoid loop if chapters list is empty or fetching
  // if (!chapter) {
  //   return <Navigate to={`/chapter/${chapters[0].id}`} replace />;
  // }

  return (
    <div className={`flex h-full ${isZenMode ? 'fixed inset-0 z-50' : ''}`}>
      {/* Main Content Area */}
      <div className={`flex-1 h-full flex flex-col transition-colors duration-300 ${
        isZenMode 
          ? (zenBg === 'parchment' ? 'bg-[#fcf5e5]' : 'bg-white') 
          : 'bg-white'
      }`}>
        {/* Toolbar */}
        {!isZenMode && (
        <div className="h-14 border-b border-slate-200 flex justify-between items-center px-8 bg-slate-50 shrink-0">
           <h1 className="font-bold text-slate-700 truncate max-w-lg flex items-center gap-2">
             {previewRef ? (
               <>
                 <span className="text-slate-400 font-normal cursor-pointer hover:text-blue-600" onClick={() => setPreviewRef(null)}>
                   {chapter?.title || 'Loading...'}
                 </span>
                 <span className="text-slate-400">/</span>
                 <span className="text-blue-600">{previewRef.title}</span>
               </>
             ) : (
               chapter?.title || (isLoading ? 'Loading...' : 'Chapter Not Found')
             )}
           </h1>
           <div className="flex items-center gap-4">
             {/* Save Status - Hide for refs */}
             {!previewRef && (
               <div className="text-xs text-slate-500 flex items-center gap-1 w-20 justify-end">
                 {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> 保存中...</>}
                 {saveStatus === 'saved' && '已保存'}
                 {saveStatus === 'error' && <span className="text-red-500">保存失败</span>}
               </div>
             )}

             {/* Mode Toggle - Disable for refs */}
             {!previewRef && (
               <div className="flex bg-slate-100 rounded-lg p-1 mr-2">
                 <button
                   onClick={() => setViewMode('text')}
                   className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     viewMode === 'text' 
                       ? 'bg-white text-blue-600 shadow-sm' 
                       : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   <FileText className="w-4 h-4 inline-block mr-1" /> 文本
                 </button>
                 <button
                   onClick={() => setViewMode('mindmap')}
                   className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                     viewMode === 'mindmap' 
                       ? 'bg-white text-blue-600 shadow-sm' 
                       : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   <Network className="w-4 h-4 inline-block mr-1" /> 导图
                 </button>
               </div>
             )}

             {/* Edit Toggle - Only show in text mode */}
             {!previewRef && viewMode === 'text' && (
               <>
               {isEditing && (
                 <>
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                   />
                   <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-sm mr-2"
                      title="插入图片"
                   >
                      <ImageIcon className="w-4 h-4" />
                   </button>
                 </>
               )}
               <button
                 onClick={() => setIsEditing(!isEditing)}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-sm"
               >
                 {isEditing ? (
                   <>
                     <Eye className="w-4 h-4" /> 预览模式
                   </>
                 ) : (
                   <>
                     <Edit className="w-4 h-4" /> 编辑模式
                   </>
                 )}
               </button>
               </>
             )}
             
             {previewRef && (
                <button
                 onClick={() => setPreviewRef(null)}
                 className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 transition-colors shadow-sm"
               >
                 返回正文
               </button>
             )}

             {/* Zen Mode Toggle */}
             {!previewRef && (
                <button
                  onClick={() => setIsZenMode(true)}
                  className="ml-2 p-2 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                  title="进入禅模式"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
             )}
           </div>
        </div>
        )}

        {/* Zen Mode Controls (Floating) */}
        {isZenMode && (
          <div className="fixed top-4 right-4 flex items-center gap-2 z-50">
             {/* Background Toggle */}
             <div className="relative group">
                <button className="p-2 rounded-full bg-slate-100/50 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors backdrop-blur-sm">
                   <Palette className="w-5 h-5" />
                </button>
                <div className="absolute right-0 top-full mt-2 bg-white rounded-lg shadow-lg border border-slate-200 p-2 hidden group-hover:block w-32">
                   <button 
                     onClick={() => setZenBg('white')}
                     className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-50 ${zenBg === 'white' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                   >
                     极简白
                   </button>
                   <button 
                     onClick={() => setZenBg('parchment')}
                     className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-50 ${zenBg === 'parchment' ? 'text-blue-600 font-medium' : 'text-slate-600'}`}
                   >
                     羊皮纸
                   </button>
                </div>
             </div>
             
             {/* Exit Zen Mode */}
             <button
               onClick={() => setIsZenMode(false)}
               className="p-2 rounded-full bg-slate-100/50 hover:bg-red-100 text-slate-500 hover:text-red-600 transition-colors backdrop-blur-sm"
               title="退出禅模式 (Esc)"
             >
               <Minimize2 className="w-5 h-5" />
             </button>
          </div>
        )}

        <div className={`flex-1 overflow-y-auto relative ${isZenMode ? 'flex justify-center' : 'p-8 md:p-12'}`} ref={contentRef}>
           <div className={isZenMode ? "max-w-3xl w-full py-12 px-8 min-h-full" : "w-full h-full"}>
           {selection && (
            <SelectionMenu 
              position={selection} 
              onExtract={() => handleMagicExtract(selection.text)} 
              onClose={clearSelection}
            />
          )}
          {isLoading ? (
             <div className="flex items-center justify-center h-full text-slate-400">
               <Loader2 className="w-8 h-8 animate-spin" />
             </div>
          ) : viewMode === 'mindmap' ? (
             <MindMapView content={content} />
          ) : isEditing && !previewRef ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setIsDirty(true);
              }}
              className="w-full h-full resize-none outline-none font-mono text-slate-800 leading-relaxed bg-transparent"
              placeholder="# 开始写作..."
              spellCheck="false"
            />
          ) : (
            <div className={`max-w-3xl mx-auto prose prose-slate prose-lg prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-blue-600 prose-img:rounded-lg prose-img:shadow-md ${isZenMode ? 'prose-p:text-lg prose-p:leading-8' : ''}`}>
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
          </div>
        </div>

        {/* Status Bar - Moved inside main column */}
        {!isZenMode && (
          <div className="h-8 bg-white border-t border-slate-200 flex items-center px-4 text-xs text-slate-500 justify-between shrink-0">
             <div className="flex items-center gap-4">
               <span>字数: {wordCount}</span>
               <span>预计阅读: {Math.ceil(wordCount / 300)} 分钟</span>
             </div>
             <div className="flex items-center gap-2">
               {saveStatus === 'saving' && <><Loader2 className="w-3 h-3 animate-spin" /> 保存中...</>}
               {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><Save className="w-3 h-3" /> 已保存</span>}
               {saveStatus === 'error' && <span className="text-red-500">保存失败</span>}
             </div>
          </div>
        )}
      </div>

      {/* Right Sidebar */}
      {!isZenMode && (
      <div className={`bg-slate-50 border-l border-slate-200 flex flex-col h-full shadow-lg z-10 shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
        {/* Sidebar Tabs */}
        <div className="flex border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('outline')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'outline'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            title="大纲"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('refs')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'refs'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            title="参考文献"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'knowledge'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            title="关联知识"
          >
            <BrainCircuit className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'notes'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            title="笔记"
          >
            <StickyNote className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Content */}
        <div className="flex-1 overflow-hidden relative">
          {activeTab === 'outline' && (
            <OutlineView 
              content={content} 
              onNavigate={(text) => {
                // Scroll to heading
                // Simple text search for heading
                // Ideally we should use IDs or source mapping
                // Since we use ReactMarkdown, it doesn't expose DOM nodes easily mapped to source lines
                // We can try to find the element by text content
                const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
                for (let el of elements) {
                  if (el.textContent === text) {
                    el.scrollIntoView({ behavior: 'smooth' });
                    break;
                  }
                }
              }} 
            />
          )}
          {activeTab === 'refs' && (
            <ReferenceManager 
              onPreviewRef={setPreviewRef} 
              content={content} 
              refreshTrigger={refRefreshTrigger}
              onMagicExtract={handleMagicExtract}
              isExtracting={isExtracting}
              onInsertRef={handleInsertRef}
            />
          )}
          {activeTab === 'knowledge' && (
            <KnowledgeMatchList content={content} />
          )}
          {activeTab === 'notes' && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <span className="text-sm font-bold text-slate-700">章节笔记</span>
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="在此处记录新的笔记..."
                    className="w-full min-h-[80px] bg-transparent resize-none focus:outline-none text-sm text-slate-700"
                  />
                  <div className="flex justify-end pt-2 mt-2 border-t border-slate-100">
                    <button
                      onClick={handleSaveNote}
                      disabled={!note.trim()}
                      className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> 添加
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Reuse note state for new note input, need a separate state for list */}
                  {/* Wait, I need to refactor state to support list */}
                  {/* Let's fetch notes list here */}
                  <ChapterNotesList chapterId={id} refreshTrigger={isNoteSaved} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      
      {/* Toggle Sidebar Button */}
      {!isZenMode && (
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white border border-slate-200 p-1 rounded-l-md shadow-md z-20 hover:bg-slate-50 text-slate-500"
        style={{ right: isSidebarOpen ? '320px' : '0' }}
        title={isSidebarOpen ? "收起侧边栏" : "展开侧边栏"}
      >
        {isSidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
      )}
    </div>
  );
}
