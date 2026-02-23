import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Loader2, Search, Brain, Database, Minimize2, X, Cpu, Globe, Bot, Clock, Zap, Maximize2 } from 'lucide-react';

// --- Horizontal Mind-Map Node ---
const MindMapNode = ({ status, title, description, color, children }) => {
  const isActive = status === 'running';
  const isDone = status === 'completed';
  const isPending = status === 'pending';

  // Use inline styles for dynamic color to avoid Tailwind purge issues
  const colorMap = {
    teal:   { bg: '#f0fdfa', border: '#14b8a6', text: '#0f766e', headerBg: '#14b8a6', dot: '#2dd4bf' },
    blue:   { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', headerBg: '#3b82f6', dot: '#60a5fa' },
    amber:  { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', headerBg: '#f59e0b', dot: '#fbbf24' },
    green:  { bg: '#f0fdf4', border: '#22c55e', text: '#15803d', headerBg: '#22c55e', dot: '#4ade80' },
    purple: { bg: '#faf5ff', border: '#a855f7', text: '#7e22ce', headerBg: '#a855f7', dot: '#c084fc' },
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <div className="flex items-center gap-0 shrink-0">
      {/* Node Card */}
      <div 
        className={`relative rounded-xl border-2 transition-all duration-500 w-48 shadow-sm ${isActive ? 'scale-105 shadow-lg' : ''} ${isPending ? 'opacity-40 grayscale' : ''}`}
        style={{ 
          borderColor: isPending ? '#cbd5e1' : c.border, 
          backgroundColor: isPending ? '#f8fafc' : c.bg,
        }}
      >
        {/* Active glow ring */}
        {isActive && (
          <div className="absolute -inset-1.5 rounded-xl animate-pulse opacity-30" style={{ border: `2px solid ${c.border}` }} />
        )}

        {/* Header bar */}
        <div 
          className="flex items-center gap-2 px-3 py-2 rounded-t-[10px] text-white text-xs font-bold"
          style={{ backgroundColor: isPending ? '#94a3b8' : c.headerBg }}
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-white/80 inline-block" />
          <span>{title}</span>
          {isDone && <CheckCircle className="w-3.5 h-3.5 ml-auto text-white/90" />}
          {isActive && <Loader2 className="w-3.5 h-3.5 ml-auto animate-spin text-white/90" />}
        </div>

        {/* Body */}
        <div className="px-3 py-2.5 text-xs leading-relaxed min-h-[40px]" style={{ color: isPending ? '#94a3b8' : c.text }}>
          {description || (isPending ? '等待中...' : '处理中...')}
        </div>

        {/* Active progress bar */}
        {isActive && (
          <div className="mx-3 mb-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: `${c.border}20` }}>
            <div className="h-full rounded-full animate-progress" style={{ backgroundColor: c.border, width: '70%' }} />
          </div>
        )}
      </div>

      {/* Right connector arrow (dashed line) — flush to node edges */}
      {children && (
        <div className="flex items-center justify-center relative" style={{ marginLeft: '-1px', marginRight: '-1px' }}>
          <svg width="52" height="8" viewBox="0 0 52 8" className="overflow-visible">
            <path
              d="M 0 4 L 52 4"
              stroke={isPending ? '#cbd5e1' : c.border}
              strokeWidth="2"
              strokeDasharray="4 3"
              fill="none"
              strokeLinecap="round"
            />
            {/* Arrow tip */}
            <path
              d="M 46 1 L 52 4 L 46 7"
              stroke={isPending ? '#cbd5e1' : c.border}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

// --- Branch connector from main node to sub-nodes ---
const BranchConnector = ({ label, color, isPending }) => {
  const colorMap = {
    teal: '#14b8a6', blue: '#3b82f6', amber: '#f59e0b', green: '#22c55e', purple: '#a855f7'
  };
  const lineColor = isPending ? '#cbd5e1' : (colorMap[color] || '#14b8a6');

  return (
    <div className="flex items-center shrink-0" style={{ marginLeft: '-1px', marginRight: '-1px' }}>
      <div className="flex flex-col items-center relative" style={{ width: '72px' }}>
        <span className="text-[10px] font-medium whitespace-nowrap absolute -top-4 w-full text-center" style={{ color: lineColor }}>{label}</span>
        {/* Connector line with integrated arrowhead — touches node edges */}
        <svg width="72" height="12" viewBox="0 0 72 12" className="overflow-visible">
          <path
            d="M 0 6 L 72 6"
            stroke={lineColor}
            strokeWidth="2"
            strokeDasharray="4 3"
            fill="none"
            strokeLinecap="round"
          />
          {/* Arrowhead */}
          <path
            d="M 65 2.5 L 72 6 L 65 9.5"
            stroke={lineColor}
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};

export const AgentWorkflowModal = ({ isOpen, onClose, workflowState, onMinimize, onRestore }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef(null);
  const timerRef = useRef(null);

  // Timer
  useEffect(() => {
    if (isOpen && !workflowState.isComplete) {
      timerRef.current = setInterval(() => setElapsed(prev => prev + 0.1), 100);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isOpen, workflowState.isComplete]);

  useEffect(() => {
    if (isOpen) setElapsed(0);
  }, [isOpen]);

  // Auto scroll console
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [workflowState]);

  const handleMinimize = () => {
    setIsMinimized(true);
    if (onMinimize) onMinimize();
  };

  const handleRestore = () => {
    setIsMinimized(false);
    if (onRestore) onRestore();
  };

  // Auto minimize when complete
  useEffect(() => {
    if (workflowState.isComplete && isOpen && !isMinimized) {
      const timer = setTimeout(() => {
        handleMinimize();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [workflowState.isComplete, isOpen, isMinimized]);

  if (!isOpen) return null;

  // If minimized, show small widget in bottom-right corner
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] w-80 bg-white rounded-xl shadow-2xl overflow-hidden border-2 border-teal-500 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 text-white">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <div>
              <div className="text-sm font-bold">知识发现 Agent</div>
              <div className="text-xs opacity-90">
                {workflowState.isComplete ? '✓ 任务完成' : '正在思考中...'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestore}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
              title="还原"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-4 bg-slate-50 max-h-32 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3 h-3 text-slate-500" />
            <span className="text-xs font-mono text-slate-600">{elapsed.toFixed(1)}s</span>
            {!workflowState.isComplete && (
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse ml-auto" />
            )}
          </div>
          <div className="text-xs text-slate-600 font-mono leading-relaxed">
            {workflowState.steps.finish === 'completed'
              ? '✓ 所有步骤已完成'
              : workflowState.steps.analyze !== 'pending'
              ? '⏳ 正在分析知识点...'
              : workflowState.steps.search !== 'pending'
              ? '⏳ 正在搜索全网...'
              : '⏳ 正在分析查询...'}
          </div>
        </div>
      </div>
    );
  }

  // Summarize node descriptions from logs
  const getNodeDesc = (phase) => {
    const log = workflowState.logs[phase] || '';
    if (!log) return null;
    // Take last meaningful line
    const lines = log.trim().split('\n').filter(l => l.trim());
    return lines.length > 0 ? lines[lines.length - 1] : null;
  };

  // Combine all logs for console
  const allLogs = ['init', 'search', 'analyze', 'finish']
    .map(phase => {
      const log = workflowState.logs[phase];
      if (!log) return '';
      return log.split('\n').filter(l => l.trim()).map(l => `> MetaAI.${phase.charAt(0).toUpperCase() + phase.slice(1)}("${l.trim()}")`).join('\n');
    })
    .filter(Boolean)
    .join('\n');

  // Stats
  const logLineCount = allLogs.split('\n').filter(l => l.trim()).length;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-all duration-500">
      <div className="bg-white w-full max-w-[90vw] h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-500 transform scale-100 opacity-100">
        
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 tracking-tight">知识发现 Agent 思维链</h2>
              <p className="text-[10px] font-mono text-teal-500 uppercase tracking-wider">Autonomous Knowledge Discovery Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <div className={`w-2 h-2 rounded-full ${workflowState.isComplete ? 'bg-green-500' : 'bg-teal-500 animate-ping'}`} />
              <span className={workflowState.isComplete ? 'text-green-600' : 'text-teal-600'}>
                {workflowState.isComplete ? '任务完成' : '正在思考中...'}
              </span>
              {!workflowState.isComplete && (
                <button onClick={onClose} className="ml-2 text-[10px] px-2 py-0.5 border border-slate-300 rounded text-slate-500 hover:bg-red-50 hover:text-red-500 hover:border-red-300 transition-colors">
                  停止
                </button>
              )}
            </div>
            <button onClick={handleMinimize} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-teal-600" title="最小化">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-red-500">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Content: Horizontal Mind-Map */}
        <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 via-white to-teal-50/30 relative">
          
          {/* Stats Panel (top-left) */}
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-3 text-xs font-mono shadow-sm">
            <div className="flex flex-col gap-1.5">
              <div><span className="text-slate-400 uppercase text-[10px]">状态</span><br/><span className="font-bold text-slate-700">{logLineCount} steps</span></div>
              <div><span className="text-slate-400 uppercase text-[10px]">耗时</span><br/><span className="font-bold text-slate-700">{elapsed.toFixed(1)} sec</span></div>
              <div><span className="text-slate-400 uppercase text-[10px]">阶段</span><br/><span className="font-bold text-teal-600">
                {workflowState.steps.finish === 'completed' ? '4/4' : workflowState.steps.analyze !== 'pending' ? '3/4' : workflowState.steps.search !== 'pending' ? '2/4' : '1/4'}
              </span></div>
            </div>
          </div>

          {/* Mind Map Area */}
          <div className="min-w-max p-8 pt-10 flex items-center gap-0 overflow-x-auto" style={{ minHeight: '320px', paddingLeft: '140px', paddingBottom: '240px' }}>
            
            {/* === ROOT Node: The Query === */}
            <div className="flex items-center gap-0 shrink-0">
              <div className="relative w-56 rounded-xl border-2 border-teal-400 bg-white shadow-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">🔍</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">📡</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500 text-white">🧠</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {workflowState.queryText || '正在分析查询意图，扩展搜索维度，通过多源信息交叉验证提取知识候选...'}
                </p>
              </div>
            </div>

            {/* === Pipeline Chain === */}
            <div className="flex items-center gap-0 shrink-0">
              
              {/* Stage 1: DeepSeek 查询扩展 */}
              <BranchConnector label="查询扩展" color="purple" isPending={workflowState.steps.init === 'pending'} />
              <MindMapNode 
                status={workflowState.steps.init} 
                title="DeepSeek 扩展" 
                description={getNodeDesc('init') || '分析查询意图并生成多维度搜索词'}
                color="purple"
              />
              
              {workflowState.steps.init === 'completed' && (
                <>
                  {/* Stage 2: 全网搜索 + search log below */}
                  <BranchConnector label="并行搜索" color="blue" isPending={workflowState.steps.search === 'pending'} />
                  <div className="relative shrink-0">
                    <MindMapNode 
                      status={workflowState.steps.search} 
                      title="全网搜索" 
                      description={getNodeDesc('search') || '执行并发搜索任务'}
                      color="blue"
                    />
                    {/* Vertical sub-branch: search log */}
                    {workflowState.steps.search !== 'pending' && (
                      <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ top: '100%', width: '288px' }}>
                        <svg width="8" height="32" viewBox="0 0 8 32">
                          <path d="M 4 0 L 4 32" stroke="#14b8a6" strokeWidth="2" strokeDasharray="4 3" fill="none" strokeLinecap="round" />
                          <path d="M 1 26 L 4 32 L 7 26" stroke="#14b8a6" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="w-72 rounded-xl border-2 border-teal-300 bg-teal-50/50 p-3 shadow-sm">
                          <div className="flex items-center gap-2 text-teal-700 text-xs font-bold mb-2">
                            <Globe className="w-3.5 h-3.5" />
                            <span>搜索执行日志</span>
                          </div>
                          <div className="text-[11px] text-teal-600/80 font-mono leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                            {workflowState.logs.search || '等待搜索...'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {workflowState.steps.search === 'completed' && (
                    <>
                      {/* Stage 3: DeepSeek 分析 + analysis log below */}
                      <BranchConnector label="知识萃取" color="amber" isPending={workflowState.steps.analyze === 'pending'} />
                      <div className="relative shrink-0">
                        <MindMapNode 
                          status={workflowState.steps.analyze} 
                          title="DeepSeek 分析" 
                          description={getNodeDesc('analyze') || '大模型知识点提取与筛选'}
                          color="amber"
                        />
                        {/* Vertical sub-branch: analysis log */}
                        {workflowState.steps.analyze !== 'pending' && (
                          <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ top: '100%', width: '288px' }}>
                            <svg width="8" height="32" viewBox="0 0 8 32">
                              <path d="M 4 0 L 4 32" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" fill="none" strokeLinecap="round" />
                              <path d="M 1 26 L 4 32 L 7 26" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <div className="w-72 rounded-xl border-2 border-amber-300 bg-amber-50/50 p-3 shadow-sm">
                              <div className="flex items-center gap-2 text-amber-700 text-xs font-bold mb-2">
                                <Cpu className="w-3.5 h-3.5" />
                                <span>LLM 分析日志</span>
                              </div>
                              <div className="text-[11px] text-amber-600/80 font-mono leading-relaxed max-h-24 overflow-y-auto whitespace-pre-wrap">
                                {workflowState.logs.analyze || '等待分析...'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {workflowState.steps.analyze === 'completed' && (
                        <>
                          {/* Stage 4: 知识合成 */}
                          <BranchConnector label="结果整合" color="green" isPending={workflowState.steps.finish === 'pending'} />
                          <MindMapNode 
                            status={workflowState.steps.finish} 
                            title="知识合成" 
                            description={getNodeDesc('finish') || '整合并输出候选知识点'}
                            color="green"
                          />
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Console Panel (Bottom) */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-900 text-green-400 max-h-[25vh]">
          <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-700 bg-slate-800">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Console</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {elapsed.toFixed(1)}s
              </span>
              <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                <Zap className="w-3 h-3" /> {logLineCount} logs
              </span>
            </div>
          </div>
          <div ref={scrollRef} className="px-4 py-2 overflow-y-auto max-h-[20vh] font-mono text-[11px] leading-relaxed">
            {allLogs ? (
              allLogs.split('\n').map((line, i) => (
                <div key={i} className="text-green-400/80 hover:text-green-300 transition-colors">
                  {line}
                </div>
              ))
            ) : (
              <div className="text-slate-500">{'> MetaAI.Thinking()'}</div>
            )}
            {!workflowState.isComplete && (
              <div className="text-teal-400 animate-pulse mt-1">{'> MetaAI.Thinking()'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
