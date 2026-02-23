import React, { useEffect, useState, useMemo } from 'react';
import { Clock, Search, Filter, X, ZoomIn, ZoomOut, Maximize2, Edit, StickyNote, Network } from 'lucide-react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  MarkerType,
  Handle, 
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';

// --- Enhanced Time Parsing with Range Support ---
const parseTimeRange = (timeStr) => {
  if (!timeStr) return { start: 1900, end: 1900, display: '未知时间' };
  
  const original = timeStr;
  
  // Handle "至今" (to present)
  const hasToPresent = timeStr.includes('至今') || timeStr.includes('至现在');
  if (hasToPresent) {
    timeStr = timeStr.replace(/至今|至现在/g, '');
  }
  
  // Explicit year range: "1950-1970年", "1950年-1970年"
  const rangeMatch = timeStr.match(/(-?\d{4})年?\s*[-~–—至]\s*(-?\d{4})年?/);
  if (rangeMatch) {
    let start = parseInt(rangeMatch[1]);
    let end = hasToPresent ? 2026 : parseInt(rangeMatch[2]);
    if (timeStr.includes('前') && start > 0) {
      start = -start;
      end = -end;
    }
    return { 
      start: Math.max(1600, Math.min(2100, start)), 
      end: Math.max(1600, Math.min(2100, end)),
      display: original,
      isRange: true
    };
  }
  
  // Single year with "至今": "1943年至今"
  const yearToPresent = timeStr.match(/(-?\d{4})年?/);
  if (yearToPresent && hasToPresent) {
    let year = parseInt(yearToPresent[1]);
    return { 
      start: Math.max(1600, Math.min(2100, year)), 
      end: 2026,
      display: original,
      isRange: true
    };
  }
  
  // Century range: "20世纪50-70年代"
  const centuryDecadeRange = timeStr.match(/(\d+)世纪(\d+)-(\d+)年代/);
  if (centuryDecadeRange) {
    const century = parseInt(centuryDecadeRange[1]);
    const startDecade = parseInt(centuryDecadeRange[2]);
    const endDecade = parseInt(centuryDecadeRange[3]);
    const baseYear = (century - 1) * 100;
    return {
      start: baseYear + startDecade * 10,
      end: baseYear + endDecade * 10 + 9,
      display: original,
      isRange: true
    };
  }
  
  // Decade range: "1950s-1980s", "50年代-80年代"
  const decadeRangeMatch = timeStr.match(/(\d{2,4})0?年代?\s*[-~至]\s*(\d{2,4})0?年代?/);
  if (decadeRangeMatch) {
    let start = parseInt(decadeRangeMatch[1]);
    let end = parseInt(decadeRangeMatch[2]);
    if (start < 100) start = 1900 + start * 10;
    else if (start < 1000) start = start * 10;
    if (end < 100) end = 1900 + end * 10 + 9;
    else if (end < 1000) end = end * 10 + 9;
    return { start, end, display: original, isRange: true };
  }
  
  // Single century: "20世纪"
  const centuryMatch = timeStr.match(/(\d+)世纪/);
  if (centuryMatch) {
    let century = parseInt(centuryMatch[1]);
    let start = (century - 1) * 100;
    let end = century * 100 - 1;
    if (timeStr.includes('前')) {
      start = -start;
      end = -end;
    }
    // For "17世纪末", "19世纪初" etc.
    if (timeStr.includes('末')) {
      start = end - 25;
    } else if (timeStr.includes('初')) {
      end = start + 25;
    } else if (timeStr.includes('中')) {
      const mid = (start + end) / 2;
      start = mid - 25;
      end = mid + 25;
    }
    return { 
      start: Math.max(1600, start), 
      end: Math.max(1600, end),
      display: original,
      isRange: end - start > 20
    };
  }
  
  // Single decade: "1950年代", "50年代"
  const decadeMatch = timeStr.match(/(\d{2,4})0年代/);
  if (decadeMatch) {
    let decade = parseInt(decadeMatch[1]);
    if (decade < 100) decade = 1900 + decade * 10;
    else if (decade < 1000) decade = decade * 10;
    return { start: decade, end: decade + 9, display: original, isRange: true };
  }
  
  // Single year: "1952年"
  const yearMatch = timeStr.match(/(-?\d{4})年?/);
  if (yearMatch) {
    let year = parseInt(yearMatch[1]);
    if (timeStr.includes('前') && year > 0) year = -year;
    year = Math.max(1600, Math.min(2100, year));
    return { start: year, end: year, display: original, isRange: false };
  }
  
  console.warn('Could not parse time:', timeStr);
  return { start: 1900, end: 1900, display: original, isRange: false };
};

// --- Enhanced Custom Node Component with Range Support ---
const TimelineNode = ({ data, style }) => {
  const isRange = data.timeRange && data.timeRange.isRange;
  
  return (
    <div 
      title={`${data.label}\n${data.time}\n${data.subModule || ''}`}
      className={`px-3 py-2 rounded-lg shadow-md border-2 text-xs transition-all hover:scale-105 hover:shadow-xl hover:z-[40] cursor-pointer ${
        data.isHighlighted ? 'ring-4 ring-blue-400 ring-opacity-50 z-[50] scale-110' : ''
      }`}
      style={{ 
        ...style,
        backgroundColor: data.color,
        borderColor: data.isHighlighted ? '#2563eb' : data.color,
        filter: data.isDimmed ? 'brightness(0.4) saturate(0.3)' : 'brightness(0.98)',
        transition: 'all 0.2s ease',
        opacity: data.isDimmed ? 0.15 : 1
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-400 !w-2 !h-2" />
      
      {/* Term name - bold and centered */}
      <div className="font-bold text-slate-800 text-center leading-tight mb-1.5 line-clamp-2 min-h-[28px]">
        {data.label}
      </div>
      
      {/* Time display - with range indicator if applicable */}
      <div className={`text-[10px] text-slate-600 text-center font-medium bg-white/50 rounded px-1 py-0.5 ${
        isRange ? 'bg-amber-100/60' : ''
      }`}>
        {data.time}
      </div>
      
      {/* Sub-module tag */}
      {data.subModule && (
        <div className="text-[9px] text-slate-500 text-center mt-1 truncate">
          {data.subModule}
        </div>
      )}
      
      <Handle type="source" position={Position.Right} className="!bg-slate-400 !w-2 !h-2" />
    </div>
  );
};

// --- Era Background Labels ---
const ERA_LABELS = [
  { start: 1940, end: 1956, label: '早期计算机时代', color: '#e0f2fe', textColor: '#0369a1' },
  { start: 1950, end: 1966, label: '机器翻译萌芽', color: '#dbeafe', textColor: '#1e40af' },
  { start: 1966, end: 1980, label: 'AI寒冬期', color: '#ddd6fe', textColor: '#5b21b6' },
  { start: 1980, end: 1993, label: '符号主义时代 / CAT兴起', color: '#fce7f3', textColor: '#be185d' },
  { start: 1988, end: 2000, label: '统计机器翻译', color: '#dcfce7', textColor: '#15803d' },
  { start: 2000, end: 2012, label: '互联网与大数据', color: '#fef3c7', textColor: '#a16207' },
  { start: 2012, end: 2017, label: '深度学习复兴', color: '#fed7aa', textColor: '#c2410c' },
  { start: 2014, end: 2026, label: '神经机器翻译时代', color: '#bbf7d0', textColor: '#166534' },
  { start: 2017, end: 2026, label: 'Transformer革命', color: '#bfdbfe', textColor: '#1e3a8a' },
  { start: 2019, end: 2026, label: '大语言模型时代', color: '#fae8ff', textColor: '#86198f' },
];

// --- Enhanced Detail Card Component with Modal Style ---
const DetailCard = ({ item, onClose, onEdit }) => {
  const [activeTab, setActiveTab] = useState('info');
  
  if (!item) return null;
  
  return (
    <>
      {/* Modal Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal Card */}
        <div 
          className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[520px] animate-in slide-in-from-bottom-4 fade-in duration-300 m-4"
          style={{ 
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column'
          }}
          onClick={(e) => e.stopPropagation()}
        >
        {/* Header */}
        <div className="flex justify-between items-start p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
          <div className="flex-1 pr-4">
            <h3 className="font-bold text-xl text-slate-800 mb-1.5">{item.term}</h3>
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {item.time}
              </span>
              {item.subModule && (
                <span className="px-2 py-0.5 bg-white rounded-full border border-slate-200">
                  {item.subModule}
                </span>
              )}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-2">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'info' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            基本信息
          </button>
          <button
            onClick={() => setActiveTab('relations')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'relations' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            关联
            {item.relations && item.relations.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {item.relations.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
              activeTab === 'notes' 
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white' 
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            笔记
            {item.notes && item.notes.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {item.notes.length}
              </span>
            )}
          </button>
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5" style={{ maxHeight: 'calc(85vh - 200px)' }}>
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">定义</label>
                <p className="text-sm text-slate-700 leading-relaxed">{item.definition}</p>
              </div>
              
              {item.importance !== undefined && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">重要度</label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div 
                          key={i}
                          className={`w-8 h-2.5 rounded-full transition-colors ${
                            i <= (item.importance || 0) ? 'bg-blue-500' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {['外围', '一般', '核心', '关键', '基石'][item.importance - 1] || '未设置'}
                    </span>
                  </div>
                </div>
              )}
              
              {item.difficulty !== undefined && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">难度</label>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div 
                          key={i}
                          className={`w-8 h-2.5 rounded-full transition-colors ${
                            i <= (item.difficulty || 0) ? 'bg-red-500' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {['简单', '较易', '中等', '较难', '困难'][item.difficulty - 1] || '未设置'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'relations' && (
            <div>
              {item.relations && item.relations.length > 0 ? (
                <div className="space-y-2">
                  {item.relations.slice(0, 10).map((rel, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-800 flex items-center gap-2 mb-1">
                            <Network className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-xs text-slate-500">关联到其他知识点</span>
                          </div>
                          {rel.reason && (
                            <p className="text-xs text-slate-600 leading-relaxed">{rel.reason}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            rel.score > 0.85 ? 'bg-green-100 text-green-700' :
                            rel.score > 0.7 ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {(rel.score * 100).toFixed(0)}%
                          </span>
                          {rel.type === 'manual' && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              手动
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {item.relations.length > 10 && (
                    <p className="text-xs text-slate-400 text-center pt-2">
                      还有 {item.relations.length - 10} 个关联...
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Network className="w-16 h-16 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">暂无关联关系</p>
                  <p className="text-xs mt-1">可在编辑面板中添加关联</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'notes' && (
            <div>
              {item.notes && item.notes.length > 0 ? (
                <div className="space-y-2.5">
                  {item.notes.map((note, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <p className="text-sm text-slate-700 leading-relaxed">{note.content}</p>
                      {note.created_at && (
                        <p className="text-xs text-slate-400 mt-2">
                          {new Date(note.created_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <StickyNote className="w-16 h-16 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">暂无笔记</p>
                  <p className="text-xs mt-1">可在编辑面板中添加笔记</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-4 bg-slate-50 flex justify-between items-center rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-white rounded-lg transition-colors"
          >
            关闭
          </button>
          <button
            onClick={() => onEdit(item)}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors flex items-center gap-2 font-medium shadow-sm hover:shadow-md"
          >
            <Edit className="w-4 h-4" />
            查看/编辑详情
          </button>
        </div>
      </div>
    </div>
    </>
  );
};

// --- Colors for Modules ---
const MODULE_COLORS = [
  '#93c5fd', // blue-300 - 第一部分：历史源流与思想奠基
  '#86efac', // green-300 - 第二部分：核心学科与数学基础
  '#67e8f9', // cyan-300 - 第三部分：关键技术与模型演进
  '#fdba74', // orange-300 - 第四部分：数据与基础设施
  '#f9a8d4', // pink-300 - 第五部分：应用范式与实践
  '#94a3b8', // slate-400
  '#fca5a5', // red-300
  '#fde047', // yellow-300
];

// ⚠️ CRITICAL: Define nodeTypes OUTSIDE component
const nodeTypes = {
  timeline: TimelineNode,
};

export function KnowledgeTimeline({ data, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const containerRef = React.useRef(null);
  const hasInitializedView = React.useRef(false); // Track if we've done initial focus
  
  // Filter & Search State
  const [timeFilter, setTimeFilter] = useState({ start: 1600, end: 2026 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Highlighting State (instant, no delay)
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  
  // Detail Card State
  const [detailCard, setDetailCard] = useState(null); // { item, position }
  
  // Calculate available time range from data
  const dataTimeRange = useMemo(() => {
    if (!data || data.length === 0) return { min: 1900, max: 2026 };
    
    let min = 3000, max = 1600;
    data.forEach(mod => {
      mod.items.forEach(item => {
        const range = parseTimeRange(item.time);
        if (range.start < min) min = range.start;
        if (range.end > max) max = range.end;
      });
    });
    
    return { min: Math.max(1600, min - 10), max: Math.min(2100, max + 10) };
  }, [data]);
  
  // Reset time filter when data changes
  useEffect(() => {
    if (dataTimeRange) {
      setTimeFilter({ start: dataTimeRange.min, end: dataTimeRange.max });
    }
  }, [dataTimeRange]);
  
  // Filtered data based on search and time range
  const filteredData = useMemo(() => {
    if (!data) return [];
    
    return data.map(mod => ({
      ...mod,
      items: mod.items.filter(item => {
        // Time filter
        const range = parseTimeRange(item.time);
        const inTimeRange = !(range.end < timeFilter.start || range.start > timeFilter.end);
        
        // Search filter
        const matchesSearch = !searchQuery || 
          item.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (item.definition && item.definition.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (item.subModule && item.subModule.toLowerCase().includes(searchQuery.toLowerCase()));
        
        return inTimeRange && matchesSearch;
      })
    })).filter(mod => mod.items.length > 0);
  }, [data, timeFilter, searchQuery]);

  // Handle Highlighting Logic (instant)
  useEffect(() => {
    if (!activeHighlightId) {
      // Reset all
      setNodes(nds => nds.map(n => ({ 
        ...n, 
        data: { ...n.data, isHighlighted: false, isDimmed: false }
      })));
      setEdges(eds => eds.map(e => ({ 
        ...e, 
        style: { ...e.style, opacity: 0.3, strokeWidth: 2 }, 
        animated: true 
      })));
      return;
    }

    // Find connected nodes
    const connectedNodeIds = new Set([activeHighlightId]);
    edges.forEach(edge => {
      if (edge.source === activeHighlightId) connectedNodeIds.add(edge.target);
      if (edge.target === activeHighlightId) connectedNodeIds.add(edge.source);
    });

    setNodes(nds => nds.map(n => ({
      ...n,
      data: { 
        ...n.data, 
        isHighlighted: n.id === activeHighlightId,
        isDimmed: !connectedNodeIds.has(n.id)
      }
    })));

    setEdges(eds => eds.map(e => ({
      ...e,
      style: { 
        ...e.style, 
        opacity: (e.source === activeHighlightId || e.target === activeHighlightId) ? 1 : 0.05,
        strokeWidth: (e.source === activeHighlightId || e.target === activeHighlightId) ? 3 : 2
      },
      animated: (e.source === activeHighlightId || e.target === activeHighlightId)
    })));
  }, [activeHighlightId, edges.length]);

  // Generate Nodes and Edges with improved horizontal tiling layout
  useEffect(() => {
    if (!filteredData || filteredData.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const newNodes = [];
    const newEdges = [];
    const itemMap = new Map();

    // Layout parameters
    const MODULE_HEIGHT = 400;
    const PIXELS_PER_YEAR = 30;
    const MIN_YEAR = Math.max(1600, timeFilter.start - 20);
    const VERTICAL_SPACING = 90;
    const NODE_WIDTH = 144;
    const NODE_HEIGHT = 80;
    const HORIZONTAL_PADDING = 8; // Padding for overlap detection

    filteredData.forEach((mod, modIndex) => {
      const color = MODULE_COLORS[modIndex % MODULE_COLORS.length];
      const modYBase = modIndex * MODULE_HEIGHT;

      // Sort items by time for better layout
      const sortedItems = [...mod.items].sort((a, b) => {
        const rangeA = parseTimeRange(a.time);
        const rangeB = parseTimeRange(b.time);
        return rangeA.start - rangeB.start;
      });

      // Track occupied spaces: array of { y, xStart, xEnd }
      const occupiedSpaces = [];

      sortedItems.forEach((item) => {
        const timeRange = parseTimeRange(item.time);
        const startYear = timeRange.start;
        const endYear = timeRange.end;
        
        // Calculate X position strictly based on time (always consistent for same year)
        const timeBasedX = (startYear - MIN_YEAR) * PIXELS_PER_YEAR;
        const baseWidth = timeRange.isRange 
          ? Math.max(NODE_WIDTH, (endYear - startYear) * PIXELS_PER_YEAR * 0.8)
          : NODE_WIDTH;
        const timeBasedEndX = timeBasedX + baseWidth;

        let finalX = timeBasedX;
        let finalWidth = baseWidth;
        let finalY = modYBase + 100;
        let rowIndex = 0;

        // Find the first available row where we can place this node
        // without overlap at its time-based X position
        while (true) {
          const testY = modYBase + 100 + rowIndex * VERTICAL_SPACING;
          
          // Check if there's any overlap with existing nodes at this Y level
          const hasOverlap = occupiedSpaces.some(space => {
            // Check if Y positions would conflict
            const yConflict = Math.abs(space.y - testY) < NODE_HEIGHT - 10;
            // Check if X ranges would overlap
            const xOverlap = !(timeBasedEndX + HORIZONTAL_PADDING < space.xStart || 
                             timeBasedX - HORIZONTAL_PADDING > space.xEnd);
            return yConflict && xOverlap;
          });

          if (!hasOverlap) {
            // Found a free spot
            finalY = testY;
            break;
          }

          rowIndex++;
          
          // Prevent infinite loop
          if (rowIndex > 20) {
            finalY = testY;
            break;
          }
        }

        // Always use time-based X position (no horizontal shifting)
        finalX = timeBasedX;
        finalWidth = baseWidth;

        // Register this space as occupied
        occupiedSpaces.push({
          y: finalY,
          xStart: finalX,
          xEnd: finalX + finalWidth
        });

        const nodeId = item.id;
        const node = {
          id: nodeId,
          type: 'timeline',
          position: { x: finalX, y: finalY },
          data: { 
            label: item.term, 
            time: item.time,
            subModule: item.subModule,
            color,
            timeRange,
            originalItem: item,
            isHighlighted: false,
            isDimmed: false
          },
          style: {
            width: finalWidth
          }
        };
        newNodes.push(node);
        itemMap.set(nodeId, node);
      });
    });

    // Generate Edges (only high-quality relations)
    filteredData.forEach(mod => {
      mod.items.forEach(item => {
        if (item.relations) {
          item.relations.forEach(rel => {
            const isHighQuality = rel.score > 0.7 || rel.type === 'manual';
            if (itemMap.has(rel.targetId) && isHighQuality) {
              const sourceId = item.id;
              const targetId = rel.targetId;
              
              newEdges.push({
                id: `e-${sourceId}-${targetId}`,
                source: sourceId,
                target: targetId,
                type: 'smoothstep',
                animated: true,
                style: { 
                  stroke: rel.score > 0.85 ? '#3b82f6' : '#94a3b8', 
                  strokeWidth: 2,
                  opacity: 0.3
                },
                label: rel.score > 0.9 ? `${(rel.score * 100).toFixed(0)}%` : '',
                labelStyle: { fill: '#64748b', fontSize: 10, fontWeight: 'bold' },
                labelBgStyle: { fill: '#ffffff', fillOpacity: 0.8 },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: rel.score > 0.85 ? '#3b82f6' : '#94a3b8',
                },
              });
            }
          });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [filteredData, timeFilter, setNodes, setEdges]);

  // Auto-focus to GPU node on initial load, then fit view on subsequent updates
  useEffect(() => {
    if (rfInstance && nodes.length > 0) {
      setTimeout(() => {
        if (!hasInitializedView.current) {
          // First load: Focus on GPU node area (1999年)
          const gpuNode = nodes.find(n => 
            n.id === 'k_4_2_5' || // GPU (Graphics Processing Unit)
            n.data.label?.includes('GPU') || 
            n.data.originalItem?.term?.includes('GPU')
          );
          
          if (gpuNode) {
            // Focus on GPU node with nice zoom level to show surrounding rich content
            rfInstance.setCenter(
              gpuNode.position.x + 72, // Center of node (half of 144)
              gpuNode.position.y + 40, // Center of node
              0.6, // Zoom level - showing wider context with rich knowledge points
              { duration: 1000 } // Smooth animation
            );
            console.log('🎯 Focused on GPU node at', gpuNode.position);
          } else {
            // Fallback: fit all nodes with slight zoom
            rfInstance.fitView({ padding: 0.2, minZoom: 0.3, maxZoom: 0.9, duration: 800 });
          }
          hasInitializedView.current = true;
        } else {
          // Subsequent updates: just fit view
          rfInstance.fitView({ padding: 0.15, minZoom: 0.2, maxZoom: 1.2, duration: 500 });
        }
      }, 150);
    }
  }, [rfInstance, nodes.length]);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white text-slate-500">
        <div className="text-center">
          <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-lg font-medium mb-2">暂无时间线数据</p>
          <p className="text-sm">请先添加一些知识点和模块</p>
        </div>
      </div>
    );
  }

  // Generate time axis ticks
  const timeAxisTicks = useMemo(() => {
    const ticks = [];
    const start = Math.floor(timeFilter.start / 10) * 10;
    const end = Math.ceil(timeFilter.end / 10) * 10;
    
    for (let year = start; year <= end; year += 10) {
      ticks.push(year);
    }
    return ticks;
  }, [timeFilter]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-50 relative flex flex-col">
      {/* Top Control Bar */}
      <div className="bg-white border-b border-slate-200 p-3 flex items-center gap-3 z-20 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索知识点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors ${
            showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>时间过滤</span>
        </button>
        
        {/* Stats */}
        <div className="text-xs text-slate-600 px-3 py-2 bg-slate-100 rounded-lg">
          显示 <span className="font-semibold text-blue-600">{nodes.length}</span> 个知识点
        </div>
        
        {/* Zoom Controls */}
        {rfInstance && (
          <div className="flex gap-1">
            <button
              onClick={() => rfInstance.zoomIn({ duration: 300 })}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => rfInstance.zoomOut({ duration: 300 })}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="缩小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => rfInstance.fitView({ padding: 0.15, duration: 300 })}
              className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="适应窗口"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
      
      {/* Time Filter Panel */}
      {showFilters && (
        <div className="bg-blue-50 border-b border-blue-200 p-4 z-20">
          <div className="max-w-4xl">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              时间范围: {timeFilter.start} - {timeFilter.end}
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={dataTimeRange.min}
                max={dataTimeRange.max}
                value={timeFilter.start}
                onChange={(e) => setTimeFilter(prev => ({ ...prev, start: Math.min(parseInt(e.target.value), prev.end - 10) }))}
                className="flex-1"
              />
              <input
                type="range"
                min={dataTimeRange.min}
                max={dataTimeRange.max}
                value={timeFilter.end}
                onChange={(e) => setTimeFilter(prev => ({ ...prev, end: Math.max(parseInt(e.target.value), prev.start + 10) }))}
                className="flex-1"
              />
              <button
                onClick={() => setTimeFilter({ start: dataTimeRange.min, end: dataTimeRange.max })}
                className="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-50"
              >
                重置
              </button>
            </div>
            
            {/* Quick Filters */}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setTimeFilter({ start: 1940, end: 1980 })} className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100">早期 (1940-1980)</button>
              <button onClick={() => setTimeFilter({ start: 1980, end: 2000 })} className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100">统计时代 (1980-2000)</button>
              <button onClick={() => setTimeFilter({ start: 2000, end: 2014 })} className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100">互联网时代 (2000-2014)</button>
              <button onClick={() => setTimeFilter({ start: 2012, end: 2026 })} className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100">深度学习 (2012-今)</button>
              <button onClick={() => setTimeFilter({ start: 2017, end: 2026 })} className="px-2 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100">Transformer (2017-今)</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Main Timeline View */}
      <div className="flex-1 relative">
        {nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p className="text-sm text-slate-500">没有匹配的知识点</p>
              <p className="text-xs text-slate-400 mt-1">请调整搜索条件或时间范围</p>
            </div>
          </div>
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeMouseEnter={(event, node) => {
                setActiveHighlightId(node.id);
              }}
              onNodeMouseLeave={() => {
                setActiveHighlightId(null);
              }}
              onNodeClick={(event, node) => {
                setDetailCard({
                  item: node.data.originalItem
                });
              }}
              onPaneClick={() => {
                setDetailCard(null);
              }}
              onInit={(instance) => {
                setRfInstance(instance);
              }}
              nodeTypes={nodeTypes}
              fitView={false}
              minZoom={0.1}
              maxZoom={2}
              className="w-full h-full"
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={true}
              panOnDrag={true}
              zoomOnScroll={true}
              defaultViewport={{ x: 100, y: 100, zoom: 0.5 }}
            >
              <Background color="#cbd5e1" gap={20} size={1} />
              <Controls position="bottom-right" showInteractive={false} />
            </ReactFlow>
            
            {/* Era Background Labels (overlay on canvas) */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-[1]">
              {ERA_LABELS.filter(era => 
                era.start <= timeFilter.end && era.end >= timeFilter.start
              ).map((era, idx) => {
                const MIN_YEAR = Math.max(1600, timeFilter.start - 20);
                const PIXELS_PER_YEAR = 30;
                const x = (era.start - MIN_YEAR) * PIXELS_PER_YEAR;
                const width = (era.end - era.start) * PIXELS_PER_YEAR;
                
                return (
                  <div
                    key={idx}
                    className="absolute top-2 text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm backdrop-blur-sm"
                    style={{
                      left: `${x}px`,
                      backgroundColor: era.color,
                      color: era.textColor,
                      minWidth: `${width}px`,
                      textAlign: 'center',
                      border: `1px solid ${era.textColor}20`
                    }}
                  >
                    {era.label}
                  </div>
                );
              })}
            </div>
            
            {/* Module Swimlane Labels */}
            <div className="absolute left-4 top-20 pointer-events-none z-10 space-y-2">
              {filteredData.map((mod, i) => (
                <div 
                  key={mod.id} 
                  className="text-xs font-bold px-3 py-1.5 rounded shadow-md opacity-90 backdrop-blur-sm"
                  style={{ 
                    backgroundColor: MODULE_COLORS[i % MODULE_COLORS.length],
                    border: '1px solid rgba(0,0,0,0.1)',
                    maxWidth: '250px'
                  }}
                >
                  {mod.name}
                </div>
              ))}
            </div>
            
            {/* Detail Card Modal */}
            {detailCard && (
              <DetailCard
                item={detailCard.item}
                onClose={() => setDetailCard(null)}
                onEdit={(item) => {
                  setDetailCard(null);
                  if (onNodeClick) {
                    onNodeClick(item);
                  }
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}