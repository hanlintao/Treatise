import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import 'echarts-gl';
import { 
  RefreshCw, Search, Eye, EyeOff, X, Maximize2, Zap, 
  BrainCircuit, Box, Layout, AlertCircle, Share2, Moon, Sun, Network
} from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

// ═══════════════════════════════════════════════════════════════
// 🎨 配置系统
// ═══════════════════════════════════════════════════════════════
const NEON_COLORS = {
  deepSpace: '#0a0a0f',
  cyan: 'rgba(0, 255, 255, 1)',
  glowCyan: 'rgba(0, 255, 255, 0.6)',
  grid: 'rgba(255, 255, 255, 0.1)',
  highlight: '#FFD700'
};

const MODULE_NEON_COLORS = [
  { main: '#93c5fd', glow: 'rgba(147, 197, 253, 0.4)', name: 'Blue' },      
  { main: '#86efac', glow: 'rgba(134, 239, 172, 0.4)', name: 'Green' },     
  { main: '#67e8f9', glow: 'rgba(103, 232, 249, 0.4)', name: 'Cyan' },      
  { main: '#fdba74', glow: 'rgba(253, 186, 116, 0.4)', name: 'Orange' },    
  { main: '#f9a8d4', glow: 'rgba(249, 168, 212, 0.4)', name: 'Pink' },      
  { main: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', name: 'Slate' },     
  { main: '#fca5a5', glow: 'rgba(252, 165, 165, 0.4)', name: 'Red' },       
  { main: '#fde047', glow: 'rgba(253, 224, 71,  0.4)', name: 'Yellow' },     
  { main: '#c4b5fd', glow: 'rgba(196, 181, 253, 0.4)', name: 'Violet' },    
  { main: '#a5f3fc', glow: 'rgba(165, 243, 252, 0.4)', name: 'Sky' },       
];

const CHART_CONFIG = {
  COORDINATE_SCALE: 20,
  BOX_SIZE: 200,
  CAMERA_DISTANCE: 250,
  BLOOM_INTENSITY: 0.4,
  AUTO_ROTATE_DELAY: 3,
  ROTATE_SENSITIVITY: 2,
  ZOOM_SENSITIVITY: 1.5,
  NODE_SIZE_2D: 10,
  NODE_SIZE_3D: 6,
  SEARCH_HIGHLIGHT_SIZE_2D: 20,
  SEARCH_HIGHLIGHT_SIZE_3D: 20,
  EDGE_OPACITY: 0.05,
  EDGE_WIDTH: 0.5
};

// ═══════════════════════════════════════════════════════════════
// 🧮 算法工具：2D 凸包计算 (Monotone Chain Algorithm)
// ═══════════════════════════════════════════════════════════════
function getConvexHull(points) {
    if (!points || points.length === 0) return [];
    if (points.length === 1) return [points[0], points[0]];
    if (points.length === 2) return [...points, points[0]];
    
    const sorted = points.slice().sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

    const lower = [];
    for (let p of sorted) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
            lower.pop();
        }
        lower.push(p);
    }

    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const p = sorted[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
            upper.pop();
        }
        upper.push(p);
    }
    
    upper.pop();
    lower.pop();
    const hull = lower.concat(upper);
    if (hull.length > 0) hull.push(hull[0]); // 闭合多边形
    return hull;
}

// ═══════════════════════════════════════════════════════════════
// 🧠 KnowledgeBrainMap 组件
// ═══════════════════════════════════════════════════════════════

export function KnowledgeBrainMap({ data, onNodeClick }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  // 状态管理
  const [loading, setLoading] = useState(false);
  const [embeddingData, setEmbeddingData] = useState(null);
  const [missingKey, setMissingKey] = useState(false);
  const [error, setError] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showLabels, setShowLabels] = useState(false); 
  const [isDark, setIsDark] = useState(true);
  const [showRelations, setShowRelations] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterModule, setFilterModule] = useState(null);
  const [viewMode, setViewMode] = useState('3d');

  // 检查 API Key
  useEffect(() => {
    const key = localStorage.getItem('zhipu_key');
    if (!key) setMissingKey(true);
  }, []);

  // 获取 Embedding 数据
  const fetchEmbeddings = async (force = false) => {
    const apiKey = localStorage.getItem('zhipu_key');
    if (!apiKey) {
      setError('Missing API Key');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/knowledge-embedding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, forceRefresh: force })
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const resData = await res.json();
      if (resData.success) {
        setEmbeddingData({ points: resData.points || [], edges: resData.edges || [] });
      } else {
        throw new Error(resData.error || 'Unknown error');
      }
    } catch (e) {
      console.error("Failed to fetch embeddings:", e);
      setError(e.message);
      // 3 秒后自动重试（仅非强制刷新）
      if (!force) {
        setTimeout(() => fetchEmbeddings(false), 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  // 初始化数据
  useEffect(() => {
    if (data && data.length > 0 && !embeddingData && !missingKey) {
       fetchEmbeddings(false);
    }
  }, [data, missingKey]);

  // 数据处理（移除 viewMode 依赖）
  const { nodes, edges, moduleColorMap } = useMemo(() => {
    if (!embeddingData || !data) return { nodes: [], edges: [], moduleColorMap: {} };

    const { points, edges: serverEdges } = embeddingData;
    const nodeList = [];
    const colorMap = {};

    // 模块颜色映射 — knowledge.json 用 "name" 字段存储模块名
    data.forEach((mod, modIdx) => {
      colorMap[mod.name] = MODULE_NEON_COLORS[modIdx % MODULE_NEON_COLORS.length];
    });

    // 构建 item 索引
    const itemMap = new Map();
    data.forEach(mod => {
        mod.items.forEach(item => itemMap.set(item.id, { ...item, module: mod.name }));
    });

    // 生成节点数据
    points.forEach(p => {
        const original = itemMap.get(p.id);
        if (!original) return;

        const modColor = colorMap[p.module] || MODULE_NEON_COLORS[0];
        
        // 动态计算大小 (relations count)
        const relCount = original.relations ? original.relations.length : 0;
        const size = Math.max(5, Math.min(30, relCount * 2 + 6));

        nodeList.push({
            id: p.id,
            name: p.term,
            x: p.x * CHART_CONFIG.COORDINATE_SCALE, 
            y: p.y * CHART_CONFIG.COORDINATE_SCALE, 
            z: p.z * CHART_CONFIG.COORDINATE_SCALE, 
            symbolSize: size,
            value: 1,
            module: p.module,
            moduleColor: modColor,
            originalItem: original
        });
    });

    // 生成边数据 (Explicit + Semantic)
    const allEdges = [];

    // 1. Explicit Relations
    nodeList.forEach(sourceNode => {
        if(sourceNode.originalItem.relations) {
            sourceNode.originalItem.relations.forEach(rel => {
                 allEdges.push({
                    source: sourceNode.id,
                    target: rel.targetId,
                    lineStyle: {
                        color: 'rgba(255,255,255,0.2)',
                        width: 1.5,
                        curveness: 0.3
                    }
                 });
            });
        }
    });

    // 2. Semantic Edges (Server provided)
    if (serverEdges) {
        serverEdges.forEach(e => {
            allEdges.push({
                source: e.source,
                target: e.target,
                value: e.similarity,
                lineStyle: {
                    color: `rgba(0, 255, 255, ${CHART_CONFIG.EDGE_OPACITY})`,
                    width: CHART_CONFIG.EDGE_WIDTH,
                    curveness: 0.3
                }
            });
        });
    }

    return { nodes: nodeList, edges: allEdges, moduleColorMap: colorMap };
  }, [data, embeddingData]);

  // 过滤数据
  const filteredData = useMemo(() => {
      let filteredNodes = nodes;
      
      if (filterModule) {
          filteredNodes = nodes.filter(n => n.module === filterModule);
      }
      
      if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filteredNodes = filteredNodes.filter(n => n.name.toLowerCase().includes(q));
      }

      // Re-index edges to match current filteredNodes indices
      const nodeIdToIndex = new Map();
      filteredNodes.forEach((n, idx) => nodeIdToIndex.set(n.id, idx));

      const validEdges = edges
          .filter(e => nodeIdToIndex.has(e.source) && nodeIdToIndex.has(e.target))
          .map(e => ({
              ...e,
              source: nodeIdToIndex.get(e.source),
              target: nodeIdToIndex.get(e.target)
          }));

      return { nodes: filteredNodes, edges: validEdges };
  }, [nodes, edges, filterModule, searchQuery]);

  // 渲染图表
  useEffect(() => {
    if (!chartRef.current || filteredData.nodes.length === 0) return;
    
    // 增强清理逻辑：释放 WebGL 上下文
    const existingChart = echarts.getInstanceByDom(chartRef.current);
    if (existingChart) {
        existingChart.dispose();
        
        // 如果从 3D 切换到 2D，强制释放 GL 上下文
        if (viewMode === '2d') {
            const canvas = chartRef.current.querySelector('canvas');
            if (canvas) {
                const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                if (gl) {
                    const loseCtx = gl.getExtension('WEBGL_lose_context');
                    if (loseCtx) loseCtx.loseContext();
                }
            }
        }
    }

    const chart = echarts.init(chartRef.current, isDark ? 'dark' : undefined);
    chartInstance.current = chart;

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    // 移除旧的点击监听器，避免重复绑定
    chart.off('click');
    chart.on('click', (params) => {
        if (!params || !params.data) return;
        const item = params.data.originalItem;
        if (item) {
             setSelectedNode(params.data);
             onNodeClick?.(item);
        }
    });

    const baseOption = {
        backgroundColor: isDark ? NEON_COLORS.deepSpace : '#f8fafc',
        tooltip: {
            formatter: (params) => {
                if (params.seriesType === 'graphGL' || params.seriesType === 'scatter') {
                    const label = params.data.term || params.name;
                    return `<b>${label}</b><br/>${params.data.module || ''}`;
                }
                return params.name; 
            }
        },
    };

    // ============ 3D 模式 ============
    if (viewMode === '3d') {
        const isSearching = searchQuery.trim().length > 0;
        const searchLower = searchQuery.toLowerCase();

        const option = {
            ...baseOption,
            title: {
                text: 'SEMANTIC NEURAL SPACE',
                subtext: '3D PCA Projection',
                left: 'center',
                top: 20,
                textStyle: { color: isDark ? NEON_COLORS.cyan : '#0891b2', fontSize: 16, fontFamily: 'monospace' },
                subtextStyle: { color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.5)' }
            },
            xAxis3D: { show: false, type: 'value' },
            yAxis3D: { show: false, type: 'value' },
            zAxis3D: { show: false, type: 'value' },
            grid3D: {
                show: false,
                boxWidth: CHART_CONFIG.BOX_SIZE, 
                boxHeight: CHART_CONFIG.BOX_SIZE, 
                boxDepth: CHART_CONFIG.BOX_SIZE,
                environment: isDark ? '#000' : '#fff',
                viewControl: {
                    projection: 'perspective',
                    autoRotate: !isSearching, 
                    autoRotateAfterStill: CHART_CONFIG.AUTO_ROTATE_DELAY,
                    autoRotateSpeed: 5,
                    damping: 0.8,
                    distance: CHART_CONFIG.CAMERA_DISTANCE,
                    rotateSensitivity: CHART_CONFIG.ROTATE_SENSITIVITY,
                    zoomSensitivity: CHART_CONFIG.ZOOM_SENSITIVITY
                },
                postEffect: {
                    enable: true,
                    bloom: { enable: isDark, bloomIntensity: CHART_CONFIG.BLOOM_INTENSITY },
                    SSAO: { enable: true, radius: 2, intensity: 1.5 }
                }
            },
            series: [{
                type: 'graphGL',
                layout: 'none',
                data: filteredData.nodes.map(n => {
                    const isMatch = isSearching && n.name.toLowerCase().includes(searchLower);
                    return {
                        ...n,
                        itemStyle: {
                            color: isMatch ? NEON_COLORS.highlight : n.moduleColor.main,
                            opacity: isSearching ? (isMatch ? 1 : 0.1) : 0.8
                        },
                        emphasis: {
                            itemStyle: {
                                color: isMatch ? NEON_COLORS.highlight : n.moduleColor.main,
                            }
                        }
                    };
                }),
                links: showRelations ? filteredData.edges : [],
                symbolSize: (val, params) => {
                    if (isSearching && params.name.toLowerCase().includes(searchLower)) {
                        return 30;
                    }
                    return params.data.symbolSize || CHART_CONFIG.NODE_SIZE_3D;
                },
                label: {
                    show: showLabels,
                    color: isDark ? '#fff' : '#333',
                    fontSize: 12,
                    position: 'right',
                    formatter: '{b}' 
                },
                lineStyle: {
                    color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    width: 0.5
                },
                emphasis: {
                    label: { show: true },
                    itemStyle: { opacity: 1 },
                    lineStyle: { width: 2, opacity: 0.8 }
                }
            }]
        };
        chart.setOption(option);

    // ============ 2D 模式 ============
    } else {
        const isSearching = searchQuery.trim().length > 0;
        const searchLower = searchQuery.toLowerCase();

        // 按模块分组计算凸包
        const moduleGroups = {};
        filteredData.nodes.forEach(n => {
            if (!moduleGroups[n.module]) moduleGroups[n.module] = [];
            moduleGroups[n.module].push([n.x, n.y]);
        });

        const hullSeries = Object.keys(moduleGroups).map(modName => {
            const points = moduleGroups[modName];
            const hull = getConvexHull(points);
            const colorObj = moduleColorMap[modName] || MODULE_NEON_COLORS[0];

            return {
                name: modName,
                type: 'line',
                smooth: true,
                symbol: 'none',
                data: hull,
                lineStyle: {
                    width: 1, 
                    type: 'dashed', 
                    color: colorObj.main, 
                    opacity: 0.5
                },
                areaStyle: {
                    color: colorObj.main, 
                    opacity: 0.15
                },
                z: 1
            };
        });

        const scatterSeries = {
            name: 'Nodes',
            type: 'scatter',
            data: filteredData.nodes.map(n => {
                const isMatch = isSearching && n.name.toLowerCase().includes(searchLower);
                return {
                    name: n.name,
                    value: [n.x, n.y],
                    module: n.module,
                    moduleColor: n.moduleColor,
                    originalItem: n.originalItem,
                    symbolSize: n.symbolSize,
                    itemStyle: {
                        color: isMatch ? NEON_COLORS.highlight : n.moduleColor.main,
                        borderColor: isDark ? '#fff' : '#666',
                        borderWidth: 1,
                        opacity: isSearching ? (isMatch ? 1 : 0.3) : 0.9,
                        shadowBlur: isMatch ? 15 : 0,
                        shadowColor: isMatch ? NEON_COLORS.highlight : 'transparent'
                    }
                };
            }),
            symbolSize: (val, params) => {
                if (isSearching && params.name.toLowerCase().includes(searchLower)) {
                    return CHART_CONFIG.SEARCH_HIGHLIGHT_SIZE_2D;
                }
                return params.data.symbolSize || CHART_CONFIG.NODE_SIZE_2D;
            },
            label: {
                show: showLabels,
                position: 'right',
                formatter: '{b}',
                fontSize: 10,
                color: isDark ? '#ddd' : '#333'
            },
            emphasis: {
                itemStyle: {
                    borderColor: '#fff',
                    borderWidth: 2,
                    shadowBlur: 20,
                    shadowColor: 'rgba(255,255,255,0.5)'
                }
            },
            z: 2
        };

        const option = {
            ...baseOption,
            title: {
                text: 'KNOWLEDGE CLUSTER MAP',
                subtext: '2D PCA & Region Analysis',
                left: 'center',
                top: 20,
                textStyle: { color: NEON_COLORS.cyan, fontSize: 16, fontFamily: 'monospace' },
                subtextStyle: { color: 'rgba(255,255,255,0.4)' }
            },
            grid: {
                top: 80, bottom: 40, left: 40, right: 40,
                containLabel: true
            },
            xAxis: { 
                type: 'value',
                scale: true, 
                axisLine: { show: false },
                splitLine: { show: true, lineStyle: { color: NEON_COLORS.grid } },
                axisLabel: { show: false }
            },
            yAxis: { 
                type: 'value',
                scale: true, 
                axisLine: { show: false },
                splitLine: { show: true, lineStyle: { color: NEON_COLORS.grid } },
                axisLabel: { show: false }
            },
            dataZoom: [
                { type: 'inside', xAxisIndex: 0, filterMode: 'empty' },
                { type: 'inside', yAxisIndex: 0, filterMode: 'empty' }
            ],
            series: [...hullSeries, scatterSeries]
        };
        chart.setOption(option);
    }

    return () => {
        window.removeEventListener('resize', handleResize);
        if (chart && !chart.isDisposed()) {
            chart.dispose();
        }
    };

  }, [filteredData, searchQuery, showLabels, viewMode, moduleColorMap, onNodeClick, isDark, showRelations]);

  return (
    <div className={`w-full h-full relative overflow-hidden transition-colors duration-700 ${isDark ? 'bg-[#0a0a0f]' : 'bg-slate-50'}`}>
      {/* 扫描线效果 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05]" 
           style={{ 
             backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.2) 2px, rgba(0,255,255,0.2) 4px)',
             animation: 'scanlines 10s linear infinite'
           }} 
      />
      <style>{`@keyframes scanlines { from { transform: translateY(0); } to { transform: translateY(10px); } }`}</style>
      
      {/* 图表容器 - key={viewMode} 强制重建 DOM */}
      <div key={viewMode} ref={chartRef} className="absolute inset-0 w-full h-full z-10" />

      {/* Loading Overlay */}
      {loading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                  <RefreshCw className="animate-spin text-cyan-400" size={48} />
                  <div className="text-cyan-200 font-mono animate-pulse">COMPUTING VECTORS...</div>
              </div>
          </div>
      )}

      {/* Error Toast */}
      {error && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-red-900/90 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-2 backdrop-blur-md border border-red-500/50">
              <AlertCircle size={18} />
              <span className="font-mono text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-2 hover:text-red-200">
                  <X size={16} />
              </button>
          </div>
      )}

      {/* Start Button */}
      {!loading && !embeddingData && (
          <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <div className="bg-black/80 border border-cyan-500/50 p-8 rounded-2xl pointer-events-auto text-center max-w-md backdrop-blur-md shadow-[0_0_50px_rgba(0,255,255,0.2)]">
                  <BrainCircuit size={64} className="mx-auto text-cyan-400 mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2 font-mono">KNOWLEDGE GRAPH SYSTEM</h2>
                  <p className="text-gray-400 mb-6 text-sm">
                      利用大模型 Embedding 技术计算知识点语义向量，
                      并通过 PCA 降维与余弦相似度聚类。
                  </p>
                  {missingKey ? (
                      <div className="text-red-400 bg-red-900/20 p-2 rounded mb-4 text-xs font-mono border border-red-500/30">
                          MISSING API KEY - CONFIG REQUIRED
                      </div>
                  ) : (
                      <button 
                        onClick={() => fetchEmbeddings(false)}
                        className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/50 transition-all flex items-center gap-2 mx-auto"
                      >
                          <Zap size={18} /> INITIALIZE SYSTEM
                      </button>
                  )}
              </div>
          </div>
      )}

      {/* Top Controls */}
      <div className="absolute top-4 left-4 right-4 z-30 flex justify-between pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-500/50" size={14} />
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search Node..."
                    className="bg-black/50 border border-cyan-500/30 text-cyan-100 pl-9 pr-4 py-2 rounded text-sm focus:outline-none focus:border-cyan-400 w-64 backdrop-blur font-mono"
                />
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex bg-black/50 border border-gray-700 rounded p-1 gap-1">
                <button 
                  onClick={() => setViewMode('3d')}
                  className={`p-1.5 rounded transition-all ${viewMode === '3d' ? 'bg-cyan-900/50 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}
                  title="3D Neural Space"
                >
                    <Box size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('2d')}
                  className={`p-1.5 rounded transition-all ${viewMode === '2d' ? 'bg-cyan-900/50 text-cyan-300' : 'text-gray-500 hover:text-gray-300'}`}
                  title="2D Cluster Regions"
                >
                    <Layout size={16} />
                </button>
            </div>
          </div>
          
          <div className="pointer-events-auto flex gap-2">
              {/* Label Toggle */}
              <button 
                onClick={() => setShowLabels(!showLabels)} 
                className={`p-2 rounded border ${showLabels ? 'bg-cyan-900/50 border-cyan-500 text-cyan-200' : 'bg-black/50 border-gray-700 text-gray-500'}`}
                title="Toggle Labels"
              >
                  {showLabels ? <Eye size={18} /> : <EyeOff size={18} />}
              </button>

              {/* Relation Toggle */}
              <button 
                onClick={() => setShowRelations(!showRelations)} 
                className={`p-2 rounded border ${showRelations ? 'bg-cyan-900/50 border-cyan-500 text-cyan-200' : 'bg-black/50 border-gray-700 text-gray-500'}`}
                title="Toggle Relations"
              >
                  <Network size={18} />
              </button>

              {/* Theme Toggle */}
              <button 
                onClick={() => setIsDark(!isDark)} 
                className={`p-2 rounded border ${isDark ? 'bg-slate-800 border-gray-600 text-yellow-300' : 'bg-white border-gray-300 text-orange-500'}`}
                title="Toggle Theme"
              >
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              
              {/* Force Refresh */}
              <button 
                 onClick={() => fetchEmbeddings(true)}
                 title="Force Re-embed"
                 className="p-2 rounded border border-gray-700 bg-black/50 text-gray-400 hover:text-cyan-400 hover:border-cyan-500 transition-colors"
              >
                  <RefreshCw size={18} />
              </button>
          </div>
      </div>

      {/* Module Legend */}
      <div className="absolute bottom-6 left-6 z-30 max-w-[600px] flex flex-wrap gap-2 pointer-events-none">
         <div className="pointer-events-auto flex flex-wrap gap-1">
             <button 
                onClick={() => setFilterModule(null)}
                className={`px-2 py-0.5 text-[10px] font-mono border rounded ${!filterModule ? 'border-cyan-400 bg-cyan-900/30 text-cyan-100' : 'border-gray-800 bg-black/40 text-gray-500'}`}
             >
                 ALL
             </button>
             {Object.entries(moduleColorMap || {}).map(([mod, color]) => (
                 <button
                    key={mod}
                    onClick={() => setFilterModule(filterModule === mod ? null : mod)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded border backdrop-blur-sm transition-all ${
                        filterModule === mod 
                        ? 'bg-white/10 border-white/50 text-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                        : 'bg-black/60 border-gray-800 text-gray-500 hover:border-gray-600'
                    }`}
                 >
                     <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color.main, boxShadow: `0 0 5px ${color.glow}` }} />
                     <span className="text-[10px] font-mono max-w-[80px] truncate">{mod}</span>
                 </button>
             ))}
         </div>
      </div>

      {/* Detail Panel */}
      {selectedNode && (
          <div className="absolute bottom-6 right-6 z-40 w-80 bg-black/90 border border-cyan-500/30 p-4 rounded-xl backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.8)]">
              <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedNode.moduleColor.main }} />
                     <h3 className="text-white font-bold text-sm tracking-wide">{selectedNode.name}</h3>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-gray-500 hover:text-white">
                      <X size={14}/>
                  </button>
              </div>
              <div className="text-xs text-cyan-400/80 font-mono mb-3">{selectedNode.module}</div>
              
              {selectedNode.originalItem?.definition && (
                  <div className="bg-white/5 p-3 rounded mb-3 border border-white/5">
                      <p className="text-gray-300 text-xs leading-relaxed line-clamp-4">
                          {selectedNode.originalItem.definition}
                      </p>
                  </div>
              )}
              
              <button 
                onClick={() => onNodeClick?.(selectedNode.originalItem)}
                className="w-full py-2 bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-200 text-xs font-bold rounded transition-all flex justify-center items-center gap-2"
              >
                  <Maximize2 size={12} /> ENTER MODULE
              </button>
          </div>
      )}

    </div>
  );
}

export default KnowledgeBrainMap;