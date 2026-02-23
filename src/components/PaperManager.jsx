import React, { useState, useEffect } from 'react';
import { FileText, Search, BookOpen, Calendar, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../utils/api';

export function PaperManager() {
  const [papers, setPapers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchPapers();
  }, []);

  const fetchPapers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/references`);
      const data = await res.json();
      
      const paperList = [];

      data.forEach(ref => {
        // 1. Check legacy direct content
        if (ref.contentPath) {
          paperList.push({
            id: ref.id,
            refId: ref.id,
            title: ref.title,
            sourceTitle: ref.source || ref.journalName || ref.publisher,
            type: 'legacy',
            date: ref.created_at,
            authors: ref.authors,
            contentPath: ref.contentPath
          });
        }

        // 2. Check attachments
        if (ref.attachments && Array.isArray(ref.attachments)) {
          ref.attachments.forEach(att => {
            if (att.contentPath || att.type === 'pdf') {
               paperList.push({
                 id: att.id,
                 refId: ref.id,
                 attachmentId: att.id,
                 title: att.filename || ref.title,
                 sourceTitle: ref.title, // Belongs to this reference
                 type: 'attachment',
                 date: att.created_at || ref.created_at,
                 authors: ref.authors,
                 contentPath: att.contentPath
               });
            }
          });
        }
      });

      // Sort by date desc
      paperList.sort((a, b) => new Date(b.date) - new Date(a.date));
      setPapers(paperList);
      setIsLoading(false);
    } catch (e) {
      console.error('Failed to load papers', e);
      setIsLoading(false);
    }
  };

  const filteredPapers = papers.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.sourceTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.authors || []).join(' ').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleRead = (paper) => {
    if (paper.type === 'attachment') {
      navigate(`/read-paper/${paper.refId}/${paper.attachmentId}`);
    } else {
      navigate(`/read-paper/${paper.refId}`);
    }
  };

  const handleDelete = async (e, paper) => {
    e.stopPropagation(); // Prevent navigation
    if (!confirm('确定要删除这篇论文吗？')) return;

    try {
        if (paper.type === 'attachment') {
            await fetch(`${API_BASE_URL}/api/references/${paper.refId}/attachments/${paper.attachmentId}`, {
                method: 'DELETE'
            });
        } else {
            await fetch(`${API_BASE_URL}/api/references/${paper.refId}`, {
                method: 'DELETE'
            });
        }
        // Refresh
        fetchPapers();
    } catch (err) {
        alert('删除失败');
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
          <FileText className="w-6 h-6 text-emerald-500" />
          论文管理 (Papers)
          <span className="text-sm font-normal text-slate-400 ml-2">({papers.length} 篇)</span>
        </div>
        <div className="relative w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="搜索论文..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-emerald-500 rounded-md text-sm outline-none transition-all"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : filteredPapers.length === 0 ? (
          <div className="text-center py-12 text-slate-400 border border-dashed border-slate-300 rounded-lg">
            {searchQuery ? '未找到匹配的论文' : '暂无导入的论文'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPapers.map(paper => (
              <div 
                key={paper.id} 
                onClick={() => handleRead(paper)}
                className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group flex flex-col h-40 relative"
              >
                <button 
                    onClick={(e) => handleDelete(e, paper)}
                    className="absolute top-2 right-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all z-10"
                    title="删除"
                >
                    <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-start justify-between mb-2 pr-8">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded max-w-[100%] truncate">
                    <BookOpen className="w-3 h-3" />
                    {paper.sourceTitle}
                  </div>
                </div>
                
                <h3 className="text-slate-800 font-medium text-sm mb-2 line-clamp-2 leading-relaxed flex-1">
                  {paper.title}
                </h3>
                
                <div className="mt-auto pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(paper.date).toLocaleDateString()}
                  </span>
                  <span className="text-emerald-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    阅读 <ArrowRight className="w-3 h-3" />
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
