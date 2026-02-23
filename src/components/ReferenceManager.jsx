import React, { useState, useEffect, useRef } from 'react';
import { formatCitation, sortReferences } from '../utils/citationFormatter';
import { ReferenceForm } from './ReferenceForm';
import { ReferenceDetailModal } from './ReferenceDetailModal';
import { Loader2, BookOpen, Plus, Edit, Quote, Wand2, Upload, Paperclip } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export function ReferenceManager({ onPreviewRef, content, refreshTrigger, onMagicExtract, isExtracting, onInsertRef, highlightedRefId }) {
  const [references, setReferences] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false); // Controls modal visibility
  const [editingRef, setEditingRef] = useState(null); // Data for editing
  const [detailRef, setDetailRef] = useState(null); // Data for detail view
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { current, total, status }
  const fileInputRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const itemRefs = useRef({}); // Refs for each list item

  // Scroll to highlighted ref
  useEffect(() => {
      if (highlightedRefId && itemRefs.current[highlightedRefId]) {
          itemRefs.current[highlightedRefId].scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Optional: flash effect
      }
  }, [highlightedRefId]);

  // Load references
  const loadReferences = () => {
    setIsLoading(true);
    fetch(`${API_BASE_URL}/api/references`)
      .then(res => res.json())
      .then(data => {
        // Sort references
        const sorted = sortReferences(data);
        setReferences(sorted);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to load references:', err);
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadReferences();
  }, [refreshTrigger]);

  // Save references
  const saveReferences = (updatedRefs) => {
    // Sort before saving to keep order? Or just sort on load?
    // User requirement: "按汉语拼音或英文字母顺序列出"
    // Better to sort before saving to ensure consistency
    const sorted = sortReferences(updatedRefs);
    
    fetch(`${API_BASE_URL}/api/references`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sorted),
    })
      .then(res => res.json())
      .then(() => {
        setReferences(sorted);
      })
      .catch(err => console.error('Failed to save references:', err));
  };

  const handleSaveRef = (data) => {
    let updated;
    if (editingRef) {
      // Edit existing
      updated = references.map(r => r.id === editingRef.id ? { ...data, id: editingRef.id } : r);
    } else {
      // Add new
      const newRef = {
        id: Date.now().toString(),
        ...data
      };
      updated = [...references, newRef];
    }
    saveReferences(updated);
    setIsAdding(false);
    setEditingRef(null);
  };

  const handleEditClick = (ref) => {
    setEditingRef(ref);
    setIsAdding(true);
  };

  const handleDelete = (id) => {
    if (confirm('确定要删除这条参考文献吗？')) {
      const updated = references.filter(r => r.id !== id);
      saveReferences(updated);
    }
  };

  // Poll for progress
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
            loadReferences(); // Reload to get new ref
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

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: 0, status: 'uploading', message: '上传中...' });
    
    const formData = new FormData();
    formData.append('file', file);

    fetch(`${API_BASE_URL}/api/upload-pdf`, {
      method: 'POST',
      body: formData,
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Start polling
          pollProgress(data.taskId);
        } else {
          alert('上传失败: ' + (data.error || 'Unknown error'));
          setIsUploading(false);
          setUploadProgress(null);
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        alert('上传出错');
        setIsUploading(false);
        setUploadProgress(null);
      });
      
    // Clear input
    e.target.value = '';
  };

  const filteredReferences = references.filter(ref => {
    const term = searchQuery.toLowerCase();
    return (
      (ref.title || '').toLowerCase().includes(term) ||
      (ref.authors || []).join(' ').toLowerCase().includes(term) ||
      (ref.year || '').includes(term)
    );
  });

  const handleAddPdf = (refId) => {
    // Trigger file input for a specific reference
    // We can reuse fileInputRef but we need to know which ref it's for
    // Or we can add a hidden input per ref (inefficient) or just one global input and a state for targetRefId
    setTargetRefId(refId);
    if (fileInputRef.current) {
        fileInputRef.current.click();
    }
  };

  const [targetRefId, setTargetRefId] = useState(null);

  const handleFileChange = (e) => {
      if (targetRefId) {
          // Upload for existing ref
          // We need a new endpoint or modify handleFileUpload to support refId
          // Actually backend supports `POST /api/references/:id/attachments`
          
          const file = e.target.files[0];
          if (!file) return;

          setIsUploading(true);
          setUploadProgress({ current: 0, total: 0, status: 'uploading', message: '上传中...' });
          
          const formData = new FormData();
          formData.append('file', file);

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
                  // If it's a PDF, we might need to poll for conversion if backend does it async
                  // Backend returns: { id, filename, type, path, created_at, conversionStatus, taskId }
                  // If conversionStatus is processing, we poll.
                  // Wait, check server.js implementation for `/api/references/:id/attachments`
                  // It adds attachment and returns the attachment object.
                  // It seems it does NOT trigger OCR/Conversion automatically for attachments?
                  // Let's check server.js
                  // Ah, previous code for `POST /api/upload-pdf` does OCR.
                  // But `POST /api/references/:id/attachments` just saves file.
                  // We need to trigger conversion or modify backend to trigger it for PDF attachments.
                  // Let's assume we need to trigger it or backend handles it.
                  // Actually, let's look at `server.js` again.
                  
                  // In `server.js`:
                  // app.post('/api/references/:id/attachments', ...)
                  // It saves file.
                  // It sets `conversionStatus: isPdf ? 'processing' : 'none'`
                  // It sets `taskId: isPdf ? attachmentId : null`
                  // AND IT DOES `if (isPdf) processPdfAttachment(refId, attachmentId, sourcePath);`
                  // So it DOES trigger processing.
                  
                  if (data.taskId) {
                      pollProgress(data.taskId);
                  } else {
                      setIsUploading(false);
                      setUploadProgress(null);
                      loadReferences();
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
              e.target.value = ''; // Reset input
          });

      } else {
          // Regular upload (new ref)
          handleFileUpload(e);
      }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept=".pdf" 
        onChange={handleFileChange}
      />
      <div className="p-4 border-b border-slate-200 bg-white">
         <div className="flex justify-between items-center mb-2">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              参考文献
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => onMagicExtract()}
                className="p-1.5 rounded hover:bg-purple-100 text-purple-600 transition-colors"
                title="魔法提取"
                disabled={isExtracting}
              >
                {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => {
                  // Trigger global upload
                  setTargetRefId(null);
                  if (fileInputRef.current) fileInputRef.current.click();
                }}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                title="导入PDF"
              >
                <Upload className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setEditingRef(null);
                  setIsAdding(true);
                }}
                className="p-1.5 rounded hover:bg-slate-100 text-slate-600 transition-colors"
                title="添加"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
         </div>
         <input 
           type="text"
           value={searchQuery}
           onChange={e => setSearchQuery(e.target.value)}
           className="w-full text-xs bg-slate-100 border-transparent rounded px-2 py-1.5 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
           placeholder="搜索题录..."
         />
      </div>
      
      {/* Upload Progress Bar */}
      {uploadProgress && (
        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
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

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isAdding && (
          <ReferenceForm 
            onSave={handleSaveRef} 
            onCancel={() => {
              setIsAdding(false);
              setEditingRef(null);
            }}
            initialData={editingRef}
          />
        )}

        {detailRef && (
          <ReferenceDetailModal
            reference={detailRef}
            onClose={() => setDetailRef(null)}
            onUpdate={(updatedRef) => {
              // Update list with new data
              setReferences(prev => prev.map(r => r.id === updatedRef.id ? updatedRef : r));
              // Also update detail view if open
              if (detailRef && detailRef.id === updatedRef.id) {
                 setDetailRef(updatedRef);
              }
            }}
            onPreviewAttachment={(att) => onPreviewRef && onPreviewRef({ ...detailRef, contentPath: att.contentPath, title: att.filename })}
          />
        )}

        {isLoading ? (
          <div className="text-center py-8 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : filteredReferences.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">
            {searchQuery ? '未找到相关文献' : '暂无文献'}
          </div>
        ) : (
          filteredReferences.map((ref, index) => (
            <div 
              key={ref.id} 
              ref={el => itemRefs.current[ref.id] = el}
              className={`bg-white p-3 rounded border shadow-sm group hover:border-blue-300 transition-all duration-500 ${highlightedRefId === ref.id ? 'ring-2 ring-blue-500 bg-blue-50' : 'border-slate-200'}`}
            >
              <div className="text-xs font-mono text-slate-400 mb-1 flex justify-between items-center">
                <span>[{index + 1}]</span>
                <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                   {onInsertRef && (
                     <button
                       onClick={() => onInsertRef(ref, index + 1)}
                       className="p-1 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded"
                       title="插入引用"
                     >
                       <Quote className="w-3 h-3" />
                     </button>
                   )}
                   <button
                     onClick={() => handleEditClick(ref)}
                     className="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                     title="编辑"
                   >
                     <Edit className="w-3 h-3" />
                   </button>
                   <button
                     onClick={() => handleAddPdf(ref.id)}
                     className="p-1 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                     title="添加PDF附件"
                   >
                     <Paperclip className="w-3 h-3" />
                   </button>
                </div>
              </div>
              <div className="text-sm text-slate-700 leading-snug break-words font-serif cursor-pointer hover:bg-slate-50 p-1 -m-1 rounded" onClick={() => setDetailRef(ref)}>
                {formatCitation(ref)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
