import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutGrid, FileText, MoreVertical, Trash2, Edit2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export function Corkboard() {
  const [chapters, setChapters] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchChapters();
  }, []);

  const fetchChapters = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chapters`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setChapters(data);
      }
    } catch (e) {
      console.error('Failed to fetch chapters', e);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
        const res = await fetch(`${API_BASE_URL}/api/chapters/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (res.ok) {
            setChapters(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
        }
    } catch (e) {
        console.error('Failed to update status', e);
    }
  };

  const handleSynopsisChange = async (id, newSynopsis) => {
      // Optimistic update? Or blur?
      // Let's update on blur
  };

  const saveSynopsis = async (id, synopsis) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chapters/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ synopsis })
        });
        if (res.ok) {
            setChapters(prev => prev.map(c => c.id === id ? { ...c, synopsis } : c));
        }
    } catch (e) {
        console.error('Failed to update synopsis', e);
    }
  };

  const statusColors = {
      draft: 'bg-slate-200 text-slate-700',
      'in-progress': 'bg-blue-100 text-blue-700',
      done: 'bg-green-100 text-green-700'
  };

  const statusLabels = {
      draft: '草稿',
      'in-progress': '写作中',
      done: '已完成'
  };

  return (
    <div className="h-full flex flex-col bg-slate-100">
      <div className="h-16 border-b bg-white flex items-center px-6 justify-between">
        <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-slate-600" />
            <h1 className="text-xl font-bold text-slate-800">写作板 (Corkboard)</h1>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {chapters.map(chapter => (
                <div key={chapter.id} className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col h-64">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-100 flex items-start justify-between bg-slate-50 rounded-t-xl">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-8 h-8 rounded-full bg-white border flex items-center justify-center shrink-0 text-sm font-bold text-slate-500">
                                {chapter.order + 1}
                            </div>
                            <h3 
                                className="font-bold text-slate-800 truncate cursor-pointer hover:text-blue-600"
                                onClick={() => navigate(`/chapter/${chapter.id}`)}
                                title={chapter.title}
                            >
                                {chapter.title}
                            </h3>
                        </div>
                        <div className="relative group">
                            <span className={`text-xs px-2 py-1 rounded-full ${statusColors[chapter.status || 'draft']} cursor-pointer`}>
                                {statusLabels[chapter.status || 'draft']}
                            </span>
                            {/* Simple Status Dropdown on Hover */}
                            <div className="absolute right-0 top-full mt-1 w-24 bg-white border rounded shadow-lg hidden group-hover:block z-10">
                                {Object.keys(statusLabels).map(s => (
                                    <div 
                                        key={s}
                                        className="px-3 py-2 text-xs hover:bg-slate-50 cursor-pointer"
                                        onClick={() => handleStatusChange(chapter.id, s)}
                                    >
                                        {statusLabels[s]}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Body (Synopsis) */}
                    <div className="flex-1 p-4">
                        <textarea 
                            className="w-full h-full resize-none text-sm text-slate-600 focus:outline-none bg-transparent placeholder:text-slate-300"
                            placeholder="输入本章摘要/大纲..."
                            defaultValue={chapter.synopsis || ''}
                            onBlur={(e) => saveSynopsis(chapter.id, e.target.value)}
                        />
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                        <div className="flex items-center gap-1 cursor-pointer hover:text-slate-600" onClick={() => navigate(`/chapter/${chapter.id}`)}>
                            <FileText className="w-3 h-3" />
                            <span>进入写作</span>
                        </div>
                        <div>
                           {/* Word count could go here if available */}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
