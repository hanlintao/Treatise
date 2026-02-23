/**
 * Markdown 自动排版工具（精简版）
 * 
 * 只做最安全、最有用的排版：
 *   1. 中英文之间自动添加空格（盘古之白）
 *   2. # 后补空格
 *   3. 列表标记后补空格
 *   4. 多余空行合并
 *   5. 行尾空格清除
 * 
 * 不做：标点转换、表格对齐（容易破坏原文）
 */

/**
 * 主函数：自动排版 Markdown 文本
 * 保护代码块和行内代码不被修改
 */
export function formatMarkdown(text) {
    if (!text) return text;

    // 1. 保护代码块
    const codeBlocks = [];
    let s = text.replace(/```[\s\S]*?```/g, m => {
        codeBlocks.push(m);
        return `\x00CB${codeBlocks.length - 1}\x00`;
    });

    // 保护行内代码
    const inlineCodes = [];
    s = s.replace(/`[^`]+`/g, m => {
        inlineCodes.push(m);
        return `\x00IC${inlineCodes.length - 1}\x00`;
    });

    // 2. 盘古之白：中文 ↔ 英文/数字之间加空格
    s = s.replace(/([\u4e00-\u9fff\u3400-\u4dbf])([A-Za-z0-9])/g, '$1 $2');
    s = s.replace(/([A-Za-z0-9])([\u4e00-\u9fff\u3400-\u4dbf])/g, '$1 $2');

    // 3. 标题 # 后补空格
    s = s.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');

    // 4. 列表标记后补空格
    s = s.replace(/^(\s*[-*+])([^\s])/gm, '$1 $2');
    s = s.replace(/^(\s*\d+\.)([^\s])/gm, '$1 $2');

    // 5. 多余空行合并（最多保留 1 行空行）
    s = s.replace(/\n{3,}/g, '\n\n');

    // 6. 行尾空格清除
    s = s.replace(/[ \t]+$/gm, '');

    // 7. 还原
    inlineCodes.forEach((c, i) => { s = s.replace(`\x00IC${i}\x00`, c); });
    codeBlocks.forEach((c, i) => { s = s.replace(`\x00CB${i}\x00`, c); });

    return s.trimEnd() + '\n';
}
