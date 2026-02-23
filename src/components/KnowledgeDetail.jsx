import React, { useState, useRef } from 'react';
import { X, Save, Network, Wand2, Plus, Trash2, StickyNote, Loader2, Image as ImageIcon, Video, Paperclip, ExternalLink, Play, Edit } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export function KnowledgeDetail({ item, onClose, onUpdate, onDelete, allItems, modules, currentModuleId }) {
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'notes', 'relations', 'multimedia'
  const [notes, setNotes] = useState(item.notes || []);
  const [newNote, setNewNote] = useState('');
  const [relations, setRelations] = useState(item.relations || []);
  const [images, setImages] = useState(item.images || []);
  const [videos, setVideos] = useState(item.videos || []);
  const [attachments, setAttachments] = useState(item.attachments || []);
  const [isMagicRunning, setIsMagicRunning] = useState(false);
  const [manualRelationTarget, setManualRelationTarget] = useState('');
  const [manualScore, setManualScore] = useState(0.5);
  
  // Media Input States
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageDesc, setNewImageDesc] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoDesc, setNewVideoDesc] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  const imageInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const updatedNotes = [...notes, { 
      id: Date.now().toString(), 
      content: newNote, 
      created_at: new Date().toISOString() 
    }];
    setNotes(updatedNotes);
    setNewNote('');
    onUpdate({ ...item, notes: updatedNotes });
  };

  const handleDeleteNote = (noteId) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    onUpdate({ ...item, notes: updatedNotes });
  };

  const handleAddRelation = () => {
    if (!manualRelationTarget) return;
    const updatedRelations = [...relations, {
      targetId: manualRelationTarget,
      score: parseFloat(manualScore),
      type: 'manual',
      created_at: new Date().toISOString()
    }];
    setRelations(updatedRelations);
    setManualRelationTarget('');
    onUpdate({ ...item, relations: updatedRelations });
  };

  const handleDeleteRelation = (targetId) => {
    const updatedRelations = relations.filter(r => r.targetId !== targetId);
    setRelations(updatedRelations);
    onUpdate({ ...item, relations: updatedRelations });
  };

  const handleMagicRelation = async () => {
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先在魔法管理页面配置 API Key');
      return;
    }

    setIsMagicRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/knowledge-relation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetId: item.id,
          allItems: allItems,
          apiKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setRelations(data.relations);
        onUpdate({ ...item, relations: data.relations });
        alert('关联分析完成！');
      } else {
        alert('分析失败: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('请求出错');
    } finally {
      setIsMagicRunning(false);
    }
  };

  const getTargetName = (id) => {
    const found = allItems.find(i => i.id === id);
    return found ? found.term : 'Unknown';
  };

  // --- Media Handlers ---

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge/${item.id}/images`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const newImg = {
          id: Date.now().toString(),
          url: `${API_BASE_URL}${data.url}`, // Full URL for rendering
          description: newImageDesc || file.name,
          type: 'upload',
          created_at: new Date().toISOString()
        };
        const updatedImages = [...images, newImg];
        setImages(updatedImages);
        setNewImageDesc('');
        onUpdate({ ...item, images: updatedImages });
      } else {
        alert('上传失败');
      }
    } catch (e) {
      alert('上传出错');
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleAddImageUrl = () => {
    if (!newImageUrl.trim()) return;
    const newImg = {
      id: Date.now().toString(),
      url: newImageUrl,
      description: newImageDesc || '外部图片',
      type: 'url',
      created_at: new Date().toISOString()
    };
    const updatedImages = [...images, newImg];
    setImages(updatedImages);
    setNewImageUrl('');
    setNewImageDesc('');
    onUpdate({ ...item, images: updatedImages });
  };

  const handleDeleteImage = (imgId) => {
    if (!confirm('确定删除这张图片吗？')) return;
    const updatedImages = images.filter(img => img.id !== imgId);
    setImages(updatedImages);
    onUpdate({ ...item, images: updatedImages });
  };

  const handleAddVideo = () => {
    if (!newVideoUrl.trim()) return;
    const newVid = {
      id: Date.now().toString(),
      url: newVideoUrl,
      description: newVideoDesc || '视频链接',
      created_at: new Date().toISOString()
    };
    const updatedVideos = [...videos, newVid];
    setVideos(updatedVideos);
    setNewVideoUrl('');
    setNewVideoDesc('');
    onUpdate({ ...item, videos: updatedVideos });
  };

  const handleDeleteVideo = (vidId) => {
    if (!confirm('确定删除这个视频链接吗？')) return;
    const updatedVideos = videos.filter(v => v.id !== vidId);
    setVideos(updatedVideos);
    onUpdate({ ...item, videos: updatedVideos });
  };

  const getEmbedUrl = (url) => {
    // Simple YouTube ID extraction
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge/${item.id}/attachments`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const newAtt = {
          id: Date.now().toString(),
          url: `${API_BASE_URL}${data.url}`,
          filename: data.filename,
          created_at: new Date().toISOString()
        };
        const updatedAtts = [...attachments, newAtt];
        setAttachments(updatedAtts);
        onUpdate({ ...item, attachments: updatedAtts });
      } else {
        alert('上传失败');
      }
    } catch (e) {
      alert('上传出错');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAttachment = (attId) => {
    if (!confirm('确定删除这个附件吗？')) return;
    const updatedAtts = attachments.filter(a => a.id !== attId);
    setAttachments(updatedAtts);
    onUpdate({ ...item, attachments: updatedAtts });
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isAutoFilling, setIsAutoFilling] = useState(false);
  const [editForm, setEditForm] = useState({
    term: item.term,
    time: item.time,
    definition: item.definition,
    subModule: item.subModule || '',
    moduleId: currentModuleId || (modules?.find(m => m.items.some(i => i.id === item.id))?.id),
    importance: item.importance || 3,
    difficulty: item.difficulty || 3
  });

  const handleSaveInfo = () => {
    // Check if module changed
    const newModuleId = editForm.moduleId !== currentModuleId ? editForm.moduleId : null;
    
    onUpdate({ 
      ...item, 
      term: editForm.term,
      time: editForm.time,
      definition: editForm.definition,
      subModule: editForm.subModule,
      importance: parseInt(editForm.importance),
      difficulty: parseInt(editForm.difficulty)
    }, newModuleId);
    
    setIsEditing(false);
  };

  const handleAutoFill = async () => {
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先在魔法管理页面配置 API Key');
      return;
    }

    setIsAutoFilling(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/knowledge-autofill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: editForm.term, apiKey })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setEditForm(prev => ({
          ...prev,
          time: data.result.time || prev.time,
          definition: data.result.definition || prev.definition,
          subModule: data.result.subModule || prev.subModule
        }));
      } else {
        alert('自动补全失败: ' + (data.error || '未知错误'));
      }
    } catch (e) {
      alert('请求出错');
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(item.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex justify-end">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-start bg-slate-50">
          <div className="flex-1 mr-4">
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editForm.time}
                    onChange={e => setEditForm({...editForm, time: e.target.value})}
                    className="w-24 text-xs font-bold bg-white text-blue-700 border border-blue-200 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="时间"
                  />
                  <input
                    type="text"
                    value={editForm.term}
                    onChange={e => setEditForm({...editForm, term: e.target.value})}
                    className="flex-1 text-xl font-bold text-slate-800 border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="知识点名称"
                  />
                  <button
                    onClick={handleAutoFill}
                    disabled={isAutoFilling}
                    className="px-2 py-1 bg-purple-100 text-purple-600 rounded text-xs hover:bg-purple-200 flex items-center gap-1"
                    title="使用 DeepSeek 自动补全信息"
                  >
                    {isAutoFilling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                    AI补全
                  </button>
                </div>
                <div className="flex gap-2">
                  {modules && (
                    <select
                      value={editForm.moduleId}
                      onChange={e => setEditForm({...editForm, moduleId: e.target.value})}
                      className="text-sm text-slate-600 border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500 max-w-[200px]"
                    >
                      {modules.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="text"
                    value={editForm.subModule}
                    onChange={e => setEditForm({...editForm, subModule: e.target.value})}
                    className="flex-1 text-sm text-slate-500 border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="所属模块/子类"
                  />
                </div>
                <div className="flex gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-slate-500 font-bold">星级(重要性):</label>
                      <select 
                        value={editForm.importance}
                        onChange={e => setEditForm({...editForm, importance: e.target.value})}
                        className="text-xs border border-slate-300 rounded px-1 py-1 outline-none"
                      >
                         <option value="1">1星 - 核心内核</option>
                         <option value="2">2星 - 非常重要</option>
                         <option value="3">3星 - 普通</option>
                         <option value="4">4星 - 次要</option>
                         <option value="5">5星 - 外围/延伸</option>
                      </select>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                      <label className="text-xs text-slate-500 font-bold">难度:</label>
                      <select 
                        value={editForm.difficulty}
                        onChange={e => setEditForm({...editForm, difficulty: e.target.value})}
                        className="text-xs border border-slate-300 rounded px-1 py-1 outline-none"
                      >
                         <option value="1">1级 - 极难/抽象</option>
                         <option value="2">2级 - 较难</option>
                         <option value="3">3级 - 中等</option>
                         <option value="4">4级 - 较易</option>
                         <option value="5">5级 - 简单/入门</option>
                      </select>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                    {item.time}
                  </span>
                  <div className="flex gap-1">
                     <span className={`px-2 py-0.5 rounded text-xs font-bold border ${item.importance <= 2 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {item.importance || 3}星
                     </span>
                     <span className={`px-2 py-0.5 rounded text-xs font-bold border ${item.difficulty <= 2 ? 'bg-orange-50 text-orange-600 border-orange-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {item.difficulty || 3}级
                     </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-800">{item.term}</h2>
                </div>
                {item.subModule && <p className="text-sm text-slate-500">{item.subModule}</p>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === 'info' && (
              isEditing ? (
                <button 
                  onClick={handleSaveInfo}
                  className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors"
                  title="保存"
                >
                  <Save className="w-5 h-5" />
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    title="编辑基本信息"
                  >
                    <Edit className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="p-2 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-600 transition-colors"
                    title="删除知识点"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )
            )}
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('info')}
            className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors mr-6 shrink-0 ${
              activeTab === 'info' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            基本信息
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors mr-6 shrink-0 flex items-center gap-2 ${
              activeTab === 'notes' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            笔记 <span className="bg-slate-100 text-slate-600 px-1.5 rounded-full text-xs">{notes.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('relations')}
            className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors mr-6 shrink-0 flex items-center gap-2 ${
              activeTab === 'relations' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            知识关联 <span className="bg-slate-100 text-slate-600 px-1.5 rounded-full text-xs">{relations.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('multimedia')}
            className={`py-4 px-2 text-sm font-medium border-b-2 transition-colors shrink-0 flex items-center gap-2 ${
              activeTab === 'multimedia' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            多媒体与附件 <span className="bg-slate-100 text-slate-600 px-1.5 rounded-full text-xs">{images.length + videos.length + attachments.length}</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="prose prose-slate max-w-none">
              <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">定义与解释</h3>
                {isEditing ? (
                  <textarea
                    value={editForm.definition}
                    onChange={e => setEditForm({...editForm, definition: e.target.value})}
                    className="w-full min-h-[300px] text-lg text-slate-800 leading-relaxed border border-slate-300 rounded p-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="输入定义..."
                  />
                ) : (
                  <p className="text-slate-800 leading-relaxed text-lg whitespace-pre-wrap">{item.definition}</p>
                )}
              </div>
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
                {notes.length === 0 && <div className="text-center py-8 text-slate-400 text-sm">暂无笔记</div>}
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

          {/* Relations Tab */}
          {activeTab === 'relations' && (
            <div className="space-y-6">
              {/* Magic Action */}
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-purple-900 flex items-center gap-2">
                    <Wand2 className="w-4 h-4" /> 智能关联发现
                  </h3>
                  <p className="text-xs text-purple-700 mt-1">使用 AI 自动分析并发现与其他知识点的潜在联系</p>
                </div>
                <button
                  onClick={handleMagicRelation}
                  disabled={isMagicRunning}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {isMagicRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isMagicRunning ? '分析中...' : '开始分析'}
                </button>
              </div>

              {/* Manual Add */}
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-3">手动关联</h3>
                <div className="flex gap-2">
                  <select 
                    value={manualRelationTarget}
                    onChange={e => setManualRelationTarget(e.target.value)}
                    className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                  >
                    <option value="">选择关联知识点...</option>
                    {allItems
                      .filter(i => i.id !== item.id && !relations.some(r => r.targetId === i.id))
                      .map(i => (
                        <option key={i.id} value={i.id}>{i.term}</option>
                      ))
                    }
                  </select>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={manualScore}
                    onChange={e => setManualScore(e.target.value)}
                    className="w-20 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                    placeholder="0-1"
                  />
                  <button 
                    onClick={handleAddRelation}
                    disabled={!manualRelationTarget}
                    className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm hover:bg-slate-900 disabled:opacity-50"
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-700">已关联 ({relations.length})</h3>
                {relations.length === 0 && <div className="text-center py-4 text-slate-400 text-sm">暂无关联</div>}
                {relations.sort((a,b) => b.score - a.score).map((rel, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between group">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          rel.score >= 0.8 ? 'bg-green-100 text-green-700' :
                          rel.score >= 0.5 ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {rel.score.toFixed(2)}
                        </span>
                        <span className="font-medium text-slate-800">{getTargetName(rel.targetId)}</span>
                      </div>
                      {rel.reason && <p className="text-xs text-slate-500 mt-1">{rel.reason}</p>}
                    </div>
                    <button 
                      onClick={() => handleDeleteRelation(rel.targetId)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Multimedia Tab */}
          {activeTab === 'multimedia' && (
            <div className="space-y-8">
              
              {/* Images Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-500" /> 图片 ({images.length})
                  </h3>
                </div>
                
                {/* Add Image Form */}
                <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      placeholder="图片描述 (可选)" 
                      value={newImageDesc}
                      onChange={e => setNewImageDesc(e.target.value)}
                      className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="图片 URL (或者上传 ->)" 
                      value={newImageUrl}
                      onChange={e => setNewImageUrl(e.target.value)}
                      className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                    />
                    <button 
                      onClick={handleAddImageUrl}
                      disabled={!newImageUrl.trim()}
                      className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded text-sm hover:bg-slate-200 disabled:opacity-50"
                    >
                      添加 URL
                    </button>
                    <div className="w-px bg-slate-200 mx-1"></div>
                    <button 
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : '上传'}
                    </button>
                    <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>
                </div>

                {/* Images Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map(img => (
                    <div key={img.id} className="group relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                      <img src={img.url} alt={img.description} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 px-2 truncate">
                        {img.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Videos Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Video className="w-4 h-4 text-red-500" /> 视频 ({videos.length})
                  </h3>
                </div>

                <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
                  <div className="flex gap-2 mb-2">
                    <input 
                      type="text" 
                      placeholder="视频描述 (可选)" 
                      value={newVideoDesc}
                      onChange={e => setNewVideoDesc(e.target.value)}
                      className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      placeholder="视频 URL (支持 YouTube)" 
                      value={newVideoUrl}
                      onChange={e => setNewVideoUrl(e.target.value)}
                      className="flex-1 text-sm border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500"
                    />
                    <button 
                      onClick={handleAddVideo}
                      disabled={!newVideoUrl.trim()}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      添加视频
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {videos.map(vid => {
                    const embedUrl = getEmbedUrl(vid.url);
                    return (
                      <div key={vid.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="p-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                          <div className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <Play className="w-3 h-3" /> {vid.description}
                          </div>
                          <button onClick={() => handleDeleteVideo(vid.id)} className="text-slate-400 hover:text-red-500">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {embedUrl ? (
                          <div className="aspect-video">
                            <iframe 
                              src={embedUrl} 
                              className="w-full h-full" 
                              allowFullScreen 
                              title={vid.description}
                            />
                          </div>
                        ) : (
                          <div className="p-4 flex items-center justify-between">
                            <a href={vid.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                              {vid.url} <ExternalLink className="w-3 h-3" />
                            </a>
                            <span className="text-xs text-slate-400">无法预览</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Attachments Section */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-slate-500" /> 附件 ({attachments.length})
                  </h3>
                  <button 
                    onClick={() => attachmentInputRef.current?.click()}
                    disabled={isUploading}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors"
                  >
                    上传附件
                  </button>
                  <input type="file" ref={attachmentInputRef} className="hidden" onChange={handleAttachmentUpload} />
                </div>

                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="bg-white p-3 rounded border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded text-slate-500">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{att.filename}</div>
                          <div className="text-xs text-slate-400">{new Date(att.created_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={att.url} 
                          download 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="下载"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button 
                          onClick={() => handleDeleteAttachment(att.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {attachments.length === 0 && <div className="text-center py-4 text-slate-400 text-xs border border-dashed border-slate-200 rounded">暂无附件</div>}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
