import React, { useState } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import { formatMarkdown } from '../utils/markdownFormatter';
import { exportToDocx } from '../utils/docxExporter';

const THEMES = [
  { id: 'default', name: '默认样式', class: 'theme-default' },
  { id: 'elegant', name: '优雅正文 (Serif)', class: 'theme-elegant' },
  { id: 'wechat', name: '公众号风格', class: 'theme-wechat' },
];

export function MarkdownEditor({ value, onChange, height = 400, preview = "live", onUploadImage, fontSize = "14px", fontFamily = "'Menlo', 'Monaco', 'Courier New', monospace" }) {
  const [currentTheme, setCurrentTheme] = useState(THEMES[0]);

  const handlePaste = async (event) => {
    if (!onUploadImage) return;

    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        event.preventDefault();
        const file = item.getAsFile();
        try {
            const url = await onUploadImage(file);
            const imageMarkdown = `![](${url})`;
            onChange(value + '\n' + imageMarkdown);
        } catch (e) {
            console.error(e);
        }
      }
    }
  };

  // Custom toolbar commands
  const formatCommand = {
    name: 'auto-format',
    keyCommand: 'auto-format',
    buttonProps: { 'aria-label': '自动排版', title: '自动排版（中英文空格、合并空行、补齐格式符号）' },
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
      </svg>
    ),
    execute: (state, api) => {
      const formatted = formatMarkdown(value || '');
      onChange(formatted);
    },
  };

  const exportDocxCommand = {
    name: 'export-docx',
    keyCommand: 'export-docx',
    buttonProps: { 'aria-label': '导出公文 DOCX', title: '按政府公文格式导出 Word 文档（GB/T 9704）' },
    icon: (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="12" y2="18" />
        <line x1="15" y1="15" x2="12" y2="18" />
      </svg>
    ),
    execute: async () => {
      // Extract a title from the first heading or use default
      const titleMatch = (value || '').match(/^#\s+(.+)$/m);
      const docTitle = titleMatch ? titleMatch[1].trim() : '公文';
      try {
        await exportToDocx(value || '', docTitle);
      } catch (e) {
        console.error('DOCX export failed:', e);
        alert('导出失败: ' + e.message);
      }
    },
  };

  const themeCommand = {
    name: 'theme',
    keyCommand: 'theme',
    buttonProps: { 
        'aria-label': '切换排版主题', 
        title: `当前排版：${currentTheme.name}`,
        style: { width: 'auto', minWidth: '28px', height: '28px', padding: '0 8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' } 
    },
    icon: (
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: '500', color: '#475569' }}>
            <span style={{ marginRight: 4, display: 'flex' }}>🎨</span>
            <span style={{ marginTop: 1 }}>{currentTheme.name.slice(0, 2)}</span>
        </div>
    ),
    execute: (state, api) => {
        const currentIndex = THEMES.findIndex(t => t.id === currentTheme.id);
        const nextHeader = THEMES[(currentIndex + 1) % THEMES.length];
        setCurrentTheme(nextHeader);
    },
  };

  // Compute line-height in px based on font-size to ensure pixel-perfect alignment
  const fontSizeNum = parseInt(fontSize, 10) || 14;
  const lineHeightPx = Math.round(fontSizeNum * 1.6) + 'px';

  return (
    <div 
      className={`w-full h-full flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm discourse-editor ${currentTheme.class}`} 
      data-color-mode="light"
      style={{
        '--md-editor-font-family': fontFamily,
        '--md-editor-font-size': fontSize,
        '--md-editor-line-height': lineHeightPx,
      }}
    >
      <MDEditor
        value={value}
        onChange={onChange}
        height={height || "100%"}
        preview={preview} 
        onPaste={handlePaste}
        visibleDragbar={false}
        extraCommands={[
            themeCommand,
            formatCommand,
            exportDocxCommand,
            commands.divider,
            commands.codeEdit,
            commands.codeLive,
            commands.codePreview,
            commands.fullscreen
        ]}
        style={{
            border: 'none',
            boxShadow: 'none',
            height: '100%',
            backgroundColor: 'white',
        }}
        textareaProps={{
            placeholder: "在此输入内容... (支持 Markdown、拖拽图片、表格)",
        }}
        previewOptions={{
             style: {
                 padding: '20px',
                 backgroundColor: '#f8f9fa',
                 fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
                 fontSize: fontSize,
                 lineHeight: '1.6'
             }
        }}
      />
      <style>{`
          /* ====================== Toolbar ======================== */
          .discourse-editor .w-md-editor-toolbar {
              border-bottom: 1px solid #e2e8f0;
              background-color: #f8fafc;
              padding: 4px 8px; /* Reduced padding */
              min-height: 40px; /* Reduced height */
              display: flex;
              align-items: center;
              overflow-x: auto; /* Enable horizontal scroll instead of wrap */
              flex-wrap: nowrap; /* Prevent wrapping */
              gap: 4px;
          }
          /* Hide scrollbar */
          .discourse-editor .w-md-editor-toolbar::-webkit-scrollbar {
              display: none;
          }
          .discourse-editor .w-md-editor-toolbar ul {
              display: flex;
              align-items: center;
              margin: 0;
              padding: 0;
              height: 100%;
              flex-shrink: 0;
          }
          .discourse-editor .w-md-editor-toolbar li {
              display: flex;
              align-items: center;
              justify-content: center;
              height: 28px; /* Match button height */
              margin: 0 1px;
              flex-shrink: 0; /* Prevent buttons from shrinking */
          }
          .discourse-editor .w-md-editor-toolbar li > button {
              color: #64748b;
              /* Remove fixed width to allow variable width buttons */
              min-width: 28px; 
              height: 28px;
              border-radius: 4px;
              padding: 0; /* Clear default padding */
              display: flex;
              align-items: center;
              justify-content: center;
          }
          .discourse-editor .w-md-editor-toolbar li > button:hover {
              background-color: #e2e8f0;
              color: #334155;
          }
          .discourse-editor .w-md-editor-toolbar li.active > button {
              background-color: #cbd5e1;
              color: #0f172a;
          }
          
          /* ============ CRITICAL: Unified Text Layer Styles ============ */
          /* 
           * The editor has 3 layers that MUST have identical font metrics:
           *   1. .w-md-editor-text          (parent container, sets inherited styles)
           *   2. .w-md-editor-text-pre>code  (syntax highlight overlay, rendered as <pre><code>)
           *   3. .w-md-editor-text-input     (actual transparent textarea for input)
           * 
           * The library hardcodes font-size:14px!important and line-height:18px!important.
           * We must override ALL of them with matching values using higher specificity.
           */
          .discourse-editor .w-md-editor .w-md-editor-text {
              font-family: var(--md-editor-font-family) !important;
              font-size: var(--md-editor-font-size) !important;
              line-height: var(--md-editor-line-height) !important;
              padding: 16px !important;
          }
          .discourse-editor .w-md-editor .w-md-editor-text-pre > code {
              font-family: var(--md-editor-font-family) !important;
              font-size: var(--md-editor-font-size) !important;
              line-height: var(--md-editor-line-height) !important;
          }
          .discourse-editor .w-md-editor .w-md-editor-text-input {
              font-family: var(--md-editor-font-family) !important;
              font-size: var(--md-editor-font-size) !important;
              line-height: var(--md-editor-line-height) !important;
          }
      `}</style>
    </div>
  );
}
