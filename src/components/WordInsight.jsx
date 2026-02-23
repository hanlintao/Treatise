import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../utils/api';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import ReactMarkdown from 'react-markdown';
import { RefreshCw, Brain, PieChart, BarChart3, LayoutGrid, Check, X, Filter, BookOpen, Layers, Quote, GitBranch, Calendar, Lightbulb } from 'lucide-react';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

export default function WordInsight() {
    const navigate = useNavigate();
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [insightLoading, setInsightLoading] = useState(false);
    const [insight, setInsight] = useState(null);
    const [filterSource, setFilterSource] = useState('mixed'); // mixed, references, papers
    
    // Data Sources
    const [references, setReferences] = useState([]);
    const [selectedPapers, setSelectedPapers] = useState(new Set()); // Set of IDs
    const [isPaperSelectorOpen, setIsPaperSelectorOpen] = useState(false);

    // Filters
    const [posFilters, setPosFilters] = useState({
        noun: true,
        verb: true,
        adj: true,
        entity: true, // Names, Places, Orgs
        adv: true,    // Adverbs
        other: true
    });
    
    // Interaction
    const [selectedWord, setSelectedWord] = useState(null); // { name, value, sources: [], snippets, co_occurrence, yearly }
    const [activeTab, setActiveTab] = useState('context'); // context, relations, trends, sources
    const [viewMode, setViewMode] = useState('cloud'); // cloud, bar, pie, treemap

    const chartRef = useRef(null);
    const chartInstance = useRef(null);
    const trendChartRef = useRef(null);
    const trendChartInstance = useRef(null);
    const relationChartRef = useRef(null);
    const relationChartInstance = useRef(null);

    useEffect(() => {
        fetchReferences();
        fetchResult();
    }, []);

    useEffect(() => {
        if (result && chartRef.current) {
            if (viewMode === 'cloud') initChart();
            else if (viewMode === 'bar') initBarChart();
            else if (viewMode === 'pie') initPieChart();
            else if (viewMode === 'treemap') initTreemapChart();
        }
        // Cleanup on unmount or mode change
        return () => {
            if (chartInstance.current) {
                chartInstance.current.dispose();
                chartInstance.current = null;
            }
        };
    }, [result, posFilters, viewMode]); // Re-render chart when result or filters change

    useEffect(() => {
        if (selectedWord && activeTab === 'trends' && trendChartRef.current) {
            // Use ResizeObserver for more robust dimension detection than setTimeout
            const resizeObserver = new ResizeObserver(() => {
                 if (trendChartRef.current?.clientWidth > 0) {
                     initTrendChart();
                     resizeObserver.disconnect();
                 }
            });
            resizeObserver.observe(trendChartRef.current);
            return () => resizeObserver.disconnect();
        }
        if (selectedWord && activeTab === 'relations' && relationChartRef.current) {
             const resizeObserver = new ResizeObserver(() => {
                 if (relationChartRef.current?.clientWidth > 0) {
                     initRelationChart();
                     resizeObserver.disconnect();
                 }
            });
            resizeObserver.observe(relationChartRef.current);
            return () => resizeObserver.disconnect();
        }
    }, [selectedWord, activeTab]);

    const fetchReferences = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/references`);
            const data = await res.json();
            setReferences(data);
        } catch (e) {
            console.error("Failed to load references", e);
        }
    };

    const fetchResult = async () => {
        try {
            // Add timestamp to prevent caching
            const res = await fetch(`${API_BASE_URL}/api/analysis/result?t=${Date.now()}`);
            const data = await res.json();
            if (data) setResult(data);
        } catch (e) {
            console.error(e);
        }
    };

    const runAnalysis = async () => {
        setLoading(true);
        setSelectedWord(null); // Clear selection
        try {
            const target = selectedPapers.size > 0 
                ? Array.from(selectedPapers).join(',') 
                : 'all';

            const res = await fetch(`${API_BASE_URL}/api/analysis/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: filterSource, target: target })
            });
            const data = await res.json();
            if (data.success) {
                await fetchResult();
            } else {
                alert('Analysis failed: ' + JSON.stringify(data));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const getInsight = async () => {
        if (!result || !result.word_list) return;
        const apiKey = localStorage.getItem('deepseek_key');
        if (!apiKey) {
            alert('请先在魔法管理页面配置 DeepSeek API Key');
            return;
        }

        setInsightLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/analysis/insight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    words: result.word_list.slice(0, 50),
                    apiKey
                })
            });
            const data = await res.json();
            if (data.success) {
                setInsight(data.content);
            } else {
                alert('Insight failed: ' + data.error);
            }
        } catch (e) {
            alert(e.message);
        } finally {
            setInsightLoading(false);
        }
    };

    const initChart = () => {
        if (chartInstance.current) {
            chartInstance.current.dispose();
        }
        
        chartInstance.current = echarts.init(chartRef.current);
        
        // Filter Data based on POS
        const filteredData = getFilteredData();

        const data = filteredData.map(item => ({
            name: item.name,
            value: item.value,
            // Pass original item data to event handler
            original: item,
            textStyle: {
                color: ['nr', 'ns', 'nt', 'nz'].includes(item.pos) ? '#e11d48' : // Entities Rose
                       item.pos.startsWith('n') ? '#4f46e5' : // Nouns Indigo
                       item.pos.startsWith('v') ? '#0ea5e9' : // Verbs Sky
                       item.pos.startsWith('a') ? '#10b981' : // Adjectives Emerald
                       item.pos.startsWith('d') ? '#d97706' : // Adverbs Amber
                       '#64748b' // Others Slate
            }
        }));

        const option = {
            tooltip: {
                show: true,
                formatter: (params) => {
                    const item = result.word_list.find(w => w.name === params.name);
                    return `${params.name}: ${params.value} <br/> <span style="font-size:10px; color:#aaa">${item?.pos || 'unknown'}</span>`;
                }
            },
            series: [{
                type: 'wordCloud',
                shape: 'circle',
                left: 'center',
                top: 'center',
                width: '100%',
                height: '100%',
                right: null,
                bottom: null,
                sizeRange: [12, 60],
                rotationRange: [-45, 90],
                rotationStep: 45,
                gridSize: 8,
                drawOutOfBound: false,
                layoutAnimation: true,
                textStyle: {
                    fontFamily: 'sans-serif',
                    fontWeight: 'bold'
                },
                emphasis: {
                    focus: 'self',
                    textStyle: {
                        shadowBlur: 10,
                        shadowColor: '#333'
                    }
                },
                data: data
            }]
        };

        chartInstance.current.setOption(option);

        // Click Handler
        chartInstance.current.on('click', (params) => {
            // Find in current data first to get original data
            const clickedData = data.find(item => item.name === params.name);
            if (clickedData && clickedData.original) {
               setSelectedWord(clickedData.original);
               setActiveTab('context'); // Reset tab
            } else {
               // Fallback
               const item = result.word_list.find(w => w.name === params.name);
               if (item) {
                   setSelectedWord(item);
                   setActiveTab('context');
               }
            }
        });
    };

    const getFilteredData = () => {
         return (result?.word_list || []).filter(item => {
            if (!item.pos) return posFilters.other;
            const p = item.pos;
            if (['nr', 'ns', 'nt', 'nz'].includes(p)) return posFilters.entity;
            if (p.startsWith('n')) return posFilters.noun;
            if (p.startsWith('v')) return posFilters.verb;
            if (p.startsWith('a')) return posFilters.adj;
            if (p.startsWith('d')) return posFilters.adv;
            return posFilters.other;
        });
    };

    const initBarChart = () => {
        if (!chartRef.current) return;
        chartInstance.current = echarts.init(chartRef.current);
        const data = getFilteredData().slice(0, 15); // Top 15
        
        const option = {
            tooltip: { 
                trigger: 'axis',
                axisPointer: { type: 'shadow' }
            },
            grid: { top: 20, right: 30, bottom: 20, left: 10, containLabel: true },
            xAxis: { type: 'value' },
            yAxis: { 
                type: 'category', 
                data: data.map(i => i.name).reverse(),
                axisLabel: { interval: 0 }
            },
            series: [{
                type: 'bar',
                data: data.map(item => ({
                    value: item.value,
                    itemStyle: {
                        color: ['nr', 'ns', 'nt', 'nz'].includes(item.pos) ? '#e11d48' :
                               item.pos.startsWith('n') ? '#4f46e5' :
                               item.pos.startsWith('v') ? '#0ea5e9' :
                               item.pos.startsWith('a') ? '#10b981' :
                               item.pos.startsWith('d') ? '#d97706' : '#64748b'
                    }
                })).reverse(),
                label: { show: true, position: 'right' },
                barWidth: 20
            }]
        };
        chartInstance.current.setOption(option);
        chartInstance.current.on('click', (params) => {
             const idx = data.length - 1 - params.dataIndex; // Reverse index
             if(data[idx]) { setSelectedWord(data[idx]); setActiveTab('context'); }
        });
    };

    const initPieChart = () => {
        if (!chartRef.current) return;
        chartInstance.current = echarts.init(chartRef.current);
        const filtered = getFilteredData();
        
        // Group by simplified POS
        const groups = { '名词': 0, '动词': 0, '形容词': 0, '实体': 0, '副词': 0, '其他': 0 };
        filtered.forEach(item => {
            if (['nr', 'ns', 'nt', 'nz'].includes(item.pos)) groups['实体'] += item.value;
            else if (item.pos.startsWith('n')) groups['名词'] += item.value;
            else if (item.pos.startsWith('v')) groups['动词'] += item.value;
            else if (item.pos.startsWith('a')) groups['形容词'] += item.value;
            else if (item.pos.startsWith('d')) groups['副词'] += item.value;
            else groups['其他'] += item.value;
        });

        const data = Object.entries(groups).map(([k, v]) => ({ name: k, value: v })).filter(d => d.value > 0);

        const option = {
            tooltip: { trigger: 'item' },
            legend: { top: '5%', left: 'center' },
            series: [{
                name: '词性分布',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: { show: false, position: 'center' },
                emphasis: {
                    label: { show: true, fontSize: 20, fontWeight: 'bold' }
                },
                labelLine: { show: false },
                data: data,
                color: ['#4f46e5', '#0ea5e9', '#10b981', '#e11d48', '#d97706', '#64748b'] // Roughly matches our scheme, ECharts assigns by order though
            }]
        };
        chartInstance.current.setOption(option);
    };

    const initTreemapChart = () => {
         if (!chartRef.current) return;
         chartInstance.current = echarts.init(chartRef.current);
         const filtered = getFilteredData().slice(0, 50); // Top 50
         
         const option = {
            tooltip: { formatter: '{b}: {c}' },
            series: [{
                type: 'treemap',
                data: filtered.map(item => ({
                    name: item.name,
                    value: item.value,
                    itemStyle: {
                        color: ['nr', 'ns', 'nt', 'nz'].includes(item.pos) ? '#e11d48' :
                               item.pos.startsWith('n') ? '#4f46e5' :
                               item.pos.startsWith('v') ? '#0ea5e9' :
                               item.pos.startsWith('a') ? '#10b981' :
                               item.pos.startsWith('d') ? '#d97706' : '#64748b'
                    }
                })),
                breadcrumb: { show: false }
            }]
         };
         chartInstance.current.setOption(option);
         chartInstance.current.on('click', (params) => {
             const found = filtered.find(i => i.name === params.name);
             if(found) { setSelectedWord(found); setActiveTab('context'); }
        });
    };

    const initTrendChart = () => {
        if (!selectedWord || !selectedWord.yearly || !trendChartRef.current) return;
        
        // Ensure container has dimensions
        if (trendChartRef.current.clientWidth === 0 || trendChartRef.current.clientHeight === 0) return;

        if (trendChartInstance.current) trendChartInstance.current.dispose();

        trendChartInstance.current = echarts.init(trendChartRef.current);
        
        const years = Object.keys(selectedWord.yearly).sort();
        const values = years.map(y => selectedWord.yearly[y]);

        const option = {
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'category', data: years },
            yAxis: { type: 'value', minInterval: 1 },
            grid: { top: 20, right: 20, bottom: 20, left: 30, containLabel: true },
            series: [{
                data: values,
                type: 'line',
                smooth: true,
                itemStyle: { color: '#8b5cf6' },
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                      { offset: 0, color: 'rgba(139, 92, 246, 0.5)' },
                      { offset: 1, color: 'rgba(139, 92, 246, 0.05)' }
                    ])
                }
            }]
        };
        trendChartInstance.current.setOption(option);
    };

    const initRelationChart = () => {
        if (!selectedWord || !selectedWord.co_occurrence || !relationChartRef.current) return;
        
        // Ensure container has dimensions
        if (relationChartRef.current.clientWidth === 0 || relationChartRef.current.clientHeight === 0) return;

        if (relationChartInstance.current) relationChartInstance.current.dispose();

        relationChartInstance.current = echarts.init(relationChartRef.current);

        const centerNode = {
            id: 'root_' + selectedWord.name, // Ensure unique ID
            name: selectedWord.name,
            value: selectedWord.value,
            symbolSize: 30,
            itemStyle: { color: '#4f46e5' },
            label: { show: true, position: 'top' }
        };

        const nodes = [centerNode];
        const links = [];
        const addedNodeNames = new Set([selectedWord.name]); // Track added names to prevent dupes

        selectedWord.co_occurrence.forEach((co, idx) => {
             if (addedNodeNames.has(co.name)) return; // Skip duplicates
             
             addedNodeNames.add(co.name);
             // Scale symbol size based on value, max 20, min 10
             const size = Math.max(10, Math.min(25, co.value * 2));
             nodes.push({
                 id: 'node_' + co.name, // Unique ID
                 name: co.name,
                 value: co.value,
                 symbolSize: size,
                 itemStyle: { color: '#0ea5e9' },
                 label: { show: true, fontSize: 10 }
             });
             links.push({
                 source: selectedWord.name,
                 target: co.name,
                 value: co.value
             });
        });

        const option = {
            tooltip: {},
            series: [{
                type: 'graph',
                layout: 'force',
                data: nodes,
                links: links,
                roam: true,
                label: { show: true },
                force: {
                    repulsion: 100,
                    edgeLength: 50
                },
                lineStyle: {
                    color: '#cbd5e1',
                    curveness: 0.1
                }
            }]
        };
        relationChartInstance.current.setOption(option);
    };

    // Resize handling with debounce
    useEffect(() => {
        let resizeTimer;
        const handleResize = () => {
             clearTimeout(resizeTimer);
             resizeTimer = setTimeout(() => {
                chartInstance.current && chartInstance.current.resize();
                trendChartInstance.current && trendChartInstance.current.resize();
                relationChartInstance.current && relationChartInstance.current.resize();
             }, 100);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            clearTimeout(resizeTimer);
        };
    }, []);

    const togglePaperSelection = (id) => {
        const newSet = new Set(selectedPapers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedPapers(newSet);
    };

    const getSourceTitle = (id) => {
        const ref = references.find(r => String(r.id) === String(id));
        return ref ? ref.title : `Unknown Source (${id})`;
    };

    // Save to Knowledge
    const saveToKnowledge = () => {
        if (!selectedWord) return;
        // Since we can't easily pass complex state via URL state efficiently without proper routing setup
        // We'll mimic creating a new concept using localStorage to pass data
        const draft = {
            title: selectedWord.name,
            desc: `"${selectedWord.name}" 在 ${selectedWord.sources?.length || 0} 篇文献中出现 ${selectedWord.value} 次。\n\n相关词：${selectedWord.co_occurrence?.map(c=>c.name).slice(0,5).join(', ')}`,
            quotes: selectedWord.snippets?.slice(0,3) || []
        };
        
        localStorage.setItem('knowledge_draft', JSON.stringify(draft));
        navigate('/knowledge');
    };

    return (
        <div className="flex h-full bg-slate-50 relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-slate-200 p-4 flex flex-col gap-4 relative z-20 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="font-bold text-lg flex items-center gap-2">
                                <PieChart className="w-5 h-5 text-indigo-600" />
                                学术词性洞察 (Word Insight)
                            </h1>
                            <p className="text-xs text-slate-500">
                                词频统计与语义分析工作台
                                {result && (
                                    <span className="ml-2 inline-flex items-center gap-2">
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-indigo-600">Total: {result.meta?.total_words || 0}</span>
                                        <span className={clsx("px-2 py-0.5 rounded text-xs", result.meta?.target === 'all' ? "bg-slate-100 text-slate-500" : "bg-indigo-50 text-indigo-600 border border-indigo-200")}>
                                            Range: {result.meta?.target === 'all' ? 'All' : 'Custom Selection'}
                                        </span>
                                    </span>
                                )}
                            </p>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <select 
                                value={filterSource} 
                                onChange={(e) => setFilterSource(e.target.value)}
                                className="text-sm border border-slate-300 rounded-md px-2 py-1.5 focus:outline-indigo-500"
                            >
                                <option value="mixed">混合 (题录+论文)</option>
                                <option value="references">仅题录元数据</option>
                                <option value="papers">仅论文正文</option>
                            </select>
                            
                            <button 
                                onClick={runAnalysis} 
                                disabled={loading}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md text-sm transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                {loading ? '分析中...' : '重新运行'}
                            </button>
                        </div>
                    </div>

                    {/* Filters Toolbar */}
                    <div className="flex items-center gap-6 text-sm">
                        {/* Paper Selector */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsPaperSelectorOpen(!isPaperSelectorOpen)}
                                className={clsx(
                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors",
                                    selectedPapers.size > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <BookOpen className="w-4 h-4" />
                                {selectedPapers.size === 0 ? "全部文献" : `已选 ${selectedPapers.size} 篇`}
                            </button>

                            {/* Dropdown Panel */}
                            {isPaperSelectorOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsPaperSelectorOpen(false)} />
                                    <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-20 max-h-[400px] flex flex-col">
                                        <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-lg">
                                            <span className="font-medium text-xs text-slate-500">选择分析范围</span>
                                            <button 
                                                onClick={() => setSelectedPapers(new Set())}
                                                className="text-xs text-indigo-600 hover:text-indigo-700"
                                            >
                                                重置 (全选)
                                            </button>
                                        </div>
                                        <div className="overflow-y-auto p-2 space-y-1">
                                            {references.map(ref => (
                                                <div 
                                                    key={ref.id} 
                                                    className="flex items-start gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                                                    onClick={() => togglePaperSelection(String(ref.id))}
                                                >
                                                    <div className={clsx(
                                                        "w-4 h-4 mt-0.5 border rounded flex items-center justify-center shrink-0",
                                                        selectedPapers.has(String(ref.id)) ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"
                                                    )}>
                                                        {selectedPapers.has(String(ref.id)) && <Check className="w-3 h-3" />}
                                                    </div>
                                                    <span className="text-xs text-slate-700 line-clamp-2">{ref.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* POS Filter */}
                        <div className="flex items-center gap-3 border-l border-slate-200 pl-6">
                            <span className="text-slate-400 flex items-center gap-1"><Filter className="w-3 h-3" /> 词性:</span>
                            
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600">
                                <input 
                                    type="checkbox" 
                                    checked={posFilters.noun}
                                    onChange={e => setPosFilters({...posFilters, noun: e.target.checked})}
                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-indigo-600 font-medium">名词</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-rose-600">
                                <input 
                                    type="checkbox" 
                                    checked={posFilters.entity}
                                    onChange={e => setPosFilters({...posFilters, entity: e.target.checked})}
                                    className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                                />
                                <span className="text-rose-600 font-medium">实体</span>
                            </label>
                            
                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-sky-600">
                                <input 
                                    type="checkbox" 
                                    checked={posFilters.verb}
                                    onChange={e => setPosFilters({...posFilters, verb: e.target.checked})}
                                    className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="text-sky-600 font-medium">动词</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-emerald-600">
                                <input 
                                    type="checkbox" 
                                    checked={posFilters.adj}
                                    onChange={e => setPosFilters({...posFilters, adj: e.target.checked})}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span className="text-emerald-600 font-medium">形容词</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-amber-600">
                                <input 
                                    type="checkbox" 
                                    checked={posFilters.adv}
                                    onChange={e => setPosFilters({...posFilters, adv: e.target.checked})}
                                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="text-amber-600 font-medium">副词</span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-600">
                                <input 
                                    type="checkbox" 
                                    checked={posFilters.other}
                                    onChange={e => setPosFilters({...posFilters, other: e.target.checked})}
                                    className="rounded border-slate-300 text-slate-600 focus:ring-slate-500"
                                />
                                <span className="text-slate-500">其他</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Main Body */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Visualization */}
                    <div className="flex-1 p-4 bg-slate-50 relative flex flex-col">
                        {/* Viz Toolbar */}
                        {result && (
                             <div className="absolute top-6 right-6 z-10 bg-white rounded-lg border border-slate-200 shadow-sm p-1 flex gap-1">
                                <button 
                                    onClick={() => setViewMode('cloud')}
                                    className={clsx("p-1.5 rounded-md transition-colors", viewMode === 'cloud' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600")}
                                    title="词云视图"
                                >
                                    <Brain className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('bar')}
                                    className={clsx("p-1.5 rounded-md transition-colors", viewMode === 'bar' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600")}
                                    title="柱状图 (Top 15)"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('pie')}
                                    className={clsx("p-1.5 rounded-md transition-colors", viewMode === 'pie' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600")}
                                    title="词性分布"
                                >
                                    <PieChart className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setViewMode('treemap')}
                                    className={clsx("p-1.5 rounded-md transition-colors", viewMode === 'treemap' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:text-slate-600")}
                                    title="矩形树图"
                                >
                                    <LayoutGrid className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {!result ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                <Layers className="w-16 h-16 mb-4 opacity-30" />
                                <p>请点击"开始分析"生成词云</p>
                            </div>
                        ) : (
                            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 relative overflow-hidden">
                                <div ref={chartRef} className="w-full h-full" />
                                {/* Legend Overlay */}
                                <div className="absolute bottom-4 left-4 flex flex-col gap-1 text-[10px] bg-white/80 p-2 rounded backdrop-blur-sm border border-slate-100">
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#4f46e5]"></div> 名词 (Noun)</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#e11d48]"></div> 实体 (Entity)</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#0ea5e9]"></div> 动词 (Verb)</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#10b981]"></div> 形容词 (Adj)</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#d97706]"></div> 副词 (Adv)</div>
                                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#64748b]"></div> 其他 (Other)</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Sidebar (Insight or Detail) */}
                    <div className="w-[420px] border-l border-slate-200 bg-white flex flex-col overflow-hidden shadow-lg z-10 transition-all">
                        {selectedWord ? (
                            // --- Word Detail View ---
                            <div className="flex flex-col h-full animate-in slide-in-from-right duration-200">
                                <div className="p-4 border-b border-slate-100 bg-slate-50 relative">
                                    <button onClick={() => setSelectedWord(null)} className="absolute top-2 right-2 p-1 hover:bg-slate-200 rounded text-slate-400">
                                        <X className="w-5 h-5" />
                                    </button>
                                    
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <h2 className="text-2xl font-bold text-slate-800">{selectedWord.name}</h2>
                                        <span className="text-lg text-indigo-600 font-medium">{selectedWord.value} 次</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className="text-xs px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full">
                                            {selectedWord.pos}
                                        </span>
                                        <button 
                                            onClick={saveToKnowledge}
                                            className="ml-auto text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                                        >
                                            <Lightbulb className="w-3 h-3" />
                                            沉淀知识点
                                        </button>
                                    </div>

                                    {/* Tabs */}
                                    <div className="flex gap-4 text-sm border-b border-slate-200 pb-0">
                                        <button 
                                            className={clsx("pb-2 border-b-2 transition-colors", activeTab === 'context' ? "border-indigo-600 text-indigo-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700")}
                                            onClick={() => setActiveTab('context')}
                                        >
                                            语境
                                        </button>
                                        <button 
                                            className={clsx("pb-2 border-b-2 transition-colors", activeTab === 'relations' ? "border-indigo-600 text-indigo-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700")}
                                            onClick={() => setActiveTab('relations')}
                                        >
                                            共现
                                        </button>
                                        <button 
                                            className={clsx("pb-2 border-b-2 transition-colors", activeTab === 'trends' ? "border-indigo-600 text-indigo-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700")}
                                            onClick={() => setActiveTab('trends')}
                                        >
                                            趋势
                                        </button>
                                        <button 
                                            className={clsx("pb-2 border-b-2 transition-colors", activeTab === 'sources' ? "border-indigo-600 text-indigo-600 font-medium" : "border-transparent text-slate-500 hover:text-slate-700")}
                                            onClick={() => setActiveTab('sources')}
                                        >
                                            来源
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-4 custom-scrollbar">
                                    {activeTab === 'context' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                <Quote className="w-3 h-3" /> KWIC (Keyword in Context)
                                            </div>
                                            {selectedWord.snippets?.map((snippet, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded border border-slate-100 text-sm leading-relaxed text-slate-700 shadow-sm">
                                                    ...
                                                    <span dangerouslySetInnerHTML={{ 
                                                        __html: snippet.replace(selectedWord.name, `<span class="bg-yellow-200 font-semibold px-0.5 rounded">${selectedWord.name}</span>`) 
                                                    }} />
                                                    ...
                                                </div>
                                            ))}
                                            {(!selectedWord.snippets || selectedWord.snippets.length === 0) && (
                                                <div className="text-center text-slate-400 py-4 text-xs">暂无语境摘录</div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'relations' && (
                                        <div className="space-y-3 h-full flex flex-col">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                <GitBranch className="w-3 h-3" /> Co-occurrence Graph
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 min-h-[200px]">
                                                 <div ref={relationChartRef} className="w-full h-full" />
                                            </div>
                                            {(!selectedWord.co_occurrence || selectedWord.co_occurrence.length === 0) && (
                                                <div className="text-center text-slate-400 py-4 text-xs">暂无明显共现词</div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'trends' && (
                                        <div className="space-y-3 h-full flex flex-col">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                <Calendar className="w-3 h-3" /> Diachronic Analysis
                                            </div>
                                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-1 min-h-[200px]">
                                                <div ref={trendChartRef} className="w-full h-full" />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'sources' && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                                <BookOpen className="w-3 h-3" /> Source Distribution
                                            </div>
                                            {selectedWord.sources?.map(sourceId => (
                                                <div key={sourceId} className="p-3 bg-white rounded border border-slate-100 text-xs shadow-sm">
                                                    <div className="font-medium text-slate-800 mb-1">{getSourceTitle(sourceId)}</div>
                                                    <div className="text-slate-400">ID: {sourceId}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            // --- Default Insight View ---
                            <>
                                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                        <Brain className="w-4 h-4 text-purple-600" />
                                        智能解读
                                    </h2>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    {!insight ? (
                                        <div className="text-center py-8 space-y-4">
                                            <div className="w-16 h-16 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-full flex items-center justify-center mx-auto text-purple-300">
                                                <Brain className="w-8 h-8" />
                                            </div>
                                            <p className="text-sm text-slate-500 max-w-[220px] mx-auto leading-relaxed">
                                                点击图表上的单词查看<br/>
                                                <span className="font-medium text-indigo-600">语境、共现、趋势</span>
                                            </p>
                                            <button 
                                                onClick={getInsight} 
                                                disabled={insightLoading || !result}
                                                className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed w-full"
                                            >
                                                {insightLoading ? '正在分析语义...' : '✨ 生成 AI 洞察报告'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="prose prose-sm max-w-none prose-headings:text-slate-800 prose-p:text-slate-600 prose-li:text-slate-600">
                                            <ReactMarkdown>{insight}</ReactMarkdown>
                                            <button 
                                                onClick={() => setInsight(null)} 
                                                className="mt-8 text-xs text-slate-400 hover:text-slate-600 underline w-full text-center pb-4"
                                            >
                                                清空并重新生成
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const customStyles = `
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 20px;
}
`;
