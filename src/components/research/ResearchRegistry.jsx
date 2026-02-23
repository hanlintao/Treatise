/**
 * json-render Registry —— 将 Catalog 中的组件映射为实际 React 组件
 */

import React, { createContext, useContext } from 'react';
import { defineRegistry, Renderer as JRRenderer, JSONUIProvider } from '@json-render/react';
import { researchCatalog } from './ResearchCatalog';
import { BookmarkPlus, ArrowRight, Copy, ExternalLink, FileText, Quote as QuoteIcon } from 'lucide-react';

// ========== Sources Context ==========
// Provides RAG sources to Citation components so they can show original text & link to papers
const SourcesContext = createContext([]);

// ========== 组件实现 ==========

function SectionComp({ props, children }) {
    return (
        <div className="mb-4">
            {props.title && (
                <h3 className="text-base font-bold text-slate-700 mb-2 border-b border-slate-200 pb-1">
                    {props.title}
                </h3>
            )}
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function HeadingComp({ props }) {
    const cls = {
        '1': 'text-lg font-bold text-slate-800 mb-2',
        '2': 'text-base font-semibold text-slate-700 mb-1.5',
        '3': 'text-sm font-semibold text-slate-600 mb-1',
    };
    const Tag = `h${props.level}`;
    return <Tag className={cls[props.level] || cls['2']}>{props.text}</Tag>;
}

function TextComp({ props }) {
    // Simple Markdown: **bold** *italic*, [N] citation refs as clickable sup
    const html = props.content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[(\d+)\]/g, '<sup class="text-violet-600 font-bold cursor-pointer hover:text-violet-800 hover:underline" data-cite-ref="$1">[$1]</sup>');
    
    const handleClick = (e) => {
        const ref = e.target.dataset?.citeRef;
        if (!ref) return;
        // Scroll to the Citation component with matching sourceIndex
        const container = e.target.closest('.json-render-output');
        if (!container) return;
        const citationEl = container.querySelector(`[data-source-index="${ref}"]`);
        if (citationEl) {
            citationEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            citationEl.classList.add('ring-2', 'ring-violet-400');
            setTimeout(() => citationEl.classList.remove('ring-2', 'ring-violet-400'), 2000);
        }
    };

    return (
        <p className="text-sm text-slate-700 leading-relaxed"
           onClick={handleClick}
           dangerouslySetInnerHTML={{ __html: html }} />
    );
}

function InsightCardComp({ props }) {
    const borderColors = {
        high: 'border-l-red-500 bg-red-50/50',
        medium: 'border-l-amber-500 bg-amber-50/50',
        low: 'border-l-blue-500 bg-blue-50/50',
    };
    const color = borderColors[props.importance] || borderColors.medium;
    return (
        <div className={`border-l-4 rounded-r-lg p-3 ${color} my-2`}>
            <div className="font-semibold text-sm text-slate-800 mb-1">💡 {props.title}</div>
            <div className="text-sm text-slate-600 leading-relaxed">{props.content}</div>
        </div>
    );
}

function KeyPointComp({ props }) {
    return (
        <div className="flex gap-2 items-start my-1.5">
            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-xs flex items-center justify-center font-bold">✦</span>
            <div>
                <span className="font-semibold text-sm text-slate-800">{props.label}：</span>
                <span className="text-sm text-slate-600">{props.detail}</span>
            </div>
        </div>
    );
}

function CitationComp({ props }) {
    const sources = useContext(SourcesContext);
    const idx = (props.sourceIndex || 1) - 1; // sourceIndex is 1-based
    const source = sources[idx];

    // Build navigation link to PaperReader
    const refId = source?.metadata?.refId;
    const attachmentId = source?.metadata?.sourceId;
    const paperUrl = refId
        ? `/read-paper/${refId}${attachmentId ? '/' + attachmentId : ''}`
        : null;
    const title = source?.reference?.title || `来源 ${props.sourceIndex}`;

    // Use the real original text from the RAG database if available, otherwise fall back to AI excerpt
    const originalText = source?.text || props.excerpt;
    // Show AI excerpt if different from original (AI may have summarized)
    const showAiExcerpt = source?.text && props.excerpt && props.excerpt !== source.text;

    return (
        <div className="my-3 bg-gradient-to-r from-violet-50/80 to-slate-50 border border-violet-200 rounded-xl overflow-hidden shadow-sm transition-all duration-300"
             data-source-index={props.sourceIndex}>
            {/* Header: source number + title + link */}
            <div className="flex items-center justify-between px-3 py-2 bg-violet-100/60 border-b border-violet-200">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">
                        {props.sourceIndex}
                    </span>
                    <span className="text-xs font-semibold text-slate-700 truncate" title={title}>
                        {title}
                    </span>
                </div>
                {paperUrl && (
                    <a
                        href={paperUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 hover:bg-violet-200 px-2 py-1 rounded-md transition-colors"
                        title="在阅读器中查看原文"
                    >
                        <ExternalLink className="w-3 h-3" />
                        查看原文
                    </a>
                )}
            </div>

            {/* Original text from RAG database */}
            <div className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                    <QuoteIcon className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    <blockquote className="text-xs text-slate-600 leading-relaxed italic border-l-2 border-violet-300 pl-2">
                        {originalText}
                    </blockquote>
                </div>

                {/* AI comment/annotation */}
                {props.comment && (
                    <p className="mt-2 text-xs text-slate-500 not-italic pl-6">
                        💬 {props.comment}
                    </p>
                )}

                {/* Relevance score badge */}
                {source?.score && (
                    <div className="mt-2 flex items-center gap-1 pl-6">
                        <span className="text-[10px] text-slate-400">相关度</span>
                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-violet-500 rounded-full"
                                style={{ width: `${Math.round(source.score * 100)}%` }}
                            />
                        </div>
                        <span className="text-[10px] text-slate-400">{Math.round(source.score * 100)}%</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ComparisonTableComp({ props }) {
    return (
        <div className="my-3 overflow-x-auto">
            {props.title && (
                <div className="text-sm font-semibold text-slate-700 mb-1.5">{props.title}</div>
            )}
            <table className="w-full text-xs border-collapse">
                <thead>
                    <tr>
                        {props.headers.map((h, i) => (
                            <th key={i} className="bg-violet-50 text-violet-700 font-semibold px-3 py-2 text-left border border-violet-200">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {props.rows.map((row, ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-2 text-slate-600 border border-slate-200">
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ListComp({ props }) {
    const Tag = props.ordered ? 'ol' : 'ul';
    return (
        <Tag className={`text-sm text-slate-700 space-y-1 my-2 pl-5 ${props.ordered ? 'list-decimal' : 'list-disc'}`}>
            {props.items.map((item, i) => <li key={i}>{item}</li>)}
        </Tag>
    );
}

function ActionButtonComp({ props, emit }) {
    const icons = {
        'deep-dive': <ArrowRight className="w-3 h-3" />,
        'copy': <Copy className="w-3 h-3" />,
        'bookmark': <BookmarkPlus className="w-3 h-3" />,
    };
    const colors = {
        'deep-dive': 'bg-violet-100 hover:bg-violet-200 text-violet-700',
        'copy': 'bg-slate-100 hover:bg-slate-200 text-slate-600',
        'bookmark': 'bg-amber-100 hover:bg-amber-200 text-amber-700',
    };

    const handleClick = () => {
        if (emit) emit('press');
    };

    return (
        <button
            onClick={handleClick}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors ${colors[props.actionType] || colors.copy}`}
            data-action-type={props.actionType}
            data-action-payload={props.actionPayload || ''}
        >
            {icons[props.actionType]}
            {props.label}
        </button>
    );
}

function QuoteComp({ props }) {
    return (
        <blockquote className="my-2 p-3 bg-slate-50 border-l-4 border-slate-300 rounded-r text-sm italic text-slate-600">
            <p>"{props.text}"</p>
            {props.author && <footer className="mt-1 text-xs text-slate-400 not-italic">— {props.author}</footer>}
        </blockquote>
    );
}

// ========== Registry ==========

export const { registry, handlers } = defineRegistry(researchCatalog, {
    components: {
        Section: SectionComp,
        Heading: HeadingComp,
        Text: TextComp,
        InsightCard: InsightCardComp,
        KeyPoint: KeyPointComp,
        Citation: CitationComp,
        ComparisonTable: ComparisonTableComp,
        List: ListComp,
        ActionButton: ActionButtonComp,
        Quote: QuoteComp,
    },
    actions: {
        deep_dive: async (params) => {
            // Will be handled by parent component via event delegation
            document.dispatchEvent(new CustomEvent('research-action', {
                detail: { type: 'deep-dive', payload: params }
            }));
        },
        copy_text: async (params) => {
            if (params.text) {
                await navigator.clipboard.writeText(params.text);
            }
        },
        bookmark: async (params) => {
            document.dispatchEvent(new CustomEvent('research-action', {
                detail: { type: 'bookmark', payload: params }
            }));
        },
    },
});

// ========== Renderer 包装 ==========

export function ResearchRenderer({ spec, sources = [], onAction }) {
    // Listen for action events
    React.useEffect(() => {
        const handler = (e) => {
            if (onAction) onAction(e.detail);
        };
        document.addEventListener('research-action', handler);
        return () => document.removeEventListener('research-action', handler);
    }, [onAction]);

    if (!spec || !spec.root || !spec.elements) {
        return <div className="text-sm text-red-400 italic">JSON 结构解析失败，请切换到 Markdown 模式</div>;
    }

    return (
        <SourcesContext.Provider value={sources}>
            <JSONUIProvider registry={registry} handlers={handlers}>
                <JRRenderer 
                    spec={spec} 
                    registry={registry}
                    fallback={({ props }) => (
                        <div className="text-xs text-slate-400 bg-red-50 p-2 rounded">
                            未知组件: {JSON.stringify(props)}
                        </div>
                    )}
                />
            </JSONUIProvider>
        </SourcesContext.Provider>
    );
}
