import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../utils/api';
import { Search as SearchIcon, FileText, BookOpen, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// Debounce utility hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function Search() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsLoading(true);
      fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(debouncedQuery)}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          setResults(data);
          setIsLoading(false);
          setHasSearched(true);
        })
        .catch(err => {
          console.error('Search error:', err);
          setIsLoading(false);
          // Optional: set error state to show in UI
        });
    } else {
      setResults([]);
      setHasSearched(false);
    }
  }, [debouncedQuery]);

  // Function to highlight keywords in snippet
  const HighlightedSnippet = ({ text, highlight }) => {
    if (!highlight) return <span>{text}</span>;
    
    // Simple case-insensitive replacement for display
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span key={i} className="bg-yellow-200 text-slate-900 font-semibold rounded px-0.5">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  return (
    <div className="flex-1 h-full bg-slate-50 flex flex-col overflow-hidden">
      {/* Search Header */}
      <div className="bg-white border-b border-slate-200 p-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-3">
            <SearchIcon className="w-8 h-8 text-blue-600" />
            全局内容检索
          </h1>
          
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索书稿正文、参考文献..."
              className="w-full pl-12 pr-4 py-4 text-lg border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              autoFocus
            />
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
            {isLoading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-blue-500 animate-spin" />
            )}
          </div>
          
          <div className="mt-3 flex gap-4 text-sm text-slate-500">
            <span>支持全文检索</span>
            <span>•</span>
            <span>自动高亮关键词</span>
            <span>•</span>
            <span>上下文预览</span>
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {!hasSearched && query.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <SearchIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">输入关键词开始探索知识库</p>
            </div>
          )}

          {!hasSearched && query.length > 0 && query.length < 2 && (
             <div className="text-center py-20 text-slate-400">
               <p>请输入至少 2 个字符...</p>
             </div>
          )}

          {hasSearched && results.length === 0 && (
            <div className="text-center py-20 text-slate-500">
              <p className="text-lg">未找到与 “<span className="font-bold text-slate-800">{query}</span>” 相关的内容</p>
              <p className="text-sm mt-2">请尝试更换关键词或检查拼写</p>
            </div>
          )}

          {results.map((result, index) => (
            <div key={index} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">
                {result.type === 'chapter' ? (
                  <>
                    <BookOpen className="w-4 h-4 text-blue-500" />
                    <span>书籍章节</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-green-500" />
                    <span>参考文献</span>
                  </>
                )}
                <span>•</span>
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">{result.id}</span>
              </div>
              
              <Link to={result.path} className="block group-hover:text-blue-600 transition-colors">
                <h3 className="text-xl font-bold text-slate-800 mb-3 group-hover:text-blue-600">
                  {result.title}
                </h3>
              </Link>
              
              <div className="text-slate-600 leading-relaxed text-sm font-serif bg-slate-50 p-4 rounded-lg border border-slate-100">
                ...<HighlightedSnippet text={result.snippet} highlight={debouncedQuery} />...
              </div>
              
              <div className="mt-4 flex justify-end">
                <Link 
                  to={result.path}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  阅读全文 <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
          
          {hasSearched && results.length > 0 && (
            <div className="text-center pt-8 text-slate-400 text-sm">
              共找到 {results.length} 条相关结果
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
