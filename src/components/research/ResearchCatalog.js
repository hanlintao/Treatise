/**
 * json-render Catalog 定义
 * 
 * 为深度研究的 AI 输出定义可用的 UI 组件和操作。
 * AI 只能使用这里定义的组件，保证输出安全可控。
 */

import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react';
import { z } from 'zod';

export const researchCatalog = defineCatalog(schema, {
    components: {
        // ====== 布局 ======
        Section: {
            props: z.object({
                title: z.string().optional().describe('可选的区块标题'),
            }),
            slots: ['default'],
            description: '一个带可选标题的内容区块，用于组织回答结构',
        },

        // ====== 文本 ======
        Heading: {
            props: z.object({
                text: z.string(),
                level: z.enum(['1', '2', '3']).describe('标题层级'),
            }),
            description: '标题文本，level=1 最大',
        },

        Text: {
            props: z.object({
                content: z.string().describe('段落文本，支持简单 Markdown 加粗/斜体'),
            }),
            description: '普通段落文字',
        },

        // ====== 高亮组件 ======
        InsightCard: {
            props: z.object({
                title: z.string(),
                content: z.string().describe('核心观点的描述'),
                importance: z.enum(['high', 'medium', 'low']).optional().describe('重要程度'),
            }),
            description: '高亮展示一个核心洞察/发现/观点，用于强调关键信息',
        },

        KeyPoint: {
            props: z.object({
                label: z.string().describe('关键要点的简短标签'),
                detail: z.string().describe('展开说明'),
            }),
            description: '展示一个关键要点，带标签和说明',
        },

        // ====== 引用 ======
        Citation: {
            props: z.object({
                sourceIndex: z.number().describe('对应 sources 数组的索引（从 1 开始）'),
                excerpt: z.string().describe('引用的原文片段'),
                comment: z.string().optional().describe('对引用的评注'),
            }),
            description: '内嵌引用块，展示来源文献的关键段落，sourceIndex 对应 [1] [2] 等编号',
        },

        // ====== 数据展示 ======
        ComparisonTable: {
            props: z.object({
                title: z.string().optional(),
                headers: z.array(z.string()).describe('列标题'),
                rows: z.array(z.array(z.string())).describe('每行的数据'),
            }),
            description: '对比表格，用于比较不同理论、方法、概念之间的异同',
        },

        List: {
            props: z.object({
                items: z.array(z.string()),
                ordered: z.boolean().optional().describe('是否有序列表'),
            }),
            description: '列表，展示多个条目',
        },

        // ====== 交互 ======
        ActionButton: {
            props: z.object({
                label: z.string(),
                actionType: z.enum(['deep-dive', 'copy', 'bookmark']).describe('按钮操作类型'),
                actionPayload: z.string().optional().describe('操作负载，如子话题内容'),
            }),
            description: '操作按钮。deep-dive: 深入研究某个子话题; copy: 复制内容; bookmark: 收藏',
        },

        Quote: {
            props: z.object({
                text: z.string(),
                author: z.string().optional(),
            }),
            description: '引用块/名言，带可选作者',
        },
    },

    actions: {
        deep_dive: {
            description: '深入研究某个子话题，发起新一轮对话',
        },
        copy_text: {
            description: '复制指定文本到剪贴板',
        },
        bookmark: {
            description: '收藏当前回答或片段',
        },
    },
});
