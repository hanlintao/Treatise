import React, { useState, useEffect } from 'react';
import { KnowledgeDiscoveryAgent } from './KnowledgeDiscoveryAgent';
import { useNavigate } from 'react-router-dom';
import { Settings, X, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export function DiscoveryPage() {
  const navigate = useNavigate();
  const [showStopList, setShowStopList] = useState(false);

  const handleBatchAdd = async (items, sources) => {
    try {
      // Extract source URLs to add to Stop List
      const sourceUrls = sources ? sources.map(s => s.url) : [];

      const res = await fetch(`${API_BASE_URL}/api/knowledge/batch-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            items,
            sourceUrls 
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`成功添加 ${data.count} 个知识点到 "${data.moduleName}"！\n(相关来源已加入停用列表，未来将不再抓取)`);
        // Stay on page, do not navigate
      } else {
        alert('添加失败: ' + data.error);
      }
    } catch (e) {
      alert('网络错误: ' + e.message);
    }
  };

  return (
    <div className="h-full w-full bg-slate-100 p-4 relative">
       {/* Toolbar */}
       <div className="absolute top-6 right-8 z-10">
          <button 
             onClick={() => setShowStopList(true)}
             className="px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
          >
             <Settings className="w-4 h-4" />
             停用名单
          </button>
       </div>

       <div className="h-full w-full bg-white rounded-xl shadow-sm overflow-hidden border border-slate-200">
          <KnowledgeDiscoveryAgent 
            inline={true} 
            onAddKnowledge={handleBatchAdd} 
          />
       </div>

       {showStopList && <StopListModal onClose={() => setShowStopList(false)} />}
    </div>
  );
}

function StopListModal({ onClose }) {
  const [urls, setUrls] = useState([]);
  const [newUrl, setNewUrl] = useState('');

  useEffect(() => {
     fetch(`${API_BASE_URL}/api/config/stop-urls`)
       .then(r => r.json())
       .then(setUrls)
       .catch(console.error);
  }, []);

  const addUrl = async () => {
    if(!newUrl) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/stop-urls`, {
         method: 'POST',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ url: newUrl })
      });
      const data = await res.json();
      if(data.success) {
         setUrls(data.list);
         setNewUrl('');
      } else {
         alert(data.error);
      }
    } catch(e) { alert(e.message) }
  };

  const removeUrl = async (url) => {
    if(!confirm('确定移除?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/stop-urls`, {
         method: 'DELETE',
         headers: {'Content-Type': 'application/json'},
         body: JSON.stringify({ url })
      });
      const data = await res.json();
      if(data.success) {
         setUrls(data.list);
      }
    } catch(e) { alert(e.message) }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
       <div className="bg-white items-center rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
          <div className="p-4 border-b flex justify-between items-center w-full">
             <h3 className="font-bold text-lg">停用网址管理</h3>
             <button onClick={onClose}><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 w-full flex-1 overflow-auto">
             <div className="flex gap-2 mb-4">
               <input 
                 className="flex-1 border p-2 rounded" 
                 placeholder="输入要屏蔽的网址..." 
                 value={newUrl}
                 onChange={e => setNewUrl(e.target.value)}
                 onKeyDown={e => e.key === 'Enter' && addUrl()}
               />
               <button onClick={addUrl} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2">
                 <Plus className="w-4 h-4" /> 添加
               </button>
             </div>
             
             <div className="space-y-2">
               {urls.map(u => (
                  <div key={u} className="flex justify-between items-center bg-slate-50 p-2 rounded border">
                     <span className="truncate flex-1 text-sm font-mono mr-2" title={u}>{u}</span>
                     <button onClick={() => removeUrl(u)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                        <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               ))}
               {urls.length === 0 && <div className="text-center text-slate-400 py-8">暂无停用网址</div>}
             </div>
          </div>
       </div>
    </div>
  );
}
