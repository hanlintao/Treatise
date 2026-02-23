import React, { useState } from 'react';
import { Wand2, X, Sparkles, PenTool, BookOpen, Loader2, Highlighter, Check } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export function SelectionMenu({ position, onExtract, onHighlight, onClose }) {
  const [aiLoading, setAiLoading] = useState(null); // 'polish' | 'expand' | 'explain'
  const [aiResult, setAiResult] = useState(null); // { mode, text }
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [comment, setComment] = useState('');

  if (!position) return null;

  const handleHighlightSubmit = () => {
      if (onHighlight) {
          onHighlight(comment);
      }
      onClose();
  };

  if (isHighlighting) {
      return (
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border border-yellow-200 animate-in fade-in zoom-in-95 duration-100 flex flex-col w-64"
            style={{
              left: Math.min(window.innerWidth - 280, Math.max(20, position.x - 100)),
              top: position.y + 10,
            }}
          >
            <div className="p-2 bg-yellow-50 border-b border-yellow-100 rounded-t-lg flex justify-between items-center">
              <span className="text-xs font-bold text-yellow-700 flex items-center gap-1">
                <Highlighter className="w-3 h-3" /> 添加高亮与评注
              </span>
              <button onClick={() => setIsHighlighting(false)}><X className="w-3 h-3 text-yellow-500" /></button>
            </div>
            <div className="p-2">
                <textarea 
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="添加评注（可选）..."
                    className="w-full text-xs p-2 border border-slate-200 rounded focus:border-yellow-400 focus:outline-none resize-none h-16 bg-slate-50"
                    autoFocus
                />
            </div>
            <div className="p-2 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={handleHighlightSubmit} className="px-3 py-1.5 text-xs bg-yellow-500 text-white hover:bg-yellow-600 rounded shadow-sm flex items-center gap-1">
                  <Check className="w-3 h-3" /> 确认
              </button>
            </div>
          </div>
      );
  }

  const handleAiAction = async (mode) => {
    setAiLoading(mode);
    setAiResult(null);
    
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先配置 API Key');
      setAiLoading(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: position.text,
          mode: mode,
          apiKey
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiResult({ mode, text: data.result });
      } else {
        alert('AI 请求失败: ' + data.error);
      }
    } catch (e) {
      alert('网络错误');
    } finally {
      setAiLoading(null);
    }
  };

  const copyResult = () => {
    if (aiResult) {
      navigator.clipboard.writeText(aiResult.text);
      onClose();
    }
  };

  if (aiResult) {
    return (
      <div
        className="fixed z-50 bg-white rounded-lg shadow-xl border border-purple-200 animate-in fade-in zoom-in-95 duration-100 flex flex-col w-80"
        style={{
          left: Math.min(window.innerWidth - 340, Math.max(20, position.x - 140)), // Keep within bounds
          top: position.y + 10,
        }}
      >
        <div className="p-3 bg-purple-50 border-b border-purple-100 rounded-t-lg flex justify-between items-center">
          <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> 
            {aiResult.mode === 'polish' ? '润色结果' : aiResult.mode === 'expand' ? '扩写建议' : '解释说明'}
          </span>
          <button onClick={onClose}><X className="w-3 h-3 text-purple-400" /></button>
        </div>
        <div className="p-3 text-sm text-slate-700 max-h-60 overflow-y-auto leading-relaxed">
          {aiResult.text}
        </div>
        <div className="p-2 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={() => setAiResult(null)} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 rounded">返回</button>
          <button onClick={copyResult} className="px-3 py-1.5 text-xs bg-purple-600 text-white hover:bg-purple-700 rounded shadow-sm">复制内容</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-100 p-1 flex items-center gap-1"
      style={{
        left: position.x,
        top: position.y + 10,
      }}
    >
      <button
        onClick={() => setIsHighlighting(true)}
        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        title="高亮"
      >
        <Highlighter className="w-3.5 h-3.5 text-yellow-500" />
        高亮
      </button>

      <div className="w-px h-4 bg-slate-200 mx-1" />

      <button
        onClick={onExtract}
        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        title="提取参考文献"
      >
        <Wand2 className="w-3.5 h-3.5 text-purple-600" />
        提取
      </button>
      
      <div className="w-px h-4 bg-slate-200 mx-1" />
      
      <button
        onClick={() => handleAiAction('polish')}
        disabled={!!aiLoading}
        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
      >
        {aiLoading === 'polish' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenTool className="w-3.5 h-3.5 text-blue-600" />}
        润色
      </button>
      
      <button
        onClick={() => handleAiAction('expand')}
        disabled={!!aiLoading}
        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
      >
        {aiLoading === 'expand' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-orange-500" />}
        扩写
      </button>
      
      <button
        onClick={() => handleAiAction('explain')}
        disabled={!!aiLoading}
        className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
      >
        {aiLoading === 'explain' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5 text-green-600" />}
        解释
      </button>

      <div className="w-px h-4 bg-slate-200 mx-1" />
      
      <button
        onClick={onClose}
        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
