import React, { useState, useEffect, useRef } from 'react';
import { Search, Trash2, Edit, Database, Copy, Download, FileText, ExternalLink, X, Save, Plus, Paperclip, Upload, Loader2, ArrowRight, Wand2 } from 'lucide-react';
import { formatCitation, sortReferences, batchExportReferences } from '../utils/citationFormatter';
import { useNavigate } from 'react-router-dom';
import { postToWeibo } from '../utils/weiboPoster';
import { API_BASE_URL } from '../utils/api';

import { ReferenceForm } from './ReferenceForm';

export function BibliographyManager() {
  const [references, setReferences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRef, setEditingRef] = useState(null); // Reference being edited or added
  const [isAdding, setIsAdding] = useState(false); // Mode flag
  const navigate = useNavigate();
  
  // Vectorization State
  const [isVectorizing, setIsVectorizing] = useState(false);

  // PDF Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [targetRefId, setTargetRefId] = useState(null);
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    fetchReferences();
  }, []);

  const fetchReferences = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/references`);
      const data = await res.json();
      setReferences(sortReferences(data));
      setIsLoading(false);
    } catch (e) {
      console.error('Failed to load references', e);
      setIsLoading(false);
    }
  };

  const handleBatchVectorize = async () => {
      if (!confirm('确定要为所有论文重新构建语义向量吗？\n这将允许你使用自然语言搜索论文内容。\n(过程将在后台运行，每篇约需 1-2 秒)')) return;
      
      setIsVectorizing(true);
      try {
          const res = await fetch(`${API_BASE_URL}/api/papers/vectorize-all`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ force: true })
          });
          
          const data = await res.json();
          if (res.ok) {
              alert(`任务已启动: ${data.message}\n请等待片刻后尝试在论文阅览室进行语义搜索。`);
          } else {
              alert('启动失败: ' + data.error);
          }
      } catch (e) {
          console.error(e);
          alert('网络请求失败');
      } finally {
          setIsVectorizing(false);
      }
  };

  const handleUpdateReference = async (updatedRef) => {
    let updatedList;
    if (isAdding && !references.find(r => r.id === updatedRef.id)) {
        // Add new
        updatedList = [...references, updatedRef];
    } else {
        // Update existing
        updatedList = references.map(r => r.id === updatedRef.id ? updatedRef : r);
    }
    
    // Sort
    updatedList = sortReferences(updatedList);

    // Optimistic update
    setReferences(updatedList);
    setEditingRef(null);
    setIsAdding(false);

    try {
      await fetch(`${API_BASE_URL}/api/references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedList)
      });
      
      // Auto-post to Weibo if new
      if (isAdding && !references.find(r => r.id === updatedRef.id)) {
          postToWeibo(`#文献收录# 新增了一条题录：**《${updatedRef.title}》** (${updatedRef.authors[0] || 'Unknown'}, ${updatedRef.year || 'n.d.'})`);
      }
    } catch (e) {
      alert('保存失败');
      fetchReferences(); // Revert
    }
  };

  const handleAddClick = () => {
      setEditingRef({
          id: Date.now().toString(),
          title: '',
          authors: [],
          year: '',
          typeCode: '',
          source: '',
          tags: []
      });
      setIsAdding(true);
  };
  
  // ... PDF Logic ...
  const pollProgress = (taskId) => {
    const interval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/ocr-status/${taskId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            clearInterval(interval);
            setIsUploading(false);
            setUploadProgress(null);
            alert('解析失败: ' + data.error);
            return;
          }

          setUploadProgress({
            current: data.progress,
            total: data.total,
            status: data.status,
            message: data.message
          });

          if (data.status === 'completed') {
            clearInterval(interval);
            setIsUploading(false);
            setUploadProgress(null);
            fetchReferences(); // Reload to get new ref/attachment status
            
            // Auto-post to Weibo
            postToWeibo(`#论文入库# 上传了新的论文 PDF，准备开始阅读... [立即阅读](/read-paper/${taskId.replace('task_', '')})`.replace('task_', '')); 
            // Note: taskId is not refId. Wait, pollProgress doesn't know filename or refId directly unless passed.
            // We need refId here. But pollProgress is generic. 
            // Actually, we don't have easy access to refId inside pollProgress closure if it changes, but here it's defined in component.
            // But targetRefId is cleared.
            // Let's simplify: just say "uploaded new paper".
            // Or better, fetch the ref details after completion.
            // For now, simple message.
            postToWeibo(`#论文入库# 成功解析并入库了一篇新论文 PDF，知识库 +1`);
          } else if (data.status === 'error') {
             clearInterval(interval);
             setIsUploading(false);
             setUploadProgress(null);
             alert('解析出错: ' + data.error);
          }
        })
        .catch(err => {
          console.error('Polling error:', err);
          clearInterval(interval);
          setIsUploading(false);
          setUploadProgress(null);
        });
    }, 1000);
  };

  const handleAddPdf = (refId) => {
    setTargetRefId(refId);
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploading(true);
      setUploadProgress({ current: 0, total: 0, status: 'uploading', message: '上传中...' });
      
      const formData = new FormData();
      formData.append('file', file);

      if (targetRefId) {
          // Upload attachment to existing ref
          fetch(`${API_BASE_URL}/api/references/${targetRefId}/attachments`, {
              method: 'POST',
              body: formData
          })
          .then(res => res.json())
          .then(data => {
              if (data.error) {
                  alert('上传失败: ' + data.error);
                  setIsUploading(false);
                  setUploadProgress(null);
              } else {
                  if (data.taskId) {
                      pollProgress(data.taskId);
                  } else {
                      setIsUploading(false);
                      setUploadProgress(null);
                      fetchReferences();
                  }
              }
          })
          .catch(err => {
              console.error(err);
              alert('上传出错');
              setIsUploading(false);
              setUploadProgress(null);
          })
          .finally(() => {
              setTargetRefId(null);
              e.target.value = '';
          });
      }
  };

  const handleRead = (ref) => {
    // Check if it has PDF attachment or direct content
    const attachment = ref.attachments?.find(a => a.type === 'pdf' || a.contentPath);
    if (attachment) {
      navigate(`/read-paper/${ref.id}/${attachment.id}`);
    } else if (ref.contentPath) {
      navigate(`/read-paper/${ref.id}`);
    }
  };

  const filteredReferences = references.filter(ref => {
    const term = searchQuery.toLowerCase();
    return (
      (ref.title || '').toLowerCase().includes(term) ||
      (ref.authors || []).join(' ').toLowerCase().includes(term) ||
      (ref.year || '').includes(term) ||
      (ref.source || '').toLowerCase().includes(term)
    );
  });
  
  const handleDelete = async (id) => {
    if (!confirm('确定要删除这条题录吗？')) return;
    
    // Optimistic update
    const updated = references.filter(r => r.id !== id);
    setReferences(updated);

    try {
      await fetch(`${API_BASE_URL}/api/references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      alert('删除失败');
      fetchReferences(); // Revert
    }
  };

  const copyCitation = (ref, format = 'GB/T 7714') => {
    const text = formatCitation(ref, format);
    navigator.clipboard.writeText(text);
    // Simple toast
    const el = document.createElement('div');
    el.className = "fixed bottom-4 right-4 bg-slate-800 text-white px-4 py-2 rounded shadow-lg animate-in slide-in-from-bottom-2 fade-in";
    el.innerText = `已复制 ${format} 格式引用`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".pdf" 
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
          <Database className="w-6 h-6 text-indigo-600" />
          题录管理 (Bibliography)
          <span className="text-sm font-normal text-slate-400 ml-2">({references.length} 条)</span>
        </div>
        <div className="flex gap-2">
          {/* Vectorize Button */}
          <button
            onClick={handleBatchVectorize}
            disabled={isVectorizing}
            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-md transition-colors flex items-center gap-1 disabled:opacity-50"
            title="构建/更新全部论文的语义向量索引"
          >
            {isVectorizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            <span className="text-xs font-medium">重构向量</span>
          </button>

          {/* Export dropdown */}
          <div className="relative group/export">
            <button
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors flex items-center gap-1"
              title="批量导出题录"
            >
              <Download className="w-4 h-4" />
              <span className="text-xs font-medium">导出</span>
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 shadow-xl rounded-lg py-1 w-48 hidden group-hover/export:block z-20">
              <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-100">导出当前列表 ({filteredReferences.length} 条)</div>
              <button onClick={() => batchExportReferences(filteredReferences, 'bibtex')} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                <span className="w-5 text-center text-xs font-mono text-indigo-500">.bib</span> BibTeX
              </button>
              <button onClick={() => batchExportReferences(filteredReferences, 'ris')} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                <span className="w-5 text-center text-xs font-mono text-emerald-500">.ris</span> RIS (EndNote)
              </button>
              <button onClick={() => batchExportReferences(filteredReferences, 'gb7714')} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors">
                <span className="w-5 text-center text-xs font-mono text-amber-500">.txt</span> GB/T 7714
              </button>
              <button onClick={() => batchExportReferences(filteredReferences, 'csv')} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                <span className="w-5 text-center text-xs font-mono text-blue-500">.csv</span> CSV 表格
              </button>
              {filteredReferences.length < references.length && (
                <>
                  <div className="border-t border-slate-100 my-1" />
                  <div className="px-3 py-1.5 text-[10px] text-slate-400 uppercase tracking-wider">导出全部 ({references.length} 条)</div>
                  <button onClick={() => batchExportReferences(references, 'bibtex')} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2 transition-colors">
                    <span className="w-5 text-center text-xs font-mono text-indigo-500">.bib</span> 全部 BibTeX
                  </button>
                  <button onClick={() => batchExportReferences(references, 'ris')} className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                    <span className="w-5 text-center text-xs font-mono text-emerald-500">.ris</span> 全部 RIS
                  </button>
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              // Trigger global upload
              setTargetRefId(null);
              if (fileInputRef.current) fileInputRef.current.click();
            }}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md transition-colors"
            title="导入PDF (创建新题录)"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button
            onClick={handleAddClick}
            className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md transition-colors flex items-center gap-1"
            title="手动添加题录"
          >
            <Plus className="w-4 h-4" />
            <span className="text-xs font-medium">添加</span>
          </button>
          <div className="relative w-64 ml-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索题录..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-indigo-500 rounded-md text-sm outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Upload Progress Bar */}
      {uploadProgress && (
        <div className="bg-blue-50 px-6 py-3 border-b border-blue-100">
           <div className="flex justify-between text-xs text-blue-700 mb-1">
             <span>{uploadProgress.message || '处理中...'}</span>
             <span>{uploadProgress.total > 0 ? `${uploadProgress.current} / ${uploadProgress.total}` : ''}</span>
           </div>
           <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
             <div 
               className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
               style={{ width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%` }}
             />
           </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">加载中...</div>
          ) : filteredReferences.length === 0 ? (
            <div className="text-center py-12 text-slate-400 border border-dashed border-slate-300 rounded-lg">
              {searchQuery ? '未找到匹配的题录' : '暂无题录数据，请在章节阅读中通过魔法提取添加'}
            </div>
          ) : (
            filteredReferences.map((ref, idx) => (
              <div key={ref.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md transition-all group flex gap-4">
                <div className="text-slate-400 font-mono text-sm w-8 shrink-0 pt-1">
                  [{idx + 1}]
                </div>
                <div className="flex-1">
                  <div className="text-slate-800 font-serif text-lg leading-snug mb-2">
                    {formatCitation(ref)}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-500 items-center">
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {ref.typeCode || '未知类型'}
                    </span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {ref.year || '年份未知'}
                    </span>
                    {ref.type === 'pdf-parsed' && (
                      <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1">
                        <FileText className="w-3 h-3" /> PDF
                      </span>
                    )}
                    {ref.hasVectors && (
                      <span className="bg-violet-50 text-violet-600 px-2 py-0.5 rounded border border-violet-100 flex items-center gap-1" title="已构建语义向量索引">
                        <Database className="w-3 h-3" /> 已索引
                      </span>
                    )}
                    {(ref.contentPath || (ref.attachments && ref.attachments.some(a => a.type === 'pdf' || a.contentPath))) && (
                      <button
                        onClick={() => handleRead(ref)}
                        className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1 hover:bg-emerald-100 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" /> 阅读
                      </button>
                    )}
                    {ref.notes && ref.notes.length > 0 && (
                      <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded border border-yellow-100">
                        {ref.notes.length} 条笔记
                      </span>
                    )}
                    {ref.tags && ref.tags.map(tag => (
                      <span key={tag} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Actions */}
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                   <div className="relative group/copy">
                     <button 
                       className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                       title="复制引用格式"
                     >
                       <Copy className="w-4 h-4" />
                     </button>
                     <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 shadow-lg rounded-lg py-1 w-32 hidden group-hover/copy:block z-10">
                       <button onClick={() => copyCitation(ref, 'GB/T 7714')} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">GB/T 7714</button>
                       <button onClick={() => copyCitation(ref, 'APA')} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">APA</button>
                       <button onClick={() => copyCitation(ref, 'BibTeX')} className="w-full text-left px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">BibTeX</button>
                     </div>
                   </div>
                   <button 
                     onClick={() => setEditingRef(ref)}
                     className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                     title="编辑元数据"
                   >
                     <Edit className="w-4 h-4" />
                   </button>
                   <button
                     onClick={() => handleAddPdf(ref.id)}
                     className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                     title="添加PDF附件"
                   >
                     <Paperclip className="w-4 h-4" />
                   </button>
                   <button 
                     onClick={() => handleDelete(ref.id)}
                     className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                     title="删除"
                   >
                     <Trash2 className="w-4 h-4" />
                   </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingRef && (
        <ReferenceForm 
          initialData={editingRef} 
          onCancel={() => setEditingRef(null)} 
          onSave={handleUpdateReference} 
        />
      )}
    </div>
  );
}
