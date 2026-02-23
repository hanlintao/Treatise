import React, { useState } from 'react';
import { Wand2, Loader2, CheckCircle, Circle, X, Sparkles, FileText, AlertCircle, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

// Normalize time format to YYYY年
const normalizeTime = (time) => {
  if (!time) return '';
  
  // Extract year from formats like "2000-2010年", "2000~2010年"
  const rangeMatch = time.match(/^(\d{4})[-~](\d{4})年?/);
  if (rangeMatch) return `${rangeMatch[1]}年`;
  
  // Extract year from formats like "1950年代"
  const decadeMatch = time.match(/^(\d{4})年代/);
  if (decadeMatch) return `${decadeMatch[1]}年`;
  
  // Extract year from formats like "1999" (missing 年)
  const yearMatch = time.match(/^(\d{4})$/);
  if (yearMatch) return `${yearMatch[1]}年`;
  
  // Already in correct format "1999年"
  return time;
};

export function AIKnowledgeExtractor({ activeModuleId, onExtract, onClose, existingItems = [], inputText: initialInputText = '' }) {
  const [inputText, setInputText] = useState(initialInputText);
  const [highlightedText, setHighlightedText] = useState('');
  const [priorityTerms, setPriorityTerms] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedItems, setExtractedItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [matchedTerms, setMatchedTerms] = useState([]);

  // Check for duplicates
  const checkDuplicate = (term) => {
    return existingItems.some(item => 
      item.term.toLowerCase() === term.toLowerCase() ||
      item.term.toLowerCase().includes(term.toLowerCase()) ||
      term.toLowerCase().includes(item.term.toLowerCase())
    );
  };

  // Highlight existing terms in input text
  const highlightExistingTerms = (text) => {
    if (!text || existingItems.length === 0) {
      setHighlightedText('');
      setMatchedTerms([]);
      return;
    }

    const matched = [];
    let highlighted = text;
    
    // Find all existing terms in the text
    existingItems.forEach(item => {
      const regex = new RegExp(`(${item.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      if (regex.test(text)) {
        matched.push(item.term);
      }
    });

    setMatchedTerms(matched);
  };

  // Handle text selection in textarea
  const handleTextSelection = (e) => {
    const selection = e.target.value.substring(
      e.target.selectionStart,
      e.target.selectionEnd
    ).trim();
    
    if (selection && selection.length > 0 && selection.length < 50) {
      setSelectedText(selection);
    } else {
      setSelectedText('');
    }
  };

  // Add selected text to priority terms
  const addSelectedToPriority = () => {
    if (!selectedText) return;
    
    const currentTerms = priorityTerms.split(/[,，、]/).map(t => t.trim()).filter(Boolean);
    
    // Check if already exists
    if (!currentTerms.some(t => t.toLowerCase() === selectedText.toLowerCase())) {
      const newTerms = currentTerms.length > 0 
        ? `${priorityTerms}, ${selectedText}` 
        : selectedText;
      setPriorityTerms(newTerms);
    }
    
    setSelectedText('');
  };

  const handleExtract = async () => {
    if (!inputText.trim()) {
      setError('请输入要提取的文本');
      return;
    }

    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      setError('未配置 DeepSeek API Key。请在魔法管理页面配置。');
      return;
    }

    setIsExtracting(true);
    setError(null);

    try {
      console.log('📤 Sending extraction request...');
      console.log('🎯 Priority terms:', priorityTerms.trim() ? priorityTerms.split(/[,，、]/).map(t => t.trim()).filter(Boolean) : []);
      // Highlight existing terms before sending
      highlightExistingTerms(inputText);
      
      const existingTerms = existingItems.map(item => item.term);
      const priorityTermsList = priorityTerms.trim() ? priorityTerms.split(/[,，、]/).map(t => t.trim()).filter(Boolean) : [];
      
      console.log('📋 Existing terms to exclude:', existingTerms.length);
      
      const res = await fetch(`${API_BASE_URL}/api/magic/extract-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: inputText,
          priorityTerms: priorityTermsList,
          existingTerms: existingTerms,
          apiKey 
        })
      });

      console.log('📥 Response status:', res.status);
      const data = await res.json();
      console.log('📥 Response data:', data);

      // Support both 'items' and 'candidates' field names
      const extractedData = data.items || data.candidates || [];
      
      if (data.success && extractedData.length > 0) {
        // Get priority term list for checking
        const priorityList = priorityTerms.trim() 
          ? priorityTerms.split(/[,，、]/).map(t => t.trim().toLowerCase()).filter(Boolean)
          : [];
        
        // Add IDs and duplicate check
        const itemsWithIds = extractedData.map(item => {
          const isPriority = priorityList.some(pt => 
            item.term.toLowerCase().includes(pt) || pt.includes(item.term.toLowerCase())
          );
          
          return {
            ...item,
            time: normalizeTime(item.time), // Normalize time to YYYY年 format
            id: `k_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            relations: [],
            notes: [],
            images: [],
            videos: [],
            attachments: [],
            importance: item.importance || 3,
            difficulty: item.difficulty || 3,
            isDuplicate: checkDuplicate(item.term),
            isPriority: isPriority
          };
        });

        console.log('✅ Extracted items:', itemsWithIds);
        console.log('⭐ Priority items:', itemsWithIds.filter(i => i.isPriority).map(i => i.term));
        setExtractedItems(itemsWithIds);
        // Select all non-duplicate items by default
        setSelectedIds(new Set(itemsWithIds.filter(item => !item.isDuplicate).map(item => item.id)));
      } else {
        console.error('❌ Extraction failed:', data);
        setError(data.error || '提取失败，未找到知识点。请确保文本包含明确的概念、时间和定义。');
        setExtractedItems([]);
      }
    } catch (e) {
      console.error('❌ Extract failed with exception:', e);
      setError('提取过程出错: ' + e.message);
      setExtractedItems([]);
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleSelection = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    const nonDuplicateItems = extractedItems.filter(item => !item.isDuplicate);
    if (selectedIds.size === nonDuplicateItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(nonDuplicateItems.map(item => item.id)));
    }
  };

  const handleConfirm = () => {
    const selectedItems = extractedItems.filter(item => selectedIds.has(item.id));
    if (selectedItems.length === 0) {
      setError('请至少选择一个知识点');
      return;
    }
    onExtract(selectedItems);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">AI 批量提取知识点</h2>
              <p className="text-sm text-slate-500">粘贴文本，智能识别并批量添加知识点</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Input Section */}
          {extractedItems.length === 0 && (
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  输入文本内容
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    highlightExistingTerms(e.target.value);
                  }}
                  onMouseUp={handleTextSelection}
                  onKeyUp={handleTextSelection}
                  onBlur={() => highlightExistingTerms(inputText)}
                  placeholder="粘贴包含知识点的文本内容，例如论文段落、教材章节、资料摘要等。&#10;&#10;例如：&#10;深度学习（Deep Learning）是机器学习的一个分支，它使用多层神经网络来学习数据的表示。2006年，杰弗里·辛顿（Geoffrey Hinton）等人提出了深度信念网络（DBN），标志着深度学习的复兴。2012年，AlexNet在ImageNet竞赛中取得突破性成果...&#10;&#10;AI 将自动识别文本中的关键知识点、时间、定义等信息。"
                  className="w-full h-48 p-4 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none font-mono text-sm"
                  disabled={isExtracting}
                />
                
                {/* Matched existing terms indicator */}
                {matchedTerms.length > 0 && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-green-700">
                      <span className="font-semibold">检测到 {matchedTerms.length} 个已有知识点：</span>
                      <span className="ml-1">{matchedTerms.slice(0, 5).join('、')}{matchedTerms.length > 5 ? '...' : ''}</span>
                      <span className="block mt-0.5 text-green-600">✓ AI 将自动跳过这些知识点</span>
                    </div>
                  </div>
                )}
                
                {/* Floating button for selected text */}
                {selectedText && (
                  <div className="absolute top-full mt-2 left-0 right-0 flex justify-center z-10">
                    <button
                      onClick={addSelectedToPriority}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
                    >
                      <Sparkles className="w-4 h-4" />
                      添加 "{selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}" 为关键词
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <Sparkles className="w-4 h-4 inline mr-1 text-purple-500" />
                  优先提取关键词（可选）
                </label>
                <input
                  type="text"
                  value={priorityTerms}
                  onChange={(e) => setPriorityTerms(e.target.value)}
                  placeholder="例如：深度学习, AlexNet, Transformer, BERT（用逗号分隔）"
                  className="w-full px-4 py-2.5 border-2 border-purple-200 bg-purple-50/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  disabled={isExtracting}
                />
                <div className="mt-2 text-xs text-slate-500">
                  💡 手动输入或在上方文本框中<span className="font-semibold text-purple-600">选中文字</span>即可快速添加关键词
                </div>
              </div>

              <div className="mt-2 text-xs text-slate-500">
                提示：文本越详细，AI 提取的知识点越准确。建议包含时间、人物、定义等关键信息。
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-medium text-red-800">提取失败</div>
                    <div className="text-sm text-red-600 mt-1">{error}</div>
                  </div>
                </div>
              )}

              {/* Priority keywords indicator */}
              {priorityTerms.trim() && (
                <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span className="font-semibold text-purple-700">
                      已设置 {priorityTerms.split(/[,，、]/).filter(t => t.trim()).length} 个优先关键词
                    </span>
                    <span className="text-purple-600">
                      - AI 将优先提取这些内容
                    </span>
                  </div>
                </div>
              )}

              <button
                onClick={handleExtract}
                disabled={isExtracting || !inputText.trim()}
                className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>AI 正在分析中...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    <span>{priorityTerms.trim() ? '开始提取（优先处理已选关键词）' : '开始提取'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Section */}
          {extractedItems.length > 0 && (
            <div className="space-y-4">
              {/* Stats & Controls */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-slate-700">
                      共提取 <span className="text-purple-600 font-bold">{extractedItems.length}</span> 个知识点
                    </span>
                  </div>
                  {extractedItems.filter(item => item.isPriority).length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-purple-600">
                      <Sparkles className="w-4 h-4" />
                      <span className="font-semibold">{extractedItems.filter(item => item.isPriority).length} 个优先关键词</span>
                    </div>
                  )}
                  <div className="text-sm text-slate-600">
                    已选择 <span className="font-semibold text-purple-600">{selectedIds.size}</span> 个
                  </div>
                  {extractedItems.filter(item => item.isDuplicate).length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-orange-600">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{extractedItems.filter(item => item.isDuplicate).length} 个重复</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={toggleAll}
                  className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  {selectedIds.size === extractedItems.filter(i => !i.isDuplicate).length ? '取消全选' : '全选'}
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {extractedItems.map((item, index) => (
                  <div
                    key={item.id}
                    onClick={() => !item.isDuplicate && toggleSelection(item.id)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      item.isDuplicate 
                        ? 'border-orange-300 bg-orange-50 opacity-60 cursor-not-allowed' 
                        : selectedIds.has(item.id)
                          ? 'border-purple-400 bg-purple-50 shadow-md cursor-pointer'
                          : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <div className="flex-shrink-0 mt-1">
                        {item.isDuplicate ? (
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                        ) : selectedIds.has(item.id) ? (
                          <CheckCircle className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-slate-300" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
                            <h3 className="font-bold text-slate-800 text-lg">{item.term}</h3>
                            {item.isPriority && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded">
                                <Sparkles className="w-3 h-3" />
                                优先
                              </span>
                            )}
                            {item.isDuplicate && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-orange-500 text-white rounded">
                                已存在
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                              {item.time || '待定'}
                            </span>
                            {item.subModule && (
                              <span className="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                                {item.subModule}
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed mb-3">
                          {item.definition}
                        </p>

                        {item.isDuplicate && (
                          <div className="mb-2 p-2 bg-orange-100 rounded text-xs text-orange-800">
                            <AlertTriangle className="w-3 h-3 inline mr-1" />
                            此知识点可能与现有知识点重复，已自动取消选择
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          {item.importance && (
                            <div className="flex items-center gap-1">
                              <span>重要度:</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <div
                                    key={i}
                                    className={`w-3 h-1.5 rounded ${
                                      i <= item.importance ? 'bg-blue-500' : 'bg-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {item.difficulty && (
                            <div className="flex items-center gap-1">
                              <span>难度:</span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <div
                                    key={i}
                                    className={`w-3 h-1.5 rounded ${
                                      i <= item.difficulty ? 'bg-red-500' : 'bg-slate-200'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-600">{error}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex items-center justify-between gap-4">
          {extractedItems.length > 0 ? (
            <>
              <button
                onClick={() => {
                  setExtractedItems([]);
                  setSelectedIds(new Set());
                  setError(null);
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium"
              >
                重新提取
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={selectedIds.size === 0}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all"
                >
                  确认添加 {selectedIds.size > 0 && `(${selectedIds.size})`}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-medium"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
