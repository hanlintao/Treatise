import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { MarkdownEditor } from './MarkdownEditor';
import { Link } from 'react-router-dom';
import { 
  Send, ThumbsUp, MessageCircle, Share2, Trash2, Hash, Image, Smile, AtSign, Sparkles
} from 'lucide-react';
import { API_BASE_URL } from '../utils/api';

// Custom Link Renderer for ReactMarkdown
const LinkRenderer = ({ href, children }) => {
    // If it's an internal link (starts with /), use React Router Link
    if (href && href.startsWith('/')) {
        return (
            <Link to={href} className="text-blue-600 hover:underline hover:text-blue-800 break-all">
                {children}
            </Link>
        );
    }
    // Otherwise use default a tag
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline hover:text-blue-800 break-all">
            {children}
        </a>
    );
};

export function WeiboManager() {
  const [posts, setPosts] = useState([]);
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentContent, setCommentContent] = useState('');
  const [repostModal, setRepostModal] = useState(null); // { id, content, author }
  const [streamingReply, setStreamingReply] = useState({}); // { postId: content }

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo`);
      const data = await res.json();
      setPosts(data);
    } catch (e) {
      console.error('Failed to fetch posts', e);
    }
  };

  const triggerSmartReply = async (post) => {
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) return;

    // Initialize streaming state
    setStreamingReply(prev => ({ ...prev, [post.id]: 'AI主编正在思考...' }));
    
    // Auto open comment section
    setActiveCommentPostId(post.id);

    // Build History
    // 1. System/Context is handled by backend
    // 2. Messages:
    //    User: Post Content
    //    Assistant/User: Comments
    
    const history = [];
    // Add original post
    history.push({ role: 'user', content: `User Post: ${post.content}` });
    
    // Add comments history
    if (post.comments) {
        post.comments.forEach(c => {
            const role = c.user === 'AI主编' ? 'assistant' : 'user';
            history.push({ role, content: c.content });
        });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/weibo/smart-reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            history, // Send full history
            apiKey
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let replyText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;
            try {
                const data = JSON.parse(dataStr);
                if (data.content) {
                    replyText += data.content;
                    setStreamingReply(prev => ({ ...prev, [post.id]: replyText }));
                }
            } catch (e) {}
          }
        }
      }

      // Save the generated reply as a comment
      if (replyText) {
          await saveAutoComment(post.id, replyText);
          setStreamingReply(prev => {
              const newState = { ...prev };
              delete newState[post.id];
              return newState;
          });
      }

    } catch (e) {
      console.error('Smart reply failed', e);
      setStreamingReply(prev => ({ ...prev, [post.id]: '' }));
    }
  };

  const saveAutoComment = async (postId, content) => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/weibo/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                content: content,
                isAuto: true 
            })
        });
        const data = await res.json();
        if (data.success) {
            // Update local state with new comment
            setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: data.comments } : p));
        }
      } catch (e) {}
  };

  const handleSubmit = async () => {
    if (!newContent.trim()) return;
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent })
      });
      const data = await res.json();
      if (data.success) {
        setNewContent('');
        const newPost = data.post;
        setPosts([newPost, ...posts]);
        
        // Trigger Smart Reply automatically for new posts
        triggerSmartReply(newPost);
      }
    } catch (e) {
      alert('发布失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLike = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo/${id}/like`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success) {
        setPosts(posts.map(p => p.id === id ? { ...p, likes: data.likes } : p));
      }
    } catch (e) {
      console.error('Like failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('确定删除这条微博吗？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setPosts(posts.filter(p => p.id !== id));
      }
    } catch (e) {
      alert('删除失败');
    }
  };

  const handleCommentSubmit = async (postId, requestAI = false) => {
    if (!commentContent.trim()) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentContent })
      });
      const data = await res.json();
      if (data.success) {
        // Update posts state with new comments
        setPosts(prev => prev.map(p => {
            if (p.id === postId) {
                return { ...p, comments: data.comments };
            }
            return p;
        }));
        setCommentContent('');
        
        // If requesting AI reply, trigger it with the updated post
        if (requestAI) {
            // We need the post object with the new comments.
            // Since setState is async, we construct it manually using data.comments
            const post = posts.find(p => p.id === postId);
            if (post) {
                const updatedPost = { ...post, comments: data.comments };
                triggerSmartReply(updatedPost);
            }
        }
      }
    } catch (e) {
      alert('评论失败');
    }
  };

  const handleRepost = async () => {
    if (!repostModal) return;
    
    const content = newContent || '转发微博'; // Reuse newContent state for repost modal input for simplicity, or create new state?
    // Wait, let's use a separate state or just use prompt for V1 to be simpler?
    // Let's build a proper modal in UI.
    // For now, assume we use `newContent` in the main input area if we were doing a different UI.
    // But since repost is usually a separate action, let's use a simple prompt for now to save UI complexity, or better, a small inline area.
    
    // Actually, let's just make the "Repost" button open a mode where the main input becomes a repost input? 
    // Or just a standard "Forward" with default text.
  };

  const submitRepost = async (originId, content) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/weibo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            content: content || '转发微博',
            originId 
        })
      });
      const data = await res.json();
      if (data.success) {
        setPosts([data.post, ...posts]);
        setRepostModal(null);
        // Also update the original post's repost count locally?
        // It's complex because we need to find it. Refreshing list is easier.
        fetchPosts(); 
      }
    } catch (e) {
      alert('转发失败');
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diff = (now - date) / 1000; // seconds

    if (diff < 60) return '刚刚';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    
    return date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handleToolClick = (type) => {
    let insertText = '';
    switch (type) {
        case 'image':
            insertText = ' ![图片描述](https://via.placeholder.com/150) ';
            break;
        case 'hash':
            insertText = ' #话题# ';
            break;
        case 'at':
            insertText = ' @用户 ';
            break;
        case 'emoji':
            insertText = ' 😊 ';
            break;
        default:
            return;
    }
    setNewContent(prev => prev + insertText);
    
    // Ideally we should set cursor position, but for now append is fine.
    // Focusing the textarea would be nice too.
    // const textarea = document.querySelector('textarea');
    // if (textarea) textarea.focus();
  };

  return (
    <div className="flex h-full bg-slate-100 justify-center">
      <div className="w-full max-w-2xl h-full overflow-y-auto bg-white shadow-sm border-x border-slate-200">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-slate-100 p-4">
          <h2 className="text-lg font-bold text-slate-800">我的微博</h2>
          <p className="text-xs text-slate-500">记录灵感，分享想法</p>
        </div>

        {/* Input Area */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 overflow-hidden">
               {/* Avatar Placeholder */}
               <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold">我</div>
            </div>
            <div className="flex-1">
              <MarkdownEditor
                value={newContent}
                onChange={(val) => setNewContent(val || '')}
                height={150}
                preview="edit"
              />
              <div className="flex justify-between items-center mt-2">
                <div className="flex gap-4 text-slate-400">
                  <button onClick={() => handleToolClick('image')} className="hover:text-blue-500" title="插入图片"><Image className="w-5 h-5" /></button>
                  <button onClick={() => handleToolClick('hash')} className="hover:text-blue-500" title="插入话题"><Hash className="w-5 h-5" /></button>
                  <button onClick={() => handleToolClick('at')} className="hover:text-blue-500" title="@用户"><AtSign className="w-5 h-5" /></button>
                  <button onClick={() => handleToolClick('emoji')} className="hover:text-blue-500" title="插入表情"><Smile className="w-5 h-5" /></button>
                </div>
                <button 
                  onClick={handleSubmit}
                  disabled={!newContent.trim() || isSubmitting}
                  className="px-6 py-1.5 bg-orange-500 text-white rounded-full font-bold hover:bg-orange-600 disabled:opacity-50 text-sm"
                >
                  发布
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Post List */}
        <div>
          {posts.map(post => (
            <div key={post.id} className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0 overflow-hidden">
                   <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white font-bold text-sm">我</div>
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-slate-800 text-sm">我 <span className="text-slate-400 font-normal ml-1 text-xs">@myself</span></div>
                      <div className="text-xs text-slate-400 mt-0.5 hover:underline cursor-pointer">{formatDate(post.created_at)}</div>
                    </div>
                    <button onClick={() => handleDelete(post.id)} className="text-slate-300 hover:text-red-500">
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Post Text */}
                  <div className="mt-2 text-slate-800 text-sm leading-relaxed prose prose-sm prose-slate max-w-none prose-p:my-1 prose-a:no-underline">
                    <ReactMarkdown 
                        components={{
                            a: LinkRenderer,
                            // Add other custom renderers if needed, e.g. for images
                            img: ({src, alt}) => <img src={src} alt={alt} className="max-w-full rounded-lg my-2 shadow-sm" />
                        }}
                    >
                        {post.content}
                    </ReactMarkdown>
                  </div>

                  {/* Repost Origin */}
                  {post.origin && (
                    <div className="mt-3 bg-slate-100 rounded-lg p-3">
                        <div className="text-xs text-blue-600 font-bold mb-1">@{post.origin.author}</div>
                        <div className="text-sm text-slate-600">{post.origin.content}</div>
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex justify-between items-center mt-3 max-w-md">
                    <button 
                        onClick={() => setRepostModal(post)}
                        className="flex items-center gap-1 text-slate-500 hover:text-blue-500 text-xs group"
                    >
                        <Share2 className="w-4 h-4 group-hover:bg-blue-50 rounded-full p-0.5 box-content" />
                        <span>{post.reposts || '转发'}</span>
                    </button>
                    
                    <button 
                        onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                        className="flex items-center gap-1 text-slate-500 hover:text-blue-500 text-xs group"
                    >
                        <MessageCircle className="w-4 h-4 group-hover:bg-blue-50 rounded-full p-0.5 box-content" />
                        <span>{post.comments?.length || '评论'}</span>
                    </button>
                    
                    <button 
                        onClick={() => handleLike(post.id)}
                        className="flex items-center gap-1 text-slate-500 hover:text-red-500 text-xs group"
                    >
                        <ThumbsUp className="w-4 h-4 group-hover:bg-red-50 rounded-full p-0.5 box-content" />
                        <span>{post.likes || '赞'}</span>
                    </button>
                  </div>

                  {/* Comments Section */}
                    {(activeCommentPostId === post.id || streamingReply[post.id]) && (
                    <div className="mt-4 bg-slate-50 p-3 rounded-lg animate-in fade-in slide-in-from-top-2">
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text" 
                                value={commentContent}
                                onChange={(e) => setCommentContent(e.target.value)}
                                placeholder="发布评论或回复..."
                                className="flex-1 bg-white border border-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
                                onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(post.id)}
                            />
                            <button 
                                onClick={() => handleCommentSubmit(post.id, false)}
                                className="text-slate-500 hover:text-blue-500 font-bold text-sm px-2"
                            >
                                发送
                            </button>
                            <button 
                                onClick={() => handleCommentSubmit(post.id, true)}
                                className="text-purple-600 hover:text-purple-700 font-bold text-sm px-2 flex items-center gap-1 bg-purple-50 rounded-full py-1 hover:bg-purple-100 transition-colors"
                                title="发送并邀请AI主编回复"
                            >
                                <Sparkles className="w-4 h-4" />
                                <span>发送并请AI回复</span>
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {post.comments && post.comments.map(comment => (
                                <div key={comment.id} className="flex justify-between items-start text-sm">
                                    <div className="flex gap-2 flex-1 min-w-0">
                                        <span className={`font-bold shrink-0 ${comment.user === 'AI主编' ? 'text-purple-600' : 'text-slate-700'}`}>
                                            {comment.user}:
                                        </span>
                                        <div className="text-slate-600 flex-1 min-w-0">
                                            {comment.user === 'AI主编' ? (
                                                <div className="prose prose-sm prose-slate max-w-none">
                                                    <ReactMarkdown>
                                                        {comment.content}
                                                    </ReactMarkdown>
                                                </div>
                                            ) : (
                                                <span>{comment.content}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setCommentContent(`回复 @${comment.user} `)}
                                        className="text-xs text-slate-400 hover:text-blue-500 whitespace-nowrap ml-2 mt-1 shrink-0"
                                    >
                                        回复
                                    </button>
                                </div>
                            ))}
                            
                            {/* Streaming AI Reply */}
                            {streamingReply[post.id] && (
                                <div className="flex gap-2 text-sm">
                                    <span className="font-bold text-purple-600 shrink-0">AI主编:</span>
                                    <div className="text-slate-600 flex-1 min-w-0">
                                         <div className="prose prose-sm prose-slate max-w-none animate-pulse">
                                             <ReactMarkdown>
                                                 {streamingReply[post.id]}
                                             </ReactMarkdown>
                                         </div>
                                     </div>
                                </div>
                            )}

                            {(!post.comments || post.comments.length === 0) && !streamingReply[post.id] && (
                                <div className="text-xs text-slate-400 text-center py-2">暂无评论</div>
                            )}
                        </div>
                    </div>
                  )}

                </div>
              </div>
            </div>
          ))}
          {posts.length === 0 && (
            <div className="p-8 text-center text-slate-400">
                暂无内容，快来发布第一条微博吧
            </div>
          )}
        </div>
      </div>

      {/* Repost Modal */}
      {repostModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl w-full max-w-md p-4 shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">转发微博</h3>
                  <div className="bg-slate-50 p-3 rounded mb-4 text-sm text-slate-500 border border-slate-200">
                      @{repostModal.origin ? repostModal.origin.author : '我'} : {repostModal.origin ? repostModal.origin.content : repostModal.content}
                  </div>
                  <textarea 
                      className="w-full h-24 border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                      placeholder="说说分享心得..."
                      id="repost-input"
                  ></textarea>
                  <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => setRepostModal(null)}
                        className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                      >
                          取消
                      </button>
                      <button 
                        onClick={() => {
                            const input = document.getElementById('repost-input');
                            submitRepost(repostModal.id, input.value);
                        }}
                        className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-bold"
                      >
                          转发
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
