import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Network, Search, Plus, Trash2, Edit, Save, X, Loader2, ArrowRight, Wand2, Clock, List, Grid, Download, Sparkles, Brain } from 'lucide-react';
import { KnowledgeDetail } from './KnowledgeDetail';
import { KnowledgeTimeline } from './KnowledgeTimeline';
import { KnowledgeHeatmap } from './KnowledgeHeatmap';
import { KnowledgeBrainMap } from './KnowledgeBrainMap';
import { AIKnowledgeExtractor } from './AIKnowledgeExtractor';
import { postToWeibo } from '../utils/weiboPoster';
import { API_BASE_URL } from '../utils/api';

export function KnowledgeSystem() {
  const [knowledgeData, setKnowledgeData] = useState([]);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'timeline' | 'heatmap'
  const [batchProgress, setBatchProgress] = useState(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [showAIExtractor, setShowAIExtractor] = useState(false);

  // Fetch data
  const loadData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge`);
      const data = await res.json();
      setKnowledgeData(data);
      if (data.length > 0 && !activeModuleId) {
        setActiveModuleId(data[0].id);
      }
      setIsLoading(false);
    } catch (e) {
      console.error(e);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check for Draft from WordInsight
  useEffect(() => {
      const draftJson = localStorage.getItem('knowledge_draft');
      if (draftJson && knowledgeData.length > 0) {
          try {
              const draft = JSON.parse(draftJson);
              if (window.confirm(`检测到来自"学术词性洞察"的知识草稿：\n\n标题：${draft.title}\n\n是否立即创建该知识点？`)) {
                  // Find a default module (e.g., first one or one named "Drafts" if exists)
                  const targetModuleId = knowledgeData[0].id;
                  
                  const newItem = {
                      id: `k_${Date.now()}`,
                      term: draft.title,
                      time: 'New', // Or inferred from trends
                      definition: draft.desc || '',
                      subModule: 'WordInsight',
                      relations: [],
                      notes: [
                          {
                              id: `n_${Date.now()}`,
                              content: `### 语境摘录 \n\n${draft.quotes.map(q => `> ${q}`).join('\n\n')}`,
                              date: new Date().toISOString()
                          }
                      ],
                      images: [],
                      videos: [],
                      attachments: [],
                      importance: 3,
                      difficulty: 3
                  };

                  const newData = knowledgeData.map(mod => {
                      if (mod.id === targetModuleId) {
                          return { ...mod, items: [newItem, ...mod.items] };
                      }
                      return mod;
                  });

                  handleUpdate(newData);
                  setSelectedItem(newItem);
                  setActiveModuleId(targetModuleId);
                  
                  // Clear draft
                  localStorage.removeItem('knowledge_draft');
              } else {
                  // User declined, clear it so it doesn't pop up again
                  localStorage.removeItem('knowledge_draft'); 
              }
          } catch (e) {
              console.error("Failed to parse draft", e);
              localStorage.removeItem('knowledge_draft');
          }
      }
  }, [knowledgeData]);

  const handleUpdate = async (newData) => {
    // Optimistic update
    setKnowledgeData(newData);
    // Save to server
    try {
      await fetch(`${API_BASE_URL}/api/knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newData)
      });
    } catch (e) {
      console.error('Failed to save', e);
      alert('保存失败');
      loadData(); // Revert
    }
  };

  const handleItemUpdate = (updatedItem, newModuleId) => {
    // If no module change, same as before
    if (!newModuleId) {
      const newData = knowledgeData.map(mod => ({
        ...mod,
        items: mod.items.map(i => i.id === updatedItem.id ? updatedItem : i)
      }));
      handleUpdate(newData);
      setSelectedItem(updatedItem);
      return;
    }

    // Handle module move
    // 1. Remove from old module(s)
    // 2. Add to new module
    const newData = knowledgeData.map(mod => {
      // Remove from source (if it's there)
      let newItems = mod.items.filter(i => i.id !== updatedItem.id);
      
      // Add to target
      if (mod.id === newModuleId) {
        newItems = [updatedItem, ...newItems]; // Add to top or bottom? Let's add to top
      }
      
      return { ...mod, items: newItems };
    });

    handleUpdate(newData);
    setSelectedItem(updatedItem);
    // Optionally update activeModuleId to follow the item?
    // setActiveModuleId(newModuleId); 
  };

  const handleAddItem = async () => {
    if (!activeModuleId) return;
    
    const term = window.prompt("请输入新知识点的名称：");
    if (!term || !term.trim()) return;

    // Create initial item with placeholder
    let newItem = {
      id: `k_${Date.now()}`,
      term: term,
      time: 'AI 生成中...',
      definition: '正在调用 DeepSeek API 自动补全知识点详情...',
      subModule: '',
      relations: [],
      notes: [],
      images: [],
      videos: [],
      attachments: []
    };

    // Optimistic Update 1: Show placeholder
    const optimisticData = knowledgeData.map(mod => {
      if (mod.id === activeModuleId) {
        return { ...mod, items: [newItem, ...mod.items] };
      }
      return mod;
    });
    setKnowledgeData(optimisticData);
    setSelectedItem(newItem);

    // Call AI
    const apiKey = localStorage.getItem('deepseek_key');
    if (apiKey) {
       try {
         const res = await fetch(`${API_BASE_URL}/api/magic/knowledge-autofill`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ term, apiKey })
         });
         const data = await res.json();
         if (data.success && data.result) {
           newItem = {
             ...newItem,
             time: data.result.time || '待定',
             definition: data.result.definition || '',
             subModule: data.result.subModule || '',
             importance: data.result.importance || 3,
             difficulty: data.result.difficulty || 3
           };
         } else {
            newItem.definition = '自动补全失败: ' + (data.error || '未知错误');
            newItem.time = '待定';
         }
       } catch (e) {
         console.error('Auto-fill failed', e);
         newItem.definition = '请求出错，请手动填写。';
         newItem.time = '待定';
       }
    } else {
       newItem.definition = '未配置 API Key，无法自动补全。请手动填写或在魔法管理页面配置 Key。';
       newItem.time = '待定';
    }

    setKnowledgeData(currentData => {
        const newData = currentData.map(mod => {
            if (mod.id === activeModuleId) {
                return { 
                    ...mod, 
                    items: mod.items.map(i => i.id === newItem.id ? newItem : i) 
                };
            }
            return mod;
        });
        
        // We also need to persist this change to backend!
        // Using the same logic as before, constructing data for save
        const finalDataForSave = newData;
        
        // Save to backend
        // Note: Using an IIFE or just firing the promise without await inside setState callback
        fetch(`${API_BASE_URL}/api/knowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(finalDataForSave)
        }).then(() => {
             // Auto-post to Weibo
             postToWeibo(`#新知# 我构建了一个新的知识点：**【${newItem.term}】**\n\n${newItem.definition.slice(0, 100)}${newItem.definition.length > 100 ? '...' : ''}\n\n[前往查看](/knowledge)`);
        }).catch(e => console.error('Failed to save final AI data', e));

        return newData;
    });
    
    setSelectedItem(newItem);
  };

  const handleAIExtract = async (extractedItems) => {
    if (!activeModuleId) {
      alert('请先选择一个模块');
      setShowAIExtractor(false);
      return;
    }

    // Add all extracted items to the active module
    const newData = knowledgeData.map(mod => {
      if (mod.id === activeModuleId) {
        return { 
          ...mod, 
          items: [...extractedItems, ...mod.items] 
        };
      }
      return mod;
    });

    handleUpdate(newData);
    setShowAIExtractor(false);
    
    // Post to Weibo
    postToWeibo(`#AI批量提取# 使用 AI 智能提取了 ${extractedItems.length} 个知识点！\n\n${extractedItems.slice(0, 3).map(item => `• ${item.term}`).join('\n')}${extractedItems.length > 3 ? '\n...' : ''}`);
    
    alert(`✅ 成功添加 ${extractedItems.length} 个知识点！`);
  };

  const handleExportMarkdown = () => {
    if (!knowledgeData || knowledgeData.length === 0) {
      alert('没有知识点可以导出');
      return;
    }

    let mdContent = `# 知识体系导出\n\n`;
    mdContent += `导出日期: ${new Date().toLocaleString()}\n\n---\n\n`;

    // Flatten all items to create a lookup map for relations
    const allItemsMap = new Map();
    knowledgeData.forEach(mod => {
      mod.items.forEach(item => {
        allItemsMap.set(item.id, item.term);
      });
    });

    knowledgeData.forEach(mod => {
      mdContent += `## 📦 模块：${mod.name}\n\n`;
      
      if (mod.items.length === 0) {
        mdContent += `*该模块下暂无知识点*\n\n`;
      } else {
        mod.items.forEach(item => {
          mdContent += `### 💡 ${item.term}\n\n`;
          mdContent += `- **时间**: ${item.time || '未知'}\n`;
          mdContent += `- **重要性**: ${item.importance || 3} 星\n`;
          mdContent += `- **难度**: ${item.difficulty || 3} 级\n`;
          if (item.subModule) mdContent += `- **子分类**: ${item.subModule}\n`;
          mdContent += `\n#### 📝 定义\n${item.definition || '暂无定义'}\n\n`;

          if (item.relations && item.relations.length > 0) {
            mdContent += `#### 🔗 关联知识点\n`;
            item.relations.forEach(rel => {
              const targetName = allItemsMap.get(rel.targetId) || '未知知识点';
              const scoreStr = rel.score !== undefined ? rel.score.toFixed(2) : '1.00';
              mdContent += `- **${targetName}** (关联度: ${scoreStr})${rel.reason ? ` - ${rel.reason}` : ''}\n`;
            });
            mdContent += `\n`;
          }

          if (item.notes && item.notes.length > 0) {
            mdContent += `#### 📒 笔记\n`;
            item.notes.forEach(note => {
              const date = new Date(note.created_at).toLocaleDateString();
              mdContent += `- [${date}] ${note.content}\n`;
            });
            mdContent += `\n`;
          }

          mdContent += `---\n\n`;
        });
      }
      mdContent += `\n`;
    });

    // Create download link
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `知识体系_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAddModule = () => {
    const name = window.prompt("请输入新模块名称：");
    if (!name || !name.trim()) return;

    const newModule = {
      id: `mod_${Date.now()}`,
      name: name.trim(),
      items: []
    };

    const newData = [...knowledgeData, newModule];
    handleUpdate(newData);
    setActiveModuleId(newModule.id);
  };

  const handleEditModule = (e, mod) => {
    e.stopPropagation();
    const newName = window.prompt("修改模块名称：", mod.name);
    if (!newName || !newName.trim() || newName === mod.name) return;

    const newData = knowledgeData.map(m => 
      m.id === mod.id ? { ...m, name: newName.trim() } : m
    );
    handleUpdate(newData);
  };

  const handleDeleteModule = (e, modId) => {
    e.stopPropagation();
    if (!confirm('确定删除该模块及其下所有知识点吗？此操作不可恢复。')) return;

    const newData = knowledgeData.filter(m => m.id !== modId);
    handleUpdate(newData);
    
    if (activeModuleId === modId) {
      setActiveModuleId(newData.length > 0 ? newData[0].id : null);
    }
  };

  const handleDeleteItem = (e, itemId) => {
    e.stopPropagation();
    if (!confirm('确定删除这个知识点吗？')) return;

    const newData = knowledgeData.map(mod => {
      // Search in all modules or just active? Item ID is unique.
      // But we need to know which module it is in to update state efficiently.
      // We can just filter it out from all modules to be safe.
      return { ...mod, items: mod.items.filter(i => i.id !== itemId) };
    });

    handleUpdate(newData);
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }
  };

  const filteredItems = useMemo(() => {
    return knowledgeData
      .find(m => m.id === activeModuleId)?.items
      .filter(i => 
        i.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
        i.definition.toLowerCase().includes(searchQuery.toLowerCase())
      ) || [];
  }, [knowledgeData, activeModuleId, searchQuery]);

  const handleBatchMagic = async () => {
    // 1. Collect all items that have no relations
    const allItems = knowledgeData.flatMap(m => m.items);
    const targetItems = allItems.filter(item => !item.relations || item.relations.length === 0);
    
    if (targetItems.length === 0) {
      alert('所有知识点都已有关联，无需处理！');
      return;
    }

    if (!confirm(`发现 ${targetItems.length} 个未关联的知识点，是否开始批量智能分析？这可能需要一些时间。`)) {
      return;
    }

    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先在魔法管理页面配置 API Key');
      return;
    }

    setBatchProgress({ current: 0, total: targetItems.length, type: 'relation' });
    
    // We will update a local copy of data to avoid too many re-renders
    let currentData = JSON.parse(JSON.stringify(knowledgeData));
    
    for (let i = 0; i < targetItems.length; i++) {
      const item = targetItems[i];
      try {
        const res = await fetch(`${API_BASE_URL}/api/magic/knowledge-relation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetId: item.id,
            allItems: allItems, // Use original full list for context
            apiKey
          })
        });
        const data = await res.json();
        
        if (data.success && data.relations.length > 0) {
          // Update item in currentData
          currentData = currentData.map(mod => ({
            ...mod,
            items: mod.items.map(it => 
              it.id === item.id ? { ...it, relations: data.relations } : it
            )
          }));
        }
      } catch (e) {
        console.error(`Failed to process item ${item.term}`, e);
      }
      
      // Update progress
      setBatchProgress({ current: i + 1, total: targetItems.length, type: 'relation' });
    }
    
    // Final update
    handleUpdate(currentData);
    setBatchProgress(null);
    alert('批量分析完成！');
  };

  const handleAutoClassify = async () => {
     if (!confirm('是否开始智能分类？这将重新分析所有知识点的重要性（星级）和难度等级。')) return;

     const apiKey = localStorage.getItem('deepseek_key');
     if (!apiKey) {
       alert('请先配置 API Key');
       return;
     }

     setIsClassifying(true);
     const allItems = knowledgeData.flatMap(m => m.items);
     
     // Initialize progress
     setBatchProgress({ current: 0, total: allItems.length, type: 'classify' });

     try {
        const BATCH_SIZE = 10;
        let updatedCount = 0;
        
        // We need to keep track of updates locally to avoid reloading data constantly
        // But since we are processing in batches, we might want to reload or update local state at the end.
        // Let's just track success count.
        
        for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
            const batch = allItems.slice(i, i + BATCH_SIZE);
            
            try {
                const res = await fetch(`${API_BASE_URL}/api/magic/knowledge-classify`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ items: batch, apiKey })
                });
                const data = await res.json();
                
                if (data.success) {
                   updatedCount += data.updated;
                }
            } catch (e) {
                console.error('Batch classify error', e);
            }
            
            // Update progress
            setBatchProgress({ 
                current: Math.min(i + BATCH_SIZE, allItems.length), 
                total: allItems.length,
                type: 'classify'
            });
        }
        
        // Final reload
        await loadData();
        alert(`分类完成！更新了 ${updatedCount} 个知识点。`);
        
     } catch (e) {
        console.error(e);
        alert('请求出错');
     } finally {
        setIsClassifying(false);
        setBatchProgress(null);
     }
  };

  const getCardStyles = (importance, difficulty) => {
    // Default to 3 if undefined
    const imp = importance || 3;
    const diff = difficulty || 3;
    
    // Map 1-5 to index 0-4
    const impIdx = Math.max(0, Math.min(4, imp - 1));
    const diffIdx = Math.max(0, Math.min(4, diff - 1));
    
    const dist = impIdx + diffIdx;
    const hue = (dist / 8) * 120; // 0 (Red) to 120 (Green)
    
    return {
        borderColor: `hsla(${hue}, 70%, 40%, 1)`,
        backgroundColor: `hsla(${hue}, 70%, 97%, 1)`
    };
  };

  if (isLoading) return <div className="flex justify-center items-center h-full text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full bg-slate-100 overflow-hidden">
      {/* Sidebar: Modules - Only show in List Mode */}
      {viewMode === 'list' && (
      <div className="w-64 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between text-slate-700 font-bold">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-blue-600" />
            知识体系
          </div>
          <button onClick={handleAddModule} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" title="新增模块" aria-label="新增模块">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {knowledgeData.map(mod => (
            <div
              key={mod.id}
              onClick={() => setActiveModuleId(mod.id)}
              className={`w-full text-left p-4 text-sm font-medium border-l-4 transition-colors cursor-pointer group flex justify-between items-start focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 ${
                activeModuleId === mod.id
                  ? 'bg-blue-50 border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              tabIndex={0}
              onKeyDown={(e) => { if(e.key === 'Enter') setActiveModuleId(mod.id) }}
            >
              <div>
                {mod.name}
                <div className="text-xs text-slate-400 font-normal mt-1">
                  {mod.items.length} 个知识点
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity group-focus-within:opacity-100">
                <button 
                  onClick={(e) => handleEditModule(e, mod)}
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  title="重命名"
                  aria-label="重命名模块"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button 
                  onClick={(e) => handleDeleteModule(e, mod.id)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  title="删除模块"
                  aria-label="删除模块"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shrink-0 z-20 relative shadow-sm">
          {/* View Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-lg mr-4">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="列表视图"
                aria-label="切换到列表视图"
              >
                  <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('timeline')}
                className={`p-1.5 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === 'timeline' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="时间线视图"
                aria-label="切换到时间线视图"
              >
                  <Clock className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('heatmap')}
                className={`p-1.5 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === 'heatmap' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="分布热力图"
                aria-label="切换到分布热力图"
              >
                  <Grid className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('brain')}
                className={`p-1.5 rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${viewMode === 'brain' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                title="3D 知识脑图"
                aria-label="切换到3D脑图"
              >
                  <Brain className="w-4 h-4" />
              </button>
          </div>

          {viewMode === 'list' ? (
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input 
              type="text" 
              placeholder="搜索知识点..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-md text-sm outline-none transition-all"
              aria-label="搜索知识点"
            />
          </div>
          ) : viewMode === 'timeline' ? (
             <div className="text-sm text-slate-500 font-medium">
                 全景时间线 (拖拽移动，滚轮缩放)
             </div>
          ) : viewMode === 'brain' ? (
             <div className="text-sm text-slate-500 font-medium">
                 3D 知识大脑 (DeepSeek/Zhipu Embedding)
             </div>
          ) : (
             <div className="text-sm text-slate-500 font-medium">
                 知识难度与重要性分布 (星级 x 难度)
             </div>
          )}
          
          <div className="flex items-center gap-4 ml-auto">
              {batchProgress && batchProgress.type === 'classify' ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 text-sm font-medium rounded border border-orange-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>正在分类 {batchProgress.current}/{batchProgress.total}</span>
                </div>
              ) : (
                <button
                  onClick={handleAutoClassify}
                  disabled={isClassifying || batchProgress}
                  className="flex items-center gap-2 px-3 py-2 bg-white text-orange-600 border border-orange-200 text-sm font-medium rounded hover:bg-orange-50 transition-colors shadow-sm disabled:opacity-50"
                  title="AI 智能分析所有知识点的星级和难度"
                >
                  <Wand2 className="w-4 h-4" /> 智能分类
                </button>
              )}
              
              {batchProgress && batchProgress.type === 'relation' ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 text-sm font-medium rounded border border-purple-200">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>处理中 {batchProgress.current}/{batchProgress.total}</span>
                </div>
              ) : (
                <button 
                  onClick={handleBatchMagic}
                  disabled={isClassifying || batchProgress}
                  className="flex items-center gap-2 px-3 py-2 bg-white text-purple-600 border border-purple-200 text-sm font-medium rounded hover:bg-purple-50 transition-colors shadow-sm disabled:opacity-50"
                  title="一键为所有未关联的知识点自动生成关联"
                >
                  <Wand2 className="w-4 h-4" /> 一键关联
                </button>
              )}
              <button
                onClick={handleExportMarkdown}
                className="flex items-center gap-2 px-3 py-2 bg-white text-green-600 border border-green-200 text-sm font-medium rounded hover:bg-green-50 transition-colors shadow-sm"
                title="导出整个知识体系为 Markdown 文件"
              >
                <Download className="w-4 h-4" /> 导出 MD
              </button>
              <button 
                onClick={() => setShowAIExtractor(true)}
                disabled={!activeModuleId && viewMode === 'list'}
                className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium rounded hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="使用 AI 从文本中批量提取知识点"
              >
                <Sparkles className="w-4 h-4" /> AI 批量提取
              </button>
              <button 
                onClick={handleAddItem}
                disabled={!activeModuleId && viewMode === 'list'}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> 新增知识点
              </button>
          </div>
        </div>

        {viewMode === 'list' ? (
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
            {filteredItems.map(item => {
              const styles = getCardStyles(item.importance, item.difficulty);
              return (
              <div 
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="p-4 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col h-48 relative overflow-hidden"
                style={{
                    backgroundColor: styles.backgroundColor,
                    borderColor: styles.borderColor,
                    borderLeftWidth: '6px'
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded border" 
                        style={{ color: styles.borderColor, borderColor: styles.borderColor, backgroundColor: 'white' }}>
                    {item.time}
                  </span>
                  <div className="flex gap-1">
                      {item.relations?.length > 0 && (
                        <span className="text-xs text-slate-400 flex items-center gap-1 bg-white/50 px-1.5 py-0.5 rounded">
                          <Network className="w-3 h-3" /> {item.relations.length}
                        </span>
                      )}
                      <button 
                        onClick={(e) => handleDeleteItem(e, item.id)}
                        className="ml-1 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500 rounded"
                        title="删除知识点"
                        aria-label={`删除知识点 ${item.term}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                  </div>
                </div>
                <h3 className="font-bold text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {item.term}
                </h3>
                <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed flex-1">
                  {item.definition}
                </p>
                {item.subModule && (
                  <div className="mt-3 pt-2 border-t border-slate-200/50 text-xs text-slate-500 truncate flex justify-between items-center">
                    <span>{item.subModule}</span>
                    <span className="text-[10px] opacity-60">
                       {item.importance || 3}星 | {item.difficulty || 3}级
                    </span>
                  </div>
                )}
              </div>
              );
            })}
            {filteredItems.length === 0 && (
              <div className="col-span-full text-center py-20 text-slate-400">
                未找到匹配的知识点
              </div>
            )}
        </div>
        ) : viewMode === 'timeline' ? (
            <div className="flex-1 w-full h-full relative">
                <KnowledgeTimeline 
                    data={knowledgeData} 
                    onNodeClick={setSelectedItem} 
                />
            </div>
        ) : viewMode === 'brain' ? (
             <div className="flex-1 w-full h-full relative bg-slate-900 border-l border-slate-700">
                <KnowledgeBrainMap 
                    data={knowledgeData} 
                    onNodeClick={setSelectedItem} 
                />
            </div>
        ) : (
            <div className="flex-1 w-full h-full relative bg-white">
                <KnowledgeHeatmap 
                    data={knowledgeData} 
                    onNodeClick={setSelectedItem} 
                />
            </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedItem && (
        <KnowledgeDetail 
          key={selectedItem.id}
          item={selectedItem} 
          onClose={() => setSelectedItem(null)} 
          onUpdate={handleItemUpdate}
          onDelete={(id) => handleDeleteItem({ stopPropagation: () => {} }, id)}
          allItems={knowledgeData.flatMap(m => m.items)}
          modules={knowledgeData}
          currentModuleId={activeModuleId}
        />
      )}

      {/* AI Knowledge Extractor */}
      {showAIExtractor && (
        <AIKnowledgeExtractor
          activeModuleId={activeModuleId}
          onExtract={handleAIExtract}
          onClose={() => setShowAIExtractor(false)}
          existingItems={knowledgeData.flatMap(m => m.items)}
        />
      )}
    </div>
  );
}
