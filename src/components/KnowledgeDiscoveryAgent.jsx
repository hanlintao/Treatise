import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../utils/api';
import { Bot, Search, Loader2, Sparkles, Plus, Globe, CheckCircle, ExternalLink, AlertCircle, Save, Ban, Sliders, Terminal, Edit3 } from 'lucide-react';

import { AgentWorkflowModal } from './AgentWorkflowModal';

export function KnowledgeDiscoveryAgent({ onAddKnowledge, onClose, inline = false }) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [steps, setSteps] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [sources, setSources] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [savingUrl, setSavingUrl] = useState(null); // Track which URL is being saved
  const [showSettings, setShowSettings] = useState(false); // Toggle settings panel
  const [lastExecutedQuery, setLastExecutedQuery] = useState(null); // Store actual query returned by backend
  const [isRawMode, setIsRawMode] = useState(false); // If true, send rawQuery: true
  
  // Workflow Modal State
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [workflowState, setWorkflowState] = useState({
     isComplete: false,
     steps: { init: 'pending', search: 'pending', analyze: 'pending', finish: 'pending' },
     logs: { init: '', search: '', analyze: '', finish: '' }
  });

  // Advanced Search Options
  const [searchOptions, setSearchOptions] = useState({
    country: 'CN',
    search_lang: 'zh-hans',
    count: 10,
    freshness: 'py' // past year
  });

  const [apiKeys, setApiKeys] = useState({
    deepseek: localStorage.getItem('deepseek_key') || '',
    brave: localStorage.getItem('brave_key') || '',
    zhipu: localStorage.getItem('zhipu_key') || ''
  });

  const addStep = (text) => setSteps(prev => [...prev, text]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    if (!apiKeys.deepseek || !apiKeys.brave) {
      setError('请先在魔法管理页面配置 DeepSeek 和 Brave Search API Key');
      return;
    }

    setIsSearching(true);
    setSteps([]);
    setCandidates([]);
    setSources([]);
    setError(null);
    setSelectedIds(new Set());

    addStep('正在启动知识发现 Agent...');
    addStep(`正在通过 Brave Search 搜索互联网知识: "${query}"...`);
    
    // Reset workflow state
    setWorkflowState({
       isComplete: false,
       steps: { init: 'running', search: 'pending', analyze: 'pending', finish: 'pending' },
       logs: { init: 'Initializing request...', search: '', analyze: '', finish: '' }
    });
    setShowWorkflow(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          deepseekKey: apiKeys.deepseek,
          braveKey: apiKeys.brave,
          zhipuKey: apiKeys.zhipu,
          options: {
             ...searchOptions,
             rawQuery: isRawMode
          },
          stream: true // Enable streaming mode
        })
      });

      if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalData = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the last incomplete line in buffer
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
                try {
                    const data = JSON.parse(trimmed.substring(6));
                    
                    if (data.type === 'log') {
                        // Update logs based on phase
                        setWorkflowState(prev => {
                             const phase = data.phase || 'init';
                             // If phase changes to a new one, mark previous as completed
                             const newSteps = { ...prev.steps };
                             if (phase === 'search' && newSteps.init === 'running') { newSteps.init = 'completed'; newSteps.search = 'running'; }
                             if (phase === 'analyze' && newSteps.search === 'running') { newSteps.search = 'completed'; newSteps.analyze = 'running'; }
                             if (phase === 'finish' && newSteps.analyze === 'running') { newSteps.analyze = 'completed'; newSteps.finish = 'running'; }
                             
                             return {
                                 ...prev,
                                 steps: newSteps,
                                 logs: { 
                                     ...prev.logs, 
                                     [phase]: (prev.logs[phase] || '') + data.message + '\n' 
                                 }
                             };
                        });
                    } else if (data.type === 'result') {
                        finalData = data.data;
                    } else if (data.type === 'error') {
                        throw new Error(data.message);
                    }
                } catch (e) {
                    if (e.message && !e.message.includes('JSON')) {
                        throw e; // Re-throw non-JSON-parse errors (e.g. server errors)
                    }
                    // ignore json parse error for partial lines
                }
            }
        }
      }

      // Finalize
      setWorkflowState(prev => ({
          ...prev,
          isComplete: true,
          steps: { init: 'completed', search: 'completed', analyze: 'completed', finish: 'completed' },
          logs: { ...prev.logs, finish: 'Process completed successfully.' }
      }));

      // No longer auto-closing, letting AgentWorkflowModal handle auto-minimization
      // setTimeout(() => setShowWorkflow(false), 1500);

      const data = finalData;
      if (!data) throw new Error('No data received from agent');
      
      setSources(data.sources || []);
      if(data.executedQuery) {
          setLastExecutedQuery(data.executedQuery);
      }
      addStep(`搜索完成，找到 ${(data.sources || []).length} 个相关网页`);
      addStep('正在调用 DeepSeek 进行知识萃取与关联分析...');
      
      if (data.candidates && data.candidates.length > 0) {
        setCandidates(data.candidates);
        addStep(`✅ 发现 ${data.candidates.length} 个新知识点！`);
        // Default select all
        setSelectedIds(new Set(data.candidates.map(c => c.id)));
      } else {
        addStep('⚠️ 未发现符合要求的新知识点');
      }

    } catch (e) {
      setError(e.message);
      addStep(`❌ 发生错误: ${e.message}`);
      setWorkflowState(prev => ({ ...prev, isComplete: true })); // stop spinning
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    const selectedItems = candidates.filter(c => selectedIds.has(c.id));
    if (selectedItems.length > 0) {
      // Pass both selected items and the sources (to be added to Stop List)
      onAddKnowledge(selectedItems, sources);
    }
  };

  const handleSaveToTransfer = async (source) => {
    if (!source || !source.url) return;
    setSavingUrl(source.url);
    try {
        const res = await fetch(`${API_BASE_URL}/api/transfers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: source.url,
                title: source.title,
                tags: ['AI Discovery', query]
            })
        });
        const data = await res.json();
        if (data.success) {
            alert(`"${source.title}" 已成功保存到知识中转站！`);
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        alert('保存失败: ' + e.message);
    } finally {
        setSavingUrl(null);
    }
  };

  const handleStopUrl = async (source) => {
    if (!source || !source.url) return;
    try {
        let urlToBlock = source.url;
        try {
            // Try to extract hostname to block the whole site
            const urlObj = new URL(source.url);
            urlToBlock = urlObj.hostname; 
        } catch (e) {}

        if(!confirm(`确定要屏蔽来自 "${urlToBlock}" 的内容吗？\n屏蔽后，Agent 将不再推荐该网站的内容。`)) return;

        const res = await fetch(`${API_BASE_URL}/api/config/stop-urls`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: urlToBlock
            })
        });
        const data = await res.json();
        if (data.success) {
            // Remove from UI immediately
            setSources(prev => prev.filter(s => !s.url.includes(urlToBlock)));
        } else {
            throw new Error(data.error);
        }
    } catch (e) {
        alert('屏蔽失败: ' + e.message);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const containerClasses = inline 
    ? "bg-white w-full h-full flex flex-col overflow-hidden"
    : "bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden";

  const wrapperClasses = inline
    ? "h-full w-full"
    : "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4";

  return (
    <>
    <AgentWorkflowModal 
        isOpen={showWorkflow} 
        workflowState={{...workflowState, queryText: query}} 
        onClose={() => setShowWorkflow(false)}
    />
    <div className={wrapperClasses}>
      <div className={containerClasses}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Treatise 知识发现 Agent</h2>
              <p className="text-sm text-slate-500 flex items-center gap-2">
                <Globe className="w-3 h-3" />
                自动搜索全网 · 智能识别关联 · 扩充知识图谱
              </p>
            </div>
          </div>
          {!inline && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <span className="text-2xl leading-none">&times;</span>
            </button>
          )}
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Controls & Logs */}
          <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-6 flex flex-col">
            <div className="mb-6">
              <label className="block text-sm font-bold text-slate-700 mb-2 flex justify-between items-center">
                <span>探索指令</span>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                  title="高级搜索设置"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              </label>
              
              {showSettings && (
                 <div className="mb-3 p-3 bg-slate-100 rounded-lg border border-slate-200 text-xs space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <span className="block text-slate-500 mb-1">地区 (Country)</span>
                            <select 
                                value={searchOptions.country}
                                onChange={e => setSearchOptions({...searchOptions, country: e.target.value})}
                                className="w-full p-1.5 rounded border border-slate-300"
                            >
                                <option value="CN">中国 (CN)</option>
                                <option value="US">美国 (US)</option>
                                <option value="GB">英国 (GB)</option>
                                <option value="ALL">全球 (Any)</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <span className="block text-slate-500 mb-1">语言 (Lang)</span>
                            <select 
                                value={searchOptions.search_lang}
                                onChange={e => setSearchOptions({...searchOptions, search_lang: e.target.value})}
                                className="w-full p-1.5 rounded border border-slate-300"
                            >
                                <option value="zh-hans">简体中文</option>
                                <option value="zh-hant">繁體中文</option>
                                <option value="en">English</option>
                                <option value="jp">日本語</option>
                                <option value="ko">한국어</option>
                                <option value="ALL">不限语言</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <span className="block text-slate-500 mb-1">时效 (Freshness)</span>
                            <select 
                                value={searchOptions.freshness}
                                onChange={e => setSearchOptions({...searchOptions, freshness: e.target.value})}
                                className="w-full p-1.5 rounded border border-slate-300"
                            >
                                <option value="">不限时间</option>
                                <option value="pd">过去一天</option>
                                <option value="pw">过去一周</option>
                                <option value="pm">过去一月</option>
                                <option value="py">过去一年</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <span className="block text-slate-500 mb-1">数量 (Count)</span>
                            <select 
                                value={searchOptions.count}
                                onChange={e => setSearchOptions({...searchOptions, count: parseInt(e.target.value)})}
                                className="w-full p-1.5 rounded border border-slate-300"
                            >
                                <option value="5">5条 (快速)</option>
                                <option value="10">10条 (均衡)</option>
                                <option value="20">20条 (深度)</option>
                            </select>
                        </div>
                    </div>
                    <div className="pt-2 border-t border-slate-200 mt-2">
                         <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={searchOptions.smartExpand}
                                onChange={e => setSearchOptions({...searchOptions, smartExpand: e.target.checked})}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-slate-700 font-medium">✨ 启用 AI 智能联想 (Smart Expand)</span>
                         </label>
                         <p className="text-slate-400 text-[10px] pl-6 mt-1">
                             勾选后，Agent 将自动把您的关键词扩展为多个相关维度并分别搜索，获取更全面的知识，但会消耗更多时间。
                         </p>
                    </div>
                 </div>
              )}

              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="例如：&#10;- 寻找关于 2024 年 LLM 评估的最新指标&#10;- 什么是 Agentic Workflow 在翻译中的应用？&#10;- 查找最新的神经符号机器翻译研究"
                className="w-full h-32 p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || !query.trim()}
                className="mt-4 w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                {isSearching ? 'Agent 正在思考...' : '开始探索'}
              </button>
            </div>
            
            {/* Executed Query Preview */}
            {lastExecutedQuery && (
                <div className="mb-4 bg-slate-900 rounded-lg p-3 border border-slate-700">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                            <Terminal className="w-3 h-3" /> 实际上行指令
                        </span>
                        <button 
                            onClick={() => {
                                setQuery(lastExecutedQuery);
                                setIsRawMode(true);
                                setShowSettings(true); // Show panel so they can see raw mode checkbox if I add it, or just for context
                            }}
                            className="text-[10px] bg-slate-700 text-white px-2 py-0.5 rounded hover:bg-slate-600 flex items-center gap-1"
                        >
                            <Edit3 className="w-3 h-3" /> 修改并执行
                        </button>
                    </div>
                    <code className="block text-xs font-mono text-green-400 break-all bg-black/30 p-2 rounded">
                        {lastExecutedQuery}
                    </code>
                </div>
            )}

            {/* Raw Mode Toggle in Footer of Controls? Or inside settings above? Let's add it near "Search" button if active */}
            {isRawMode && (
                <div className="mb-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200 flex items-center justify-between">
                    <span>⚠️ 专家模式：将完全按输入执行 (不自动优化)</span>
                    <button onClick={() => setIsRawMode(false)} className="underline text-amber-700">重置</button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto bg-white border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-600">
              <div className="text-slate-400 mb-2">// Agent 运行日志</div>
              {steps.map((step, i) => (
                <div key={i} className="mb-2 flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">➜</span>
                  <span>{step}</span>
                </div>
              ))}
              {steps.length === 0 && <span className="text-slate-300">等待指令...</span>}
            </div>
            
            {error && (
               <div className="mt-4 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-200 flex items-start gap-2">
                 <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                 {error}
               </div>
            )}
          </div>

          {/* Right Panel: Results */}
          <div className="flex-1 p-6 overflow-hidden flex flex-col min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                发现的新知识点 ({candidates.length})
              </h3>
              {candidates.length > 0 && (
                <div className="flex gap-3">
                   <button 
                     onClick={() => setSelectedIds(new Set(selectedIds.size === candidates.length ? [] : candidates.map(c => c.id)))}
                     className="text-sm text-slate-500 hover:text-indigo-600"
                   >
                     {selectedIds.size === candidates.length ? '取消全选' : '全选'}
                   </button>
                   <button
                     onClick={handleConfirm}
                     disabled={selectedIds.size === 0}
                     className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
                   >
                     添加所选 ({selectedIds.size})
                   </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {candidates.length === 0 && !isSearching ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Bot className="w-16 h-16 mb-4 opacity-20" />
                  <p>输入指令，让 Agent 为您寻找最新的翻译学知识</p>
                </div>
              ) : (
                candidates.map((item) => (
                  <div 
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer hover:shadow-md ${
                      selectedIds.has(item.id) 
                        ? 'border-indigo-500 bg-indigo-50/30' 
                        : 'border-slate-100 bg-white hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        selectedIds.has(item.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'
                      }`}>
                        {selectedIds.has(item.id) && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-bold text-lg text-slate-800">{item.term}</h4>
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-500 font-mono">
                            {item.time || '未知时间'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-2 leading-relaxed">
                          {item.definition}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-fit">
                          <Bot className="w-3 h-3" />
                          <span>AI 推荐原因: {item.reason}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Sources Footer */}
            {sources.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-500 mb-2">信息来源 ({sources.length}) - 建议保存到中转站进行深度分析</p>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {sources.map((source, idx) => (
                    <div 
                      key={idx}
                      className="flex-shrink-0 w-64 p-3 bg-slate-50 border border-slate-200 rounded text-xs hover:border-indigo-300 hover:bg-white transition-all group flex flex-col justify-between"
                    >
                      <a href={source.url} target="_blank" rel="noreferrer" className="block mb-2">
                        <div className="font-medium truncate text-slate-700 group-hover:text-indigo-600 mb-1" title={source.title}>
                           {source.title}
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Globe className="w-3 h-3" />
                          <span className="truncate">{new URL(source.url).hostname}</span>
                          <ExternalLink className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                        </div>
                      </a>
                      
                      <div className="flex gap-1 mt-1">
                        <button
                            onClick={() => handleSaveToTransfer(source)}
                            disabled={savingUrl === source.url}
                            className="flex-1 py-1.5 flex items-center justify-center gap-1 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
                            title="保存到中转站"
                        >
                            {savingUrl === source.url ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <Save className="w-3 h-3" />
                            )}
                            <span className="text-xs">{savingUrl === source.url ? '保存中' : '保存'}</span>
                        </button>
                        <button
                            onClick={() => handleStopUrl(source)}
                            className="px-2 py-1.5 flex items-center justify-center bg-white border border-slate-300 rounded text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                            title="屏蔽此网站 (加入停用名单)"
                        >
                            <Ban className="w-3 h-3" />
                            <span className="ml-1 text-xs">停用</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
