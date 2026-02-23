import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../utils/api';
import { 
  Plus, ChevronRight, ChevronDown, Circle, CheckCircle2, Clock, 
  MoreHorizontal, Link as LinkIcon, Trash2, Calendar, FileText, 
  Lightbulb, Mic, Hash, X, ArrowRight, Tag, Layout, List, Kanban, Edit, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import ReactMarkdown from 'react-markdown';
import { MarkdownEditor } from './MarkdownEditor';

const statusLabels = {
  pending: '待研究',
  doing: '研究中',
  done: '已完成'
};

export function ResearchBoard() {
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('tree'); // 'tree' or 'kanban'
  const [activeRefData, setActiveRefData] = useState({ refs: [], knowledge: [], inspirations: [], voices: [] });
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [currentLinkNodeId, setCurrentLinkNodeId] = useState(null);
  const [moveMode, setMoveMode] = useState(false);
  const [nodeToMove, setNodeToMove] = useState(null);
  const [lastCreatedId, setLastCreatedId] = useState(null);

  useEffect(() => {
    fetchConcepts();
    fetchReferenceData();
  }, []);

  const fetchConcepts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/research/concepts`);
      if (res.ok) {
        const data = await res.json();
        setConcepts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [refs, know, insp, voices] = await Promise.all([
        fetch(`${API_BASE_URL}/api/references`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/knowledge`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/inspirations`).then(r => r.json()),
        fetch(`${API_BASE_URL}/api/voice-memos`).then(r => r.json())
      ]);
      setActiveRefData({ refs, knowledge: know, inspirations: insp, voices });
    } catch (e) {
      console.error("Failed to load reference data", e);
    }
  };

  const updateConcepts = async (newConcepts) => {
    setConcepts(newConcepts);
    try {
      await fetch(`${API_BASE_URL}/api/research/concepts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConcepts)
      });
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const addConcept = (parentId = null) => {
    // Generate a truly unique ID using current timestamp + random
    const newId = uuidv4();
    const newConcept = {
      id: newId,
      title: '新研究概念',
      status: 'pending', // pending, doing, done
      category: '未分类',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      children: [],
      links: []
    };

    if (parentId === null) {
      updateConcepts([...concepts, newConcept]);
      setLastCreatedId(newId);
    } else {
      // Use a flag to stop traversing once added
      let added = false;
      const updateRecursive = (list) => {
        return list.map(item => {
          // If already added somewhere, just return item as is (optimization)
          if (added) return item;

          if (item.id === parentId) {
            added = true;
            return { 
                ...item, 
                children: [...(item.children || []), newConcept],
                _expanded: true 
            };
          }
          
          if (item.children && item.children.length > 0) {
            const updatedChildren = updateRecursive(item.children);
            // Only create new object if children actually changed
            if (updatedChildren !== item.children) {
                return { ...item, children: updatedChildren };
            }
          }
          return item;
        });
      };
      const newConcepts = updateRecursive(concepts);
      if (added) {
          updateConcepts(newConcepts);
          setLastCreatedId(newId);
      } else {
          console.warn("Parent ID not found:", parentId);
      }
    }
  };

  const updateConceptField = (id, field, value) => {
    const updateRecursive = (list) => {
      return list.map(item => {
        if (item.id === id) {
          const updated = { ...item, [field]: value, updatedAt: Date.now() };
          // Lifecycle logic
          if (field === 'status') {
            if (value === 'doing' && !item.startedAt) updated.startedAt = Date.now();
            if (value === 'done' && !item.completedAt) updated.completedAt = Date.now();
          }
          return updated;
        }
        if (item.children) {
          return { ...item, children: updateRecursive(item.children) };
        }
        return item;
      });
    };
    updateConcepts(updateRecursive(concepts));
  };

  const deleteConcept = (id) => {
    if (!window.confirm("确定删除此概念及其所有子项吗？")) return;
    const deleteRecursive = (list) => {
      return list.filter(item => item.id !== id).map(item => ({
        ...item,
        children: item.children ? deleteRecursive(item.children) : []
      }));
    };
    updateConcepts(deleteRecursive(concepts));
  };

  const addLink = (target) => {
    if (!currentLinkNodeId) return;
    const updateRecursive = (list) => {
      return list.map(item => {
        if (item.id === currentLinkNodeId) {
          return { ...item, links: [...(item.links || []), target] };
        }
        if (item.children) return { ...item, children: updateRecursive(item.children) };
        return item;
      });
    };
    updateConcepts(updateRecursive(concepts));
    setLinkModalOpen(false);
    setCurrentLinkNodeId(null);
  };

  const openLinkModal = (id) => {
    setCurrentLinkNodeId(id);
    setLinkModalOpen(true);
  };

  const startMoveNode = (id) => {
    setNodeToMove(id);
    setMoveMode(true);
  };

  const commitMoveNode = (targetParentId) => {
    if (!nodeToMove) return;
    if (nodeToMove === targetParentId) {
        alert("不能移动到自己及内部！");
        return;
    }

    // Deep copy to modify
    let newConcepts = JSON.parse(JSON.stringify(concepts));
    let movedNode = null;

    // 1. Remove from old location
    const removeRecursive = (list) => {
        const index = list.findIndex(n => n.id === nodeToMove);
        if (index > -1) {
            movedNode = list[index];
            list.splice(index, 1);
            return true;
        }
        for (let item of list) {
            if (item.children && removeRecursive(item.children)) return true;
        }
        return false;
    };

    removeRecursive(newConcepts);

    if (!movedNode) {
        setMoveMode(false);
        setNodeToMove(null);
        return;
    }

    // 2. Add to new location or root
    if (targetParentId === null) {
        newConcepts.push(movedNode);
    } else {
        const addRecursive = (list) => {
            for (let item of list) {
                if (item.id === targetParentId) {
                    item.children = item.children || [];
                    item.children.push(movedNode);
                    item._expanded = true;
                    return true;
                }
                if (item.children && addRecursive(item.children)) return true;
            }
            return false;
        };
        addRecursive(newConcepts);
    }

    updateConcepts(newConcepts);
    setMoveMode(false);
    setNodeToMove(null);
  };

  const cancelMove = () => {
    setMoveMode(false);
    setNodeToMove(null);
  };

  // Helper to flatten tree for Kanban view
  const getAllNodesFlat = (nodes) => {
      let flat = [];
      const traverse = (list) => {
          list.forEach(node => {
              flat.push(node);
              if (node.children) traverse(node.children);
          });
      };
      traverse(nodes);
      return flat;
  };

  const getLightColorClassHelper = (color) => {
      const map = {
          red: 'bg-red-50 text-red-700 border-red-100',
          orange: 'bg-orange-50 text-orange-700 border-orange-100',
          yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
          green: 'bg-green-50 text-green-700 border-green-100',
          blue: 'bg-blue-50 text-blue-700 border-blue-100',
          purple: 'bg-purple-50 text-purple-700 border-purple-100',
          gray: 'bg-gray-50 text-gray-700 border-gray-100',
          pink: 'bg-pink-50 text-pink-700 border-pink-100',
          indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100'
      };
      return map[color] || 'bg-slate-50 text-slate-700 border-slate-100';
  };

  const [editingTagName, setEditingTagName] = useState(null);
  const [tempTagName, setTempTagName] = useState('');

  const renameTag = (oldName, newName) => {
    if (!newName.trim() || oldName === newName) {
        setEditingTagName(null);
        return;
    }

    const updateRecursive = (list) => {
      return list.map(item => {
        let nodeChanged = false;
        let newTags = item.tags;

        if (item.tags && item.tags.length > 0) {
           const updatedTags = item.tags.map(t => {
               const tName = typeof t === 'string' ? t : t.name;
               const tColor = typeof t === 'string' ? 'gray' : t.color;
               
               if (tName === oldName) {
                   nodeChanged = true;
                   return { name: newName, color: tColor }; 
               }
               return typeof t === 'string' ? { name: t, color: 'gray' } : t;
           });
           
           if (nodeChanged) {
               // Remove duplicates if merge happened
               const uniqueTags = [];
               const seen = new Set();
               updatedTags.forEach(t => {
                   if (!seen.has(t.name)) {
                       seen.add(t.name);
                       uniqueTags.push(t);
                   }
               });
               newTags = uniqueTags;
           }
        }

        const newNode = nodeChanged ? { ...item, tags: newTags } : item;
        
        if (item.children) {
            const updatedChildren = updateRecursive(item.children);
            if (updatedChildren !== item.children) {
                return { ...newNode, children: updatedChildren };
            }
        }
        return newNode;
      });
    };

    const newConcepts = updateRecursive(concepts);
    updateConcepts(newConcepts);
    setEditingTagName(null);
  };

  const renderTagView = () => {
      const allNodes = getAllNodesFlat(concepts);
      const groups = {};
      
      // Initialize with uncategorized
      const getTagColor = (t) => typeof t === 'string' ? 'gray' : (t.color || 'gray');
      const getTagName = (t) => typeof t === 'string' ? t : t.name;

      allNodes.forEach(node => {
          if (!node.tags || node.tags.length === 0) {
              if (!groups['未标记']) groups['未标记'] = { color: 'gray', nodes: [] };
              groups['未标记'].nodes.push(node);
          } else {
              node.tags.forEach(t => {
                  const name = getTagName(t);
                  const color = getTagColor(t);
                  
                  if (!groups[name]) {
                      groups[name] = { color, nodes: [] };
                  }
                  groups[name].nodes.push(node);
              });
          }
      });

      // Sort keys: Put other tags first, '未标记' last
      const sortedKeys = Object.keys(groups).sort((a, b) => {
          if (a === '未标记') return 1;
          if (b === '未标记') return -1;
          return a.localeCompare(b);
      });

      return (
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
            {sortedKeys.map((tagName) => {
                const data = groups[tagName];
                return (
                <div key={tagName} className={`bg-white rounded-lg shadow-sm border overflow-hidden flex flex-col max-h-[500px] ${tagName === '未标记' ? 'border-dashed border-slate-300' : 'border-slate-200'}`}>
                    <div className={`p-3 border-b font-bold text-sm flex justify-between items-center ${getLightColorClassHelper(data.color)}`}>
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                            <Tag className="w-4 h-4 shrink-0" />
                            {editingTagName === tagName ? (
                                <div className="flex items-center gap-1 flex-1">
                                    <input 
                                        className="text-xs px-1 py-0.5 rounded border border-slate-300 w-full focus:outline-indigo-500"
                                        value={tempTagName}
                                        onChange={(e) => setTempTagName(e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => {
                                            if(e.key === 'Enter') renameTag(tagName, tempTagName);
                                        }}
                                        autoFocus
                                    />
                                    <button onClick={(e) => { e.stopPropagation(); renameTag(tagName, tempTagName); }} className="p-1 hover:bg-slate-200 rounded text-green-600">
                                        <Check className="w-3 h-3" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); setEditingTagName(null); }} className="p-1 hover:bg-slate-200 rounded text-slate-500">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 group/tag truncate flex-1">
                                    <span className="truncate" title={tagName}>{tagName}</span>
                                    {tagName !== '未标记' && (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setEditingTagName(tagName); 
                                                setTempTagName(tagName);
                                            }}
                                            className="opacity-0 group-hover/tag:opacity-100 p-1 hover:bg-white/50 rounded text-slate-500 transition-opacity"
                                            title="重命名标签"
                                        >
                                            <Edit className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        <span className="bg-white/60 px-2 py-0.5 rounded-full text-xs shadow-sm ml-2 shrink-0">{data.nodes.length}</span>
                    </div>
                    <div className="p-2 overflow-y-auto space-y-2 bg-slate-50/50 flex-1 min-h-[50px]">
                        {data.nodes.map(node => (
                             <div 
                                key={node.id}
                                onClick={() => setActiveConceptId(node.id)}
                                className={`p-3 bg-white border border-slate-100 rounded-md cursor-pointer hover:shadow-md transition-all group ${activeConceptId === node.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'hover:border-indigo-200'}`}
                             >
                                <div className="text-sm font-medium text-slate-800 break-words line-clamp-2">{node.title}</div>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex gap-1">
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                            node.status === 'done' ? 'bg-green-100 text-green-700' : 
                                            node.status === 'doing' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                            {statusLabels[node.status] || node.status}
                                        </span>
                                    </div>
                                    {node.note && <FileText className="w-3 h-3 text-blue-400" />}
                                </div>
                             </div>
                        ))}
                    </div>
                </div>
                );
            })}
        </div>
      );
  };

  const [activeConceptId, setActiveConceptId] = useState(null);

  const renderKanbanColumn = (status, title, colorClass) => {
      const allNodes = getAllNodesFlat(concepts);
      const nodesInStatus = allNodes.filter(n => n.status === status);

      return (
          <div className="flex-1 min-w-[300px] flex flex-col bg-slate-100/50 rounded-xl h-full border border-slate-200">
              <div className={`p-3 border-b border-slate-200 ${colorClass} bg-opacity-10 rounded-t-xl font-bold text-sm flex justify-between items-center`}>
                  <span>{title}</span>
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs shadow-sm text-slate-500">{nodesInStatus.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {nodesInStatus.map(node => (
                      <div 
                        key={node.id}
                        onClick={() => setActiveConceptId(node.id)} 
                        className={`bg-white p-3 rounded-lg shadow-sm border border-slate-200 cursor-pointer hover:shadow-md transition-all ${activeConceptId === node.id ? 'ring-2 ring-indigo-500' : ''}`}
                      >
                          <div className="flex justify-between items-start mb-2">
                              <span className={`text-sm font-semibold ${node.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{node.title}</span>
                              {node.note && <FileText className="w-3 h-3 text-blue-500" />}
                          </div>
                          
                          {/* Tags */}
                          {node.tags && node.tags.length > 0 && (
                                <div className="flex gap-1 mb-2">
                                    {node.tags.map((tag, i) => {
                                        const color = typeof tag === 'string' ? tag : (tag.color || 'gray');
                                        const name = typeof tag === 'string' ? tag : tag.name;
                                        return (
                                            <div 
                                                key={i} 
                                                className={`w-2 h-2 rounded-full bg-${color === 'yellow' ? 'yellow-400' : color + '-500'}`}
                                                title={name} 
                                            />
                                        );
                                    })}
                                </div>
                          )}

                          <div className="flex justify-between items-center mt-2">
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 truncate max-w-[80px]">{node.category}</span>
                              <div className="flex gap-1">
                                  {status !== 'pending' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); updateConceptField(node.id, 'status', 'pending'); }}
                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400"
                                        title="Move to Pending"
                                      >
                                          ←
                                      </button>
                                  )}
                                  {status !== 'doing' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); updateConceptField(node.id, 'status', 'doing'); }}
                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-blue-500"
                                        title="Move to Doing"
                                      >
                                          {status === 'pending' ? '→' : '←'}
                                      </button>
                                  )}
                                  {status !== 'done' && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); updateConceptField(node.id, 'status', 'done'); }}
                                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-100 text-green-500"
                                        title="Move to Done"
                                      >
                                          ✓
                                      </button>
                                  )}
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const allTags = React.useMemo(() => {
    const nodes = getAllNodesFlat(concepts);
    const tags = new Map();
    nodes.forEach(node => {
      if (node.tags) {
        node.tags.forEach(t => {
          // Normalize string tags to objects for consistency
          const tagObj = typeof t === 'string' ? { name: t, color: 'gray' } : t;
          if (!tags.has(tagObj.name)) {
            tags.set(tagObj.name, tagObj);
          }
        });
      }
    });
    return Array.from(tags.values());
  }, [concepts]);

  return (
    <div className="flex h-full bg-slate-50 relative">
      <div className={`flex flex-col h-full border-r border-slate-200 transition-all duration-300 ${activeConceptId ? 'w-1/2' : 'w-full'}`}>
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-bold text-lg flex items-center gap-2">
              <Hash className="w-5 h-5 text-indigo-600" />
              研究概念看板
            </h1>
            <p className="text-xs text-slate-500">
                {moveMode ? (
                    <span className="text-amber-600 font-bold animate-pulse">
                        请点击选择目标父节点 (或点击此栏移动到根节点)
                    </span>
                ) : "规划、追踪与关联您的学术研究脉络"}
            </p>
          </div>
          <div className="flex gap-2 items-center">
             {/* View Switcher */}
             <div className="bg-slate-100 p-1 rounded-lg flex gap-1 mr-2">
                <button 
                    onClick={() => setViewMode('tree')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'tree' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="树状大纲视图"
                >
                    <List className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('kanban')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'kanban' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="看板视图"
                >
                    <Kanban className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setViewMode('tags')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'tags' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    title="标签视图"
                >
                    <Layout className="w-4 h-4" />
                </button>
             </div>

            {moveMode ? (
                <>
                     <button 
                        onClick={() => commitMoveNode(null)}
                        className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-md text-sm border border-amber-200 hover:bg-amber-200"
                    >
                        作为根节点
                    </button>
                    <button 
                        onClick={cancelMove}
                        className="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-md text-sm hover:bg-slate-200"
                    >
                        取消移动
                    </button>
                </>
            ) : (
                <button 
                    onClick={() => addConcept(null)}
                    className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1 hover:bg-indigo-700 transition"
                >
                    <Plus className="w-4 h-4" /> 新增根概念
                </button>
            )}
          </div>
        </div>

        {/* Work Area */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
            {viewMode === 'tree' ? (
                <div className="p-4 md:p-6">
                    {concepts.length === 0 ? (
                        <div className="text-center text-slate-400 mt-20">
                            <p>暂无研究概念</p>
                            <button onClick={() => addConcept(null)} className="text-indigo-600 underline mt-2">点击创建第一个概念</button>
                        </div>
                    ) : (
                        <div className="space-y-2 mx-auto">
                            {concepts.map(node => (
                                <ConceptNode 
                                    key={node.id} 
                                    node={node} 
                                    onUpdate={updateConceptField}
                                    onAddChild={addConcept}
                                    onDelete={deleteConcept}
                                    onLink={openLinkModal}
                                    activeId={activeConceptId}
                                    onSelect={setActiveConceptId}
                                    moveMode={moveMode}
                                    onMoveStart={startMoveNode}
                                    onMoveCommit={commitMoveNode}
                                    isMoving={nodeToMove === node.id}
                                    allTags={allTags}
                                    lastCreatedId={lastCreatedId}
                                />
                            ))}
                        </div>
                    )}
                </div>
            ) : viewMode === 'kanban' ? (
                // Kanban View
                <div className="h-full p-4 flex gap-4 overflow-x-auto">
                    {renderKanbanColumn('pending', '待研究 (To Do)', 'bg-slate-500 text-slate-700')}
                    {renderKanbanColumn('doing', '研究中 (Doing)', 'bg-blue-500 text-blue-700')}
                    {renderKanbanColumn('done', '已完成 (Done)', 'bg-green-500 text-green-700')}
                </div>
            ) : (
                renderTagView()
            )}
        </div>
      </div>
      
      {/* Right Panel - Note Editor */}
      {activeConceptId && (
        <React.Fragment>
          {(() => {
            // Find active node recursively
            const findNode = (nodes) => {
              for (const n of nodes) {
                if (n.id === activeConceptId) return n;
                if (n.children) {
                  const found = findNode(n.children);
                  if (found) return found;
                }
              }
              return null;
            };
            const activeNode = findNode(concepts);
             
            if (!activeNode) return null;

            return (
               <div className="w-1/2 bg-white flex flex-col h-full shadow-xl z-10 transition-all">
                  <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                             activeNode.status === 'done' ? 'bg-green-500' : 
                             activeNode.status === 'doing' ? 'bg-blue-500' : 'bg-slate-300'
                        }`} />
                        <h2 className="font-bold text-slate-800 truncate max-w-[200px]">{activeNode.title}</h2>
                    </div>
                    <button onClick={() => setActiveConceptId(null)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex-1 flex flex-col p-6 overflow-hidden">
                      <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <FileText className="w-4 h-4" /> 研究备注 (Markdown)
                      </div>
                      
                      <div className="flex-1 border rounded-xl overflow-hidden flex flex-col">
                        <MarkdownEditor 
                           value={activeNode.note || ''}
                           onChange={(val) => updateConceptField(activeNode.id, 'note', val || '')}
                           height="100%"
                           preview="edit"
                        />
                      </div>
                  </div>
               </div>
            );
          })()}
        </React.Fragment>
      )}

      {/* Link Modal */}
      {linkModalOpen && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white w-[600px] max-h-[80vh] rounded-xl shadow-2xl flex flex-col">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold">关联知识库元素</h3>
                    <button onClick={() => setLinkModalOpen(false)}><X className="w-5 h-5" /></button>
                </div>
                <div className="p-4 overflow-y-auto space-y-6 flex-1">
                    
                    {/* References */}
                    <section>
                        <h4 className="font-semibold text-sm text-slate-500 mb-2 flex items-center gap-2">
                            <FileText className="w-4 h-4" /> 题录 / 论文
                        </h4>
                        <div className="space-y-1">
                            {activeRefData.refs.slice(0, 50).map(ref => (
                                <div key={ref.id} 
                                    onClick={() => addLink({ type: 'reference', id: ref.id, title: ref.title })}
                                    className="p-2 hover:bg-indigo-50 cursor-pointer rounded text-sm border border-transparent hover:border-indigo-100 truncate"
                                >
                                    {ref.title}
                                </div>
                            ))}
                        </div>
                    </section>
                    
                    {/* Knowledge */}
                    <section>
                         <h4 className="font-semibold text-sm text-slate-500 mb-2 mt-4 flex items-center gap-2">
                            <Lightbulb className="w-4 h-4" /> 知识点
                        </h4>
                         <div className="flex flex-wrap gap-2">
                            {/* Flatten knowledge tree for simple selection or just show top levels? */}
                            {/* For simplicity, showing top structure or flat list if easy. Let's assume list of ids for now or map structure */}
                            {Object.values(activeRefData.knowledge).map(k => (
                                <div key={k.id}
                                     onClick={() => addLink({ type: 'knowledge', id: k.id, title: k.name })}
                                     className="px-2 py-1 bg-yellow-50 hover:bg-yellow-100 border border-yellow-200 rounded text-xs cursor-pointer"
                                >
                                    {k.name}
                                </div>
                            ))}
                         </div>
                    </section>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

function ConceptNode({ node, onUpdate, onAddChild, onDelete, onLink, activeId, onSelect, moveMode, onMoveStart, onMoveCommit, isMoving, allTags, lastCreatedId }) {
  const [expanded, setExpanded] = useState(node._expanded !== false); // Default true
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const nodeRef = React.useRef(null);

  useEffect(() => {
    if (node._expanded) {
        setExpanded(true);
    }
  }, [node._expanded]);

  useEffect(() => {
    if (lastCreatedId === node.id && nodeRef.current) {
        nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Optional: flash highlight
        nodeRef.current.classList.add('ring-2', 'ring-emerald-400');
        setTimeout(() => {
            if(nodeRef.current) nodeRef.current.classList.remove('ring-2', 'ring-emerald-400');
        }, 1500);
    }
  }, [lastCreatedId, node.id]);
  
  // New state for tag creation
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');

  const statusColors = {
    pending: 'bg-slate-100 text-slate-500 border-slate-200',
    doing: 'bg-blue-50 text-blue-600 border-blue-200',
    done: 'bg-green-50 text-green-600 border-green-200'
  };

  const tagColors = [
      { name: 'Red', value: 'red' },
      { name: 'Orange', value: 'orange' },
      { name: 'Yellow', value: 'yellow' },
      { name: 'Green', value: 'green' },
      { name: 'Blue', value: 'blue' },
      { name: 'Purple', value: 'purple' },
      { name: 'Gray', value: 'gray' },
      { name: 'Pink', value: 'pink' },
      { name: 'Indigo', value: 'indigo' },
  ];

  const getColorClass = (color) => {
      const map = {
          red: 'bg-red-500',
          orange: 'bg-orange-500',
          yellow: 'bg-yellow-400',
          green: 'bg-green-500',
          blue: 'bg-blue-500',
          purple: 'bg-purple-500',
          gray: 'bg-gray-500',
          pink: 'bg-pink-500',
          indigo: 'bg-indigo-500'
      };
      return map[color] || 'bg-slate-300';
  };

  const getLightColorClass = (color) => {
      const map = {
          red: 'bg-red-50 text-red-700',
          orange: 'bg-orange-50 text-orange-700',
          yellow: 'bg-yellow-50 text-yellow-700',
          green: 'bg-green-50 text-green-700',
          blue: 'bg-blue-50 text-blue-700',
          purple: 'bg-purple-50 text-purple-700',
          gray: 'bg-gray-50 text-gray-700',
          pink: 'bg-pink-50 text-pink-700',
          indigo: 'bg-indigo-50 text-indigo-700'
      };
      return map[color] || 'bg-slate-50 text-slate-700';
  };

  const addTag = () => {
      if(!newTagName.trim()) return;
      const currentTags = node.tags || [];
      // Tag structure: { name: 'Important', color: 'red' }
      // Or simple string if legacy. Let's support object structure now.

      // Normalize existing tags if they are strings
      const normalizedTags = currentTags.map(t => typeof t === 'string' ? { name: t, color: 'gray' } : t);

      if (normalizedTags.some(t => t.name === newTagName)) {
          alert('标签名已存在');
          return;
      }
      
      const newTag = { name: newTagName, color: newTagColor };
      onUpdate(node.id, 'tags', [...normalizedTags, newTag]);
      setNewTagName('');
  };

  const removeTag = (tagName) => {
      const currentTags = node.tags || [];
      const normalizedTags = currentTags.map(t => typeof t === 'string' ? { name: t, color: 'gray' } : t);
      const newTags = normalizedTags.filter(t => t.name !== tagName);
      onUpdate(node.id, 'tags', newTags);
  };

  const [hoveringMoveTarget, setHoveringMoveTarget] = useState(false);

  // If in move mode, this node can be a target
  const handleMoveClick = (e) => {
      e.stopPropagation();
      if (moveMode && !isMoving) {
          onMoveCommit(node.id);
      }
  };

  return (
    <div ref={nodeRef}>
      <div 
        className={`
            group flex flex-col md:flex-row md:items-start gap-3 p-3 border rounded-lg shadow-sm mb-2 transition-all cursor-pointer relative
            ${node.status === 'done' ? 'bg-slate-50' : 'bg-white'}
            ${activeId === node.id ? 'border-indigo-500 shadow-md ring-1 ring-indigo-500' : 
              (moveMode && !isMoving) ? 'border-amber-300 border-dashed bg-amber-50 hover:bg-amber-100' : 'hover:shadow-md hover:border-indigo-200'}
            ${isMoving ? 'opacity-50 border-dashed border-2' : ''}
        `}
        onClick={(e) => {
            if (moveMode) {
                handleMoveClick(e);
                return;
            }
            // Only select if not clicking interactive elements
            if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
                onSelect(node.id);
            }
        }}
        onMouseEnter={() => moveMode && !isMoving && setHoveringMoveTarget(true)}
        onMouseLeave={() => setHoveringMoveTarget(false)}
      >
         {moveMode && !isMoving && hoveringMoveTarget && (
             <div className="absolute inset-0 flex items-center justify-center bg-amber-100/50 rounded-lg pointer-events-none z-10">
                 <span className="bg-amber-600 text-white px-3 py-1 rounded shadow text-sm font-bold">移动到此处</span>
             </div>
         )}

         {/* Main Content Wrapper - Left Side */}
         <div className="flex-1 flex flex-col gap-2 w-full min-w-0">
             <div className="flex flex-col md:flex-row md:items-center gap-2">
                {/* Controls Row */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                        className={`w-6 h-6 flex items-center justify-center rounded hover:bg-slate-100 text-slate-400 ${node.children?.length === 0 ? 'invisible' : ''}`}
                    >
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    
                    {/* Status Badge Toggle */}
                    <div className="relative shrink-0">
                        <select 
                            value={node.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdate(node.id, 'status', e.target.value)}
                            disabled={moveMode}
                            className={`appearance-none text-xs font-medium px-2 py-1 rounded-full border cursor-pointer outline-none ${statusColors[node.status]}`}
                        >
                            <option value="pending">○ 待研究</option>
                            <option value="doing">▶ 研究中</option>
                            <option value="done">✓ 已完成</option>
                        </select>
                    </div>

                    {/* Title */}
                    {isEditing ? (
                        <input 
                            autoFocus
                            value={node.title}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => onUpdate(node.id, 'title', e.target.value)}
                            onBlur={() => setIsEditing(false)}
                            onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                            className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-b border-indigo-300 outline-none pb-0.5"
                        />
                    ) : (
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (!moveMode) setIsEditing(true);
                                }}
                                className={`text-sm font-semibold text-slate-800 cursor-text truncate ${node.status === 'done' ? 'line-through text-slate-400' : ''}`}
                            >
                                {node.title}
                            </span>
                            {/* Tags display */}
                            {node.tags && node.tags.length > 0 && (
                                <div className="flex gap-1 flex-wrap">
                                    {node.tags.map((tag, idx) => {
                                        const tagName = typeof tag === 'string' ? tag : tag.name;
                                        const tagColor = typeof tag === 'string' ? 'gray' : tag.color;
                                        return (
                                            <div key={idx} className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${getLightColorClass(tagColor)}`}>
                                                {tagName}
                                                <button onClick={(e) => { e.stopPropagation(); removeTag(tagName); }} className="hover:text-red-500">
                                                    <X className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Meta & Actions */}
                <div className="flex items-center gap-3 pl-8 md:pl-0 shrink-0">
                    {/* Category Tag */}
                    <input 
                        value={node.category}
                        disabled={moveMode}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onUpdate(node.id, 'category', e.target.value)}
                        className="text-[10px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-transparent hover:border-slate-200 outline-none w-16 text-center"
                        placeholder="分类"
                    />
                    
                    {/* Date */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400" title={`创建: ${format(node.createdAt, 'yyyy-MM-dd')}`}>
                        <Clock className="w-3 h-3" />
                        {node.updatedAt ? format(node.updatedAt, 'MM-dd') : 'New'}
                    </div>

                    {/* Actions */}
                    {!moveMode && (
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                         {/* Color Tag Picker */}
                         <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowColorPicker(!showColorPicker);
                                }}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                title="添加标签"
                            >
                                <Tag className="w-3.5 h-3.5" />
                            </button>
                            
                            {showColorPicker && (
                                <>
                                <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setShowColorPicker(false);}}></div>
                                <div 
                                    className="absolute bg-white border border-slate-200 shadow-xl rounded-lg p-3 z-[100] w-56 flex flex-col gap-2"
                                    style={{ right: 0, top: '100%', marginTop: '4px' }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {allTags && allTags.length > 0 && (
                                        <div className="mb-2 border-b border-slate-100 pb-2">
                                            <div className="text-xs font-bold text-slate-500 mb-1">常用标签</div>
                                            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                                {allTags.map((t, idx) => (
                                                    <button
                                                        key={`${t.name}-${idx}`}
                                                        onClick={() => {
                                                            const currentTags = node.tags || [];
                                                            const normalized = currentTags.map(ct => typeof ct === 'string' ? {name:ct, color:'gray'} : ct);
                                                            if (!normalized.some(ct => ct.name === t.name)) {
                                                                onUpdate(node.id, 'tags', [...normalized, t]);
                                                            }
                                                            setShowColorPicker(false);
                                                        }}
                                                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${getColorClass(t.color)} text-white hover:opacity-80`}
                                                    >
                                                        {t.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="text-xs font-bold text-slate-500 mb-1">添加新标签</div>
                                    <input 
                                        autoFocus
                                        value={newTagName}
                                        onChange={e => setNewTagName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                        placeholder="标签名称..."
                                        className="text-xs border border-slate-300 rounded px-2 py-1 w-full outline-emerald-500"
                                    />
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {tagColors.map(c => (
                                            <button 
                                                key={c.value}
                                                className={`w-4 h-4 rounded-full ${getColorClass(c.value)} hover:scale-110 transition-transform ${newTagColor === c.value ? 'ring-2 ring-offset-1 ring-slate-400' : ''}`}
                                                title={c.name}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setNewTagColor(c.value);
                                                }}
                                            />
                                        ))}
                                    </div>
                                    <button 
                                        onClick={() => { addTag(); setShowColorPicker(false); }}
                                        className="bg-indigo-600 text-white text-xs py-1 rounded hover:bg-indigo-700 w-full"
                                    >
                                        添加
                                    </button>
                                </div>
                                </>
                            )}
                        </div>

                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveStart(node.id);
                            }}
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-600"
                            title="移动此节点"
                        >
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onSelect(activeId === node.id ? null : node.id);
                            }}
                            className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 relative ${node.note ? 'text-blue-600' : ''}`}
                            title="备注 / 笔记"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            {node.note && <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full" />}
                        </button>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                onLink(node.id);
                            }}
                            className={`p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-indigo-600 relative ${node.links?.length > 0 ? 'text-indigo-600' : ''}`} 
                            title="关联资源"
                        >
                            <LinkIcon className="w-3.5 h-3.5" />
                            {node.links?.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-indigo-500 text-[8px] text-white">
                                    {node.links.length}
                                </span>
                            )}
                        </button>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            onAddChild(node.id);
                        }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-green-600" title="添加子项">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={(e) => {
                            e.stopPropagation();
                            onDelete(node.id);
                        }} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-600" title="删除">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    )}
                </div>
             </div>

             {/* Links Display (Inline, inside left wrapper) */}
             {node.links?.length > 0 && (
                <div className="w-full mt-2 pl-8 flex flex-wrap gap-2">
                    {node.links.map((link, i) => (
                        <div key={i} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] border border-indigo-100">
                            {link.type === 'reference' ? <FileText className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                            <span className="max-w-[150px] truncate">{link.title || link.id}</span>
                            {!moveMode && (
                            <button 
                            className="hover:text-red-500 ml-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                const newLinks = node.links.filter((_, idx) => idx !== i);
                                onUpdate(node.id, 'links', newLinks);
                            }}
                            >
                                <X className="w-3 h-3" />
                            </button>
                            )}
                        </div>
                    ))}
                </div>
             )}
         </div>
         
         {/* Removed Note Area from here - moved to right pane */}
      </div>

      {/* Children */}
      {expanded && node.children && (
        <div className="border-l-2 border-slate-100 ml-3 pl-3">
            {node.children.map(child => (
                <ConceptNode 
                    key={child.id} 
                    node={child} 
                    onUpdate={onUpdate}
                    onAddChild={onAddChild}
                    onDelete={onDelete}
                    onLink={onLink}
                    activeId={activeId}
                    onSelect={onSelect}
                    moveMode={moveMode}
                    onMoveStart={onMoveStart}
                    onMoveCommit={onMoveCommit}
                    isMoving={isMoving}
                    allTags={allTags}
                    lastCreatedId={lastCreatedId}
                />
            ))}
        </div>
      )}
    </div>
  );
}
