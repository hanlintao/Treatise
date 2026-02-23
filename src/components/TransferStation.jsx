import React, { useState, useEffect } from 'react';
import { 
  Globe, Plus, Trash2, ExternalLink, Search, FileText, 
  Highlighter, Sparkles, Sidebar as SidebarIcon, AlertCircle, 
  Loader2, ChevronRight, Save, Bot, RefreshCw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AIKnowledgeExtractor } from './AIKnowledgeExtractor';
import { API_BASE_URL } from '../utils/api';

export function TransferStation() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isExtractorOpen, setIsExtractorOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(null);

  // Load items
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/transfers`)
      .then(r => r.json())
      .then(data => {
        setItems(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0].id);
        setIsLoading(false);
      })
      .catch(e => {
        console.error(e);
        setIsLoading(false);
      });
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('确定删除此网页存档吗？')) return;
    try {
      await fetch(`${API_BASE_URL}/api/transfers/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      alert('删除失败');
    }
  };

  const handleExtractKnowledge = (item) => {
    setActiveItem(item);
    setIsExtractorOpen(true);
  };

  const handleKnowledgeExtracted = async (newItems) => {
    try {
        // Save extracted items to knowledge base
        const res = await fetch(`${API_BASE_URL}/api/knowledge/batch-add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: newItems })
        });
        const data = await res.json();
        alert(`成功提取并保存 ${data.count} 个知识点！`);
        setIsExtractorOpen(false);
    } catch (e) {
        alert('保存知识点失败');
    }
  };
  
  const handleRefresh = async (item) => {
      if (isRefreshing) return;
      if (!confirm('确定重新下载最新内容吗？这将覆盖现有存档。')) return;

      setIsRefreshing(true);
      try {
          const res = await fetch(`${API_BASE_URL}/api/transfers/${item.id}/refresh`, { method: 'POST' });
          const data = await res.json();
          if (data.success) {
              setItems(prev => prev.map(i => i.id === item.id ? data.item : i));
              alert('内容已更新！');
          } else {
              throw new Error(data.error);
          }
      } catch (e) {
          alert('刷新失败: ' + e.message);
      } finally {
          setIsRefreshing(false);
      }
  };

  const selectedItem = items.find(i => i.id === selectedId);

  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-white overflow-hidden">
      {/* Sidebar List */}
      <div className="w-80 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-indigo-600" />
            知识中转站
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="搜索网页..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-slate-400" />
              </div>
              <p>暂无网页存档</p>
              <p className="mt-1">请使用 Agent 搜索并保存</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredItems.map(item => (
                <div 
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`p-4 cursor-pointer hover:bg-slate-100 transition-colors group ${selectedId === item.id ? 'bg-white shadow-sm border-l-4 border-indigo-500' : 'border-l-4 border-transparent'}`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <h3 className={`font-medium line-clamp-2 text-sm ${selectedId === item.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {item.title}
                    </h3>
                    <button 
                      onClick={(e) => handleDelete(item.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-red-500 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <span className="truncate max-w-[150px]">{new URL(item.url || 'http://localhost').hostname}</span>
                    <span>•</span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-slate-400 line-clamp-2">
                    {item.summary}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content (Reader) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
        {selectedItem ? (
          <>
            {/* Toolbar */}
            <div className="h-16 border-b border-slate-200 px-6 flex items-center justify-between bg-white shrink-0 z-10">
              <div className="flex-1 min-w-0 mr-4">
                <h1 className="text-lg font-bold text-slate-800 truncate" title={selectedItem.title}>
                  {selectedItem.title}
                </h1>
                <a href={selectedItem.url} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 w-fit">
                   <ExternalLink className="w-3 h-3" />
                   {selectedItem.url}
                </a>
              </div>
              <div className="flex items-center gap-3">
                 <button
                    onClick={() => handleRefresh(selectedItem)}
                    disabled={isRefreshing}
                    title="重新下载网页内容"
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                 >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                 </button>

                 <button 
                   onClick={() => handleExtractKnowledge(selectedItem)}
                   className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-sm font-medium rounded-lg hover:shadow-md active:scale-95 transition-all"
                 >
                   <Sparkles className="w-4 h-4" />
                   AI 智能提取知识点
                 </button>
              </div>
            </div>

            {/* Markdown Content */}
            <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
               <article className="prose prose-slate prose-lg max-w-none">
                 <ReactMarkdown>{selectedItem.content}</ReactMarkdown>
               </article>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Globe className="w-16 h-16 mb-4 opacity-10" />
            <p>选择左侧网页查看详情</p>
          </div>
        )}
      </div>

      {/* AI Extraction Modal */}
      {isExtractorOpen && activeItem && (
        <AIKnowledgeExtractor 
           activeModuleId="ai_discovered" // Default module
           onExtract={handleKnowledgeExtracted}
           onClose={() => setIsExtractorOpen(false)}
           existingItems={[]} // Ideally verify against existing knowledge base
           inputText={activeItem.content} // Pass the full markdown content
        />
      )}
    </div>
  );
}
