import React, { useState } from 'react';
import { Wand2, Plus, Trash2, Settings, Play, Database, FileText, Globe } from 'lucide-react';
import { KnowledgeDiscoveryAgent } from './KnowledgeDiscoveryAgent';
import { API_BASE_URL } from '../utils/api';
import toast from 'react-hot-toast';

export function MagicManager() {
  const [showDiscoveryAgent, setShowDiscoveryAgent] = useState(false);
  const [magicButtons, setMagicButtons] = useState([
    {
      id: 'extract-refs',
      name: '智能提取参考文献',
      description: '从论文末尾自动识别并提取参考文献，格式化后存入题录库',
      type: 'extraction',
      model: 'deepseek-chat',
      prompt: '请提取以下文本中的参考文献，并按 JSON 格式返回，包含字段：title, author, year, source, type (M/J/C等)。',
      target: 'references'
    }
  ]);

  const [apiKeys, setApiKeys] = useState({
    deepseek: localStorage.getItem('deepseek_key') || '',
    volc_appid: localStorage.getItem('volc_appid') || '',
    volc_access_token: localStorage.getItem('volc_access_token') || '',
    zhipu: localStorage.getItem('zhipu_key') || '',
    brave: localStorage.getItem('brave_key') || '',
    baidu: ''
  });

  const [config, setConfig] = useState({
    logoTitle: '',
    paddleApiUrl: '',
    paddleToken: '',
    jinaApiKey: '',
    zhipuApiKey: ''
  });
  
  // Ref to track if the update comes from user input (dirty) to avoid auto-saving on initial load
  const isDirtyRef = React.useRef(false);

  React.useEffect(() => {
    fetch(`${API_BASE_URL}/api/config`)
      .then(r => r.json())
      .then(data => {
        if (data) {
             let newConfig = { ...data };
             let configChanged = false;

             // 1. Sync Backend -> Frontend (Privacy: backend wins if set, assuming it's secure source)
             // Actually, usually local key is user's private key.
             // If backend has zhipu, sync to local
             if (data.zhipuApiKey) {
                 setApiKeys(prev => ({ ...prev, zhipu: data.zhipuApiKey }));
                 localStorage.setItem('zhipu_key', data.zhipuApiKey);
             }
             if (data.deepseekApiKey) {
                 setApiKeys(prev => ({ ...prev, deepseek: data.deepseekApiKey }));
                 localStorage.setItem('deepseek_key', data.deepseekApiKey);
             }

             // 2. Sync Frontend (Local) -> Backend (if backend missing)
             const localDeepseek = localStorage.getItem('deepseek_key');
             if (localDeepseek && !data.deepseekApiKey) {
                 newConfig.deepseekApiKey = localDeepseek;
                 configChanged = true;
             }
             
             const localZhipu = localStorage.getItem('zhipu_key');
             if (localZhipu && !data.zhipuApiKey) {
                 newConfig.zhipuApiKey = localZhipu;
                 configChanged = true;
             }

             setConfig(prev => ({ ...prev, ...newConfig }));
             
             // If we found local keys that were missing in backend, trigger a save immediately
             if (configChanged) {
                 fetch(`${API_BASE_URL}/api/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newConfig)
                  }).then(() => console.log('Synced local keys to backend'));
             }
        }
      })
      .catch(console.error);
  }, []);

  // Debounced Auto-save
  React.useEffect(() => {
      if (!isDirtyRef.current) return;

      const timer = setTimeout(() => {
          fetch(`${API_BASE_URL}/api/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
          }).then(() => {
             console.log('Config saved:', config);
             toast.success('配置已自动保存');
             window.dispatchEvent(new CustomEvent('config-updated', { detail: config }));
          }).catch(e => {
            console.error('Failed to save config', e);
            toast.error('配置保存失败');
          });
      }, 800); // 800ms debounce

      return () => clearTimeout(timer);
  }, [config]);

  const handleConfigChange = (key, value) => {
    isDirtyRef.current = true;
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const saveKey = (provider, value) => {
    setApiKeys(prev => ({ ...prev, [provider]: value }));
    if (provider === 'deepseek') {
      localStorage.setItem('deepseek_key', value);
      handleConfigChange('deepseekApiKey', value); // Sync to backend
    } else if (provider.startsWith('volc_')) {
      localStorage.setItem(provider, value);
    } else if (provider === 'zhipu') {
      localStorage.setItem('zhipu_key', value);
      // Also sync to backend config for vectorization
      handleConfigChange('zhipuApiKey', value);
    } else if (provider === 'brave') {
      localStorage.setItem('brave_key', value);
    }
  };

  const handleAddMagic = () => {
    const name = prompt("请输入魔法名称：", "自定义魔法");
    if (!name) return;
    const description = prompt("请输入描述：", "自动执行的任务");
    const promptText = prompt("请输入 Prompt 提示词：", "你是一个助手...");
    
    if (name && promptText) {
        const newMagic = {
            id: `magic-${Date.now()}`,
            name,
            description: description || '',
            type: 'custom',
            model: 'deepseek-chat',
            prompt: promptText,
            target: 'custom'
        };
        setMagicButtons([...magicButtons, newMagic]);
    }
  };

  const handleDeleteMagic = (id) => {
    if (confirm("确定删除这个魔法吗？")) {
        setMagicButtons(magicButtons.filter(btn => btn.id !== id));
    }
  };

  const handleRunMagic = async (btn) => {
    if (btn.id === 'extract-refs') {
      if (!apiKeys.deepseek) {
        alert('请先配置 DeepSeek API Key');
        return;
      }
      // Assuming we are extracting from the current chapter content? 
      // Or allowing user to input text? 
      // For this demo, let's ask user to paste text or we fetch from backend "current chapter"?
      // The requirement says "extract from paper markdown". 
      // Let's prompt user for text input in a modal for now, or use a "Test Text" approach.
      // Better: In the Reader page, we can have a button "Extract from this chapter".
      // But here is the Manager. Let's provide a "Test Run" with text input.
      
      const text = prompt("请输入包含参考文献的文本 (最后2000字):");
      if (!text) return;
      
      const toastId = toast.loading('正在提取参考文献...');
      try {
        const res = await fetch(`${API_BASE_URL}/api/magic/extract-refs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            apiKey: apiKeys.deepseek
          })
        });
        const data = await res.json();
        if (data.success) {
          toast.success(`提取成功！新增 ${data.added} 条参考文献。`, { id: toastId });
        } else {
          toast.error('提取失败: ' + (data.error || 'Unknown error'), { id: toastId });
        }
      } catch (e) {
        toast.error('请求出错: ' + e.message, { id: toastId });
      }
    }
  };

  const handleBatchSave = async (items) => {
    const toastId = toast.loading('正在保存知识点...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/knowledge/batch-add`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ items })
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      toast.success(`成功保存 ${data.count} 个新知识点到 "${data.moduleName}" 模块！`, { id: toastId });
      setShowDiscoveryAgent(false);
    } catch (e) {
      toast.error(e.message, { id: toastId });
    }
  };

  return (
    <div className="flex-1 h-full bg-slate-50 flex flex-col overflow-hidden">
      <div className="bg-white border-b border-slate-200 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-3">
            <Wand2 className="w-8 h-8 text-purple-600" />
            魔法按钮管理
          </h1>
          <p className="text-slate-500">
            自定义基于 AI 的自动化任务，让繁琐的工作一键完成。
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* API Configuration */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-400" />
              系统与 API 配置
            </h2>
            <div className="grid gap-6">
              {/* System Config */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-3">系统设置</h3>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">系统 Logo 标题</label>
                    <input 
                      type="text"
                      value={config.logoTitle}
                      onChange={(e) => handleConfigChange('logoTitle', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                      placeholder="Treatise"
                    />
                    <p className="text-xs text-slate-500 mt-1">修改左上角显示的系统名称</p>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">DeepSeek API Key</label>
                <input 
                  type="password"
                  value={apiKeys.deepseek}
                  onChange={(e) => saveKey('deepseek', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                  placeholder="sk-..."
                />
                <p className="text-xs text-slate-500 mt-1">用于支持智能提取等核心魔法功能</p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Zhipu API Key (Embedding)</label>
                <input 
                  type="password"
                  value={apiKeys.zhipu || ''}
                  onChange={(e) => saveKey('zhipu', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                  placeholder="智谱AI GLM-4/Embedding Key..."
                />
                <p className="text-xs text-slate-500 mt-1">用于生成3D知识脑图嵌入向量</p>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Brave Search API Key</label>
                <input 
                  type="password"
                  value={apiKeys.brave || ''}
                  onChange={(e) => saveKey('brave', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                  placeholder="BS..."
                />
                <p className="text-xs text-slate-500 mt-1">用于支持 AI 知识发现 Agent (搜索最新网络知识)</p>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Jina API Config</h3>
                <div>
                   <label className="block text-xs font-medium text-slate-500 mb-1">API Key (jina_...)</label>
                   <input 
                      type="password"
                      value={config.jinaApiKey || ''}
                      onChange={(e) => handleConfigChange('jinaApiKey', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                      placeholder="jina_..."
                   />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Baidu Paddle OCR (AI Studio Layout Parsing)</h3>
                <div className="grid gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">API URL</label>
                    <input 
                      type="text"
                      value={config.paddleApiUrl || ''}
                      onChange={(e) => handleConfigChange('paddleApiUrl', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Token</label>
                    <input 
                      type="password"
                      value={config.paddleToken || ''}
                      onChange={(e) => handleConfigChange('paddleToken', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-3">豆包语音合成极速版 (Volcengine)</h3>
                <div className="grid gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">APP ID</label>
                    <input 
                      type="text"
                      value={apiKeys.volc_appid || ''}
                      onChange={(e) => saveKey('volc_appid', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                      placeholder="e.g. 12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Access Token</label>
                    <input 
                      type="password"
                      value={apiKeys.volc_access_token || ''}
                      onChange={(e) => saveKey('volc_access_token', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Magic Buttons List */}
          <section>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Play className="w-5 h-5 text-slate-400" />
                已启用的魔法
              </h2>
              <button 
                onClick={handleAddMagic}
                className="text-sm text-purple-600 font-medium flex items-center gap-1 hover:text-purple-700"
              >
                <Plus className="w-4 h-4" /> 创建新魔法
              </button>
            </div>

            <div className="grid gap-4">
              {/* Agent Card */}
              <div className="bg-gradient-to-r from-indigo-50 to-white rounded-xl border border-indigo-200 shadow-sm p-6 flex items-start gap-4 hover:shadow-md transition-all">
                  <div className="p-3 bg-indigo-600 text-white rounded-lg shadow-lg shadow-indigo-200">
                    <Globe className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-indigo-900">领域知识发现 Agent</h3>
                      <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold">
                        NEW
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 mb-3">
                      自主连接互联网，搜索最新的领域研究成果、工具和理论，并智能过滤、关联现有知识。
                    </p>
                    <button 
                      onClick={() => setShowDiscoveryAgent(true)}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm active:scale-95 transition-transform"
                    >
                      <Play className="w-4 h-4" /> 启动探索
                    </button>
                  </div>
              </div>

              {magicButtons.map(btn => (
                <div key={btn.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-start gap-4 hover:border-purple-300 transition-colors">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-lg">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-slate-800">{btn.name}</h3>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 border border-slate-200">
                          {btn.model}
                        </span>
                        <button 
                          onClick={() => handleRunMagic(btn)}
                          className="text-purple-600 hover:text-purple-800 flex items-center gap-1 text-sm font-medium border border-purple-200 px-2 py-0.5 rounded hover:bg-purple-50"
                        >
                          <Play className="w-3 h-3" /> 测试运行
                        </button>
                        <button 
                          onClick={() => handleDeleteMagic(btn.id)}
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mt-1 mb-3">{btn.description}</p>
                    
                    <div className="bg-slate-50 rounded p-3 text-xs font-mono text-slate-600 border border-slate-100">
                      <span className="font-bold text-slate-400 select-none">PROMPT: </span>
                      {btn.prompt}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
      {showDiscoveryAgent && (
        <KnowledgeDiscoveryAgent 
          onAddKnowledge={handleBatchSave}
          onClose={() => setShowDiscoveryAgent(false)}
        />
      )}
    </div>
  );
}
