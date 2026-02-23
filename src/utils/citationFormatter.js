// Reference Types and Field Definitions
export const REFERENCE_TYPES = {
  M: { label: '专著 [M]', code: 'M' },
  C: { label: '论文集 [C]', code: 'C' },
  A: { label: '析出文献 [A]', code: 'A' },
  J: { label: '期刊 [J]', code: 'J' },
  N: { label: '报纸 [N]', code: 'N' },
  D: { label: '学位论文 [D]', code: 'D' },
  R: { label: '报告 [R]', code: 'R' },
  S: { label: '标准 [S]', code: 'S' },
  DB: { label: '数据库 [DB]', code: 'DB' },
  CP: { label: '计算机程序 [CP]', code: 'CP' },
  EB: { label: '电子公告 [EB]', code: 'EB' },
  Z: { label: '其他 [Z]', code: 'Z' }
};

// Helper to detect if text contains Chinese
const isChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

// Helper to format authors
const formatAuthors = (authors, lang) => {
  if (!authors || authors.length === 0) return '';
  if (lang === 'en') {
    // English: Surname first? User example: "Baker, Mona"
    // Assuming input is already "Baker, Mona" or user inputs First Last and we convert?
    // For simplicity, assume user inputs the full name string as they want it to appear, or we just join them.
    // User example: "郭宏安、章国锋、王逢振" (Chinese uses 、)
    return authors.join(isChinese(authors[0]) ? '、' : ', ');
  }
  return authors.join('、');
};

// Main Formatter
export const formatCitation = (ref, format = 'GB/T 7714') => {
  if (!ref) return '';
  if (ref.type === 'pdf-parsed' && !ref.year) return ref.title; // Fallback for raw OCR imports
  
  const lang = ref.language || (isChinese(ref.title) ? 'zh' : 'en');
  // APA Style (Simplified)
  if (format === 'APA') {
    let text = '';
    // Author
    let authors = ref.authors || [];
    if (typeof authors === 'string') authors = [authors];
    if (authors.length > 0) {
      text += authors.join(', ') + '. ';
    }
    // Year
    if (ref.year) text += `(${ref.year}). `;
    // Title
    text += `${ref.title}. `;
    // Source
    if (ref.source) text += ref.source;
    else if (ref.publisher) text += ref.publisher + '.';
    return text;
  }
  
  // BibTeX
  if (format === 'BibTeX') {
    const id = (ref.authors?.[0]?.split(' ')[0] || 'unknown') + (ref.year || '2020') + (ref.title?.split(' ')[0] || 'ref');
    let entry = `@misc{${id},\n`;
    entry += `  title = {${ref.title}},\n`;
    if (ref.authors) entry += `  author = {${ref.authors.join(' and ')}},\n`;
    if (ref.year) entry += `  year = {${ref.year}},\n`;
    if (ref.publisher) entry += `  publisher = {${ref.publisher}},\n`;
    entry += `}`;
    return entry;
  }

  // Default: GB/T 7714
  const dot = lang === 'zh' ? '．' : '. ';
  const comma = lang === 'zh' ? '，' : ', ';
  const colon = lang === 'zh' ? '：' : ': ';
  
  // Format Authors
  let authors = ref.authors || [];
  if (typeof authors === 'string') authors = [authors]; // Handle legacy
  const authorStr = formatAuthors(authors, lang);
  
  let citation = `${authorStr}${dot}${ref.title}`;

  // Add Type Code
  // Special case for EB: [EB/OL], DB: [DB/OL] etc? User example says [EB/OL]
  let typeCode = ref.typeCode || 'M';
  let typeMark = `[${typeCode}]`;
  if (ref.subType) typeMark = `[${typeCode}/${ref.subType}]`;
  else if (typeCode === 'EB') typeMark = '[EB/OL]';
  else if (typeCode === 'DB') typeMark = '[DB/OL]';

  citation += typeMark;

  // Type specific formatting
  switch (typeCode) {
    case 'M': // Monograph
    case 'C': // Collection
    case 'D': // Thesis
    case 'R': // Report
      citation += dot;
      if (ref.location) citation += `${ref.location}${colon}`;
      if (ref.publisher) citation += `${ref.publisher}${comma}`;
      if (ref.year) citation += `${ref.year}`;
      break;

    case 'A': // Article in Collection
      citation += dot;
      // In...
      if (lang === 'en') citation += 'In ';
      else citation += '见';
      
      if (ref.editors) citation += `${ref.editors}${dot}`;
      if (ref.collectionTitle) citation += `${ref.collectionTitle}[C]${dot}`;
      if (ref.location) citation += `${ref.location}${colon}`;
      if (ref.publisher) citation += `${ref.publisher}${comma}`;
      if (ref.year) citation += `${ref.year}`;
      break;

    case 'J': // Journal
      citation += dot;
      if (ref.journalName) citation += `${ref.journalName}`;
      // Foreign journal name in italics? HTML rendering needed for true italics.
      // We will return plain text here, italics handled by UI if possible or markdown.
      if (ref.year) citation += `${comma}${ref.year}`;
      if (ref.issue) citation += `(${ref.issue})`;
      break;

    case 'N': // Newspaper
      citation += dot;
      if (ref.newspaperName) citation += `${ref.newspaperName}`;
      if (ref.publishDate) citation += `${comma}${ref.publishDate}`;
      break;

    case 'EB': // Electronic
    case 'DB':
    case 'CP':
      citation += dot;
      if (ref.location) citation += `${ref.location}${colon}`;
      if (ref.publisher) citation += `${ref.publisher}${comma}`;
      if (ref.publishDate) citation += `${ref.publishDate}`;
      if (ref.accessDate) citation += `${dot}[${ref.accessDate}]`;
      if (ref.url) citation += `${dot}${ref.url}`;
      break;

    default:
      citation += dot;
      if (ref.source) citation += ref.source;
      if (ref.year) citation += `${comma}${ref.year}`;
  }

  // End with dot if not present
  if (!citation.endsWith('.') && !citation.endsWith('．')) {
    citation += dot;
  }

  return citation;
};

export const sortReferences = (refs) => {
  return [...refs].sort((a, b) => {
    // 1. Year (Descending - Newest first)
    const yearA = parseInt(a.year) || 0;
    const yearB = parseInt(b.year) || 0;
    
    if (yearA !== yearB) {
      return yearB - yearA;
    }

    // 2. Language: Chinese (zh) first, then English (en)
    const langA = a.language || (isChinese(a.title) ? 'zh' : 'en');
    const langB = b.language || (isChinese(b.title) ? 'zh' : 'en');
    
    if (langA !== langB) {
      return langA === 'zh' ? -1 : 1;
    }

    // 3. Author Name
    const authorA = (a.authors && a.authors[0]) || a.author || '';
    const authorB = (b.authors && b.authors[0]) || b.author || '';

    return authorA.localeCompare(authorB, langA === 'zh' ? 'zh-Hans-CN' : 'en');
  });
};

// ============================================================
// Batch Export Utilities
// ============================================================

// Generate a clean BibTeX key: author2024title
const makeBibKey = (ref) => {
  let authorPart = 'unknown';
  if (ref.authors && ref.authors.length > 0) {
    const first = ref.authors[0];
    // Take surname: last word for English, first char for Chinese
    if (isChinese(first)) {
      authorPart = first.replace(/[,，、\s]/g, '').slice(0, 2);
    } else {
      const parts = first.split(/[\s,]+/).filter(Boolean);
      authorPart = (parts[0] || 'unknown').replace(/[^a-zA-Z]/g, '');
    }
  }
  const yearPart = ref.year || 'nd';
  // First meaningful word of title
  let titlePart = '';
  if (ref.title) {
    const words = ref.title.replace(/[^\w\u4e00-\u9fa5]/g, ' ').split(/\s+/).filter(Boolean);
    titlePart = isChinese(ref.title) ? words[0]?.slice(0, 2) || '' : (words[0] || '').toLowerCase();
  }
  return `${authorPart}${yearPart}${titlePart}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '');
};

// Map typeCode to proper BibTeX entry type
const bibEntryType = (typeCode) => {
  const map = {
    M: 'book', C: 'proceedings', A: 'incollection', J: 'article',
    N: 'article', D: 'phdthesis', R: 'techreport', S: 'misc',
    DB: 'misc', CP: 'misc', EB: 'online', Z: 'misc'
  };
  return map[typeCode] || 'misc';
};

// Format a single reference as proper BibTeX entry
const formatBibTeXEntry = (ref) => {
  const key = makeBibKey(ref);
  const type = bibEntryType(ref.typeCode);
  const lines = [`@${type}{${key},`];

  const add = (field, value) => {
    if (value) lines.push(`  ${field} = {${value}},`);
  };

  add('title', ref.title);
  if (ref.authors && ref.authors.length > 0) {
    add('author', ref.authors.join(' and '));
  }
  add('year', ref.year);

  switch (ref.typeCode) {
    case 'J':
      add('journal', ref.journalName);
      add('number', ref.issue);
      break;
    case 'M': case 'C':
      add('publisher', ref.publisher);
      add('address', ref.location);
      break;
    case 'D':
      add('school', ref.publisher);
      add('address', ref.location);
      break;
    case 'R':
      add('institution', ref.publisher);
      add('address', ref.location);
      break;
    case 'A':
      add('booktitle', ref.collectionTitle);
      add('editor', Array.isArray(ref.editors) ? ref.editors.join(' and ') : ref.editors);
      add('publisher', ref.publisher);
      add('address', ref.location);
      break;
    case 'N':
      add('journal', ref.newspaperName);
      add('note', ref.publishDate);
      break;
    case 'EB': case 'DB': case 'CP':
      add('url', ref.url);
      if (ref.accessDate) add('urldate', ref.accessDate);
      add('publisher', ref.publisher);
      break;
    default:
      add('publisher', ref.publisher);
      if (ref.source) add('note', ref.source);
  }

  if (ref.language === 'zh') add('language', 'chinese');

  lines.push('}');
  return lines.join('\n');
};

// Format a single reference as RIS entry
const formatRISEntry = (ref) => {
  const typeMap = {
    M: 'BOOK', C: 'CONF', A: 'CHAP', J: 'JOUR',
    N: 'NEWS', D: 'THES', R: 'RPRT', S: 'STD',
    DB: 'DATA', CP: 'COMP', EB: 'ELEC', Z: 'GEN'
  };
  const lines = [];
  lines.push(`TY  - ${typeMap[ref.typeCode] || 'GEN'}`);
  if (ref.title) lines.push(`TI  - ${ref.title}`);
  if (ref.authors) {
    ref.authors.forEach(a => lines.push(`AU  - ${a}`));
  }
  if (ref.year) lines.push(`PY  - ${ref.year}`);

  switch (ref.typeCode) {
    case 'J':
      if (ref.journalName) lines.push(`JO  - ${ref.journalName}`);
      if (ref.issue) lines.push(`IS  - ${ref.issue}`);
      break;
    case 'M': case 'C': case 'R':
      if (ref.publisher) lines.push(`PB  - ${ref.publisher}`);
      if (ref.location) lines.push(`CY  - ${ref.location}`);
      break;
    case 'D':
      if (ref.publisher) lines.push(`PB  - ${ref.publisher}`);
      if (ref.location) lines.push(`CY  - ${ref.location}`);
      break;
    case 'A':
      if (ref.collectionTitle) lines.push(`T2  - ${ref.collectionTitle}`);
      if (ref.editors) {
        const eds = Array.isArray(ref.editors) ? ref.editors : [ref.editors];
        eds.forEach(e => lines.push(`ED  - ${e}`));
      }
      if (ref.publisher) lines.push(`PB  - ${ref.publisher}`);
      break;
    case 'N':
      if (ref.newspaperName) lines.push(`JO  - ${ref.newspaperName}`);
      if (ref.publishDate) lines.push(`DA  - ${ref.publishDate}`);
      break;
    case 'EB': case 'DB': case 'CP':
      if (ref.url) lines.push(`UR  - ${ref.url}`);
      if (ref.accessDate) lines.push(`Y2  - ${ref.accessDate}`);
      if (ref.publisher) lines.push(`PB  - ${ref.publisher}`);
      break;
    default:
      if (ref.source) lines.push(`N1  - ${ref.source}`);
  }

  if (ref.language) lines.push(`LA  - ${ref.language === 'zh' ? 'Chinese' : 'English'}`);
  if (ref.tags && ref.tags.length > 0) {
    ref.tags.forEach(t => lines.push(`KW  - ${t}`));
  }
  lines.push('ER  - ');
  return lines.join('\n');
};

/**
 * Batch export references to a downloadable file.
 * @param {Array} refs - array of reference objects
 * @param {'bibtex'|'ris'|'gb7714'|'csv'} format
 */
export const batchExportReferences = (refs, format = 'bibtex') => {
  if (!refs || refs.length === 0) return;

  let content = '';
  let filename = '';
  let mimeType = 'text/plain';

  switch (format) {
    case 'bibtex':
      content = refs.map(r => formatBibTeXEntry(r)).join('\n\n');
      filename = `references_${new Date().toISOString().slice(0, 10)}.bib`;
      break;

    case 'ris':
      content = refs.map(r => formatRISEntry(r)).join('\n\n');
      filename = `references_${new Date().toISOString().slice(0, 10)}.ris`;
      break;

    case 'gb7714':
      content = refs.map((r, i) => `[${i + 1}] ${formatCitation(r, 'GB/T 7714')}`).join('\n');
      filename = `references_${new Date().toISOString().slice(0, 10)}.txt`;
      break;

    case 'csv': {
      const headers = ['title', 'authors', 'year', 'typeCode', 'journalName', 'publisher', 'location', 'url', 'tags', 'language'];
      const escape = (v) => `"${String(v || '').replace(/"/g, '""')}"`;
      const headerRow = headers.map(h => escape(h)).join(',');
      const dataRows = refs.map(r =>
        headers.map(h => {
          const val = r[h];
          if (Array.isArray(val)) return escape(val.join('; '));
          return escape(val);
        }).join(',')
      );
      content = [headerRow, ...dataRows].join('\n');
      filename = `references_${new Date().toISOString().slice(0, 10)}.csv`;
      mimeType = 'text/csv';
      break;
    }
    default:
      return;
  }

  // Trigger download with BOM for UTF-8
  const bom = '\uFEFF';
  const blob = new Blob([bom + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

