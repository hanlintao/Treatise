import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Bot, User, Trash2, Search, Plus, X, Globe, Library, Loader2, Sparkles, PanelLeftClose
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../utils/api';

export function FastChat({ onClose, embed = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(Date.now().toString());
  const [useWebSearch, setUseWebSearch] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!embed);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadSessions();
    const saved = localStorage.getItem(`fast_chat_${sessionId}`);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
        // Initial greeting
        setMessages([{
            role: 'assistant',
            content: '你好！我是基于当前知识库的快速问答助手。有什么可以帮你的吗？'
        }]);
    }
  }, [sessionId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSessions = () => {
    // Determine existing sessions from localStorage keys
    const keys = Object.keys(localStorage).filter(k => k.startsWith('fast_chat_'));
    const sess = keys.map(k => {
        const id = k.replace('fast_chat_', '');
        const data = JSON.parse(localStorage.getItem(k));
        const lastMsg = data[data.length - 1];
        return {
            id,
            preview: (lastMsg?.content || '新对话').slice(0, 30) + '...',
            timestamp: parseInt(id) || Date.now()
        };
    }).sort((a, b) => b.timestamp - a.timestamp);
    setSessions(sess);
  };

  const saveExample = (msgs) => {
      localStorage.setItem(`fast_chat_${sessionId}`, JSON.stringify(msgs));
      loadSessions();
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);
    saveExample(newMessages);

    try {
        const apiKey = localStorage.getItem('deepseek_key');
        const braveKey = localStorage.getItem('brave_key');
        
        if (!apiKey) {
            const errorMsg = { role: 'assistant', content: '请先在设置中配置 DeepSeek API Key。' };
            setMessages([...newMessages, errorMsg]);
            setIsLoading(false);
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/fast-chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: newMessages,
                useWebSearch,
                apiKey,
                braveKey,
                model: 'deepseek-chat', // or deepseek-reasoner
                sessionId
            })
        });

        if (!response.ok) throw new Error('Network response was not ok');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMsg = { role: 'assistant', content: '' };
        
        setMessages([...newMessages, assistantMsg]);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            // Handle SSE format: data: ...
            // Simplified: Assuming raw text stream for now, but usually it's SSE format if using Vercel AI SDK or similar.
            // If custom backend implements res.write(chunk), it's raw text.
            // Let's assume the backend sends raw text deltas for simplicity, or handle SSE if needed.
            // For now, let's implement backend to send raw text chunks as they arrive.
            
            assistantMsg.content += chunk;
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...assistantMsg };
                return updated;
            });
        }
        
        saveExample([...newMessages, assistantMsg]);

    } catch (error) {
        console.error('Chat error:', error);
        setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，发生了一些错误，请稍后再试。' }]);
    } finally {
        setIsLoading(false);
    }
  };

  const startNewSession = () => {
      const newId = Date.now().toString();
      setSessionId(newId);
      setMessages([{
          role: 'assistant',
          content: '你好！我是基于当前知识库的快速问答助手。有什么可以帮你的吗？'
      }]);
  };

  const clearHistory = () => {
    if (window.confirm('确定要清空所有历史记录吗？')) {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('fast_chat_')) localStorage.removeItem(k);
        });
        startNewSession();
        setSessions([]);
    }
  };

  const containerClass = embed 
    ? "w-full h-full flex flex-row overflow-hidden bg-white" 
    : "fixed inset-0 bg-black/50 z-50 flex justify-end animate-in fade-in duration-200";

  const wrapperClass = embed
    ? "w-full h-full flex flex-row overflow-hidden" 
    : "w-full max-w-4xl h-full bg-white shadow-2xl flex flex-row overflow-hidden animate-in slide-in-from-right duration-300";

  return (
    <div className={containerClass}>
      <div className={wrapperClass}>
        
        {/* Sidebar */}
        <div className={`${isSidebarOpen ? 'w-48' : 'w-0'} bg-slate-50 border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden`}>
            <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-100">
                <span className="font-bold text-xs text-slate-700">历史会话</span>
                <button onClick={startNewSession} className="p-1 hover:bg-slate-200 rounded text-slate-600" title="新建会话">
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {sessions.map(sess => (
                    <button
                        key={sess.id}
                        onClick={() => setSessionId(sess.id)}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs truncate ${
                            sessionId === sess.id ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
                        }`}
                    >
                        {sess.preview}
                    </button>
                ))}
            </div>
            <div className="p-3 border-t border-slate-200">
                <button onClick={clearHistory} className="flex items-center gap-2 text-xs text-red-500 hover:text-red-700 w-full">
                    <Trash2 className="w-3 h-3" /> 清空历史
                </button>
            </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col relative w-0">
            {/* Header */}
            {!embed && (
            <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-slate-600">
                        <PanelLeftClose className={`w-5 h-5 transition-transform ${!isSidebarOpen && 'rotate-180'}`} />
                    </button>
                    <div className="flex items-center gap-2 font-bold text-lg text-slate-800">
                        <Bot className="w-6 h-6 text-indigo-600" />
                        Do Anything (DeepSeek V3)
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setUseWebSearch(!useWebSearch)} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            useWebSearch 
                            ? 'bg-blue-50 border-blue-200 text-blue-700' 
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        {useWebSearch ? '已开启联网' : '联网搜索'}
                    </button>
                   
                    <div className="w-px h-6 bg-slate-200 mx-2" />
                    
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
            )}
            
            {embed && (
                <div className="h-10 border-b border-slate-100 flex items-center justify-between px-3 bg-white shrink-0">
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-400 hover:text-slate-600 p-1">
                         <Library className="w-4 h-4" />
                    </button>
                    <button 
                         onClick={() => setUseWebSearch(!useWebSearch)} 
                         className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-colors ${
                             useWebSearch 
                             ? 'bg-blue-50 border-blue-200 text-blue-700' 
                             : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                         }`}
                         title="联网搜索开关"
                     >
                         <Globe className="w-3 h-3" />
                         {useWebSearch ? 'ON' : 'OFF'}
                     </button>
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-600 text-white'
                        }`}>
                            {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>
                        <div className={`max-w-[90%] rounded-2xl px-3 py-2 shadow-sm text-sm leading-relaxed ${
                            msg.role === 'user' 
                            ? 'bg-white text-slate-800 rounded-tr-none border border-slate-100' 
                            : 'bg-indigo-600 text-white rounded-tl-none'
                        }`}>
                            {msg.role === 'user' ? (
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            ) : (
                                <div className="prose prose-sm prose-invert max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                     <div className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-200">
                <div className="max-w-3xl mx-auto relative">
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="输入问题，按 Enter 发送..."
                        className="w-full pl-3 pr-10 py-2 bg-slate-100 border-none rounded-lg focus:ring-1 focus:ring-indigo-500 min-h-[40px] max-h-[150px] resize-none text-xs"
                        rows={1}
                        style={{ height: 'auto', minHeight: '42px' }} 
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-1.5 bottom-1.5 p-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
                {!embed && (
                <div className="text-center mt-2 text-xs text-slate-400 flex justify-center gap-4">
                     <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> DeepSeek V3 Enabled</span>
                     <span className="flex items-center gap-1"><Library className="w-3 h-3" /> Local Knowledge Base</span>
                </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
