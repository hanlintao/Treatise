import React, { useState, useEffect } from 'react';
import { Trash2, Copy, Highlighter, MessageSquare, Loader2, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { formatCitation } from '../utils/citationFormatter';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';

export function HighlightManager() {
  const [highlights, setHighlights] = useState([]);
  const [references, setReferences] = useState({}); // Map of refId -> ref object for citation
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [hlRes, refRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/highlights`),
        fetch(`${API_BASE_URL}/api/references`)
      ]);
      
      const hlData = await hlRes.json();
      const refData = await refRes.json();
      
      const refMap = {};
      refData.forEach(r => refMap[r.id] = r);
      setReferences(refMap);
      
      // Sort highlights by date desc
      hlData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setHighlights(hlData);
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleAll = () => {
    if (selectedIds.size === highlights.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(highlights.map(h => h.id)));
    }
  };

  const handleDelete = async (idsToDelete) => {
    if (!confirm(`确定删除选中的 ${idsToDelete.length} 条高亮吗？`)) return;

    for (const id of idsToDelete) {
      await fetch(`${API_BASE_URL}/api/highlights/${id}`, { method: 'DELETE' });
    }
    
    setHighlights(prev => prev.filter(h => !idsToDelete.includes(h.id)));
    setSelectedIds(new Set());
  };

  const handleCopy = (idsToCopy) => {
    const textParts = idsToCopy.map(id => {
      const hl = highlights.find(h => h.id === id);
      if (!hl) return '';
      const ref = references[hl.refId];
      const citation = ref ? formatCitation(ref) : (hl.refTitle || 'Unknown Source');
      
      let entry = `"${hl.text}"`;
      if (hl.comment) entry += `\n[评注] ${hl.comment}`;
      entry += `\nFrom: ${citation}`;
      return entry;
    });

    const fullText = textParts.join('\n\n---\n\n');
    navigator.clipboard.writeText(fullText).then(() => {
      alert(`已复制 ${idsToCopy.length} 条高亮内容`);
    });
  };

  const getSourceTitle = (hl) => {
     const ref = references[hl.refId];
     return ref ? ref.title : (hl.refTitle || 'Unknown Source');
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-slate-400"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
          <Highlighter className="w-6 h-6 text-yellow-500" />
          高亮管理 (Highlights)
          <span className="text-sm font-normal text-slate-400 ml-2">({highlights.length} 条)</span>
        </div>
        
        <div className="flex gap-2">
           {selectedIds.size > 0 && (
             <>
               <button 
                 onClick={() => handleCopy(Array.from(selectedIds))}
                 className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-sm font-medium"
               >
                 <Copy className="w-4 h-4" /> 复制选中 ({selectedIds.size})
               </button>
               <button 
                 onClick={() => handleDelete(Array.from(selectedIds))}
                 className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors text-sm font-medium"
               >
                 <Trash2 className="w-4 h-4" /> 删除选中
               </button>
             </>
           )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
         {highlights.length === 0 ? (
           <div className="text-center py-12 text-slate-400 border border-dashed border-slate-300 rounded-lg">
             暂无高亮内容
           </div>
         ) : (
           <>
             <div className="flex items-center gap-2 mb-2 px-1">
               <button onClick={toggleAll} className="flex items-center gap-2 text-slate-500 text-sm hover:text-slate-700">
                 {selectedIds.size === highlights.length ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                 全选
               </button>
             </div>
             
             {highlights.map(hl => (
               <div 
                 key={hl.id} 
                 className={`bg-white p-4 rounded-lg border shadow-sm transition-all ${selectedIds.has(hl.id) ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200 hover:border-blue-200'}`}
                 onClick={() => toggleSelection(hl.id)}
               >
                 <div className="flex items-start gap-3">
                   <div className="pt-1 text-slate-400">
                      {selectedIds.has(hl.id) ? <CheckSquare className="w-4 h-4 text-blue-500" /> : <Square className="w-4 h-4" />}
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="mb-2">
                        <span className={`bg-${hl.color}-100 px-1 rounded decoration-clone`}>
                          {hl.text}
                        </span>
                      </div>
                      
                      {hl.comment && (
                        <div className="flex items-start gap-2 text-sm text-slate-600 bg-slate-50 p-2 rounded mb-2">
                          <MessageSquare className="w-3 h-3 mt-1 shrink-0 text-slate-400" />
                          <span>{hl.comment}</span>
                        </div>
                      )}

                      <div className="flex justify-between items-center text-xs text-slate-400 mt-2 pt-2 border-t border-slate-50">
                        <span className="font-medium text-slate-500 truncate max-w-[60%] flex gap-2 items-center">
                          <span>From: {getSourceTitle(hl)}</span>
                            {/* Link to source paper, if possible */}
                            {highlights.find(h => h.id === hl.id)?.refId && (
                                <Link 
                                    to={`/read-paper/${hl.refId}${hl.attachmentId ? `/${hl.attachmentId}` : ''}`} 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-500 hover:underline flex items-center gap-1 hover:bg-blue-50 px-1.5 py-0.5 rounded transition-colors"
                                    title="跳转回原文"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    跳转
                                </Link>
                            )}
                        </span>
                        <span>{new Date(hl.created_at).toLocaleString()}</span>
                      </div>
                   </div>
                 </div>
               </div>
             ))}
           </>
         )}
      </div>
    </div>
  );
}
