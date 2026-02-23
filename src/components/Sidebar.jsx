import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Book, FileText, Search, Wand2, Plus, Network, Database, BookOpen, Highlighter, Lightbulb, Mic, Hash, ChevronLeft, ChevronRight, ChevronDown, Download, LayoutGrid, MoreVertical, Trash2, Edit2, Archive, Compass, Microscope, PieChart, Sparkles, Brain, Library } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { chapters as initialChapters } from '../chapters';
import { AddChapterModal } from './AddChapterModal';
import { API_BASE_URL } from '../utils/api';

const colorStyles = {
    slate: { active: 'bg-slate-800 border-blue-500', hover: 'hover:bg-slate-800', icon: 'text-slate-400' },
    blue: { active: 'bg-blue-900/50 border-blue-500', hover: 'hover:bg-blue-900/30', icon: 'text-blue-400' },
    cyan: { active: 'bg-cyan-900/50 border-cyan-500', hover: 'hover:bg-cyan-900/30', icon: 'text-cyan-400' },
    violet: { active: 'bg-violet-900/50 border-violet-500', hover: 'hover:bg-violet-900/30', icon: 'text-violet-400' },
    fuchsia: { active: 'bg-fuchsia-900/50 border-fuchsia-500', hover: 'hover:bg-fuchsia-900/30', icon: 'text-fuchsia-400' },
    indigo: { active: 'bg-indigo-900/50 border-indigo-500', hover: 'hover:bg-indigo-900/30', icon: 'text-indigo-400' },
    orange: { active: 'bg-orange-900/50 border-orange-500', hover: 'hover:bg-orange-900/30', icon: 'text-orange-400' },
    purple: { active: 'bg-purple-900/50 border-purple-500', hover: 'hover:bg-purple-900/30', icon: 'text-purple-400' },
    emerald: { active: 'bg-emerald-900/50 border-emerald-500', hover: 'hover:bg-emerald-900/30', icon: 'text-emerald-400' },
    yellow: { active: 'bg-yellow-900/50 border-yellow-500', hover: 'hover:bg-yellow-900/30', icon: 'text-yellow-400' },
    pink: { active: 'bg-pink-900/50 border-pink-500', hover: 'hover:bg-pink-900/30', icon: 'text-pink-400' },
    red: { active: 'bg-red-900/50 border-red-500', hover: 'hover:bg-red-900/30', icon: 'text-red-400' },
};

function NavItem({ item, collapsed }) {
    const style = colorStyles[item.color] || colorStyles.blue;
    
    if (item.onClick) {
        return (
            <button
                onClick={item.onClick}
                title={collapsed ? item.label : ""}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors border border-transparent text-slate-400 ${style.hover} hover:text-white ${collapsed ? 'justify-center' : ''}`}
            >
                <div className="relative shrink-0">
                    <item.icon className={`w-5 h-5 ${style.icon}`} />
                </div>
                {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
        );
    }

    return (
        <NavLink
            to={item.to}
            title={collapsed ? item.label : ""}
            className={({ isActive }) =>
                `flex items-center gap-3 p-2 rounded-lg transition-colors border border-transparent ${
                    isActive
                        ? `${style.active} text-white`
                        : `text-slate-400 ${style.hover} hover:text-white`
                } ${collapsed ? 'justify-center' : ''}`
            }
        >
            {({ isActive }) => (
                <>
                    <div className="relative shrink-0">
                        <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : style.icon}`} />
                        {item.badge && <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full border border-slate-900"></div>}
                    </div>
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                </>
            )}
        </NavLink>
    );
}

function SortableChapterItem({ chapter, isActive, onRename, onDelete }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  const [showMenu, setShowMenu] = useState(false);

  return (
    <li 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners} 
        className="group relative"
        onMouseEnter={() => setShowMenu(true)}
        onMouseLeave={() => setShowMenu(false)}
    >
      <NavLink
        to={`/chapter/${chapter.id}`}
        className={`flex items-start gap-3 p-2 rounded-lg transition-colors ${
            isActive
            ? 'bg-blue-600 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`}
      >
        <FileText className="w-4 h-4 mt-0.5 shrink-0" />
        <span className="text-sm font-medium leading-tight line-clamp-2 flex-1">{chapter.title}</span>
      </NavLink>
      
      {/* Context Menu Button */}
      {showMenu && (
          <div className="absolute right-1 top-1.5 flex bg-slate-800 rounded shadow-sm">
             <button 
                className="p-1 hover:text-blue-400 text-slate-400" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRename(chapter); }}
                title={t('chapter.rename')}
             >
                 <Edit2 className="w-3 h-3" />
             </button>
             <button 
                className="p-1 hover:text-red-400 text-slate-400" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(chapter); }}
                title={t('chapter.delete')}
             >
                 <Trash2 className="w-3 h-3" />
             </button>
          </div>
      )}
    </li>
  );
}

function GroupItem({ group, collapsed, isExpanded, onToggle, items }) {
    const [isHovered, setIsHovered] = useState(false);

    if (collapsed) {
        return (
            <div 
                className="relative group"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex justify-center p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer">
                    {group.icon && <group.icon className="w-5 h-5" />}
                </div>
                
                {/* Float Menu */}
                {isHovered && (
                    <div className="absolute left-full top-0 ml-2 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-2 w-48 z-50">
                        <div className="px-3 py-1 text-xs font-semibold text-slate-500 border-b border-slate-700 mb-1 pb-2">
                            {group.title}
                        </div>
                        {items.map(item => (
                            <div key={item.to || item.label} className="px-1">
                                <NavItem item={item} collapsed={false} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-1">
            <button 
                onClick={onToggle}
                className="w-full flex items-center justify-between px-2 py-1.5 text-slate-400 hover:text-white transition-colors group"
            >
                <div className="flex items-center gap-2">
                        {group.icon && <group.icon className="w-4 h-4" />}
                        <span className="text-sm font-medium">{group.title}</span>
                </div>
                {isExpanded ? 
                    <ChevronDown className="w-3 h-3 text-slate-600 group-hover:text-slate-400" /> : 
                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400" />
                }
            </button>
            
            {isExpanded && (
                <div className="space-y-1 pl-1">
                    {items.map(item => (
                        <NavItem key={item.to || item.label} item={item} collapsed={collapsed} />
                    ))}
                </div>
            )}
        </div>
    );
}

export function Sidebar({ collapsed, onToggle }) {
  const { t } = useTranslation();
  const [chapters, setChapters] = useState(initialChapters);
  const [isAdding, setIsAdding] = useState(false);
  const [logoTitle, setLogoTitle] = useState('Treatise');
  const [expandedGroups, setExpandedGroups] = useState({}); // Track expanded specific groups
  const navigate = useNavigate();
  
  const toggleGroup = (title) => {
    setExpandedGroups(prev => ({
        ...prev,
        [title]: !prev[title]
    }));
  };
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
        activationConstraint: {
            distance: 8,
        },
    }),
    useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch chapters from API
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

  useEffect(() => {
    fetchChapters();

    // Fetch Config for Logo
    const fetchConfig = () => {
        fetch(`${API_BASE_URL}/api/config`)
          .then(res => res.json())
          .then(data => {
              if (data && data.logoTitle) setLogoTitle(data.logoTitle);
          })
          .catch(console.error);
    };
    fetchConfig();

    // Listen for updates from MagicManager
    const handleConfigUpdate = (e) => {
        if (e.detail && e.detail.logoTitle) {
            setLogoTitle(e.detail.logoTitle);
        }
    };
    window.addEventListener('config-updated', handleConfigUpdate);
    return () => window.removeEventListener('config-updated', handleConfigUpdate);
  }, []);

  const handleChapterCreated = (newChapter) => {
    // Add to list and navigate
    setChapters(prev => [...prev, newChapter]);
    navigate(`/chapter/${newChapter.id}`);
  };

  const handleBackup = () => {
    window.location.href = `${API_BASE_URL}/api/backup/export`;
  };
  
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
        setChapters((items) => {
            const oldIndex = items.findIndex(i => i.id === active.id);
            const newIndex = items.findIndex(i => i.id === over.id);
            const newItems = arrayMove(items, oldIndex, newIndex);
            
            // Sync with backend
            fetch(`${API_BASE_URL}/api/chapters/reorder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: newItems.map(i => i.id) })
            }).catch(console.error);
            
            return newItems;
        });
    }
  };
  
  const handleRename = async (chapter) => {
      const newTitle = prompt(t('chapter.rename_prompt'), chapter.title);
      if (newTitle && newTitle !== chapter.title) {
          try {
              const res = await fetch(`${API_BASE_URL}/api/chapters/${chapter.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title: newTitle })
              });
              if (res.ok) {
                  setChapters(prev => prev.map(c => c.id === chapter.id ? { ...c, title: newTitle } : c));
              }
          } catch (e) {
              console.error('Rename failed', e);
          }
      }
  };
  
  const handleDelete = async (chapter) => {
      if (confirm(t('chapter.delete_confirm', { title: chapter.title }))) {
          try {
              const res = await fetch(`${API_BASE_URL}/api/chapters/${chapter.id}`, {
                  method: 'DELETE'
              });
              if (res.ok) {
                  setChapters(prev => prev.filter(c => c.id !== chapter.id));
                  if (chapters.length > 1) {
                      navigate(`/chapter/${chapters[0].id}`);
                  }
              }
          } catch (e) {
              console.error('Delete failed', e);
          }
      }
  };

  const navGroups = [
    {
      title: t('sidebar.smart_research_group'),
      icon: Brain,
      items: [
        { to: "/dashboard", icon: PieChart, label: t('sidebar.dashboard'), color: "blue", custom: true },
        { to: "/search", icon: Search, label: t('sidebar.global_search'), color: "slate", custom: true },
        { to: "/discovery", icon: Compass, label: t('sidebar.discovery'), color: "cyan" },
        { to: "/deep-research", icon: Microscope, label: t('sidebar.deep_research'), color: "violet" },
        { to: "/research-board", icon: Hash, label: t('sidebar.research_board'), color: "fuchsia" },
        { to: "/word-insight", icon: PieChart, label: t('sidebar.word_insight'), color: "indigo" },
      ]
    },
    {
      title: t('sidebar.knowledge_management_group'),
      icon: Library,
      items: [
        { to: "/knowledge", icon: Network, label: t('sidebar.knowledge_system'), color: "blue" },
        { to: "/transfer", icon: Archive, label: t('sidebar.transfer_station'), color: "orange" },
        { to: "/questions", icon: Database, label: t('sidebar.bibliography'), color: "indigo" },
        { to: "/papers", icon: BookOpen, label: t('sidebar.papers'), color: "emerald" },
        { label: t('sidebar.backup'), icon: Download, color: "emerald", onClick: handleBackup },
      ]
    },
    {
      title: t('sidebar.magic_lab_group'),
      icon: Sparkles,
      items: [
          { to: "/magic", icon: Wand2, label: t('sidebar.magic_manager'), color: "purple" },
      ]
    },
    {
      title: "笔记灵感",
      icon: FileText,
      items: [
         { to: "/notes", icon: FileText, label: "笔记管理", color: "yellow", badge: true },
         { to: "/highlights", icon: Highlighter, label: "高亮金句", color: "pink" },
         { to: "/inspirations", icon: Lightbulb, label: "灵感日志", color: "yellow" },
         { to: "/voice-memos", icon: Mic, label: "语音留言", color: "red" },
         { to: "/weibo", icon: Hash, label: "我的微博", color: "orange" },
      ]
    }
  ];

  return (
    <div className={`${collapsed ? 'w-16' : 'w-64'} h-full bg-slate-900 text-white flex flex-col border-r border-slate-700 transition-all duration-300 relative`}>
      <div className={`p-4 border-b border-slate-700 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <div className="relative">
                <Book className="w-6 h-6 text-blue-500 shrink-0" />
                <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-900"></div>
            </div>
            {!collapsed && <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent truncate">{logoTitle}</h1>}
          </div>
      </div>
      
      <nav className="flex-1 overflow-y-auto p-2 scrollbar-hide space-y-6">
        <div className="space-y-2">
            {navGroups.map((group) => (
                <GroupItem 
                    key={group.title}
                    group={group}
                    collapsed={collapsed}
                    isExpanded={expandedGroups[group.title]}
                    onToggle={() => toggleGroup(group.title)}
                    items={group.items}
                />
            ))}
        </div>

        <div>
            {!collapsed && (
            <div className="flex justify-between items-center mb-2 px-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    目录
                    <button 
                        onClick={() => navigate('/corkboard')}
                        title="卡片视图 (Corkboard)"
                        className="hover:text-blue-400 transition-colors"
                    >
                        <LayoutGrid className="w-3 h-3" />
                    </button>
                </div>
                <button 
                onClick={() => setIsAdding(true)}
                className="text-slate-500 hover:text-white transition-colors"
                title="新增章节"
                >
                <Plus className="w-4 h-4" />
                </button>
            </div>
            )}
            
            {!collapsed ? (
            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext 
                    items={chapters.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <ul className="space-y-1 pb-4">
                        {chapters.map((chapter) => (
                        <SortableChapterItem 
                            key={chapter.id} 
                            chapter={chapter} 
                            onRename={handleRename}
                            onDelete={handleDelete}
                        />
                        ))}
                    </ul>
                </SortableContext>
            </DndContext>
            ) : (
                <div className="flex flex-col items-center gap-2 mt-2 border-t border-slate-700 pt-2">
                    <button 
                        onClick={() => navigate('/corkboard')}
                        title="卡片视图"
                        className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    {chapters.map((chapter) => (
                        <NavLink
                            key={chapter.id}
                            to={`/chapter/${chapter.id}`}
                            title={chapter.title}
                            className={({ isActive }) =>
                                `p-2 rounded-lg transition-colors ${
                                isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`
                            }
                        >
                            <FileText className="w-5 h-5 shrink-0" />
                        </NavLink>
                    ))}
                    <button 
                    onClick={() => setIsAdding(true)}
                    className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                    title="新增章节"
                    >
                    <Plus className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
      </nav>
      
      {/* Toggle Button Area */}
      <div className="p-2 border-t border-slate-700 flex flex-col gap-2">
        <button
            onClick={onToggle}
            className="flex items-center justify-center p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={collapsed ? "展开侧边栏" : "收起侧边栏"}
        >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
        {!collapsed && (
            <div className="text-xs text-slate-500 text-center">
                © 2026 Treatise
            </div>
        )}
      </div>
      
      {isAdding && (
        <AddChapterModal 
          onClose={() => setIsAdding(false)} 
          onCreated={handleChapterCreated}
        />
      )}
    </div>
  );
}
