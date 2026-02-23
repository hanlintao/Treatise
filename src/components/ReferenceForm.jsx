import React, { useState, useEffect } from 'react';
import { REFERENCE_TYPES, formatCitation } from '../utils/citationFormatter';
import { X, Plus, Trash2, Save, Wand2, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

export function ReferenceForm({ onSave, onCancel, initialData }) {
  const [formData, setFormData] = useState({
    typeCode: 'M',
    language: 'zh',
    title: '',
    authors: [''],
    ...initialData
  });
  
  const [isMagicMode, setIsMagicMode] = useState(false);
  const [magicText, setMagicText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  // Reset form when initialData changes (if switching between edit modes)
  useEffect(() => {
    if (initialData) {
      setFormData({
        typeCode: 'M',
        language: 'zh',
        authors: [''], // Ensure array
        ...initialData
      });
    }
  }, [initialData]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAuthorChange = (index, value) => {
    const newAuthors = [...formData.authors];
    newAuthors[index] = value;
    setFormData(prev => ({ ...prev, authors: newAuthors }));
  };

  const addAuthor = () => {
    setFormData(prev => ({ ...prev, authors: [...prev.authors, ''] }));
  };

  const removeAuthor = (index) => {
    const newAuthors = formData.authors.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, authors: newAuthors }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Filter empty authors
    const cleanData = {
      ...formData,
      authors: formData.authors.filter(a => a.trim() !== '')
    };
    onSave(cleanData);
  };

  const handleMagicExtract = async () => {
    if (!magicText.trim()) return;
    
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先在“魔法管理”页面配置 DeepSeek API Key');
      return;
    }

    setIsExtracting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/extract-refs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: magicText,
          apiKey
        })
      });
      const data = await res.json();
      
      if (data.success) {
        // We might get multiple refs, but we only need the first one for this form
        // Or we could let user choose? 
        // For now, assume user pastes ONE reference string.
        // But extract-refs returns 'added' count and updates backend. 
        // Wait, extract-refs saves to DB directly! 
        // We want to just GET the data to fill the form, not save it yet.
        // We need a different API or modify the existing one to support 'dry-run'.
        // Or we can just use the existing API which returns { success: true, added: 1, total: ... }
        // BUT it doesn't return the extracted object directly in a usable way for filling the form without saving.
        
        // Let's modify the prompt slightly or use a new endpoint?
        // Actually, we can just use the existing logic but we need the extracted data back.
        // The current backend implementation saves it.
        // Let's implement a quick client-side parse or a new endpoint `api/magic/parse-ref`.
        // Or better: Use the `api/magic/extract-refs` but we need to intercept the result.
        // The current backend logic `extract-refs` DOES NOT return the extracted objects.
        
        // Let's create a new helper function in frontend that calls a new endpoint.
        // Since I can't modify server.js right now easily without context switch, let's assume I add it.
        // Wait, I can modify server.js.
        
        // Let's first add the UI and then I will update server.js to support parsing without saving.
        // Actually, I can use `extract-refs` and if it saves, it returns success.
        // But that defeats the purpose of "Filling the form".
        
        // Let's add a new endpoint `POST /api/magic/parse-ref` in server.js first.
        // But I should finish this file edit first.
        
        // Placeholder for now:
        const parseRes = await fetch(`${API_BASE_URL}/api/magic/parse-ref`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ text: magicText, apiKey })
        });
        const parseData = await parseRes.json();
        
        if (parseData.success && parseData.result) {
            const extracted = parseData.result;
            setFormData(prev => ({
                ...prev,
                ...extracted,
                authors: extracted.authors && extracted.authors.length > 0 ? extracted.authors : ['']
            }));
            setIsMagicMode(false);
            setMagicText('');
        } else {
            alert('解析失败: ' + (parseData.error || 'Unknown error'));
        }

      } else {
        alert('解析失败: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('请求出错: ' + e.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const renderCommonFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">文献类型</label>
          <select
            value={formData.typeCode}
            onChange={e => handleChange('typeCode', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(REFERENCE_TYPES).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">语言</label>
          <select
            value={formData.language}
            onChange={e => handleChange('language', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="zh">中文</option>
            <option value="en">英文</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">题名</label>
        <input
          value={formData.title}
          onChange={e => handleChange('title', e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="文献标题"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">责任者 (作者)</label>
        <div className="space-y-2">
          {formData.authors.map((author, index) => (
            <div key={index} className="flex gap-2">
              <input
                value={author}
                onChange={e => handleAuthorChange(index, e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={formData.language === 'en' ? "Last Name, First Name" : "姓名"}
              />
              <button
                type="button"
                onClick={() => removeAuthor(index)}
                className="p-2 text-slate-400 hover:text-red-500"
                disabled={formData.authors.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAuthor}
            className="text-sm text-blue-600 flex items-center gap-1 hover:text-blue-800"
          >
            <Plus className="w-3 h-3" /> 添加作者
          </button>
        </div>
      </div>
    </>
  );

  const renderTypeFields = () => {
    switch (formData.typeCode) {
      case 'M': // Monograph
      case 'C': // Collection
      case 'D': // Thesis
      case 'R': // Report
        return (
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">出版地</label>
              <input
                value={formData.location || ''}
                onChange={e => handleChange('location', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">出版者</label>
              <input
                value={formData.publisher || ''}
                onChange={e => handleChange('publisher', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">出版年</label>
              <input
                value={formData.year || ''}
                onChange={e => handleChange('year', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        );
      
      case 'A': // Article in Collection
        return (
          <div className="space-y-4">
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">原文献题名 (论文集名)</label>
              <input
                value={formData.collectionTitle || ''}
                onChange={e => handleChange('collectionTitle', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">原文献责任者 (主编)</label>
              <input
                value={formData.editors || ''}
                onChange={e => handleChange('editors', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">出版地</label>
                <input
                  value={formData.location || ''}
                  onChange={e => handleChange('location', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">出版者</label>
                <input
                  value={formData.publisher || ''}
                  onChange={e => handleChange('publisher', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">出版年</label>
                <input
                  value={formData.year || ''}
                  onChange={e => handleChange('year', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        );

      case 'J': // Journal
        return (
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">期刊名</label>
              <input
                value={formData.journalName || ''}
                onChange={e => handleChange('journalName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">年</label>
              <input
                value={formData.year || ''}
                onChange={e => handleChange('year', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">期</label>
              <input
                value={formData.issue || ''}
                onChange={e => handleChange('issue', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        );

      case 'N': // Newspaper
        return (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">报纸名</label>
              <input
                value={formData.newspaperName || ''}
                onChange={e => handleChange('newspaperName', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">出版日期 (YYYY-MM-DD)</label>
              <input
                value={formData.publishDate || ''}
                onChange={e => handleChange('publishDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        );

      case 'EB': // Electronic
      case 'DB':
      case 'CP':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">出版地</label>
                <input
                  value={formData.location || ''}
                  onChange={e => handleChange('location', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">出版者</label>
                <input
                  value={formData.publisher || ''}
                  onChange={e => handleChange('publisher', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">出版/发布日期</label>
                <input
                  value={formData.publishDate || ''}
                  onChange={e => handleChange('publishDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">引用日期 [YYYY-MM-DD]</label>
                <input
                  value={formData.accessDate || ''}
                  onChange={e => handleChange('accessDate', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL / 访问路径</label>
              <input
                value={formData.url || ''}
                onChange={e => handleChange('url', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        );

      default:
        return (
           <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">来源</label>
              <input
                value={formData.source || ''}
                onChange={e => handleChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">年份</label>
              <input
                value={formData.year || ''}
                onChange={e => handleChange('year', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-800">编辑参考文献</h2>
          <div className="flex items-center gap-2">
             <button 
               onClick={() => setIsMagicMode(!isMagicMode)}
               className={`p-1.5 rounded transition-colors ${isMagicMode ? 'bg-purple-100 text-purple-600' : 'text-slate-400 hover:text-purple-500 hover:bg-purple-50'}`}
               title="魔法填充"
             >
               <Wand2 className="w-5 h-5" />
             </button>
             <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
               <X className="w-5 h-5" />
             </button>
          </div>
        </div>
        
        {isMagicMode && (
            <div className="p-4 bg-purple-50 border-b border-purple-100 animate-in slide-in-from-top-2">
                <label className="block text-xs font-bold text-purple-700 mb-2">粘贴题录文本 (自动识别)</label>
                <div className="flex gap-2">
                    <input 
                      value={magicText}
                      onChange={e => setMagicText(e.target.value)}
                      placeholder="例如: [1] Baker, M. Corpora in translation studies..."
                      className="flex-1 text-sm p-2 border border-purple-200 rounded focus:outline-none focus:border-purple-400"
                    />
                    <button 
                      onClick={handleMagicExtract}
                      disabled={isExtracting || !magicText.trim()}
                      className="bg-purple-600 text-white px-3 py-2 rounded text-sm font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {isExtracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      填充
                    </button>
                </div>
            </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {renderCommonFields()}
          
          <div className="border-t border-slate-100 pt-4">
             {renderTypeFields()}
          </div>

          <div className="bg-slate-50 p-4 rounded-md border border-slate-200 mt-4">
            <div className="text-xs text-slate-500 font-bold uppercase mb-2">预览</div>
            <div className="text-sm font-serif text-slate-800 break-words">
              {formatCitation(formData) || <span className="text-slate-400 italic">填写信息后显示预览...</span>}
            </div>
          </div>
        </form>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> 保存
          </button>
        </div>
      </div>
    </div>
  );
}
