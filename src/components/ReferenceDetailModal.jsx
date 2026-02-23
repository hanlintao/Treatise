import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Paperclip, StickyNote, Trash2, Upload, Loader2, Eye, Plus, File } from 'lucide-react';
import { formatCitation } from '../utils/citationFormatter';
import { API_BASE_URL } from '../utils/api';

export function ReferenceDetailModal({ reference, onClose, onUpdate, onPreviewAttachment }) {
  const [activeTab, setActiveTab] = useState('attachments'); // 'info', 'attachments', 'notes'
  const [notes, setNotes] = useState(reference.notes || []);
  const [attachments, setAttachments] = useState(reference.attachments || []);
  const [newNote, setNewNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const fileInputRef = useRef(null);

  // Sync with prop updates
  useEffect(() => {
    setNotes(reference.notes || []);
    setAttachments(reference.attachments || []);
  }, [reference]);

  // --- Notes Logic ---
  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/references/${reference.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote })
      });
      const data = await res.json();
      if (data.success) {
        setNotes(data.reference.notes);
        setNewNote('');
        onUpdate(data.reference);
      }
    } catch (e) {
      alert('添加笔记失败');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('确定删除这条笔记吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/references/${reference.id}/notes/${noteId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setNotes(data.reference.notes);
        onUpdate(data.reference);
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  // --- Attachments Logic ---
  const pollProgress = (taskId) => {
    const interval = setInterval(() => {
      fetch(`${API_BASE_URL}/api/ocr-status/${taskId}`)
        .then(res => res.json())
        .then(data => {
          if (data.error || data.status === 'error') {
            clearInterval(interval);
            setIsUploading(false);
            setUploadProgress(null);
            alert('处理失败: ' + (data.error || 'Unknown error'));
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
            // Refresh reference to get new attachment status
            // Since backend updates it async, we might need to fetch the ref again
            // But for now, let's assume parent refresh or we trigger a refetch?
            // Actually, we should refetch the specific reference to get the updated attachment list
            fetchReferences();
          }
        });
    }, 1000);
  };

  const fetchReferences = async () => {
     // Reload this reference specifically? 
     // We don't have a single ref endpoint, but we can fetch all and find it.
     // Or we can rely on parent update. 
     // Let's just manually update local state if we knew the result, but we don't know the exact path until server says so.
     // Let's call parent onUpdate which triggers a reload?
     // Actually, let's just wait for user to refresh or use the response from upload.
     // The upload response gives us taskId and attachmentId.
     // We can optimistically update or just reload.
     // Let's rely on parent to reload everything? No, that's heavy.
     // Let's implement a single ref fetch in server? We don't have it yet.
     // We'll just fetch all and filter.
     const res = await fetch(`${API_BASE_URL}/api/references`);
     const all = await res.json();
     const updated = all.find(r => r.id === reference.id);
     if (updated) {
       setAttachments(updated.attachments || []);
       onUpdate(updated);
     }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress({ current: 0, total: 0, status: 'uploading', message: '上传中...' });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/references/${reference.id}/attachments`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        // If it has a taskId, it's a PDF processing
        if (data.taskId) {
           pollProgress(data.taskId);
        } else {
           setIsUploading(false);
           setUploadProgress(null);
           fetchReferences();
        }
      } else {
        alert('上传失败');
        setIsUploading(false);
        setUploadProgress(null);
      }
    } catch (e) {
      console.error(e);
      alert('上传出错');
      setIsUploading(false);
      setUploadProgress(null);
    }
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attId) => {
    if (!confirm('确定删除这个附件吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/references/${reference.id}/attachments/${attId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setAttachments(data.reference.attachments);
        onUpdate(data.reference);
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                {reference.typeCode || 'Ref'}
              </span>
              <h2 className="text-lg font-bold text-slate-800 line-clamp-1">{reference.title}</h2>
            </div>
            <p className="text-sm text-slate-600 font-serif">{formatCitation(reference)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('attachments')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'attachments' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Paperclip className="w-4 h-4" /> 附件 ({attachments.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'notes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <StickyNote className="w-4 h-4" /> 笔记 ({notes.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* Attachments Tab */}
          {activeTab === 'attachments' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-medium text-slate-700">附件列表</h3>
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={isUploading}
                   className="flex items-center gap-1 text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
                 >
                   {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                   上传附件
                 </button>
                 <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              </div>

              {uploadProgress && (
                <div className="bg-blue-50 p-3 rounded text-xs text-blue-700 border border-blue-100 mb-4">
                   <div className="flex justify-between mb-1">
                     <span>{uploadProgress.message}</span>
                     <span>{Math.round((uploadProgress.current / uploadProgress.total) * 100) || 0}%</span>
                   </div>
                   <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                     <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                   </div>
                </div>
              )}

              {attachments.length === 0 ? (
                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
                  暂无附件
                </div>
              ) : (
                <div className="grid gap-3">
                  {attachments.map(att => (
                    <div key={att.id} className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded text-slate-500">
                          {att.type === 'pdf' ? <FileText className="w-5 h-5" /> : <File className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 text-sm">{att.filename}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                             <span>{new Date(att.created_at).toLocaleDateString()}</span>
                             {att.conversionStatus === 'processing' && <span className="text-orange-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> 转换中...</span>}
                             {att.conversionStatus === 'completed' && <span className="text-green-600">已转换</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {att.conversionStatus === 'completed' && (
                          <button 
                            onClick={() => onPreviewAttachment(att, reference)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                            title="预览内容"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  className="w-full text-sm border-0 focus:ring-0 resize-none outline-none p-0 min-h-[80px]"
                  placeholder="添加新的笔记..."
                />
                <div className="flex justify-end pt-2 border-t border-slate-100 mt-2">
                  <button 
                    onClick={handleAddNote}
                    disabled={!newNote.trim()}
                    className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> 添加
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {notes.length === 0 && (
                   <div className="text-center py-8 text-slate-400 text-sm">暂无笔记</div>
                )}
                {notes.map(note => (
                  <div key={note.id} className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 relative group">
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{note.content}</p>
                    <div className="mt-2 text-xs text-slate-400 flex justify-between items-center">
                      <span>{new Date(note.created_at).toLocaleString()}</span>
                      <button 
                        onClick={() => handleDeleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
