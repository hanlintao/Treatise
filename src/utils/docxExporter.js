/**
 * Markdown → DOCX 导出工具（政府公文格式）
 * 
 * 遵循 GB/T 9704-2012《党政机关公文格式》：
 *   纸张：A4（210 × 297mm）
 *   页边距：上 3.7cm 下 3.5cm 左 2.8cm 右 2.6cm
 *   正文：仿宋_GB2312 三号（16pt）行距 28.95pt 固定值
 *   一级标题：黑体 三号
 *   二级标题：楷体_GB2312 三号
 *   三级及以下：仿宋 三号 加粗
 *   文件标题：方正小标宋/华文中宋 二号（22pt）居中
 *   页码：— N — 居中 四号 Times New Roman
 *   首行缩进：2 字符（= 2×16pt = 32pt = 640twip）
 */

import {
    Document, Packer, Paragraph, TextRun,
    AlignmentType, TableRow, TableCell, Table,
    WidthType, BorderStyle,
    Footer, PageNumber, NumberFormat,
    convertMillimetersToTwip,
} from 'docx';
import { saveAs } from 'file-saver';

// ========== 常量 ==========
const F = {
    TITLE: '华文中宋',
    H1: '黑体',
    H2: '楷体',
    BODY: '仿宋',
    CODE: 'Courier New',
    PN: 'Times New Roman',
};
const S = { TITLE: 44, H: 32, BODY: 32, CODE: 21, PN: 28 };
const LS = 579;            // 28.95pt × 20
const INDENT2 = 640;       // 首行缩进 2 字符 = 32pt × 20
const mm = convertMillimetersToTwip;

// ========== Markdown → Block ==========

function parse(md) {
    if (!md) return [];
    const lines = md.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
        const L = lines[i];

        // 代码块
        if (L.trim().startsWith('```')) {
            const buf = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) { buf.push(lines[i]); i++; }
            blocks.push({ t: 'code', text: buf.join('\n') });
            i++;
            continue;
        }

        // 标题
        const hm = L.match(/^(#{1,6})\s+(.+)$/);
        if (hm) { blocks.push({ t: 'h', lv: hm[1].length, text: hm[2].trim() }); i++; continue; }

        // 分割线
        if (/^[-*_]{3,}\s*$/.test(L.trim())) { blocks.push({ t: 'hr' }); i++; continue; }

        // 表格
        if (L.trim().startsWith('|')) {
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++; }
            blocks.push({ t: 'table', rows });
            continue;
        }

        // 无序列表
        const ul = L.match(/^(\s*)([-*+])\s+(.+)$/);
        if (ul) { blocks.push({ t: 'li', ordered: false, indent: Math.floor(ul[1].length / 2), text: ul[3] }); i++; continue; }

        // 有序列表
        const ol = L.match(/^(\s*)(\d+)\.\s+(.+)$/);
        if (ol) { blocks.push({ t: 'li', ordered: true, num: ol[2], indent: Math.floor(ol[1].length / 2), text: ol[3] }); i++; continue; }

        // 引用
        const qm = L.match(/^>\s*(.*)$/);
        if (qm) { blocks.push({ t: 'quote', text: qm[1] }); i++; continue; }

        // 空行
        if (L.trim() === '') { i++; continue; }

        // 普通段落——把连续非空行合并为同一段
        let para = L;
        i++;
        while (i < lines.length) {
            const next = lines[i];
            // 碰到空行、标题、列表、引用、代码块、表格、分割线就停
            if (
                next.trim() === '' ||
                /^#{1,6}\s/.test(next) ||
                /^\s*[-*+]\s/.test(next) ||
                /^\s*\d+\.\s/.test(next) ||
                /^>\s/.test(next) ||
                next.trim().startsWith('```') ||
                next.trim().startsWith('|') ||
                /^[-*_]{3,}\s*$/.test(next.trim())
            ) break;
            para += ' ' + next;
            i++;
        }
        blocks.push({ t: 'p', text: para });
    }
    return blocks;
}

// ========== 内联解析 ==========

function inlineRuns(text, fontOverride, sizeOverride, boldOverride) {
    const runs = [];
    const re = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|~~(.*?)~~/g;
    let last = 0, m;
    const push = (txt, opts = {}) => {
        if (!txt) return;
        runs.push(new TextRun({
            text: txt,
            font: opts.code ? F.CODE : (fontOverride || F.BODY),
            size: opts.code ? S.CODE : (sizeOverride || S.BODY),
            bold: boldOverride || opts.bold || false,
            italics: opts.italic || false,
            strike: opts.strike || false,
            ...(opts.code ? { shading: { fill: 'F0F0F0' } } : {}),
        }));
    };
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) push(text.slice(last, m.index));
        if (m[1]) push(m[2], { bold: true });
        else if (m[3]) push(m[4], { italic: true });
        else if (m[5]) push(m[5], { code: true });
        else if (m[6]) push(m[6]);            // 链接文字（Word 中外部链接需要额外处理，先只取文字）
        else if (m[8]) push(m[8], { strike: true });
        last = re.lastIndex;
    }
    if (last < text.length) push(text.slice(last));
    if (runs.length === 0) push(text);
    return runs;
}

// ========== 表格解析 ==========

function buildTable(rowLines) {
    const data = [];
    for (const line of rowLines) {
        const cells = line.split('|').slice(1, -1).map(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c))) continue; // 跳过分隔行
        data.push(cells);
    }
    if (data.length === 0) return null;
    const cols = Math.max(...data.map(r => r.length));
    const border = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
    const borders = { top: border, bottom: border, left: border, right: border };

    return new Table({
        rows: data.map((row, ri) =>
            new TableRow({
                children: Array.from({ length: cols }, (_, ci) =>
                    new TableCell({
                        children: [new Paragraph({
                            children: inlineRuns(row[ci] || '', ri === 0 ? F.H1 : F.BODY, S.BODY, ri === 0),
                            spacing: { line: LS },
                        })],
                        width: { size: Math.floor(100 / cols), type: WidthType.PERCENTAGE },
                        borders,
                    })
                ),
            })
        ),
        width: { size: 100, type: WidthType.PERCENTAGE },
    });
}

// ========== 导出 ==========

export async function exportToDocx(markdown, title = '公文') {
    const blocks = parse(markdown);
    const children = [];
    let titleDone = false;

    for (const b of blocks) {
        switch (b.t) {

            case 'h': {
                if (b.lv === 1 && !titleDone) {
                    // 文件标题：华文中宋 二号 居中 段前段后各一行
                    titleDone = true;
                    children.push(new Paragraph({
                        children: [new TextRun({ text: b.text, font: F.TITLE, size: S.TITLE, bold: true })],
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 360, after: 360, line: LS },
                    }));
                } else if (b.lv <= 2) {
                    // 一级 / 二级标题
                    const font = b.lv === 1 ? F.H1 : F.H2;
                    children.push(new Paragraph({
                        children: inlineRuns(b.text, font, S.H, b.lv === 1),
                        spacing: { before: 240, after: 120, line: LS },
                    }));
                } else {
                    // 三级以下：仿宋加粗
                    children.push(new Paragraph({
                        children: inlineRuns(b.text, F.BODY, S.BODY, true),
                        spacing: { before: 120, after: 60, line: LS },
                    }));
                }
                break;
            }

            case 'p': {
                children.push(new Paragraph({
                    children: inlineRuns(b.text),
                    indent: { firstLine: INDENT2 },
                    spacing: { line: LS },
                }));
                break;
            }

            case 'li': {
                const marker = b.ordered ? `${b.num}. ` : '• ';
                children.push(new Paragraph({
                    children: inlineRuns(marker + b.text),
                    indent: { left: INDENT2 + b.indent * 420 },
                    spacing: { line: LS },
                }));
                break;
            }

            case 'quote': {
                children.push(new Paragraph({
                    children: [new TextRun({ text: b.text, font: F.H2, size: S.BODY, italics: true })],
                    indent: { left: mm(10), right: mm(10) },
                    spacing: { line: LS },
                    border: { left: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 10 } },
                }));
                break;
            }

            case 'code': {
                for (const cl of b.text.split('\n')) {
                    children.push(new Paragraph({
                        children: [new TextRun({ text: cl || ' ', font: F.CODE, size: S.CODE })],
                        spacing: { line: 360 },
                        shading: { fill: 'F5F5F5' },
                    }));
                }
                break;
            }

            case 'table': {
                const tbl = buildTable(b.rows);
                if (tbl) children.push(tbl);
                break;
            }

            case 'hr': {
                children.push(new Paragraph({
                    children: [new TextRun({ text: '————————————————', font: F.BODY, size: S.BODY, color: 'AAAAAA' })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 120, after: 120 },
                }));
                break;
            }
        }
    }

    if (children.length === 0) children.push(new Paragraph({ children: [] }));

    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: { font: F.BODY, size: S.BODY },
                    paragraph: { spacing: { line: LS } },
                },
            },
        },
        sections: [{
            properties: {
                page: {
                    size: { width: mm(210), height: mm(297) },
                    margin: { top: mm(37), bottom: mm(35), left: mm(28), right: mm(26) },
                },
                pageNumberFormatType: NumberFormat.DECIMAL,
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            children: ['— ', PageNumber.CURRENT, ' —'],
                            font: F.PN, size: S.PN,
                        })],
                    })],
                }),
            },
            children,
        }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${title}.docx`);
}
