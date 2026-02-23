import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FastChat } from './FastChat';
import { 
  Lightbulb, Plus, Trash2, Link as LinkIcon, Copy, Search, 
  FileText, Highlighter, StickyNote, X, Check, Clock, Network, Wand2, Loader2, ChevronDown, ChevronUp, Image as ImageIcon,
  CheckSquare, Square, Layers, BookOpen, FileEdit, PenTool, Download, Bot
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { MarkdownEditor } from './MarkdownEditor';
import { formatCitation } from '../utils/citationFormatter';
import { API_BASE_URL } from '../utils/api';

export function InspirationManager() {
  const [inspirations, setInspirations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]); // Multi-select
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false); // Magic Generation State (Single)
  const [isPaperGenerating, setIsPaperGenerating] = useState(false); // Paper Generation State (Multi)
  const [isAssociationsExpanded, setIsAssociationsExpanded] = useState(true); // Association toggle
  const [isPreviewMode, setIsPreviewMode] = useState(false); // Markdown Preview Mode
  const [activeSidePanel, setActiveSidePanel] = useState('none'); // 'none' | 'search' | 'chat'
  
  // SVG Generator State
  const [isSvgModalOpen, setIsSvgModalOpen] = useState(false);
  const [svgCode, setSvgCode] = useState('');
  const [isSvgGenerating, setIsSvgGenerating] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Data for Association Selector
  const [references, setReferences] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [notes, setNotes] = useState([]);
  const [knowledgeItems, setKnowledgeItems] = useState([]); 
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  useEffect(() => {
    fetchInspirations();
    // Pre-fetch association data
    fetch(`${API_BASE_URL}/api/references`).then(r => r.json()).then(setReferences);
    fetch(`${API_BASE_URL}/api/highlights`).then(r => r.json()).then(setHighlights);
    fetch(`${API_BASE_URL}/api/notes`).then(r => r.json()).then(setNotes);
    
    // Fetch Knowledge
    fetch(`${API_BASE_URL}/api/knowledge`)
      .then(r => r.json())
      .then(data => {
        const items = [];
        if (Array.isArray(data)) {
            data.forEach(mod => {
                if (mod.items && Array.isArray(mod.items)) {
                    mod.items.forEach(item => items.push({ ...item, module: mod.title || mod.name || 'Unknown Module' }));
                } else if (mod.id && mod.term) {
                     items.push({ ...mod, module: 'General' });
                }
            });
        }
        setKnowledgeItems(items);
      })
      .catch(err => console.error("Failed to load knowledge:", err));
  }, []);

  const fetchInspirations = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/inspirations`);
      const data = await res.json();
      setInspirations(data.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)));
      setIsLoading(false);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  const handleCreate = async (initialContent = '', initialAssociations = []) => {
    const newInsp = {
      content: initialContent,
      associations: initialAssociations
    };
    try {
        const res = await fetch(`${API_BASE_URL}/api/inspirations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newInsp)
        });
        const data = await res.json();
        if (data.success) {
            const created = data.inspiration;
            setInspirations(prev => [created, ...prev]);
            setSelectedId(created.id);
            setIsEditing(true); 
            return created;
        }
    } catch (e) {
        alert('创建失败');
    }
    return null;
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除这条灵感吗？')) return;
    try {
        await fetch(`${API_BASE_URL}/api/inspirations/${id}`, { method: 'DELETE' });
        setInspirations(prev => prev.filter(i => i.id !== id));
        if (selectedId === id) setSelectedId(null);
        setSelectedIds(prev => prev.filter(sid => sid !== id));
    } catch (e) {
        alert('删除失败');
    }
  };

  const handleUpdate = async (id, updates) => {
      // Optimistic update
      setInspirations(prev => prev.map(i => i.id === id ? { ...i, ...updates, updated_at: new Date().toISOString() } : i));
      
      try {
          await fetch(`${API_BASE_URL}/api/inspirations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, ...updates })
          });
      } catch (e) {
          console.error('Save failed');
      }
  };

  const handleCopy = (insp) => {
      let text = insp.content || '';
      if (insp.associations && insp.associations.length > 0) {
          text += '\n\n--- 关联内容 ---\n';
          insp.associations.forEach(assoc => {
              text += `\n[${assoc.type === 'ref' ? '文献' : assoc.type === 'highlight' ? '高亮' : '笔记'}] ${assoc.summary}`;
              if (assoc.detail) text += `\n${assoc.detail}`;
          });
      }
      navigator.clipboard.writeText(text).then(() => alert('灵感及关联内容已复制'));
  };

  // --- Multi-select Logic ---

  const toggleSelection = (e, id) => {
    e.stopPropagation();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === inspirations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(inspirations.map(i => i.id));
    }
  };

  const handleBatchCopy = () => {
    const selectedItems = inspirations.filter(i => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;

    let text = selectedItems.map((insp, idx) => {
        let itemText = `### 灵感 ${idx + 1}\n${insp.content}`;
        if (insp.associations && insp.associations.length > 0) {
            itemText += '\n\n> 关联内容:';
            insp.associations.forEach(assoc => {
                itemText += `\n> - [${assoc.type}] ${assoc.summary}`;
            });
        }
        return itemText;
    }).join('\n\n---\n\n');

    navigator.clipboard.writeText(text).then(() => alert(`已复制 ${selectedItems.length} 条灵感`));
  };

  const handleGeneratePaper = async () => {
    const selectedItems = inspirations.filter(i => selectedIds.includes(i.id));
    if (selectedItems.length === 0) return;

    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
        alert('请先在“魔法管理”页面配置 DeepSeek API Key');
        return;
    }

    setIsPaperGenerating(true);
    
    // 1. Create a placeholder inspiration for the paper
    const newInsp = await handleCreate('# 正在生成《中国翻译》期刊论文草稿...\n\n(AI 正在思考并撰写中，请稍候...)');
    if (!newInsp) {
        setIsPaperGenerating(false);
        return;
    }

    // 2. Start Streaming
    try {
        const response = await fetch(`${API_BASE_URL}/api/magic/generate-paper`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                items: selectedItems,
                apiKey
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorJson = JSON.parse(errorText);
                throw new Error(errorJson.error || response.statusText);
            } catch (e) {
                throw new Error(`请求失败 (${response.status}): ${errorText.substring(0, 100)}`);
            }
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    if (jsonStr === '[DONE]') break;
                    try {
                        const json = JSON.parse(jsonStr);
                        if (json.error) {
                            alert('生成出错: ' + json.error);
                            break;
                        }
                        if (json.content) {
                            fullContent += json.content;
                            // Real-time update logic
                            // To avoid too many re-renders/saves, we might want to buffer?
                            // But for UX, we want to see it type out.
                            // We can update local state first?
                            // Since we are using optimistic update in handleUpdate, it might be okay.
                            // But let's limit save frequency if possible.
                            // For now, just update.
                            
                            // Optimization: Update the inspirations state directly for immediate feedback,
                            // but debounce the API save.
                            // (Simplified: Just call handleUpdate, it has no debounce but it's fine for local dev)
                            
                            // Actually, let's just update local state here manually to avoid full re-render flickering
                            // and call handleUpdate less frequently or at the end?
                            // No, handleUpdate updates state.
                        }
                    } catch (e) {
                        console.error("Parse error", e);
                    }
                }
            }
            // Update UI with accumulated content
            handleUpdate(newInsp.id, { content: fullContent });
        }
        
        // Final Save
        handleUpdate(newInsp.id, { content: fullContent });
        alert('论文草稿生成完成！');

    } catch (e) {
        console.error(e);
        alert('生成请求失败');
    } finally {
        setIsPaperGenerating(false);
        setSelectedIds([]); // Clear selection
    }
  };

  // --- End Multi-select Logic ---

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
            
            const textarea = textareaRef.current;
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const newContent = selectedInspiration.content.substring(0, start) + imageMarkdown + selectedInspiration.content.substring(end);
                handleUpdate(selectedInspiration.id, { content: newContent });
            } else {
                handleUpdate(selectedInspiration.id, { content: selectedInspiration.content + imageMarkdown });
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

  const handleMagicGenerate = async () => {
      if (!selectedInspiration) return;
      if (!selectedInspiration.content && (!selectedInspiration.associations || selectedInspiration.associations.length === 0)) {
          alert('请先输入一些灵感或关联一些内容，AI 才能为您生成文本。');
          return;
      }
      
      const apiKey = localStorage.getItem('deepseek_key');
      if (!apiKey) {
          alert('请先在“魔法管理”页面配置 DeepSeek API Key');
          return;
      }

      setIsGenerating(true);
      try {
          const res = await fetch(`${API_BASE_URL}/api/magic/generate-academic-text`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  inspirationContent: selectedInspiration.content,
                  associations: selectedInspiration.associations,
                  apiKey
              })
          });
          const data = await res.json();
          
          if (data.success) {
              const newContent = selectedInspiration.content + '\n\n' + data.result;
              handleUpdate(selectedInspiration.id, { content: newContent });
          } else {
              alert('生成失败: ' + (data.error || 'Unknown error'));
          }
      } catch (e) {
          console.error(e);
          alert('请求出错');
      } finally {
          setIsGenerating(false);
      }
  };

  // Helper to clean SVG for inline rendering
  const cleanSvgForDisplay = (svg) => {
      if (!svg) return '';
      // Remove XML declaration
      let clean = svg.replace(/<\?xml.*?\?>/g, '').replace(/<!DOCTYPE.*?>/g, '');
      // Ensure width/height or style to fit container
      if (!clean.includes('width=') && !clean.includes('style=')) {
          clean = clean.replace('<svg', '<svg style="width: 100%; height: auto; max-height: 600px;"');
      }
      return clean;
  };

  const handleGenerateSvg = async () => {
      if (!selectedInspiration || !selectedInspiration.content) {
          alert('请先输入一些内容作为生成插图的依据。');
          return;
      }
      
      const apiKey = localStorage.getItem('deepseek_key');
      if (!apiKey) {
          alert('请先配置 API Key');
          return;
      }

      setIsSvgGenerating(true);
      setIsSvgModalOpen(true); // Open modal immediately to show loading
      setSvgCode(''); // Clear previous

      try {
          const res = await fetch(`${API_BASE_URL}/api/magic/generate-svg`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  content: selectedInspiration.content,
                  apiKey
              })
          });
          const data = await res.json();
          
          if (data.success) {
              setSvgCode(data.svg);
          } else {
              setSvgCode('');
              alert('生成失败: ' + (data.error || 'Unknown error'));
              setIsSvgModalOpen(false);
          }
      } catch (e) {
          console.error(e);
          alert('请求出错');
          setIsSvgModalOpen(false);
      } finally {
          setIsSvgGenerating(false);
      }
  };

  const handleInsertSvg = () => {
      if (!svgCode) return;
      // Insert as a code block with language 'svg-preview' or just 'xml' if we want standard highlighting
      // But we want to render it.
      // Let's use a custom fence: ```svg-render
      const svgBlock = `\n\`\`\`svg-render\n${svgCode}\n\`\`\`\n`;
      
      const textarea = textareaRef.current;
      if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newContent = selectedInspiration.content.substring(0, start) + svgBlock + selectedInspiration.content.substring(end);
          handleUpdate(selectedInspiration.id, { content: newContent });
      } else {
          handleUpdate(selectedInspiration.id, { content: selectedInspiration.content + svgBlock });
      }
      setIsSvgModalOpen(false);
  };

  const selectedInspiration = inspirations.find(i => i.id === selectedId);

  return (
    <div className="flex h-full bg-slate-50">
      {/* Left Sidebar List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 relative">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white z-10">
            <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-yellow-500" />
                灵感日志
            </h2>
            <div className="flex items-center gap-2">
                {/* Select All */}
                <button 
                    onClick={handleSelectAll}
                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                    title={selectedIds.length === inspirations.length ? "取消全选" : "全选"}
                >
                    {selectedIds.length > 0 && selectedIds.length === inspirations.length ? (
                        <CheckSquare className="w-4 h-4" />
                    ) : (
                        <Square className="w-4 h-4" />
                    )}
                </button>
                <button onClick={() => handleCreate()} className="p-2 bg-yellow-50 text-yellow-600 rounded-full hover:bg-yellow-100 transition-colors">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto pb-20">
            {inspirations.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">
                    暂无灵感，点击右上角 + 新建
                </div>
            ) : (
                inspirations.map(insp => (
                    <div 
                      key={insp.id}
                      onClick={() => setSelectedId(insp.id)}
                      className={`p-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 group relative ${selectedId === insp.id ? 'bg-yellow-50 border-l-4 border-l-yellow-400' : 'border-l-4 border-l-transparent'}`}
                    >
                        {/* Checkbox Overlay */}
                        <div 
                            className={`absolute left-2 top-4 z-10 ${selectedIds.includes(insp.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                            onClick={(e) => toggleSelection(e, insp.id)}
                        >
                             {selectedIds.includes(insp.id) ? (
                                <CheckSquare className="w-4 h-4 text-blue-500 bg-white" />
                             ) : (
                                <Square className="w-4 h-4 text-slate-300 bg-white hover:text-slate-400" />
                             )}
                        </div>

                        <div className={`pl-4 transition-all ${selectedIds.includes(insp.id) ? 'opacity-50' : ''}`}>
                            <h3 className="font-medium text-slate-800 line-clamp-1 mb-1">
                                {insp.content.split('\n')[0] || '无标题灵感'}
                            </h3>
                            <div className="flex justify-between items-center text-xs text-slate-400">
                                <span>{new Date(insp.updated_at).toLocaleDateString()}</span>
                                {insp.associations?.length > 0 && (
                                    <span className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                        <LinkIcon className="w-3 h-3" /> {insp.associations.length}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>

        {/* Batch Action Toolbar */}
        {selectedIds.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-3 bg-white border-t border-slate-200 shadow-lg flex gap-2 animate-in slide-in-from-bottom-2">
                <button 
                    onClick={handleBatchCopy}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded text-xs font-medium transition-colors"
                >
                    <Copy className="w-3 h-3" /> 批量复制 ({selectedIds.length})
                </button>
                <button 
                    onClick={handleGeneratePaper}
                    disabled={isPaperGenerating}
                    className="flex-1 flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded text-xs font-medium transition-colors disabled:opacity-50"
                >
                    {isPaperGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <BookOpen className="w-3 h-3" />}
                    一键写论文
                </button>
            </div>
        )}
      </div>

      {/* Right Editor Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
          {selectedInspiration ? (
              <>
                  {/* Toolbar */}
                  <div className="h-14 border-b border-slate-200 bg-white flex justify-between items-center px-6 shrink-0 overflow-x-auto overflow-y-hidden">
                      <div className="text-xs text-slate-400 flex items-center gap-2 shrink-0 mr-4">
                          <Clock className="w-3 h-3" />
                          <span className="hidden sm:inline">最后编辑: </span>
                          {new Date(selectedInspiration.updated_at).toLocaleString()}
                      </div>
                      <div className="flex gap-2 shrink-0">
                          <button 
                            onClick={() => setIsPreviewMode(!isPreviewMode)}
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded transition-colors ${isPreviewMode ? 'text-blue-600 bg-blue-50' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                            title={isPreviewMode ? "切换回编辑模式" : "预览 Markdown"}
                          >
                              {isPreviewMode ? <FileEdit className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                              {isPreviewMode ? '编辑' : '预览'}
                          </button>

                          <div className="w-px h-6 bg-slate-200 mx-1" />

                          <button 
                            onClick={() => setIsSelectorOpen(true)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                          >
                              <LinkIcon className="w-4 h-4" /> 关联内容
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                          />
                          <button 
                            onClick={handleGenerateSvg}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            title="生成学术插图 (SVG)"
                          >
                              <PenTool className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                            title="插入图片"
                          >
                              <ImageIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setActiveSidePanel(activeSidePanel === 'search' ? 'none' : 'search')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded transition-colors ${activeSidePanel === 'search' ? 'text-blue-600 bg-blue-50' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                            title={activeSidePanel === 'search' ? "关闭 Google 搜索" : "打开 Google 搜索"}
                          >
                            <Search className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setActiveSidePanel(activeSidePanel === 'chat' ? 'none' : 'chat')}
                            className={`flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded transition-colors ${activeSidePanel === 'chat' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'}`}
                            title={activeSidePanel === 'chat' ? "关闭智能问答" : "打开智能问答 (DeepSeek)"}
                          >
                            <Bot className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={handleMagicGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded transition-colors disabled:opacity-50"
                            title="基于当前灵感和关联内容生成学术文本"
                          >
                              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                              AI 续写
                          </button>
                          <button 
                            onClick={() => handleCopy(selectedInspiration)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                              <Copy className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(selectedInspiration.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                              <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
                  
                  {/* Content & Search Split View */}
                  <div className="flex-1 flex overflow-hidden">
                      {/* Left: Content Editor */}
                      <div className="flex-1 flex flex-col relative bg-white">
                        <div className="flex-1 relative">
                            {isPreviewMode ? (
                                <div className="absolute inset-0 w-full h-full p-8 overflow-y-auto">
                                    <div className="prose prose-slate max-w-none">
                                        <ReactMarkdown
                                        components={{
                                            code({node, inline, className, children, ...props}) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                if (!inline && match && match[1] === 'svg-render') {
                                                    return (
                                                        <div className="my-6 border border-slate-200 rounded-lg p-6 flex justify-center bg-white shadow-sm overflow-hidden">
                                                            <div 
                                                                className="w-full flex justify-center"
                                                                dangerouslySetInnerHTML={{ __html: cleanSvgForDisplay(String(children).replace(/\n$/, '')) }} 
                                                            />
                                                        </div>
                                                    );
                                                }
                                                return !inline ? (
                                                    <pre className="bg-slate-100 p-4 rounded-lg overflow-x-auto text-sm text-slate-800">
                                                        <code className={className} {...props}>{children}</code>
                                                    </pre>
                                                ) : (
                                                    <code className="bg-slate-100 px-1 py-0.5 rounded text-sm text-red-500 font-mono" {...props}>{children}</code>
                                                );
                                            }
                                        }}
                                        >
                                            {selectedInspiration.content}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 w-full h-full">
                                    <MarkdownEditor
                                        value={selectedInspiration.content}
                                        onChange={newValue => handleUpdate(selectedInspiration.id, { content: newValue || '' })}
                                        height="100%"
                                        preview="edit"
                                        fontSize="18px"
                                        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"
                                        onUploadImage={async (file) => {
                                            // Reuse the existing upload logic
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            try {
                                                const res = await fetch(`${API_BASE_URL}/api/upload-image`, {
                                                    method: 'POST',
                                                    body: formData
                                                });
                                                const data = await res.json();
                                                if (data.success) return data.url;
                                                throw new Error(data.error);
                                            } catch (e) {
                                                console.error(e);
                                                throw e;
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Associations Footer - Moved inside the flex column */}
                        {selectedInspiration.associations && selectedInspiration.associations.length > 0 && (
                            <div className="border-t border-slate-200 bg-white z-10">
                                <button 
                                onClick={() => setIsAssociationsExpanded(!isAssociationsExpanded)}
                                className="w-full flex justify-between items-center text-sm font-bold text-slate-500 hover:bg-slate-50 px-6 py-3 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <LinkIcon className="w-4 h-4" /> 
                                        关联内容 ({selectedInspiration.associations.length})
                                    </div>
                                    {isAssociationsExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </button>
                                
                                {isAssociationsExpanded && (
                                    <div className="px-6 pb-6 overflow-y-auto max-h-[40vh] animate-in slide-in-from-bottom-2 duration-200">
                                        <div className="grid gap-4 grid-cols-1 xl:grid-cols-2">
                                            {selectedInspiration.associations.map((assoc, idx) => (
                                                <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm relative group">
                                                    <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newAssocs = selectedInspiration.associations.filter((_, i) => i !== idx);
                                                        handleUpdate(selectedInspiration.id, { associations: newAssocs });
                                                    }}
                                                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="取消关联"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <div className="flex items-start gap-3">
                                                        <div className={`mt-1 p-1.5 rounded ${
                                                            assoc.type === 'ref' ? 'bg-blue-100 text-blue-600' :
                                                            assoc.type === 'highlight' ? 'bg-yellow-100 text-yellow-600' :
                                                            assoc.type === 'knowledge' ? 'bg-purple-100 text-purple-600' :
                                                            'bg-emerald-100 text-emerald-600'
                                                        }`}>
                                                            {assoc.type === 'ref' ? <FileText className="w-4 h-4" /> :
                                                            assoc.type === 'highlight' ? <Highlighter className="w-4 h-4" /> :
                                                            assoc.type === 'knowledge' ? <Network className="w-4 h-4" /> :
                                                            <StickyNote className="w-4 h-4" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0 pr-6">
                                                            <div className="text-sm font-medium text-slate-800 line-clamp-2">{assoc.summary}</div>
                                                            {assoc.detail && (
                                                                <div className="text-xs text-slate-500 mt-1 line-clamp-2">{assoc.detail}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                      </div>

                      {/* Right: Side Panel (Tabbed: Google Search + AI Chat) */}
                      {activeSidePanel !== 'none' && (
                          <div className="w-[450px] border-l border-slate-200 bg-white flex flex-col shadow-xl z-20 animate-in slide-in-from-right duration-300">
                              {/* Tab Header */}
                              <div className="h-10 border-b border-slate-200 flex items-center justify-between px-1 bg-slate-50 shrink-0">
                                  <div className="flex items-center gap-0">
                                      <button 
                                        onClick={() => setActiveSidePanel('search')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                                            activeSidePanel === 'search' 
                                            ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px' 
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                          <Search className="w-3.5 h-3.5" /> Google
                                      </button>
                                      <button 
                                        onClick={() => setActiveSidePanel('chat')}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
                                            activeSidePanel === 'chat' 
                                            ? 'bg-white text-indigo-600 border border-slate-200 border-b-white -mb-px' 
                                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                      >
                                          <Bot className="w-3.5 h-3.5" /> AI 问答
                                      </button>
                                  </div>
                                  <div className="flex items-center gap-1">
                                      {activeSidePanel === 'search' && (
                                          <button 
                                            onClick={() => window.open('https://www.google.com/webhp?igu=1', '_blank')}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-200"
                                            title="在新窗口打开"
                                          >
                                              <LinkIcon className="w-3.5 h-3.5" />
                                          </button>
                                      )}
                                      <button 
                                        onClick={() => setActiveSidePanel('none')}
                                        className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-200"
                                      >
                                          <X className="w-3.5 h-3.5" />
                                      </button>
                                  </div>
                              </div>
                              
                              {/* Tab Content */}
                              <div className="flex-1 bg-white relative overflow-hidden">
                                  {/* Google Search Panel */}
                                  <div className={`absolute inset-0 ${activeSidePanel === 'search' ? 'visible' : 'invisible'}`}>
                                      <iframe 
                                        src="https://www.google.com/webhp?igu=1" 
                                        className="w-full h-full border-none"
                                        title="Google Search"
                                        referrerPolicy="no-referrer"
                                      />
                                  </div>
                                  {/* AI Chat Panel */}
                                  <div className={`absolute inset-0 ${activeSidePanel === 'chat' ? 'visible' : 'invisible'}`}>
                                      <FastChat onClose={() => setActiveSidePanel('none')} embed={true} />
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </>
          ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center">
                      <Lightbulb className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>选择或新建一条灵感</p>
                  </div>
              </div>
          )}
      </div>

      {/* SVG Generator Modal */}
      {isSvgModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <PenTool className="w-5 h-5 text-slate-500" />
                        学术插图生成器
                    </h3>
                    <button onClick={() => setIsSvgModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Left: Preview */}
                    <div className="flex-1 bg-slate-100 p-8 flex items-center justify-center border-r border-slate-200 relative overflow-auto">
                        {isSvgGenerating ? (
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin" />
                                <p>正在绘制学术图表...</p>
                            </div>
                        ) : svgCode ? (
                            <div className="bg-white shadow-lg p-4 max-w-full max-h-full overflow-auto flex justify-center">
                                <div 
                                  className="w-full h-full flex justify-center"
                                  dangerouslySetInnerHTML={{ __html: cleanSvgForDisplay(svgCode) }} 
                                />
                            </div>
                        ) : (
                            <div className="text-slate-400 text-sm">等待生成结果...</div>
                        )}
                    </div>
                    
                    {/* Right: Code Editor */}
                    <div className="w-1/3 bg-slate-900 text-slate-300 flex flex-col">
                        <div className="p-2 bg-slate-800 text-xs font-mono border-b border-slate-700 flex justify-between items-center">
                            <span>SVG Source</span>
                            <button 
                                onClick={() => {
                                    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `academic-chart-${Date.now()}.svg`;
                                    a.click();
                                }}
                                disabled={!svgCode}
                                className="hover:text-white disabled:opacity-50"
                                title="下载 .svg 文件"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <textarea 
                            value={svgCode}
                            onChange={(e) => setSvgCode(e.target.value)}
                            className="flex-1 bg-transparent p-4 font-mono text-xs resize-none focus:outline-none"
                            placeholder="<svg>...</svg>"
                            spellCheck="false"
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
                    <button 
                        onClick={handleGenerateSvg}
                        disabled={isSvgGenerating}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        {svgCode ? '重新生成' : '开始生成'}
                    </button>
                    <button 
                        onClick={handleInsertSvg}
                        disabled={!svgCode}
                        className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm disabled:opacity-50 transition-colors"
                    >
                        插入到日志
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Association Selector Modal */}
      {isSelectorOpen && (
          <AssociationSelector 
             onClose={() => setIsSelectorOpen(false)}
             onSelect={(item) => {
                 const currentAssocs = selectedInspiration.associations || [];
                 // Avoid duplicates
                 if (currentAssocs.some(a => a.id === item.id && a.type === item.type)) return;
                 
                 handleUpdate(selectedInspiration.id, { 
                     associations: [...currentAssocs, item]
                 });
                 setIsSelectorOpen(false);
             }}
             references={references}
             highlights={highlights}
             notes={notes}
             knowledgeItems={knowledgeItems}
          />
      )}
    </div>
  );
}

function AssociationSelector({ onClose, onSelect, references, highlights, notes, knowledgeItems }) {
    const [activeTab, setActiveTab] = useState('refs');
    const [search, setSearch] = useState('');

    const filteredItems = useMemo(() => {
        const term = search.toLowerCase();
        if (activeTab === 'refs') {
            return references.filter(r => (r.title || '').toLowerCase().includes(term) || (r.author || '').toLowerCase().includes(term));
        } else if (activeTab === 'highlights') {
            return highlights.filter(h => (h.text || '').toLowerCase().includes(term) || (h.comment || '').toLowerCase().includes(term));
        } else if (activeTab === 'knowledge') {
            return (knowledgeItems || []).filter(k => (k.term || '').toLowerCase().includes(term) || (k.definition || '').toLowerCase().includes(term));
        } else {
            return notes.filter(n => (n.content || '').toLowerCase().includes(term));
        }
    }, [activeTab, search, references, highlights, notes, knowledgeItems]);

    const handleItemClick = (item) => {
        let assocItem;
        if (activeTab === 'refs') {
            assocItem = {
                type: 'ref',
                id: item.id,
                summary: item.title,
                detail: formatCitation(item)
            };
        } else if (activeTab === 'highlights') {
            assocItem = {
                type: 'highlight',
                id: item.id,
                summary: item.text,
                detail: `From: ${item.refTitle || 'Unknown'} (Comment: ${item.comment || 'None'})`
            };
        } else if (activeTab === 'knowledge') {
            assocItem = {
                type: 'knowledge',
                id: item.id,
                summary: item.term,
                detail: `Module: ${item.module} | ${item.definition}`
            };
        } else {
            assocItem = {
                type: 'note',
                id: item.id,
                summary: item.content,
                detail: `Source: ${item.sourceTitle || 'Unknown'}`
            };
        }
        onSelect(assocItem);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl h-[80vh] flex flex-col animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-lg">选择关联内容</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                
                <div className="p-2 bg-slate-50 border-b border-slate-200 flex gap-2">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="搜索..."
                            className="w-full pl-9 pr-3 py-1.5 rounded border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex border-b border-slate-200">
                    <button 
                      onClick={() => setActiveTab('refs')}
                      className={`flex-1 py-2 text-sm font-medium border-b-2 ${activeTab === 'refs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                    >
                        文献 ({references.length})
                    </button>
                    <button 
                      onClick={() => setActiveTab('highlights')}
                      className={`flex-1 py-2 text-sm font-medium border-b-2 ${activeTab === 'highlights' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                    >
                        高亮 ({highlights.length})
                    </button>
                    <button 
                      onClick={() => setActiveTab('knowledge')}
                      className={`flex-1 py-2 text-sm font-medium border-b-2 ${activeTab === 'knowledge' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                    >
                        知识 ({(knowledgeItems || []).length})
                    </button>
                    <button 
                      onClick={() => setActiveTab('notes')}
                      className={`flex-1 py-2 text-sm font-medium border-b-2 ${activeTab === 'notes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                    >
                        笔记 ({notes.length})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {activeTab === 'knowledge' && !search ? (
                        // Grouped view for Knowledge when not searching
                        Object.entries(
                            (knowledgeItems || []).reduce((acc, item) => {
                                const mod = item.module || 'Other';
                                if (!acc[mod]) acc[mod] = [];
                                acc[mod].push(item);
                                return acc;
                            }, {})
                        ).map(([moduleName, items]) => (
                            <div key={moduleName} className="mb-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 sticky top-0 bg-white py-1">{moduleName}</h4>
                                <div className="space-y-2">
                                    {items.map(item => (
                                        <div 
                                          key={item.id}
                                          onClick={() => handleItemClick(item)}
                                          className="p-3 bg-white border border-slate-200 rounded hover:border-purple-400 hover:bg-purple-50 cursor-pointer transition-all"
                                        >
                                            <div className="font-medium text-slate-800 text-sm flex items-center gap-2">
                                                <Network className="w-3 h-3 text-purple-500" /> {item.term}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.definition}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        // Flat list for others or search results
                        filteredItems.map(item => (
                        <div 
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={`p-3 bg-white border border-slate-200 rounded cursor-pointer transition-all ${
                              activeTab === 'knowledge' ? 'hover:border-purple-400 hover:bg-purple-50' :
                              activeTab === 'highlights' ? 'hover:border-yellow-400 hover:bg-yellow-50' :
                              'hover:border-blue-400 hover:bg-blue-50'
                          }`}
                        >
                            {activeTab === 'refs' && (
                                <>
                                    <div className="font-medium text-slate-800 text-sm">{item.title}</div>
                                    <div className="text-xs text-slate-500 mt-1">{item.author} ({item.year})</div>
                                </>
                            )}
                            {activeTab === 'highlights' && (
                                <>
                                    <div className="text-sm text-slate-800 line-clamp-2 bg-yellow-100/50 p-1 rounded inline">{item.text}</div>
                                    <div className="text-xs text-slate-500 mt-2 flex justify-between">
                                        <span>From: {item.refTitle}</span>
                                        {item.comment && <span className="text-slate-400">"{item.comment}"</span>}
                                    </div>
                                </>
                            )}
                            {activeTab === 'knowledge' && (
                                <>
                                    <div className="font-medium text-slate-800 text-sm flex items-center gap-2">
                                        <Network className="w-3 h-3 text-purple-500" /> {item.term}
                                    </div>
                                    <div className="text-xs text-slate-500 mt-1 line-clamp-2">{item.definition}</div>
                                    <div className="text-xs text-purple-400 mt-1">{item.module}</div>
                                </>
                            )}
                            {activeTab === 'notes' && (
                                <>
                                    <div className="text-sm text-slate-800 line-clamp-3">{item.content}</div>
                                    <div className="text-xs text-slate-500 mt-2">Source: {item.sourceTitle}</div>
                                </>
                            )}
                        </div>
                    ))
                    )}
                    {(!search && activeTab !== 'knowledge' && filteredItems.length === 0) || (search && filteredItems.length === 0) ? (
                        <div className="text-center text-slate-400 py-8">未找到匹配内容</div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
