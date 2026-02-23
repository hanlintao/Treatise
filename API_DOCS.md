# External Read-Only API Documentation

为了支持第三方工具（如 AI 写作助手、Research Agent）安全地访问您的知识库，我们提供了一套统一的只读 API。

**Base URL**: `http://localhost:3001/api/external`

---

## 1. 参考文献（题录）检索 (Bibliography API)

专为 AI 写作工具设计，支持关键词搜索并返回标准化的引用格式。

### 1.1 搜索文献
`GET /references/search`

**参数**:
- `q` (可选): 搜索关键词。
- `limit` (可选): 返回数量，默认 10。
- `has_full_text` (可选): 设为 `true` 则仅返回有全文的文献。
- `mode` (可选): 设为 `deep` 则启用全文深度搜索（扫描正文内容），默认为 `basic`（仅搜索元数据）。

**示例 1: 基础搜索（仅有全文）**
```bash
curl "http://localhost:3001/api/external/references/search?q=机器翻译&has_full_text=true"
```

**示例 2: 全文深度搜索**
```bash
curl "http://localhost:3001/api/external/references/search?q=Transformer&mode=deep"
```

**响应**:
```json
{
  "success": true,
  "count": 1,
  "results": [
    {
      "id": "ref_12345",
      "title": "Attention Is All You Need",
      "has_full_text": true,
      "citation": "Vaswani, A., et al. Attention Is All You Need...",
      "match_context": "...based solely on attention mechanisms, dispensing with recurrence and convolutions entirely..."
    }
  ]
}
```

### 1.2 获取文献详情
`GET /references/:id`

**参数**:
- `include_content` (可选): 设为 `true` 则返回完整的全文内容（字段名 `content`）。

**示例**:
```bash
curl "http://localhost:3001/api/external/references/ref_12345?include_content=true"
```


---

## 2. 知识库检索 (Knowledge API)

用于查询核心概念定义、重要性及难度等级，辅助 AI 撰写理论背景。

### 2.1 搜索知识点
`GET /knowledge/search`

**参数**:
- `q` (可选): 搜索关键词。

**响应**:
```json
{
  "success": true,
  "results": [
    {
      "id": "k_123",
      "term": "统计机器翻译",
      "definition": "基于统计模型的机器翻译范式...",
      "importance": 5,
      "difficulty": 4
    }
  ]
}
```

---

## 3. 灵感日志 (Inspirations API)

获取用户的灵感记录，用于扩展写作思路。

### 3.1 获取所有灵感
`GET /inspirations`

**响应**:
```json
{
  "success": true,
  "results": [
    {
      "id": "insp_1",
      "content": "关于翻译技术伦理的思考...",
      "created_at": "2023-10-01T12:00:00Z"
    }
  ]
}
```

---

## 最佳实践：AI 写作助手工作流

1.  **用户请求**: "请帮我写一段关于神经机器翻译发展的背景介绍，并引用相关文献。"
2.  **Tool 调用**:
    *   调用 `GET /references/search?q=神经机器翻译` 获取相关文献列表。
    *   调用 `GET /knowledge/search?q=神经机器翻译` 获取准确的定义。
3.  **内容生成**:
    *   AI 使用知识点定义撰写正文。
    *   AI 从文献搜索结果中提取 `citation` 字段，自动生成参考文献列表（Bibliography）。
