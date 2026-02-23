import React, { useState, useEffect } from 'react';
import { Search, StickyNote, ArrowRight, Book, Database, Network, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';

export function NoteManager() {
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'chapter', 'reference', 'knowledge'
  const navigate = useNavigate();

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notes`);
      const data = await res.json();
      setNotes(data);
      setIsLoading(false);
    } catch (e) {
      console.error('Failed to load notes', e);
      setIsLoading(false);
    }
  };

  const filteredNotes = notes.filter(note => {
    const matchesSearch = (note.content || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (note.sourceTitle || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || note.sourceType === filterType;
    return matchesSearch && matchesType;
  });

  const handleNavigate = (note) => {
    navigate(note.path);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'chapter': return <Book className="w-4 h-4 text-blue-500" />;
      case 'reference': return <Database className="w-4 h-4 text-indigo-500" />;
      case 'knowledge': return <Network className="w-4 h-4 text-purple-500" />;
      default: return <StickyNote className="w-4 h-4 text-slate-500" />;
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'chapter': return '章节';
      case 'reference': return '题录';
      case 'knowledge': return '知识点';
      default: return '未知';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
          <StickyNote className="w-6 h-6 text-yellow-500" />
          笔记管理 (Notes)
          <span className="text-sm font-normal text-slate-400 ml-2">({notes.length} 条)</span>
        </div>
        <div className="flex gap-4">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索笔记..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-yellow-500 rounded-md text-sm outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex gap-2">
        {['all', 'chapter', 'reference', 'knowledge'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors border ${
              filterType === type 
                ? 'bg-yellow-50 border-yellow-200 text-yellow-700' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {type === 'all' ? '全部' : getTypeLabel(type)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-300 rounded-lg">
            {searchQuery ? '未找到匹配的笔记' : '暂无笔记'}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredNotes.map(note => (
              <div 
                key={note.id} 
                onClick={() => handleNavigate(note)}
                className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-yellow-300 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    {getIcon(note.sourceType)}
                    {getTypeLabel(note.sourceType)}: {note.sourceTitle}
                  </div>
                  <div className="text-xs text-slate-400">
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-slate-800 text-sm whitespace-pre-wrap leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                  {note.content}
                </div>
                <div className="mt-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    跳转到原文 <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
