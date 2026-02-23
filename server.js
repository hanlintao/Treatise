import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import archiver from 'archiver';
import { PCA } from 'ml-pca';
import { chunkText, generateZhipuEmbedding } from './src/utils/vectorizer.js';

const require = createRequire(import.meta.url);
const WebSocket = require('ws');
const crypto = require('crypto');
const initialKnowledge = require('./src/data/knowledge_init.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Data Directory Configuration ---
// TEMPLATE_DIR: Source of truth for initial data structures (tracked by git)
const TEMPLATE_DIR = path.join(__dirname, 'src/data');
// USER_DATA_DIR: Where user data actually lives (ignored by git)
const USER_DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

// Ensure USER_DATA_DIR exists and populate with defaults if missing
async function initUserData() {
  try {
    await fs.mkdir(USER_DATA_DIR, { recursive: true });
    
    // List of files to check/copy from template
    const templateFiles = await fs.readdir(TEMPLATE_DIR);
    
    for (const file of templateFiles) {
      const srcPath = path.join(TEMPLATE_DIR, file);
      const destPath = path.join(USER_DATA_DIR, file);
      
      try {
        await fs.access(destPath);
      } catch {
        // Destination doesn't exist, copy from template
        const stats = await fs.stat(srcPath);
        if (stats.isDirectory()) {
             await fs.mkdir(destPath, { recursive: true });
             // Recursive copy for directories like research_sessions
             const subFiles = await fs.readdir(srcPath);
             for (const subFile of subFiles) {
                await fs.copyFile(path.join(srcPath, subFile), path.join(destPath, subFile));
             }
        } else {
             await fs.copyFile(srcPath, destPath);
             console.log(`Initialized user data file: ${file}`);
        }
      }
    }
    
    // Special handling for config.json
    const configPath = path.join(USER_DATA_DIR, 'config.json');
    try {
      await fs.access(configPath);
    } catch {
       const exampleConfig = path.join(TEMPLATE_DIR, 'config.example.json');
       try {
         await fs.copyFile(exampleConfig, configPath);
         console.log('Initialized config.json from example');
       } catch (e) { }
    }

  } catch (err) {
    console.error('Error initializing user data directory:', err);
  }
}

// Block until user data is ready
await initUserData();

const app = express();
const PORT = 3001;

// Configure Multer for PDF uploads
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb' }));

const CONTENT_DIR = path.join(__dirname, 'src/content');
// Redirect all data operations to the user data directory
const DATA_DIR = USER_DATA_DIR;
const REFS_FILE = path.join(DATA_DIR, 'references.json');
const KNOWLEDGE_FILE = path.join(DATA_DIR, 'knowledge.json');
const EMBEDDINGS_FILE = path.join(DATA_DIR, 'embeddings.json');
const QUESTIONS_FILE = path.join(DATA_DIR, 'questions.json');
const CHAPTER_NOTES_FILE = path.join(DATA_DIR, 'chapter_notes.json');
const HIGHLIGHTS_FILE = path.join(DATA_DIR, 'highlights.json');
const INSPIRATIONS_FILE = path.join(DATA_DIR, 'inspirations.json');
const WEIBO_FILE = path.join(DATA_DIR, 'weibo.json');
const TRANSFERS_FILE = path.join(DATA_DIR, 'transfers.json');
const VOICE_MEMOS_FILE = path.join(DATA_DIR, 'voice_memos.json');
const CHAPTER_META_FILE = path.join(DATA_DIR, 'chapter_meta.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STOP_URLS_FILE = path.join(DATA_DIR, 'stop_urls.json');
const AGENT_HISTORY_FILE = path.join(DATA_DIR, 'agent_history.json');
const RESEARCH_HISTORY_FILE = path.join(DATA_DIR, 'research_history.json');
const RESEARCH_CONCEPTS_FILE = path.join(DATA_DIR, 'research_concepts.json');
const RESEARCH_SESSIONS_DIR = path.join(DATA_DIR, 'research_sessions');
// New structure: public/papers/{refId}/
const PAPERS_DIR = path.join(__dirname, 'public/papers');
const KNOWLEDGE_ASSETS_DIR = path.join(__dirname, 'public/knowledge');

// Ensure directories exist
const ensureDirs = async () => {
  try {
    await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
    await fs.mkdir(PAPERS_DIR, { recursive: true });
    await fs.mkdir(KNOWLEDGE_ASSETS_DIR, { recursive: true });
    await fs.mkdir(RESEARCH_SESSIONS_DIR, { recursive: true });
    console.log('Directories checked/created');
  } catch (e) {
    console.error('Error creating directories:', e);
  }
};
ensureDirs();

// Serve static files for knowledge assets
app.use('/knowledge-assets', express.static(KNOWLEDGE_ASSETS_DIR));
app.use('/papers', express.static(PAPERS_DIR)); // Also serve papers publicly if not already

// Initialize Config
async function initConfig() {
  try {
    await fs.access(CONFIG_FILE);
  } catch {
    console.log('Initializing config...');
    const defaultConfig = {
      logoTitle: 'Treatise',
      paddleApiUrl: '',
      paddleToken: '',
      zhipuApiKey: ''
    };
    await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf-8');
  }
}
initConfig();

// Initialize Knowledge Data
async function initKnowledge() {
  try {
    await fs.access(KNOWLEDGE_FILE);
  } catch {
    console.log('Initializing knowledge data...');
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(initialKnowledge, null, 2), 'utf-8');
  }
}
initKnowledge();

// Initialize Embeddings Data
async function initEmbeddings() {
  try {
    await fs.access(EMBEDDINGS_FILE);
  } catch {
    console.log('Initializing embeddings data...');
    await fs.writeFile(EMBEDDINGS_FILE, JSON.stringify({}, null, 2), 'utf-8');
  }
}
initEmbeddings();

// Initialize Chapter Notes Data
async function initChapterNotes() {
  try {
    await fs.access(CHAPTER_NOTES_FILE);
  } catch {
    console.log('Initializing chapter notes...');
    await fs.writeFile(CHAPTER_NOTES_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initChapterNotes();

// Initialize Highlights Data
async function initHighlights() {
  try {
    await fs.access(HIGHLIGHTS_FILE);
  } catch {
    console.log('Initializing highlights...');
    await fs.writeFile(HIGHLIGHTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initHighlights();

// Initialize Inspirations Data
async function initInspirations() {
  try {
    await fs.access(INSPIRATIONS_FILE);
  } catch {
    console.log('Initializing inspirations...');
    await fs.writeFile(INSPIRATIONS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initInspirations();

// Initialize Weibo Data
async function initWeibo() {
  try {
    await fs.access(WEIBO_FILE);
  } catch {
    console.log('Initializing weibo data...');
    await fs.writeFile(WEIBO_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initWeibo();

// Initialize Voice Memos Data
async function initVoiceMemos() {
  let memos = [];
  try {
    const data = await fs.readFile(VOICE_MEMOS_FILE, 'utf-8');
    memos = JSON.parse(data);
  } catch {
    console.log('Creating voice memos file...');
  }

  // If empty, try to recover from files
  if (memos.length === 0) {
      console.log('Attempting to recover voice memos from files...');
      const audioDir = path.join(__dirname, 'public/assets/audio');
      try {
        const files = await fs.readdir(audioDir);
        let recovered = [];
        for (const file of files) {
             if (file.startsWith('.')) continue;
             const parts = file.split('_');
             const timestamp = parseInt(parts[0]);
             if (!isNaN(timestamp)) {
                 recovered.push({
                     id: timestamp.toString(),
                     url: `/assets/audio/${file}`,
                     text: '(已恢复，需重新转写)', 
                     academicText: '', 
                     created_at: new Date(timestamp).toISOString(),
                     duration: 0
                 });
             }
        }
        if (recovered.length > 0) {
            // Sort by time desc
            recovered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            memos = recovered;
            await fs.writeFile(VOICE_MEMOS_FILE, JSON.stringify(memos, null, 2), 'utf-8');
            console.log(`Recovered ${memos.length} memos.`);
        } else {
             // Just write empty array if it was missing
             if (!await fs.access(VOICE_MEMOS_FILE).then(() => true).catch(() => false)) {
                 await fs.writeFile(VOICE_MEMOS_FILE, JSON.stringify([], null, 2), 'utf-8');
             }
        }
      } catch (e) {
          // audio dir might not exist, ensure file exists
          if (!await fs.access(VOICE_MEMOS_FILE).then(() => true).catch(() => false)) {
             await fs.writeFile(VOICE_MEMOS_FILE, JSON.stringify([], null, 2), 'utf-8');
          }
      }
  }
}
initVoiceMemos();

// Initialize Chapter Meta Data
async function initChapterMeta() {
  try {
    await fs.access(CHAPTER_META_FILE);
  } catch {
    console.log('Initializing chapter meta...');
    try {
        const files = await fs.readdir(CONTENT_DIR);
        const meta = [];
        let order = 0;
        for (const file of files) {
            if (!file.endsWith('.md')) continue;
            const content = await fs.readFile(path.join(CONTENT_DIR, file), 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)$/m);
            const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
            meta.push({
                id: file.replace('.md', ''),
                title: title,
                order: order++,
                status: 'draft',
                synopsis: ''
            });
        }
        await fs.writeFile(CHAPTER_META_FILE, JSON.stringify(meta, null, 2), 'utf-8');
    } catch (e) {
        console.error('Failed to init chapter meta:', e);
    }
  }
}
initChapterMeta();

// Initialize Agent History Data
async function initAgentHistory() {
  try {
    await fs.access(AGENT_HISTORY_FILE);
  } catch {
    console.log('Initializing agent history...');
    await fs.writeFile(AGENT_HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initAgentHistory();

// Initialize Research History Data
async function initResearchHistory() {
  try {
    await fs.access(RESEARCH_HISTORY_FILE);
  } catch {
    console.log('Initializing research history...');
    await fs.writeFile(RESEARCH_HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initResearchHistory();

// Initialize Research Concepts Data
async function initResearchConcepts() {
  try {
    await fs.access(RESEARCH_CONCEPTS_FILE);
  } catch {
    console.log('Initializing research concepts...');
    await fs.writeFile(RESEARCH_CONCEPTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}
initResearchConcepts();

// Task Store (In-Memory)
const tasks = new Map(); // taskId -> { status, progress, total, message, result, error }

// Helper to get file path
const getFilePath = (chapterId) => {
  // Check if it is a reference content request
  if (chapterId.startsWith('ref_')) {
    // It's a reference. We stored it in public/papers/{refId}/content.md
    // Note: chapterId passed here might be 'ref_123' or 'ref_123.md' or similar.
    // The previous frontend implementation passed filename.
    const refId = chapterId.replace('.md', '');
    return path.join(PAPERS_DIR, refId, 'content.md');
  }
  
  // Security: prevent directory traversal
  const safeId = path.basename(chapterId);
  return path.join(CONTENT_DIR, `${safeId}.md`);
};

// --- Dashboard API ---
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // 1. Load basic counts
    const refs = JSON.parse(await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]'));
    const knowledge = JSON.parse(await fs.readFile(KNOWLEDGE_FILE, 'utf-8').catch(() => '[]'));
    const notes = JSON.parse(await fs.readFile(CHAPTER_NOTES_FILE, 'utf-8').catch(() => '[]'));
    const inspirations = JSON.parse(await fs.readFile(INSPIRATIONS_FILE, 'utf-8').catch(() => '[]'));
    const weibo = JSON.parse(await fs.readFile(WEIBO_FILE, 'utf-8').catch(() => '[]'));
    const chapters = await fs.readdir(CONTENT_DIR).then(files => files.filter(f => f.endsWith('.md')));
    
    // 2. Load Research Sessions
    let researchSessions = [];
    try {
       const sessionFiles = await fs.readdir(RESEARCH_SESSIONS_DIR);
       for (const file of sessionFiles) {
           if (!file.endsWith('.json')) continue;
           const content = await fs.readFile(path.join(RESEARCH_SESSIONS_DIR, file), 'utf-8');
           researchSessions.push(JSON.parse(content));
       }
    } catch {}

    // 3. Calculate Trends (Simple Daily Activity across all types)
    // We aggregate create times. Note: different entities have different date fields.
    const activityMap = new Map(); // date string -> count

    const addToTrend = (items, dateField) => {
        items.forEach(item => {
            if (!item[dateField]) return;
            const date = new Date(item[dateField]).toLocaleDateString();
            activityMap.set(date, (activityMap.get(date) || 0) + 1);
        });
    };

    addToTrend(refs, 'created_at');
    addToTrend(inspirations, 'created_at');
    addToTrend(weibo, 'created_at');
    addToTrend(researchSessions, 'createdAt');
    addToTrend(researchSessions, 'updatedAt'); // Also count updates as activity
    
    // Convert map to sorted array (last 14 days)
    const trends = Array.from(activityMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-14);

    // 4. Concepts (Real Logic: Count occurrences in knowledge modules items)
    const conceptCounts = {};
    let totalKnowledgeItems = 0;

    // Helper to count terms/keywords from knowledge modules
    if (Array.isArray(knowledge)) {
        knowledge.forEach(module => {
             if (module.items && Array.isArray(module.items)) {
                 totalKnowledgeItems += module.items.length;
                 module.items.forEach(item => {
                     if (item.term) {
                         conceptCounts[item.term] = (conceptCounts[item.term] || 0) + 1;
                     }
                 });
             }
        });
    }

    // Convert to sorted array
    let concepts = Object.entries(conceptCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    // Filter out low frequency if needed, or keep all
    if (concepts.length === 0) {
        // Fallback: Try reading from RESEARCH_CONCEPTS_FILE if defined and present
        try {
             // If we really have no knowledge, check if we have research concepts defined manually
             // But do NOT return fake "Machine Translation" data if the user has nothing.
             const fileContent = await fs.readFile(RESEARCH_CONCEPTS_FILE, 'utf-8');
             const fileConcepts = JSON.parse(fileContent);
             if (Array.isArray(fileConcepts) && fileConcepts.length > 0) {
                 concepts = fileConcepts;
             }
        } catch (e) {
            // Ignore error if file doesn't exist
        }
    }

    res.json({
        counts: {
            references: refs.length,
            knowledge: totalKnowledgeItems, // Count actual items, not modules
            chapters: chapters.length,
            notes: notes.length,
            inspirations: inspirations.length,
            weibo: weibo.length,
            researchSessions: researchSessions.length
        },
        trends: {
            activity: trends,
            concepts: concepts
        },
        recentResearch: researchSessions
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            .slice(0, 5)
            .map(s => ({ title: s.title, updatedAt: s.updatedAt }))
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({ error: 'Failed to generate stats' });
  }
});

// --- Backup API ---
app.get('/api/backup/export', async (req, res) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.zip`;

    res.attachment(filename);

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Backup warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(res);

    // Append directories
    archive.directory(path.join(__dirname, 'src/data'), 'data');
    archive.directory(path.join(__dirname, 'src/content'), 'content');
    archive.directory(path.join(__dirname, 'public'), 'public');
    
    // Include pending uploads and auxiliary scripts
    archive.directory(path.join(__dirname, 'uploads'), 'uploads');
    archive.directory(path.join(__dirname, 'src/scripts'), 'src/scripts');
    
    // Include version info
    archive.file(path.join(__dirname, 'package.json'), { name: 'package.json' });

    await archive.finalize();
  } catch (e) {
    console.error('Backup error:', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Backup failed' });
    }
  }
});

// --- Config API ---
app.get('/api/config', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load config' });
  }
});

app.post('/api/config', async (req, res) => {
  try {
    const config = req.body;
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// --- Knowledge System API ---

// Get all knowledge modules
app.get('/api/knowledge', async (req, res) => {
  try {
    const data = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load knowledge data' });
  }
});

// Update entire knowledge system (Simplicity for now)
app.post('/api/knowledge', async (req, res) => {
  try {
    const data = req.body;
    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save knowledge data' });
  }
});

// Auto-associate Knowledge Items using DeepSeek
app.post('/api/magic/knowledge-relation', async (req, res) => {
  const { targetId, allItems, apiKey } = req.body;
  
  if (!targetId || !allItems || !apiKey) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  const targetItem = allItems.find(i => i.id === targetId);
  if (!targetItem) return res.status(404).json({ error: 'Target item not found' });

  // Filter out self and already related items? 
  // Let's just send a subset or simplified list to save tokens.
  // We send: id, term, definition
  const candidates = allItems
    .filter(i => i.id !== targetId)
    .map(i => ({ id: i.id, term: i.term, definition: i.definition }));

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a knowledge graph assistant. 
Analyze the relationship between the Target Concept and the Candidate Concepts.
Return a JSON array of related concepts.
Format: [{ "targetId": "candidate_id", "score": 0.1-1.0, "reason": "short explanation" }]
Only return relations with score > 0.4.
Limit to top 5 strongest relations.
Output raw JSON only.`
          },
          {
            role: "user",
            content: `Target Concept: ${JSON.stringify({ term: targetItem.term, definition: targetItem.definition })}
            
Candidates: ${JSON.stringify(candidates)}`
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let relations;
    try {
      relations = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
    }

    // Update Knowledge File
    const knowledgeData = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    let modules = JSON.parse(knowledgeData);
    
    // Find item and update relations
    let updatedItem = null;
    for (const mod of modules) {
      const item = mod.items.find(i => i.id === targetId);
      if (item) {
        if (!item.relations) item.relations = [];
        // Merge new relations
        for (const rel of relations) {
           const existingIdx = item.relations.findIndex(r => r.targetId === rel.targetId);
           if (existingIdx !== -1) {
             item.relations[existingIdx] = { ...item.relations[existingIdx], ...rel, type: 'auto' };
           } else {
             item.relations.push({ ...rel, type: 'auto' });
           }
        }
        updatedItem = item;
        break;
      }
    }

    if (updatedItem) {
      await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(modules, null, 2), 'utf-8');
      res.json({ success: true, relations: updatedItem.relations });
    } else {
      res.status(404).json({ error: 'Item not found in storage' });
    }

  } catch (e) {
    console.error('Auto-relation error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add Image to Knowledge Item
app.post('/api/knowledge/:id/images', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Directory: public/knowledge/{id}/images/
  const imgDir = path.join(KNOWLEDGE_ASSETS_DIR, id, 'images');
  const filename = `${Date.now()}_${fixUtf8(req.file.originalname)}`;
  const targetPath = path.join(imgDir, filename);
  
  try {
    await fs.mkdir(imgDir, { recursive: true });
    await fs.copyFile(req.file.path, targetPath);
    await fs.unlink(req.file.path);
    
    const publicUrl = `/knowledge-assets/${id}/images/${filename}`;
    res.json({ success: true, url: publicUrl });
  } catch (e) {
    console.error('Knowledge image upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Add Attachment to Knowledge Item
app.post('/api/knowledge/:id/attachments', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Directory: public/knowledge/{id}/attachments/
  const attachDir = path.join(KNOWLEDGE_ASSETS_DIR, id, 'attachments');
  const filename = fixUtf8(req.file.originalname); // Keep original name if possible
  const targetPath = path.join(attachDir, filename);
  
  try {
    await fs.mkdir(attachDir, { recursive: true });
    await fs.copyFile(req.file.path, targetPath);
    await fs.unlink(req.file.path);
    
    const publicUrl = `/knowledge-assets/${id}/attachments/${filename}`;
    res.json({ success: true, url: publicUrl, filename: filename });
  } catch (e) {
    console.error('Knowledge attachment upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// --- Highlights API ---

// Get Highlights
app.get('/api/highlights', async (req, res) => {
  try {
    const data = await fs.readFile(HIGHLIGHTS_FILE, 'utf-8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch highlights' });
  }
});

// Add Highlight
app.post('/api/highlights', async (req, res) => {
  const { refId, text, comment, color, refTitle } = req.body;
  
  if (!text || !refId) return res.status(400).json({ error: 'Text and RefId required' });

  try {
    const data = await fs.readFile(HIGHLIGHTS_FILE, 'utf-8').catch(() => '[]');
    const highlights = JSON.parse(data);
    
    const newHighlight = {
      id: Date.now().toString(),
      refId,
      refTitle, // Optional: Store source title for easier display
      text,
      comment: comment || '',
      color: color || 'yellow',
      created_at: new Date().toISOString()
    };
    
    highlights.push(newHighlight);
    await fs.writeFile(HIGHLIGHTS_FILE, JSON.stringify(highlights, null, 2), 'utf-8');
    res.json({ success: true, highlight: newHighlight });
  } catch (e) {
    console.error('Save highlight error:', e);
    res.status(500).json({ error: 'Failed to save highlight' });
  }
});

// Delete Highlight
app.delete('/api/highlights/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(HIGHLIGHTS_FILE, 'utf-8').catch(() => '[]');
    let highlights = JSON.parse(data);
    highlights = highlights.filter(h => h.id !== id);
    await fs.writeFile(HIGHLIGHTS_FILE, JSON.stringify(highlights, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete highlight' });
  }
});

// --- Chapters API ---

// Create new chapter
app.post('/api/chapters', async (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  // Generate safe filename from title
  const safeTitle = title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').toLowerCase();
  const id = `${Date.now()}_${safeTitle}`;
  const filename = `${id}.md`;
  const filePath = path.join(CONTENT_DIR, filename);
  
  const initialContent = `# ${title}\n\n在此处开始写作...`;

  try {
    await fs.writeFile(filePath, initialContent, 'utf-8');
    
    // Update Meta
    const metaData = await fs.readFile(CHAPTER_META_FILE, 'utf-8').catch(() => '[]');
    const meta = JSON.parse(metaData);
    const maxOrder = meta.reduce((max, item) => Math.max(max, item.order || 0), -1);
    
    const newChapter = {
        id: id,
        title: title,
        order: maxOrder + 1,
        status: 'draft',
        synopsis: ''
    };
    meta.push(newChapter);
    await fs.writeFile(CHAPTER_META_FILE, JSON.stringify(meta, null, 2), 'utf-8');

    res.json({ success: true, id: id, title: title });
  } catch (e) {
    console.error('Create chapter error:', e);
    res.status(500).json({ error: 'Failed to create chapter' });
  }
});

// Get all chapters (list)
app.get('/api/chapters', async (req, res) => {
  try {
    const metaData = await fs.readFile(CHAPTER_META_FILE, 'utf-8').catch(() => '[]');
    let chapters = JSON.parse(metaData);
    
    // Sort by order
    chapters.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    // Append path for frontend compatibility
    chapters = chapters.map(c => ({
        ...c,
        path: `/chapter/${c.id}`
    }));
    
    res.json(chapters);
  } catch (e) {
    console.error('Error in GET /api/chapters:', e);
    res.status(500).json({ error: 'Failed to list chapters' });
  }
});

// Reorder Chapters
app.post('/api/chapters/reorder', async (req, res) => {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'Invalid data' });

    try {
        const metaData = await fs.readFile(CHAPTER_META_FILE, 'utf-8').catch(() => '[]');
        let chapters = JSON.parse(metaData);
        
        // Update orders
        chapters.forEach(c => {
            const newIndex = orderedIds.indexOf(c.id);
            if (newIndex !== -1) {
                c.order = newIndex;
            }
        });
        
        await fs.writeFile(CHAPTER_META_FILE, JSON.stringify(chapters, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to reorder' });
    }
});

// Update Chapter Metadata (Rename, Status, Synopsis)
app.patch('/api/chapters/:id', async (req, res) => {
    const { id } = req.params;
    const { title, status, synopsis } = req.body;
    
    try {
        const metaData = await fs.readFile(CHAPTER_META_FILE, 'utf-8').catch(() => '[]');
        let chapters = JSON.parse(metaData);
        
        const index = chapters.findIndex(c => c.id === id);
        if (index === -1) return res.status(404).json({ error: 'Chapter not found' });
        
        // If title changed, update file content H1 too
        if (title && title !== chapters[index].title) {
            const filePath = path.join(CONTENT_DIR, `${id}.md`);
            try {
                let content = await fs.readFile(filePath, 'utf-8');
                // Replace first H1
                content = content.replace(/^#\s+(.+)$/m, `# ${title}`);
                await fs.writeFile(filePath, content, 'utf-8');
            } catch (err) {
                console.error('Failed to update file title:', err);
                // Continue updating meta anyway? Yes.
            }
        }
        
        if (title) chapters[index].title = title;
        if (status) chapters[index].status = status;
        if (synopsis !== undefined) chapters[index].synopsis = synopsis;
        
        await fs.writeFile(CHAPTER_META_FILE, JSON.stringify(chapters, null, 2), 'utf-8');
        res.json({ success: true, chapter: chapters[index] });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update chapter' });
    }
});

// Delete Chapter
app.delete('/api/chapters/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Remove from meta
        const metaData = await fs.readFile(CHAPTER_META_FILE, 'utf-8').catch(() => '[]');
        let chapters = JSON.parse(metaData);
        chapters = chapters.filter(c => c.id !== id);
        await fs.writeFile(CHAPTER_META_FILE, JSON.stringify(chapters, null, 2), 'utf-8');
        
        // 2. Remove file
        const filePath = path.join(CONTENT_DIR, `${id}.md`);
        await fs.unlink(filePath).catch(err => {
            console.warn('File delete warning:', err.message); // Ignore if file not found
        });
        
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete chapter' });
    }
});

// Get chapter content
app.get('/api/chapters/:id', async (req, res) => {
  try {
    const filePath = getFilePath(req.params.id);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Chapter not found' });
    } else {
      console.error('Error reading file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Save chapter content
app.post('/api/chapters/:id', async (req, res) => {
  try {
    const filePath = getFilePath(req.params.id);
    const { content } = req.body;
    
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }

    await fs.writeFile(filePath, content, 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error writing file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- References API ---

// Helper to update reference in JSON
const updateReference = async (refId, updater) => {
  const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
  let references = JSON.parse(referencesData);
  const index = references.findIndex(r => r.id === refId);
  
  if (index === -1) return false;
  
  const updatedRef = updater(references[index]);
  if (updatedRef) {
    references[index] = updatedRef;
  }
  
  await fs.writeFile(REFS_FILE, JSON.stringify(references, null, 2), 'utf-8');
  return references[index];
};

// Start OCR Task (Reusable)
const startOcrTask = (taskId, sourcePath, outputMdPath, outputImgDir, imgUrlPrefix, onComplete) => {
  // Python script path
  const scriptPath = path.join(__dirname, 'src/scripts/ocr_converter.py');
  const pythonPath = path.join(__dirname, '.venv/bin/python');

  // Initialize Task
  tasks.set(taskId, {
    status: 'processing',
    progress: 0,
    total: 0,
    message: 'Starting OCR process...',
    startTime: Date.now()
  });

  // Spawn Python Process
  const pythonProcess = spawn(pythonPath, [scriptPath, sourcePath, outputMdPath, outputImgDir, imgUrlPrefix]);

  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'progress') {
          const task = tasks.get(taskId);
          if (task) {
            task.progress = msg.current;
            task.total = msg.total;
            task.status = msg.status;
            task.message = msg.message;
          }
        } else if (msg.type === 'complete') {
          const task = tasks.get(taskId);
          if (task) {
            task.status = 'completed';
            task.progress = task.total;
            task.message = 'Conversion complete';
            task.result = msg;
          }
          if (onComplete) onComplete(msg);
        } else if (msg.type === 'error') {
           const task = tasks.get(taskId);
           if (task) {
             task.status = 'error';
             task.error = msg.message;
           }
        }
      } catch (e) {
        console.log('Python output (raw):', line);
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`OCR Stderr (${taskId}): ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      const task = tasks.get(taskId);
      if (task && task.status !== 'completed') {
        task.status = 'error';
        task.error = `Process exited with code ${code}`;
      }
    }
  });
};

// Get all references
app.get('/api/references', async (req, res) => {
  try {
    const data = await fs.readFile(REFS_FILE, 'utf-8');
    const references = JSON.parse(data);

    // Enrich with vectorization status
    const enriched = await Promise.all(references.map(async (ref) => {
      // Check main ref folder
      const vectorPath = path.join(PAPERS_DIR, ref.id, 'vectors.json');
      let hasVectors = false;
      try {
        await fs.access(vectorPath);
        hasVectors = true;
      } catch {}

      // If main ref doesn't have it, maybe it is an attachment?
      // But currently vectorizer uses ref.id directly.
      
      return { ...ref, hasVectors };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error reading references:', error);
    // If file doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      res.json([]);
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Save all references (Full update for simplicity)
app.post('/api/references', async (req, res) => {
  try {
    const references = req.body;
    if (!Array.isArray(references)) {
      return res.status(400).json({ error: 'References must be an array' });
    }
    await fs.writeFile(REFS_FILE, JSON.stringify(references, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving references:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete Reference
app.delete('/api/references/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    let references = JSON.parse(data);
    references = references.filter(r => r.id !== id);
    await fs.writeFile(REFS_FILE, JSON.stringify(references, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete reference' });
  }
});

// Upload Image
app.post('/api/upload-image', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Use a general assets directory: public/assets/images/
  const imgDir = path.join(__dirname, 'public/assets/images');
  const filename = `${Date.now()}_${fixUtf8(req.file.originalname)}`;
  const targetPath = path.join(imgDir, filename);

  try {
    await fs.mkdir(imgDir, { recursive: true });
    await fs.copyFile(req.file.path, targetPath);
    await fs.unlink(req.file.path);

    const publicUrl = `/assets/images/${filename}`;
    res.json({ success: true, url: publicUrl });
  } catch (e) {
    console.error('Image upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Serve assets
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));

// Add Note to Reference
app.post('/api/references/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    const data = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    const refs = JSON.parse(data);
    const refIndex = refs.findIndex(r => r.id === id);
    
    if (refIndex === -1) return res.status(404).json({ error: 'Reference not found' });
    
    if (!refs[refIndex].notes) refs[refIndex].notes = [];
    
    const newNote = {
      id: Date.now().toString(),
      content,
      created_at: new Date().toISOString()
    };
    
    refs[refIndex].notes.push(newNote);
    
    await fs.writeFile(REFS_FILE, JSON.stringify(refs, null, 2), 'utf-8');
    res.json({ success: true, notes: refs[refIndex].notes });
  } catch (e) {
    console.error('Error saving ref note:', e);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// Delete Note
app.delete('/api/references/:id/notes/:noteId', async (req, res) => {
  const { id, noteId } = req.params;
  
  const updatedRef = await updateReference(id, (ref) => {
    if (!ref.notes) return ref;
    ref.notes = ref.notes.filter(n => n.id !== noteId);
    return ref;
  });

  if (!updatedRef) return res.status(404).json({ error: 'Reference not found' });
  res.json({ success: true, reference: updatedRef });
});

// Add Attachment to Reference
app.post('/api/references/:id/attachments', upload.single('file'), async (req, res) => {
  const refId = req.params.id;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  // Fix encoding
  const originalFilename = fixUtf8(req.file.originalname);

  const attachmentId = `att_${Date.now()}`;
  // Structure: public/papers/{refId}/attachments/{attachmentId}/
  const attachDir = path.join(PAPERS_DIR, refId, 'attachments', attachmentId);
  const sourcePath = path.join(attachDir, originalFilename);
  
  try {
    await fs.mkdir(attachDir, { recursive: true });
    await fs.copyFile(req.file.path, sourcePath);
    await fs.unlink(req.file.path);
  } catch (e) {
    console.error('Attachment file error:', e);
    return res.status(500).json({ error: 'File save failed' });
  }

  const isPdf = req.file.mimetype === 'application/pdf' || originalFilename.toLowerCase().endsWith('.pdf');
  const taskId = isPdf ? attachmentId : null;

  // Update Reference
  await updateReference(refId, (ref) => {
    if (!ref.attachments) ref.attachments = [];
    ref.attachments.push({
      id: attachmentId,
      filename: originalFilename,
      type: isPdf ? 'pdf' : 'file',
      path: `/papers/${refId}/attachments/${attachmentId}/${originalFilename}`,
      created_at: new Date().toISOString(),
      conversionStatus: isPdf ? 'processing' : 'none',
      taskId: taskId
    });
    return ref;
  });

  if (isPdf) {
    // Start OCR
    const mdPath = path.join(attachDir, 'content.md');
    const imgDir = path.join(attachDir, 'images');
    const imgUrlPrefix = `/papers/${refId}/attachments/${attachmentId}/images/`;

    startOcrTask(taskId, sourcePath, mdPath, imgDir, imgUrlPrefix, async (result) => {
      // On complete, update reference attachment status
      await updateReference(refId, (ref) => {
        const att = ref.attachments.find(a => a.id === attachmentId);
        if (att) {
          att.conversionStatus = 'completed';
          att.contentPath = `/papers/${refId}/attachments/${attachmentId}/content.md`;
        }
        return ref;
      });
    });
  }

  res.json({ success: true, taskId, attachmentId });
});

// Delete Attachment
app.delete('/api/references/:id/attachments/:attId', async (req, res) => {
  const { id, attId } = req.params;

  const updatedRef = await updateReference(id, (ref) => {
    if (!ref.attachments) return ref;
    ref.attachments = ref.attachments.filter(a => a.id !== attId);
    return ref;
  });

  // Optional: Delete file from disk (skipped for safety/simplicity in this step)

  if (!updatedRef) return res.status(404).json({ error: 'Reference not found' });
  res.json({ success: true, reference: updatedRef });
});

// Get Attachment Content (Proxy/Helper)
app.get('/api/references/:id/attachments/:attId/content', async (req, res) => {
  const { id, attId } = req.params;
  const contentPath = path.join(PAPERS_DIR, id, 'attachments', attId, 'content.md');
  
  try {
    const content = await fs.readFile(contentPath, 'utf-8');
    res.json({ content });
  } catch (e) {
    res.status(404).json({ error: 'Content not found' });
  }
});

// Get Reference Content
app.get('/api/references/content/:filename', async (req, res) => {
  try {
    const filename = req.params.filename; // e.g., ref_123456
    const refId = filename.replace('.md', '');
    const filePath = path.join(PAPERS_DIR, refId, 'content.md');
    
    const content = await fs.readFile(filePath, 'utf-8');
    res.json({ content });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Content not found' });
    } else {
      console.error('Error reading ref content:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// --- Search API ---

// --- Notes API ---

// Get Aggregated Notes
app.get('/api/notes', async (req, res) => {
  try {
    const allNotes = [];

    // 1. Get Chapter Notes
    const chapterNotesData = await fs.readFile(CHAPTER_NOTES_FILE, 'utf-8').catch(() => '[]');
    const chapterNotes = JSON.parse(chapterNotesData);
    // Enrich with chapter titles if possible?
    // We need chapter list
    const chapterFiles = await fs.readdir(CONTENT_DIR);
    const chaptersMap = {};
    for (const file of chapterFiles) {
      if (file.endsWith('.md')) {
        const content = await fs.readFile(path.join(CONTENT_DIR, file), 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
        chaptersMap[file.replace('.md', '')] = title;
      }
    }

    chapterNotes.forEach(cn => {
      allNotes.push({
        id: cn.id,
        content: cn.content,
        created_at: cn.created_at,
        sourceType: 'chapter',
        sourceId: cn.chapterId,
        sourceTitle: chaptersMap[cn.chapterId] || cn.chapterId,
        path: `/chapter/${cn.chapterId}`
      });
    });

    // 2. Get Reference Notes
    const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    const references = JSON.parse(referencesData);
    references.forEach(ref => {
      if (ref.notes && ref.notes.length > 0) {
        ref.notes.forEach(note => {
          allNotes.push({
            id: note.id,
            content: note.content,
            created_at: note.created_at,
            sourceType: 'reference',
            sourceId: ref.id,
            sourceTitle: ref.title,
            path: `/questions?refId=${ref.id}`
          });
        });
      }
    });

    // 3. Get Knowledge Notes
    const knowledgeData = await fs.readFile(KNOWLEDGE_FILE, 'utf-8').catch(() => '[]');
    const modules = JSON.parse(knowledgeData);
    modules.forEach(mod => {
      mod.items.forEach(item => {
        if (item.notes && item.notes.length > 0) {
          item.notes.forEach(note => {
            allNotes.push({
              id: note.id,
              content: note.content,
              created_at: note.created_at,
              sourceType: 'knowledge',
              sourceId: item.id,
              sourceTitle: item.term,
              path: `/knowledge?itemId=${item.id}`
            });
          });
        }
      });
    });

    // Sort by created_at desc
    allNotes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(allNotes);
  } catch (e) {
    console.error('Error fetching notes:', e);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Get Chapter Notes
app.get('/api/chapters/:id/notes', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(CHAPTER_NOTES_FILE, 'utf-8').catch(() => '[]');
    const allNotes = JSON.parse(data);
    const chapterNotes = allNotes.filter(n => n.chapterId === id);
    res.json(chapterNotes);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch chapter notes' });
  }
});

// Add Chapter Note
app.post('/api/chapters/:id/notes', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    const data = await fs.readFile(CHAPTER_NOTES_FILE, 'utf-8').catch(() => '[]');
    const allNotes = JSON.parse(data);
    
    const newNote = {
      id: Date.now().toString(),
      chapterId: id,
      content,
      created_at: new Date().toISOString()
    };
    
    allNotes.push(newNote);
    await fs.writeFile(CHAPTER_NOTES_FILE, JSON.stringify(allNotes, null, 2), 'utf-8');
    
    // Return all notes for this chapter
    const chapterNotes = allNotes.filter(n => n.chapterId === id);
    res.json({ success: true, notes: chapterNotes });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save note' });
  }
});

// Delete Chapter Note
app.delete('/api/chapters/:id/notes/:noteId', async (req, res) => {
  const { id, noteId } = req.params;
  try {
    const data = await fs.readFile(CHAPTER_NOTES_FILE, 'utf-8').catch(() => '[]');
    let allNotes = JSON.parse(data);
    
    allNotes = allNotes.filter(n => n.id !== noteId);
    await fs.writeFile(CHAPTER_NOTES_FILE, JSON.stringify(allNotes, null, 2), 'utf-8');
    
    const chapterNotes = allNotes.filter(n => n.chapterId === id);
    res.json({ success: true, notes: chapterNotes });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.length < 2) {
    return res.json([]);
  }

  const results = [];
  const lowerQuery = query.toLowerCase();

  try {
    // 1. Search Chapters
    const chapterFiles = await fs.readdir(CONTENT_DIR);
    for (const file of chapterFiles) {
      if (!file.endsWith('.md')) continue;
      
      const filePath = path.join(CONTENT_DIR, file);
      // Skip if directory (e.g. references dir if it exists inside content)
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) continue;

      const content = await fs.readFile(filePath, 'utf-8');
      const lowerContent = content.toLowerCase();
      
      const matchIndex = lowerContent.indexOf(lowerQuery);
      if (matchIndex !== -1) {
        // Find title (first line starting with #)
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : file.replace('.md', '');
        
        // Extract snippet
        const start = Math.max(0, matchIndex - 500);
        const end = Math.min(content.length, matchIndex + query.length + 500);
        const snippet = content.substring(start, end);

        results.push({
          type: 'chapter',
          id: file.replace('.md', ''),
          title: title,
          snippet: snippet,
          path: `/chapter/${file.replace('.md', '')}`
        });
      }
    }

    // 2. Search References
    const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    const references = JSON.parse(referencesData);

    for (const ref of references) {
      let matched = false;
      let snippet = '';

      // A. Check Metadata
      const metadataText = `${ref.title || ''} ${ref.author || ''} ${ref.source || ''} ${ref.year || ''}`;
      const metaMatchIndex = metadataText.toLowerCase().indexOf(lowerQuery);
      
      if (metaMatchIndex !== -1) {
        matched = true;
        snippet = `[Metadata Match] ...${metadataText}...`;
      }

      // B. Check Content (if pdf-parsed)
      if (!matched && ref.type === 'pdf-parsed' && ref.id) {
        // Look for content in public/papers/{refId}/content.md
        const refContentPath = path.join(PAPERS_DIR, ref.id, 'content.md');
        try {
          const content = await fs.readFile(refContentPath, 'utf-8');
          const lowerContent = content.toLowerCase();
          
          const matchIndex = lowerContent.indexOf(lowerQuery);
          if (matchIndex !== -1) {
             matched = true;
             // Extract snippet
            const start = Math.max(0, matchIndex - 500);
            const end = Math.min(content.length, matchIndex + query.length + 500);
            snippet = content.substring(start, end);
          }
        } catch (e) {
          // Ignore missing files
        }
      }

      if (matched) {
        results.push({
          type: 'reference',
          id: ref.id,
          title: ref.title,
          snippet: snippet,
          path: `/questions?refId=${ref.id}`
        });
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Upload PDF and Convert
app.post('/api/upload-pdf', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const pdfPath = req.file.path;
  const refId = `ref_${Date.now()}`;
  
  // New Structure: public/papers/{refId}/
  const paperDir = path.join(PAPERS_DIR, refId);
  const mdPath = path.join(paperDir, 'content.md');
  const imgDir = path.join(paperDir, 'images');
  const sourcePdfPath = path.join(paperDir, 'source.pdf');
  
  // URL prefix for images: /papers/{refId}/images/
  const imgUrlPrefix = `/papers/${refId}/images/`;

  try {
    await fs.mkdir(paperDir, { recursive: true });
    // Move uploaded file to source.pdf
    await fs.copyFile(pdfPath, sourcePdfPath);
    // Remove temp file
    await fs.unlink(pdfPath);
  } catch (err) {
    console.error('File prep error:', err);
    return res.status(500).json({ error: 'Failed to prepare file storage' });
  }

  // Python script path
  const scriptPath = path.join(__dirname, 'src/scripts/ocr_converter.py');
  
  // Virtual env python path (assuming .venv is in root)
  const pythonPath = path.join(__dirname, '.venv/bin/python');

  // Initialize Task
  tasks.set(refId, {
    status: 'processing',
    progress: 0,
    total: 0,
    message: 'Starting OCR process...',
    startTime: Date.now()
  });

  // Spawn Python Process
  let env = { ...process.env };
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(configData);
    if (config.paddleApiUrl) env.PADDLE_API_URL = config.paddleApiUrl;
    if (config.paddleToken) env.PADDLE_TOKEN = config.paddleToken;
  } catch (e) {
    console.error('Failed to read config for OCR', e);
  }

  const pythonProcess = spawn(pythonPath, [scriptPath, sourcePdfPath, mdPath, imgDir, imgUrlPrefix], { env });

  pythonProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'progress') {
          const task = tasks.get(refId);
          if (task) {
            task.progress = msg.current;
            task.total = msg.total;
            task.status = msg.status;
            task.message = msg.message;
          }
        } else if (msg.type === 'complete') {
          const task = tasks.get(refId);
          if (task) {
            task.status = 'completed';
            task.progress = task.total;
            task.message = 'Conversion complete';
            task.result = msg;
          }
          finalizeReference(refId, req.file.originalname).catch(console.error);
        } else if (msg.type === 'error') {
           const task = tasks.get(refId);
           if (task) {
             task.status = 'error';
             task.error = msg.message;
           }
        }
      } catch (e) {
        console.log('Python output (raw):', line);
      }
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`OCR Stderr (${refId}): ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      const task = tasks.get(refId);
      if (task && task.status !== 'completed') {
        task.status = 'error';
        task.error = `Process exited with code ${code}`;
      }
    }
  });

  // Return Task ID immediately
  res.json({ success: true, taskId: refId });
});

// Check Task Status
app.get('/api/ocr-status/:id', (req, res) => {
  const task = tasks.get(req.params.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
});

// Helper to fix mojibake (UTF-8 interpreted as Latin-1)
const fixUtf8 = (str) => {
  try {
    return Buffer.from(str, 'latin1').toString('utf8');
  } catch {
    return str;
  }
};

async function vectorizePaper(refId, apiKey) {
  if (!apiKey) {
    // Try to get from config
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData);
      apiKey = config.zhipuApiKey;
    } catch (e) {}
  }

  if (!apiKey) {
    console.log(`⚠️ No API key found for vectorizing ${refId}`);
    return false;
  }

  const paperDir = path.join(PAPERS_DIR, refId);
  const vectorsPath = path.join(paperDir, 'vectors.json');

  // Collect all content sources
  const sources = [];

  // 1. Check Root content.md
  const rootMd = path.join(paperDir, 'content.md');
  try {
      const content = await fs.readFile(rootMd, 'utf-8');
      sources.push({ type: 'root', content, id: 'main' });
  } catch {}

  // 2. Check Attachments
  const attachDir = path.join(paperDir, 'attachments');
  try {
      const folders = await fs.readdir(attachDir);
      for (const folder of folders) {
          if (folder.startsWith('.')) continue;
          const attMd = path.join(attachDir, folder, 'content.md');
          try {
              const content = await fs.readFile(attMd, 'utf-8');
              sources.push({ type: 'attachment', content, id: folder });
          } catch {}
      }
  } catch {}

  if (sources.length === 0) {
      console.log(`⚠️ No content found to vectorize for ${refId}`);
      return false;
  }

  try {
    const vectors = [];
    let globalIndex = 0;

    for (const src of sources) {
        console.log(`Processing source ${src.id} for ${refId}...`);
        const chunks = chunkText(src.content);
        console.log(`🧩 Chunking ${refId}/${src.id}: ${chunks.length} chunks`);

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            try {
                const vector = await generateZhipuEmbedding(chunk, apiKey, 2048);
                vectors.push({
                    id: `${refId}_${src.id}_${i}`,
                    text: chunk,
                    vector: vector,
                    metadata: { 
                        refId, 
                        sourceType: src.type,
                        sourceId: src.id,
                        chunkIndex: i
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (e) {
                console.error(`Error embedding chunk ${i} of ${refId}/${src.id}`, e.message);
            }
        }
    }

    if (vectors.length > 0) {
      await fs.writeFile(vectorsPath, JSON.stringify(vectors, null, 2), 'utf-8');
      console.log(`✅ Vectorized ${refId}: ${vectors.length} vectors saved.`);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`Failed to vectorize ${refId}:`, e);
    return false;
  }
}

async function finalizeReference(refId, originalFilename) {
  try {
    // Fix encoding if necessary
    let fixedName = fixUtf8(originalFilename);
    const originalName = fixedName.replace('.pdf', '');
    
    const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    const references = JSON.parse(referencesData);

    const newRef = {
      id: refId,
      title: originalName,
      author: 'OCR Import',
      year: new Date().getFullYear().toString(),
      source: 'PDF Import',
      type: 'pdf-parsed',
      contentPath: `references/${refId}.md`, // Logical path, mapped in getFilePath
      pdfPath: `/papers/${refId}/source.pdf`
    };

    references.push(newRef);
    await fs.writeFile(REFS_FILE, JSON.stringify(references, null, 2), 'utf-8');
    console.log(`Reference ${refId} finalized. Title: ${originalName}`);

    // Trigger Vectorization
    vectorizePaper(refId).catch(err => console.error('Vectorization background task failed:', err));
  } catch (err) {
    console.error('Error finalizing reference:', err);
  }
}

// Manual Vectorization Trigger
app.post('/api/papers/:id/vectorize', async (req, res) => {
  const { id } = req.params;
  const { apiKey } = req.body;
  
  console.log(`Manual vectorization request for ${id}`);
  const result = await vectorizePaper(id, apiKey);
  
  if (result) {
      res.json({ success: true, message: 'Vectorization completed' });
  } else {
      res.status(500).json({ error: 'Vectorization failed (Check API Key or logs)' });
  }
});

// Batch Vectorize All Papers
app.post('/api/papers/vectorize-all', async (req, res) => {
  const { apiKey: providedKey, force = false } = req.body;
  
  console.log('🚀 Starting batch vectorization...');
  
  // Get API Key
  let apiKey = providedKey;
  if (!apiKey) {
     try {
       const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
       const config = JSON.parse(configData);
       apiKey = config.zhipuApiKey;
     } catch (e) {}
  }
  
  if (!apiKey) return res.status(400).json({ error: 'No API Key available (in body or config)' });

  try {
    const papers = await fs.readdir(PAPERS_DIR);
    const results = { success: 0, skipped: 0, failed: 0 };
    
    // Run in background to avoid timeout
    (async () => {
      for (const refId of papers) {
        if (refId.startsWith('.')) continue; // skip .DS_Store etc
        
        try {
          const paperDir = path.join(PAPERS_DIR, refId);
          // Check if it's a directory
          const stat = await fs.stat(paperDir);
          if (!stat.isDirectory()) continue;
          
          const vectorsPath = path.join(paperDir, 'vectors.json');
          
          // Check if already exists
          let exists = false;
          try {
            await fs.access(vectorsPath);
            exists = true;
          } catch {}
          
          if (exists && !force) {
            results.skipped++;
            continue;
          }
          
          console.log(`Processing ${refId}...`);
          const success = await vectorizePaper(refId, apiKey);
          if (success) {
            results.success++;
          } else {
            results.failed++;
          }
          
          // Rate limit protection for batch (Wait 1s between papers)
          await new Promise(r => setTimeout(r, 1000));
          
        } catch (e) {
          console.error(`Error processing ${refId}:`, e.message);
          results.failed++;
        }
      }
      console.log('🏁 Batch vectorization complete:', results);
    })();

    res.json({ message: 'Batch vectorization started in background', totalPapers: papers.length });
    
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Search Papers Vector Store
app.post('/api/search/papers', async (req, res) => {
  const { query, k = 5, apiKey: providedKey } = req.body;
  
  let apiKey = providedKey;
  if (!apiKey) {
     try {
       const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
       const config = JSON.parse(configData);
       apiKey = config.zhipuApiKey;
     } catch (e) {}
  }
  
  if (!apiKey) return res.status(400).json({ error: 'No API Key provided' });

  try {
      const queryVector = await generateZhipuEmbedding(query, apiKey, 2048);
      
      const papers = await fs.readdir(PAPERS_DIR);
      let allChunks = [];
      
      // Load all vectors (simplified)
      for (const refId of papers) {
          const vPath = path.join(PAPERS_DIR, refId, 'vectors.json');
          try {
              const data = await fs.readFile(vPath, 'utf-8');
              const vectors = JSON.parse(data);
              // In memory append
              allChunks.push(...vectors);
          } catch (e) {}
      }
      
      // Calculate similarity
      const results = allChunks.map(chunk => {
           let dot = 0;
           let normA = 0; 
           let normB = 0;
           for(let i=0; i<chunk.vector.length; i++) {
               dot += chunk.vector[i] * queryVector[i];
               normA += chunk.vector[i] * chunk.vector[i];
               normB += queryVector[i] * queryVector[i];
           }
           const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
           return { ...chunk, score, vector: undefined }; 
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
      
      res.json({ results });
      
  } catch (e) {
      console.error('Search error:', e);
      res.status(500).json({ error: e.message });
  }
});

// --- DeepSeek Extraction API ---

// --- Research Concepts API ---

// Get all concepts
app.get('/api/research/concepts', async (req, res) => {
  try {
    const data = await fs.readFile(RESEARCH_CONCEPTS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading research concepts:', error);
    res.status(500).json({ error: 'Failed to read concepts' });
  }
});

// Update all concepts (Full Sync for Drag & Drop / Hierarchy Updates)
app.post('/api/research/concepts', async (req, res) => {
  try {
    const concepts = req.body;
    if (!Array.isArray(concepts)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    await fs.writeFile(RESEARCH_CONCEPTS_FILE, JSON.stringify(concepts, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving research concepts:', error);
    res.status(500).json({ error: 'Failed to save concepts' });
  }
});

// --- RAG & Research API (Session-based) ---

// Helper: read a session file
async function readSession(sessionId) {
  const filePath = path.join(RESEARCH_SESSIONS_DIR, `${sessionId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Helper: write a session file
async function writeSession(sessionId, sessionData) {
  const filePath = path.join(RESEARCH_SESSIONS_DIR, `${sessionId}.json`);
  await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2), 'utf-8');
}

// List all sessions (metadata only)
app.get('/api/research/sessions', async (req, res) => {
  try {
    const files = await fs.readdir(RESEARCH_SESSIONS_DIR);
    const sessions = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = await fs.readFile(path.join(RESEARCH_SESSIONS_DIR, file), 'utf-8');
        const session = JSON.parse(data);
        sessions.push({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: (session.messages || []).length,
        });
      } catch {}
    }
    // Sort by updatedAt descending (most recent first)
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    res.json(sessions);
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Create a new session
app.post('/api/research/sessions', async (req, res) => {
  try {
    const { title } = req.body;
    const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const session = {
      id,
      title: title || '新的研究会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    await writeSession(id, session);
    res.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Get a single session (with messages)
app.get('/api/research/sessions/:id', async (req, res) => {
  try {
    const session = await readSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error) {
    console.error('Error reading session:', error);
    res.status(500).json({ error: 'Failed to read session' });
  }
});

// Update session title
app.put('/api/research/sessions/:id', async (req, res) => {
  try {
    const session = await readSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (req.body.title) session.title = req.body.title;
    session.updatedAt = Date.now();
    await writeSession(req.params.id, session);
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete a session
app.delete('/api/research/sessions/:id', async (req, res) => {
  try {
    const filePath = path.join(RESEARCH_SESSIONS_DIR, `${req.params.id}.json`);
    await fs.unlink(filePath).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Legacy: Get old research history (for migration)
app.get('/api/research/history', async (req, res) => {
  try {
    let history = [];
    try {
      const data = await fs.readFile(RESEARCH_HISTORY_FILE, 'utf-8');
      history = JSON.parse(data);
    } catch {
      // If file doesn't exist, return empty array
    }
    res.json(history);
  } catch (error) {
    console.error('Error reading research history:', error);
    res.status(500).json({ error: 'Failed to read research history' });
  }
});

// Clear research history
app.delete('/api/research/history', async (req, res) => {
  try {
    await fs.writeFile(RESEARCH_HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing research history:', error);
    res.status(500).json({ error: 'Failed to clear research history' });
  }
});

app.post('/api/research/chat', async (req, res) => {
    const { query, history, outputMode, sessionId } = req.body;
    
    // Set up SSE
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    
    const sendStep = (step, detail) => {
        res.write(`data: ${JSON.stringify({ type: 'step', step, detail })}\n\n`);
    };
    
    const sendResult = (data) => {
        res.write(`data: ${JSON.stringify({ type: 'result', data })}\n\n`);
    };
    
    const sendError = (message) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    };
    
    // Get Keys
    let zhipuKey = '';
    let deepseekKey = '';
    
    try {
        const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
        const config = JSON.parse(configData);
        zhipuKey = config.zhipuApiKey;
        deepseekKey = config.deepseekApiKey || config.deepseek_key || ''; 
    } catch {}

    if (!zhipuKey) {
         sendError('Zhipu API Key missing in server config');
         return res.end();
    }
    if (!deepseekKey) {
         sendError('DeepSeek API Key not configured in server (config.json). Please check Magic Manager settings.');
         return res.end();
    }

    try {
        console.log(`🔎 Researching: ${query}`);

        // Save User Message IMMEDIATELY to session (to prevent order issues on frontend sync)
        if (sessionId) {
            try {
                const sessionRaw = await fs.readFile(path.join(RESEARCH_SESSIONS_DIR, `${sessionId}.json`), 'utf-8');
                const session = JSON.parse(sessionRaw);
                
                // Add user message if it's not the last one (avoid duplicates if retrying)
                const lastMsg = session.messages[session.messages.length - 1];
                if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== query) {
                     session.messages.push({
                        role: 'user',
                        content: query,
                        timestamp: Date.now()
                    });
                    // Auto-title
                    if (session.messages.length === 1) {
                         session.title = query.length > 30 ? query.substring(0, 30) + '...' : query;
                    }
                    session.updatedAt = Date.now();
                    await fs.writeFile(path.join(RESEARCH_SESSIONS_DIR, `${sessionId}.json`), JSON.stringify(session, null, 2));
                }
            } catch (e) {
                console.error("Failed to save initial user msg:", e);
            }
        }
        
        // Step 1: Embed Query
        sendStep('embedding', '正在理解您的问题，生成语义向量...');
        const queryVector = await generateZhipuEmbedding(query, zhipuKey, 2048);
        sendStep('embedding_done', '语义向量生成完成');
        
        // Step 2: Search Vectors
        sendStep('searching', '正在检索论文库，扫描所有已收录文献...');
        const papers = await fs.readdir(PAPERS_DIR);
        let allChunks = [];
        let paperCount = 0;
        
        for (const refId of papers) {
            if (refId.startsWith('.')) continue;
            const vPath = path.join(PAPERS_DIR, refId, 'vectors.json');
            try {
                const vectorData = await fs.readFile(vPath, 'utf-8');
                const vectors = JSON.parse(vectorData);
                allChunks.push(...vectors);
                paperCount++;
            } catch {}
        }
        sendStep('searching_done', `检索完成，扫描了 ${paperCount} 篇文献的 ${allChunks.length} 个文本块`);
        
        // Step 3: Ranking
        sendStep('ranking', '正在计算语义相似度，对结果排序...');
        const scored = allChunks.map(chunk => {
            let dot = 0;
            let normA = 0; 
            let normB = 0;
            for(let i=0; i<chunk.vector.length; i++) {
                dot += chunk.vector[i] * queryVector[i];
                normA += chunk.vector[i] * chunk.vector[i];
                normB += queryVector[i] * queryVector[i];
            }
            const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
            return { ...chunk, score, vector: undefined }; 
        });
        
        const topK = scored.sort((a, b) => b.score - a.score).slice(0, 50); // Increase candidate limit for better recall
        
        // Hydrate with Citation Info
        const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
        const references = JSON.parse(referencesData);
        
        const contextSources = topK.map(chunk => {
             const refId = chunk.metadata.refId;
             const ref = references.find(r => r.id === refId);
             let title = chunk.metadata.sourceId || refId;
             
             return {
                 text: chunk.text,
                 metadata: chunk.metadata,
                 reference: ref || { title, id: refId },
                 score: chunk.score
             };
        });
        
        const topScore = contextSources[0]?.score?.toFixed(4) || '0';
        sendStep('ranking_done', `找到 ${contextSources.length} 处高相关文献片段 (最高相似度 ${topScore})`);
        
        // Step 4: Generating Answer
        sendStep('generating', '正在调用 DeepSeek V3 生成深度分析...');
        
        const contextText = contextSources.map((src, i) => 
            `[[Source ${i+1}] Title: ${src.reference.title}]\n${src.text}`
        ).join('\n\n');

        // Build system prompt based on output mode
        const markdownSystemPrompt = `You are an academic research assistant.
Answer the user's question based strictly on the provided context.
Cite sources using [1], [2] format corresponding to the provided sources.
Respond in the same language as the user's question.
Context:\n${contextText}`;

        const jsonRenderSystemPrompt = `You are an academic research assistant.
Answer the user's question based strictly on the provided context.

IMPORTANT: You MUST respond with a valid JSON object in the json-render Spec format.
Do NOT include any text outside the JSON. Do NOT wrap the JSON in markdown code fences.
Output ONLY the raw JSON object.

The JSON has this structure:
{"root": "<root-key>", "elements": { "<key>": { "type": "<ComponentType>", "props": {...}, "children": ["<child-key>"] } } }

Available components:
1. Section { title?: string } - Container. children: element keys.
2. Heading { text: string, level: "1"|"2"|"3" } - Title. No children.
3. Text { content: string } - Paragraph, supports **bold**, *italic*, [N] refs. No children.
4. InsightCard { title: string, content: string, importance?: "high"|"medium"|"low" } - Key insight. No children.
5. KeyPoint { label: string, detail: string } - Key takeaway. No children.
6. Citation { sourceIndex: number, excerpt: string, comment?: string } - IMPORTANT: an inline citation block. sourceIndex is a 1‑based number matching the [Source N] in context below. excerpt should be a SHORT key phrase from that source (one sentence). The frontend will automatically show the full original text from the database and a link to the original paper. You MUST use Citation for every source you reference. No children.
7. ComparisonTable { title?: string, headers: string[], rows: string[][] } - Comparison table. No children.
8. List { items: string[], ordered?: boolean } - List. No children.
9. ActionButton { label: string, actionType: "deep-dive"|"copy"|"bookmark", actionPayload?: string } - Button. No children.
10. Quote { text: string, author?: string } - Blockquote. No children.

Guidelines:
- Root should be a Section containing the full answer
- Use InsightCard for key findings (1-3 per answer)
- **CRITICAL**: Every time you reference information from the context, immediately follow the Text/InsightCard with a Citation element. The Citation lets users trace back to the original paper. Use as many Citation elements as needed (one per source used).
- Use ComparisonTable when comparing concepts
- Use ActionButton with actionType="deep-dive" to suggest 2-3 follow-up questions at the end
- Respond in the same language as the user's question

Context (cite using sourceIndex 1,2,3... each [Source N] corresponds to sourceIndex=N):\n${contextText}`;

        const systemPrompt = outputMode === 'json' ? jsonRenderSystemPrompt : markdownSystemPrompt;

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    ...history.slice(-4).map(h => ({ role: h.role, content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) })), 
                    { role: "user", content: query }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${err}`);
        }
        
        const ansData = await response.json();
        const answer = ansData.choices[0].message.content;
        sendStep('generating_done', '回答生成完成');
        
        // Step 5: Save to session
        sendStep('saving', '正在保存到会话...');
        if (sessionId) {
            try {
                // Fetch latest state (user message already added)
                const sessionRaw = await fs.readFile(path.join(RESEARCH_SESSIONS_DIR, `${sessionId}.json`), 'utf-8');
                const session = JSON.parse(sessionRaw);

                session.messages.push({
                    role: 'assistant',
                    content: answer,
                    sources: contextSources,
                    mode: outputMode || 'markdown',
                    timestamp: Date.now()
                });
                session.updatedAt = Date.now();
                await fs.writeFile(path.join(RESEARCH_SESSIONS_DIR, `${sessionId}.json`), JSON.stringify(session, null, 2));


            } catch (hErr) {
                console.error("Failed to save to session:", hErr);
            }
        }
        
        // Also save to legacy flat history for backward compat
        try {
            const historyData = await fs.readFile(RESEARCH_HISTORY_FILE, 'utf-8').catch(() => '[]');
            const savedHistory = JSON.parse(historyData);
            
            savedHistory.push({
                role: 'user',
                content: query,
                timestamp: Date.now()
            });
            
            savedHistory.push({
                role: 'assistant',
                content: answer,
                sources: contextSources,
                mode: outputMode || 'markdown',
                timestamp: Date.now()
            });
            
            await fs.writeFile(RESEARCH_HISTORY_FILE, JSON.stringify(savedHistory, null, 2), 'utf-8');
        } catch (hErr) {
            console.error("Failed to save research history:", hErr);
        }
        
        // Send final result
        // We know the source code says "sendResult" but we must ensure we adhere to naming conventions.
        res.write(`data: ${JSON.stringify({ type: 'result', data: { answer, sources: contextSources, sessionId } })}\n\n`);
        
        res.end();

    } catch (e) {
        console.error('Research Error:', e);
        sendError(e.message);
        res.end();
    }
});

app.post('/api/magic/extract-refs', async (req, res) => {
  const { text, apiKey } = req.body;
  
  if (!text || !apiKey) {
    return res.status(400).json({ error: 'Missing text or apiKey' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system", 
            content: `You are a bibliographic data extraction assistant. 
Extract references from the provided text. 
Return ONLY a JSON array of objects. No markdown formatting, no code blocks, just raw JSON.

For each reference, strictly extract the following fields based on the content:
- title: The title of the work (book name, article title, etc.)
- authors: Array of strings. Split multiple authors correctly.
- year: Publication year (e.g., "2008").
- typeCode: One of [M, C, A, J, N, D, R, S, DB, CP, EB, Z]. Infer from brackets like [M] or context.
- language: 'zh' for Chinese, 'en' for English.

Type-Specific Fields (Extract if present):
- publisher: Publisher name (for books M, collections C). Look for pattern "Location: Publisher".
- location: Place of publication (for books M, collections C).
- journalName: Name of the journal (for articles J). Look for the name before year/issue.
- issue: Issue number/Volume (e.g., "2008(6)" or "Vol. 32, No. 1").
- newspaperName: Name of the newspaper (for N).
- publishDate: Specific date for newspapers or web (e.g., "2008-3-26").
- collectionTitle: Title of the collection/proceedings (for A).
- editors: Editors of the collection (for A).
- url: URL for electronic resources.
- accessDate: Date accessed for electronic resources.
- source: A fallback string containing the publication source info.

EXAMPLES:

Input: 
[28] 刘军平. 西方翻译理论通史 [M]. 武汉: 武汉大学出版社, 2019.
[1] Baker, M. Corpora in translation studies: An overview and some suggestions for future research[J]. Target, 1995(2):223-243.

Output:
[
  {
    "title": "西方翻译理论通史",
    "authors": ["刘军平"],
    "year": "2019",
    "typeCode": "M",
    "language": "zh",
    "location": "武汉",
    "publisher": "武汉大学出版社",
    "source": "武汉: 武汉大学出版社"
  },
  {
    "title": "Corpora in translation studies: An overview and some suggestions for future research",
    "authors": ["Baker, M."],
    "year": "1995",
    "typeCode": "J",
    "language": "en",
    "journalName": "Target",
    "issue": "1995(2)",
    "source": "Target, 1995(2):223-243"
  }
]

If a field is missing, use empty string.
Detect language based on characters.`
          },
          {
            role: "user",
            content: text
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('DeepSeek API Error:', errText);
      return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    
    // Clean up markdown code blocks if present
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let extractedRefs;
    try {
      extractedRefs = JSON.parse(content);
    } catch (e) {
      console.error('JSON Parse Error:', content);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
    }

    // Merge logic
    const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    let currentRefs = JSON.parse(referencesData);
    let addedCount = 0;

    for (const newRef of extractedRefs) {
      // Simple duplicate check by title
      const exists = currentRefs.some(r => r.title === newRef.title);
      if (!exists) {
        currentRefs.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          ...newRef,
          source: newRef.source || 'AI Extraction',
          created_at: new Date().toISOString()
        });
        addedCount++;
      }
    }

    if (addedCount > 0) {
      // Sort: Chinese first, then English
      // Re-use sorting logic? Backend should just store, frontend sorts? 
      // Let's simple sort here to keep file tidy
      currentRefs.sort((a, b) => {
         const langA = a.language || 'en';
         const langB = b.language || 'en';
         if (langA !== langB) return langA === 'zh' ? -1 : 1;
         return (a.title || '').localeCompare(b.title || '');
      });

      await fs.writeFile(REFS_FILE, JSON.stringify(currentRefs, null, 2), 'utf-8');
    }

    res.json({ success: true, added: addedCount, total: currentRefs.length });

  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Parse Reference (Without Saving)
app.post('/api/magic/parse-ref', async (req, res) => {
  const { text, apiKey } = req.body;
  
  if (!text || !apiKey) return res.status(400).json({ error: 'Missing text or apiKey' });

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system", 
            content: `You are a bibliographic data parser. 
Extract reference metadata from the provided single reference string.
Return ONLY a JSON object (not an array).
Fields: title, authors (array), year, typeCode (M/J/etc), language (zh/en), publisher, location, journalName, issue, newspaperName, publishDate, collectionTitle, editors, url, accessDate, source.
Detect language from characters.
Return raw JSON only.`
          },
          {
            role: "user",
            content: text
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(content);
      // Handle array if AI returns array despite instructions
      if (Array.isArray(result)) result = result[0];
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
    }

    res.json({ success: true, result });

  } catch (error) {
    console.error('Parse ref error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Completion/Polishing API
app.post('/api/magic/completion', async (req, res) => {
  const { text, mode, apiKey } = req.body;
  // mode: 'polish' (润色), 'expand' (扩写), 'translate' (翻译), 'explain' (解释)
  
  if (!text || !apiKey) {
    return res.status(400).json({ error: 'Missing text or apiKey' });
  }

  let prompt = '';
  switch (mode) {
    case 'polish':
      prompt = `You are a professional academic editor. Polish the following text to make it more formal, concise, and academically appropriate for a book on this subject. Keep the meaning unchanged. Language: Same as input.`;
      break;
    case 'expand':
      prompt = `You are an expert in academic research. Expand the following text into a detailed paragraph, adding relevant theoretical context or examples. Keep the academic tone. Language: Chinese.`;
      break;
    case 'explain':
      prompt = `Explain the following concept or text in simple terms, providing a definition and context within translation studies. Language: Chinese.`;
      break;
    default:
      prompt = `Improve the following text.`;
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content: text
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    res.json({ success: true, result });

  } catch (e) {
    console.error('Completion error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Fast Chat with RAG & Streaming (Zhipu Embedding + Vector Search)
app.post('/api/fast-chat', async (req, res) => {
    // 1. Setup Stream
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const { messages, apiKey, useWebSearch, braveKey, model = 'deepseek-chat', sessionId } = req.body;
    
    if (!messages || !apiKey) {
        res.write('Error: Missing inputs');
        res.end();
        return;
    }

    const userQuery = messages[messages.length - 1].content;
    let context = "";

    try {
        // 2. RAG: Zhipu Embedding + Vector Search over paper chunks
        let zhipuKey = '';
        try {
            const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
            const config = JSON.parse(configData);
            zhipuKey = config.zhipuApiKey;
        } catch (e) {}

        if (zhipuKey) {
            try {
                // Generate embedding for user query
                const queryVector = await generateZhipuEmbedding(userQuery, zhipuKey, 2048);
                
                // Load all paper vectors
                const papers = await fs.readdir(PAPERS_DIR);
                let allChunks = [];
                
                for (const refId of papers) {
                    if (refId.startsWith('.')) continue;
                    const vPath = path.join(PAPERS_DIR, refId, 'vectors.json');
                    try {
                        const data = await fs.readFile(vPath, 'utf-8');
                        const vectors = JSON.parse(data);
                        allChunks.push(...vectors);
                    } catch (e) {}
                }
                
                if (allChunks.length > 0) {
                    // Cosine similarity
                    const scored = allChunks.map(chunk => {
                        let dot = 0, normA = 0, normB = 0;
                        for (let i = 0; i < chunk.vector.length; i++) {
                            dot += chunk.vector[i] * queryVector[i];
                            normA += chunk.vector[i] * chunk.vector[i];
                            normB += queryVector[i] * queryVector[i];
                        }
                        const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
                        return { text: chunk.text, refId: chunk.refId, sourceId: chunk.sourceId, score };
                    });
                    
                    const topK = scored.sort((a, b) => b.score - a.score).slice(0, 8);
                    
                    if (topK.length > 0 && topK[0].score > 0.3) {
                        context += "【论文库语义检索结果】(基于向量相似度匹配):\n";
                        topK.forEach((item, i) => {
                            context += `[${i+1}] (相似度: ${item.score.toFixed(3)}) ${item.text.slice(0, 500)}\n\n`;
                        });
                    }
                }
            } catch (e) {
                console.error("Vector RAG Error:", e.message);
            }
        }

        // 3. Knowledge Base keyword fallback
        try {
            const knowledgeRaw = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
            const knowledge = JSON.parse(knowledgeRaw);
            
            const keywords = userQuery.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, ' ').split(/\s+/).filter(k => k.length > 1);
            
            if (keywords.length > 0) {
                 const matched = knowledge.flatMap(m => m.items).filter(item => {
                    const text = (item.term + (item.definition || '')).toLowerCase();
                    return keywords.some(k => text.includes(k.toLowerCase()));
                 }).slice(0, 5);

                 if (matched.length > 0) {
                    context += "【知识库术语匹配】:\n";
                    matched.forEach(t => {
                        context += `- **${t.term}**: ${t.definition || '暂无定义'}\n`;
                    });
                    context += "\n";
                 }
            }
        } catch (e) {
            console.error("Knowledge RAG Error:", e);
        }

        // 4. Web Search (Brave)
        if (useWebSearch && braveKey) {
            try {
                const braveRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(userQuery)}&count=5`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Subscription-Token': braveKey
                    }
                });
                if (braveRes.ok) {
                    const braveData = await braveRes.json();
                    if (braveData.web && braveData.web.results) {
                        context += "【联网搜索结果 (Brave Search)】:\n";
                        braveData.web.results.forEach((r, i) => {
                            context += `${i+1}. [${r.title}](${r.url}): ${r.description}\n`;
                        });
                        context += "\n";
                    }
                }
            } catch (e) {
                console.error("Web Search Error:", e);
            }
        }

        // 5. Construct Prompt
        const systemPrompt = `你是"Treatise"研究平台的智能问答助手。
请基于以下检索到的上下文来回答用户的问题。
如果上下文中有相关内容，请优先引用上下文信息，并标注来源编号（如 [1]、[2]）。
如果上下文不足以回答，可以结合你的通用知识进行补充，但需要注明。
请用 Markdown 格式输出，默认使用中文作答。

${context || '（未检索到相关上下文，请基于通用知识作答）'}`;

        const requestBody = {
            model,
            messages: [
                { role: "system", content: systemPrompt },
                ...messages.slice(-10)
            ],
            stream: true
        };

        // 6. Call DeepSeek (Streaming)
        const aiRes = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!aiRes.ok) {
            const err = await aiRes.text();
            res.write(`Error calling AI: ${err}`);
            res.end();
            return;
        }

        // 7. Stream Response
        const decoder = new TextDecoder();
        let buffer = '';

        for await (const chunk of aiRes.body) {
             const text = decoder.decode(chunk, { stream: true });
             buffer += text;
             
             const lines = buffer.split('\n');
             buffer = lines.pop(); 

             for (const line of lines) {
                 const trimmed = line.trim();
                 if (!trimmed || trimmed === 'data: [DONE]') continue;
                 if (trimmed.startsWith('data: ')) {
                     try {
                         const json = JSON.parse(trimmed.slice(6));
                         const content = json.choices[0]?.delta?.content || '';
                         if (content) {
                             res.write(content);
                         }
                     } catch (e) {
                        // ignore json parse error
                     }
                 }
             }
        }
        res.end();

    } catch (e) {
        console.error("Fast Chat Error:", e);
        res.write("\n[Internal Error]");
        res.end();
    }
});

// Auto-fill Knowledge Item
app.post('/api/magic/knowledge-autofill', async (req, res) => {
  const { term, context, apiKey } = req.body;
  
  if (!term || !apiKey) {
    return res.status(400).json({ error: 'Missing term or apiKey' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an expert in academic research.  
Given a term, provide:
1. A concise academic definition (max 200 chars).
2. A relevant time period (e.g. "1950s", "2012").
3. A sub-module category (e.g. "Neural Networks").
4. Importance (Star Rating): 1 (Core/Foundation) to 5 (Peripheral/Extension).
5. Difficulty (Level): 1 (Hard/Abstract) to 5 (Easy/Introductory).

Return ONLY valid JSON format:
{
  "definition": "...",
  "time": "...",
  "subModule": "...",
  "importance": 3,
  "difficulty": 3
}
Keep the definition academic but clear. Language: Chinese.`
          },
          {
            role: "user",
            content: `Term: ${term}\nContext: ${context || 'General Academic Context'}`
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
    }

    res.json({ success: true, result });
    
  } catch (e) {
    console.error('Autofill error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-Classify Knowledge Items (Importance & Difficulty)
app.post('/api/magic/knowledge-classify', async (req, res) => {
  const { items, apiKey } = req.body;
  
  if (!items || !apiKey) {
    return res.status(400).json({ error: 'Missing items or apiKey' });
  }

  // To save context window, we only send term and definition
  const simplifiedItems = items.map(i => ({ 
    id: i.id, 
    term: i.term, 
    definition: i.definition 
  }));

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an expert in curriculum design.
Analyze the provided knowledge points and assign two attributes to each:
1. **Importance (Star Rating)**: 1 (Core/Foundation) to 5 (Peripheral/Extension).
2. **Difficulty (Level)**: 1 (Hard/Abstract) to 5 (Easy/Introductory).

Return a JSON array of objects:
[
  { "id": "item_id", "importance": 1, "difficulty": 2, "reason": "brief reason" }
]
Output RAW JSON only.`
          },
          {
            role: "user",
            content: JSON.stringify(simplifiedItems)
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    let content = data.choices[0].message.content;
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: content });
    }

    // Update Knowledge File
    const knowledgeData = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    let modules = JSON.parse(knowledgeData);
    
    let updatedCount = 0;
    
    // Create a map for fast lookup
    const resultMap = new Map(result.map(r => [r.id, r]));
    
    modules.forEach(mod => {
      mod.items.forEach(item => {
        if (resultMap.has(item.id)) {
           const update = resultMap.get(item.id);
           item.importance = update.importance;
           item.difficulty = update.difficulty;
           // Optional: store reason? item.classifyReason = update.reason;
           updatedCount++;
        }
      });
    });

    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(modules, null, 2), 'utf-8');
    res.json({ success: true, updated: updatedCount, details: result });

  } catch (e) {
    console.error('Classify error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 🔥 优化后的知识点 Embedding 与力导向聚类 API
// ═══════════════════════════════════════════════════════════════

// 余弦相似度计算
function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 力导向优化函数
// 力导向优化函数 - 增加模块聚类效果
function forceDirectedOptimization(coords, validItems, vectors, iterations = 100) {
  console.log(`🔧 Starting pure-semantic force-directed optimization (${iterations} iterations)...`);
  
  const learningRate = 0.12;
  const repulsionStrength = 0.02;
  const SIMILARITY_THRESHOLD = 0.55; // 降低阈值，捕获更多语义关系
  
  // 预计算相似度边（纯语义，不看模块标签）
  const similarityEdges = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = cosineSimilarity(vectors[i], vectors[j]);
      if (sim > SIMILARITY_THRESHOLD) {
        similarityEdges.push({
          source: i,
          target: j,
          similarity: sim
        });
      }
    }
  }
  
  console.log(`📊 Found ${similarityEdges.length} similarity edges (threshold: ${SIMILARITY_THRESHOLD})`);
  
  // 迭代优化
  for (let iter = 0; iter < iterations; iter++) {
    const forces = coords.map(() => [0, 0, 0]);
    
    // 1. 语义吸引力（相似节点互相吸引，力度与相似度成正比）
    similarityEdges.forEach(edge => {
      const { source, target, similarity } = edge;
      
      const dx = coords[target][0] - coords[source][0];
      const dy = coords[target][1] - coords[source][1];
      const dz = coords[target][2] - coords[source][2];
      
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.01;
      
      // 力度随相似度指数增长，高相似度节点吸引力更强
      const force = Math.pow(similarity - SIMILARITY_THRESHOLD, 0.8) * learningRate;
      
      forces[source][0] += (dx / dist) * force;
      forces[source][1] += (dy / dist) * force;
      forces[source][2] += (dz / dist) * force;
      
      forces[target][0] -= (dx / dist) * force;
      forces[target][1] -= (dy / dist) * force;
      forces[target][2] -= (dz / dist) * force;
    });
    
    // 2. 排斥力（防止节点重叠，保持可辨识）
    for (let i = 0; i < coords.length; i++) {
      for (let j = i + 1; j < coords.length; j++) {
        const dx = coords[j][0] - coords[i][0];
        const dy = coords[j][1] - coords[i][1];
        const dz = coords[j][2] - coords[i][2];
        
        const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 0.01;
        
        if (dist < 8) {
          const force = repulsionStrength / (dist * dist);
          
          forces[i][0] -= (dx / dist) * force;
          forces[i][1] -= (dy / dist) * force;
          forces[i][2] -= (dz / dist) * force;
          
          forces[j][0] += (dx / dist) * force;
          forces[j][1] += (dy / dist) * force;
          forces[j][2] += (dz / dist) * force;
        }
      }
    }
    
    // 3. 更新坐标（带衰减的学习率）
    const decay = 1 - iter / iterations * 0.5; // 逐步减小步幅，稳定收敛
    coords.forEach((coord, idx) => {
      coord[0] += forces[idx][0] * decay;
      coord[1] += forces[idx][1] * decay;
      coord[2] += forces[idx][2] * decay;
    });
    
    if ((iter + 1) % 20 === 0) {
      console.log(`   Iteration ${iter + 1}/${iterations} completed`);
    }
  }
  
  console.log('✅ Pure-semantic force-directed optimization completed');
  return { coords, edges: similarityEdges };
}

app.post('/api/magic/knowledge-embedding', async (req, res) => {
  const { apiKey, forceRefresh } = req.body;
  
  if (!apiKey) return res.status(400).json({ error: 'Missing API Key' });

  try {
    console.log('🧠 Starting knowledge embedding process...');
    
    // 1. 加载知识数据
    const kmData = await fs.readFile(KNOWLEDGE_FILE, 'utf-8');
    const modules = JSON.parse(kmData);
    // 🔥 给每个 item 注入 module 名称（knowledge.json 用 "name" 字段）
    const allItems = modules.flatMap(m => 
      m.items.map(item => ({ ...item, module: m.name }))
    );
    
    console.log(`📚 Loaded ${allItems.length} knowledge items from ${modules.length} modules`);
    
    // 2. 加载已有 Embeddings
    let embeddingsCache = {};
    try {
        embeddingsCache = JSON.parse(await fs.readFile(EMBEDDINGS_FILE, 'utf-8'));
    } catch (e) {}

    // 3. 识别需要 embedding 的项目
    const itemsToProcess = [];
    const textsToProcess = [];
    
    for (const item of allItems) {
        if (forceRefresh || !embeddingsCache[item.id]) {
            itemsToProcess.push(item);
            // 纯语义输入：只用术语和定义，不掺入分类标签，让向量反映真实语义关系
            textsToProcess.push(`${item.term}：${item.definition || ''}`);
        }
    }

    // 4. 调用智谱 AI Embedding API
    if (itemsToProcess.length > 0) {
        console.log(`🔄 Generating embeddings for ${itemsToProcess.length} items...`);
        const BATCH_SIZE = 32; // 智谱 embedding-3 最多支持 64 条/批
        
        for (let i = 0; i < itemsToProcess.length; i += BATCH_SIZE) {
            const batchTexts = textsToProcess.slice(i, i + BATCH_SIZE);
            const batchItems = itemsToProcess.slice(i, i + BATCH_SIZE);
            
            try {
                const response = await fetch('https://open.bigmodel.cn/api/paas/v4/embeddings', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "embedding-3",
                        input: batchTexts,
                        dimensions: 512  // 🔥 512维足够可视化，减少存储和计算
                    })
                });
                
                if (!response.ok) {
                    const err = await response.text();
                    console.error('❌ Zhipu Embedding Error:', err);
                    continue; 
                }
                
                const data = await response.json();
                if (data.data) {
                    data.data.forEach((entry, idx) => {
                         const item = batchItems[idx];
                         embeddingsCache[item.id] = {
                             vector: entry.embedding,
                             updated_at: Date.now()
                         };
                    });
                }
                
                console.log(`   Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(itemsToProcess.length / BATCH_SIZE)} completed`);
            } catch (e) {
                console.error('❌ Embedding batch failed', e);
            }
            await new Promise(r => setTimeout(r, 100)); // Rate limit
        }
        
        await fs.writeFile(EMBEDDINGS_FILE, JSON.stringify(embeddingsCache, null, 2), 'utf-8');
        console.log('✅ Embeddings cached successfully');
    } else {
        console.log('✅ All embeddings already cached');
    }

    // 5. 准备有效数据
    const validItems = [];
    const vectors = [];
    
    allItems.forEach(item => {
        if (embeddingsCache[item.id]?.vector) {
            validItems.push(item);
            vectors.push(embeddingsCache[item.id].vector);
        }
    });
    
    if (vectors.length < 3) {
        console.log('⚠️ Not enough vectors for PCA');
        return res.json({ success: true, points: [], edges: [] });
    }
    
    console.log(`📊 Processing ${vectors.length} valid embeddings...`);
    
    // 6. PCA 降维到 3D
    console.log('🔬 Running PCA dimensionality reduction...');
    const pca = new PCA(vectors);
    const result = pca.predict(vectors, { nComponents: 3 });
    let coords = result.to2DArray();
    
    console.log('✅ PCA reduction completed');
    
    // 7. 力导向优化（核心改进）
    const optimizationResult = forceDirectedOptimization(coords, validItems, vectors, 50);
    coords = optimizationResult.coords;
    const similarityEdges = optimizationResult.edges;
    
    // 8. 构建返回数据（坐标由前端统一缩放，此处不做缩放）
    const points = validItems.map((item, idx) => ({
        id: item.id,
        term: item.term,
        module: item.module || 'Unknown',  // 🔥 使用已注入的 module 字段
        x: coords[idx][0],
        y: coords[idx][1],
        z: coords[idx][2]
    }));
    
    // 转换边的格式（使用 item.id 而不是索引）
    const edges = similarityEdges.map(edge => ({
        source: validItems[edge.source].id,
        target: validItems[edge.target].id,
        similarity: edge.similarity
    }));
    
    console.log(`✅ Generated ${points.length} points and ${edges.length} edges`);
    console.log('🎉 Knowledge embedding process completed successfully');
    
    res.json({ success: true, points, edges });

  } catch (e) {
    console.error('❌ Embedding generation error:', e);
    res.status(500).json({ error: 'Failed to generate embeddings', details: e.message });
  }
});

// Extract Knowledge Points from Text
app.post('/api/magic/extract-knowledge', async (req, res) => {
  const { text, priorityTerms, existingTerms, apiKey } = req.body;
  
  if (!text || !apiKey) {
    return res.status(400).json({ success: false, error: 'Missing text or apiKey' });
  }

  console.log('📥 Extract knowledge request received, text length:', text.length);
  console.log('🎯 Priority terms:', priorityTerms);
  console.log('❌ Existing terms to exclude:', existingTerms ? existingTerms.length : 0);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `你是学术领域的专家，擅长从文本中提取知识点。

${existingTerms && existingTerms.length > 0 ? `❌ **【强制排除】已有知识点**：
以下术语已存在于知识库中，**绝对不要**再次提取：
${existingTerms.slice(0, 30).join('、')}${existingTerms.length > 30 ? '... 等' + existingTerms.length + '个术语' : ''}

⚠️ 排除规则：
1. 不要提取上述任何术语或其同义词
2. 即使文本重点讨论这些概念，也必须跳过
3. 优先提取新的、未列出的知识点

` : ''}${priorityTerms && priorityTerms.length > 0 ? `🎯 **【最高优先级】用户指定关键词**：
用户手动选择了以下关键词，**必须强制优先提取**：
${priorityTerms.map(t => `- ${t}`).join('\n')}

⚠️ 强制要求：
1. 这些关键词必须作为前 ${priorityTerms.length} 个结果返回
2. 即使文本中只简单提及，也要构建完整知识点
3. 提取优先级：优先关键词 > 其他所有内容
4. 可以基于上下文补充定义和时间信息

` : ''}任务：分析用户提供的文本，提取所有重要的知识点。重点关注：
- 翻译技术和理论
- 机器翻译系统和模型
- 自然语言处理概念
- 人工智能和深度学习
- 历史发展和里程碑
- 关键人物及其贡献
- 技术标准和工具

对每个知识点提供：
1. **term**: 概念名称（中文，简洁明确）
2. **definition**: 学术定义（100-200字，中文）
3. **time**: 出现/提出年份（"YYYY年"格式）
   - 如果文本明确提到年份，如"2012年提出"→"2012年"
   - 年份范围取起始年："2000-2010年"→"2000年"
   - 年代取首年："1950年代"→"1950年"
   - 如果文本没有提到具体年份，可以根据上下文合理推断，或留空
   - 允许基于常识填写著名事件的时间（如AlexNet→2012年，Transformer→2017年）
4. **subModule**: 分类（可选，如"机器翻译"、"神经网络"、"翻译理论"）
5. **importance**: 1-5（1=基石/核心, 5=外围/扩展）
6. **difficulty**: 1-5（1=困难/抽象, 5=简单/入门）

重要规则：
- **全面提取**：提取文本中所有值得记录的知识点，不设数量上限
  - 短文本（<100字）：提取 2-5 个核心概念
  - 中等文本（100-500字）：提取 5-15 个知识点
  - 长文本（>500字）：提取 15-50 个知识点
- 时间信息必须准确，如果文中提到年份/年代，务必提取
- 定义要学术严谨、完整
- 包含核心概念、关键技术、重要人物、历史事件等所有有价值的内容
- 宁可多提取，不可遗漏重要知识点
- 必须返回JSON格式

返回格式（只返回JSON，不要其他内容）：
{
  "items": [
    {
      "term": "知识点名称",
      "definition": "定义...",
      "time": "1999年",
      "subModule": "子模块",
      "importance": 3,
      "difficulty": 3
    }
  ]
}`
          },
          {
            role: "user",
            content: `${existingTerms && existingTerms.length > 0 ? `❌ 排除已有术语：${existingTerms.slice(0, 20).join('、')}等\n\n` : ''}${priorityTerms && priorityTerms.length > 0 ? `🎯 **强制优先提取**：${priorityTerms.join('、')}\n\n` : ''}请从以下文本中提取知识点：\n\n${text.substring(0, 8000)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        top_p: 0.9,
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       console.error('❌ DeepSeek API error:', response.status, errText);
       return res.status(response.status).json({ 
         success: false,
         error: `DeepSeek API 返回错误 (${response.status})`, 
         details: errText.substring(0, 200)
       });
    }

    const data = await response.json();
    console.log('📦 DeepSeek response:', JSON.stringify(data).substring(0, 500));
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error('❌ Invalid response structure:', data);
      return res.json({ 
        success: false,
        error: 'API 响应格式异常'
      });
    }

    let content = data.choices[0].message.content;
    console.log('📄 Raw content:', content.substring(0, 300));
    
    // Clean up markdown code blocks
    content = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error('❌ JSON parse error:', e.message);
      console.error('Raw content:', content.substring(0, 500));
      return res.json({ 
        success: false,
        error: 'AI 返回的内容无法解析', 
        raw: content.substring(0, 300)
      });
    }

    if (!result.items || !Array.isArray(result.items)) {
      console.error('❌ Invalid result structure:', result);
      return res.json({ 
        success: false,
        error: '未找到知识点列表'
      });
    }

    if (result.items.length === 0) {
      return res.json({ 
        success: false,
        error: '未提取到知识点，请提供包含更多概念和时间信息的文本'
      });
    }

    console.log(`✅ Successfully extracted ${result.items.length} knowledge points`);
    console.log('📋 Extracted terms:', result.items.map(i => i.term).join(', '));
    
    // 后处理：强制确保用户指定的关键词都被包含
    if (priorityTerms && priorityTerms.length > 0) {
      const extractedTermsLower = result.items.map(i => i.term.toLowerCase());
      
      for (const pt of priorityTerms) {
        const ptLower = pt.toLowerCase();
        // 检查是否已被提取（精确匹配或包含关系）
        const alreadyExtracted = result.items.some(item => 
          item.term.toLowerCase() === ptLower ||
          item.term.toLowerCase().includes(ptLower) || 
          ptLower.includes(item.term.toLowerCase())
        );
        
        if (!alreadyExtracted) {
          // AI遗漏了这个关键词，强制创建一个条目
          console.log(`⚠️ Priority term "${pt}" was missed by AI, forcing creation`);
          result.items.unshift({
            term: pt,
            definition: `用户指定的关键词「${pt}」。该概念出现在输入文本中，请根据上下文理解其含义。`,
            time: '',
            subModule: '',
            importance: 2,
            difficulty: 3
          });
        }
      }
      
      // 将匹配优先关键词的条目移到最前面
      result.items.sort((a, b) => {
        const aIsPriority = priorityTerms.some(pt => 
          a.term.toLowerCase().includes(pt.toLowerCase()) || 
          pt.toLowerCase().includes(a.term.toLowerCase())
        );
        const bIsPriority = priorityTerms.some(pt => 
          b.term.toLowerCase().includes(pt.toLowerCase()) || 
          pt.toLowerCase().includes(b.term.toLowerCase())
        );
        if (aIsPriority && !bIsPriority) return -1;
        if (!aIsPriority && bIsPriority) return 1;
        return 0;
      });
      
      const priorityMatched = result.items.filter(item => 
        priorityTerms.some(pt => 
          item.term.toLowerCase().includes(pt.toLowerCase()) || 
          pt.toLowerCase().includes(item.term.toLowerCase())
        )
      );
      console.log(`🎯 Priority terms in result: ${priorityMatched.length}/${priorityTerms.length}`);
      console.log('  - Priority items:', priorityMatched.map(i => i.term).join(', '));
    }
    
    res.json({ success: true, items: result.items });
    
  } catch (e) {
    console.error('❌ Extract knowledge error:', e);
    res.status(500).json({ 
      success: false,
      error: '服务器处理错误: ' + e.message 
    });
  }
});

// Fetch Jina AI Content (as Markdown)
async function fetchJinaContent(targetUrl) {
  // Config
  let apiKey = '';
  try {
     const cfg = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf-8').catch(() => '{}'));
     apiKey = cfg.jinaApiKey || '';
  } catch {}

  // Use "r.jina.ai" which converts URL to clean Markdown
  // Use curlproxy for stability in CN region
  return new Promise((resolve, reject) => {
    // Note: Jina Reader URL format is https://r.jina.ai/<target_url>
    const jinaUrl = `https://r.jina.ai/${targetUrl}`;
    
    // Check if we need proxy. Using the discovered SOCKS5 proxy port (often more stable).
    const args = [
      '-x', 'socks5h://127.0.0.1:15235', 
      '-s',
      '-L',
      '--http1.1', // Fix for HTTP/2 framing error (curl code 16)
      '-H', 'Accept: application/json',
      '-H', 'X-Respond-With: readerlm-v2',
      '-H', 'X-Retain-Images: none',
      '-H', 'X-Return-Format: markdown',
      jinaUrl
    ];

    if (apiKey) {
        args.push('-H', `Authorization: Bearer ${apiKey}`);
    }

    const curl = spawn('curl', args);

    let stdout = '';
    let stderr = '';

    curl.stdout.on('data', (data) => stdout += data);
    curl.stderr.on('data', (data) => stderr += data);

    curl.on('close', (code) => {
      if (code !== 0) {
        console.error('Jina Fetch curl error:', stderr);
        reject(new Error(`curl failed with code ${code}`));
      } else {
        if (!stdout || stdout.trim().length === 0) {
            reject(new Error('Empty response from Jina AI'));
        } else {
            try {
                // Try parsing JSON response
                const json = JSON.parse(stdout);
                if (json.data && json.data.content) {
                    resolve(json.data.content);
                } else if (json.content) { 
                    resolve(json.content); // Fallback for some structures
                } else {
                    // Fallback to raw stdout if structure unknown but valid JSON
                    console.log('Jina returned JSON but structure unknown, using raw text');
                    resolve(stdout);
                }
            } catch (e) {
                // Not JSON, return as is (in case of error or different content type)
                resolve(stdout);
            }
        }
      }
    });
    
    curl.on('error', (err) => reject(err));
  });
}

// --- Knowledge Transfer Station API ---

app.get('/api/transfers', async (req, res) => {
  try {
    const data = await fs.readFile(TRANSFERS_FILE, 'utf-8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

app.post('/api/transfers', async (req, res) => {
  const { url, title, tags } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    let transfers = [];
    try {
      transfers = JSON.parse(await fs.readFile(TRANSFERS_FILE, 'utf-8'));
    } catch {}

    // Check existing
    if (transfers.some(t => t.url === url)) {
        return res.status(400).json({ error: 'This URL already exists in Transfer Station' });
    }

    console.log(`🌐 Fetching content for: ${url}`);
    let content = '';
    try {
        content = await fetchJinaContent(url);
    } catch (e) {
        console.error('Jina fetch failed:', e);
        content = `(Content fetch failed: ${e.message})`;
    }

    const newItem = {
      id: `tf_${Date.now()}`,
      url,
      title: title || 'New Webpage',
      content, // Markdown content
      summary: content.substring(0, 200) + '...',
      tags: tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      annotations: [] // For highlights/knowledge points
    };

    transfers.unshift(newItem);
    await fs.writeFile(TRANSFERS_FILE, JSON.stringify(transfers, null, 2), 'utf-8');
    
    res.json({ success: true, item: newItem });
  } catch (e) {
    console.error('Transfer create error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/transfers/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, annotations, tags } = req.body;
    try {
        const transfers = JSON.parse(await fs.readFile(TRANSFERS_FILE, 'utf-8'));
        const idx = transfers.findIndex(t => t.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Item not found' });
        
        if (title !== undefined) transfers[idx].title = title;
        if (content !== undefined) transfers[idx].content = content;
        if (annotations !== undefined) transfers[idx].annotations = annotations;
        if (tags !== undefined) transfers[idx].tags = tags;
        
        transfers[idx].updated_at = new Date().toISOString();
        
        await fs.writeFile(TRANSFERS_FILE, JSON.stringify(transfers, null, 2), 'utf-8');
        res.json({ success: true, item: transfers[idx] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Refresh Transfer Content (Re-download)
app.post('/api/transfers/:id/refresh', async (req, res) => {
    const { id } = req.params;
    try {
        const transfers = JSON.parse(await fs.readFile(TRANSFERS_FILE, 'utf-8'));
        const idx = transfers.findIndex(t => t.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Item not found' });
        
        const item = transfers[idx];
        if (!item.url) return res.status(400).json({ error: 'Item has no URL' });

        console.log(`🌐 Re-fetching content for: ${item.url}`);
        let content = '';
        try {
            content = await fetchJinaContent(item.url);
        } catch (e) {
            console.error('Jina refresh failed:', e);
            return res.status(500).json({ error: 'Re-download failed: ' + e.message });
        }

        transfers[idx].content = content;
        transfers[idx].updated_at = new Date().toISOString();
        
        await fs.writeFile(TRANSFERS_FILE, JSON.stringify(transfers, null, 2), 'utf-8');
        res.json({ success: true, item: transfers[idx] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/transfers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        let transfers = JSON.parse(await fs.readFile(TRANSFERS_FILE, 'utf-8'));
        transfers = transfers.filter(t => t.id !== id);
        await fs.writeFile(TRANSFERS_FILE, JSON.stringify(transfers, null, 2), 'utf-8');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- Knowledge Discovery Agent ---

app.post('/api/knowledge/batch-add', async (req, res) => {
  const { items, sourceUrls } = req.body;
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid items' });

  try {
    const data = JSON.parse(await fs.readFile(KNOWLEDGE_FILE, 'utf-8'));
    
    // Add processed URLs to Stop List
    if (sourceUrls && Array.isArray(sourceUrls) && sourceUrls.length > 0) {
        try {
            let stopList = JSON.parse(await fs.readFile(STOP_URLS_FILE, 'utf-8').catch(() => '[]'));
            let added = 0;
            sourceUrls.forEach(url => {
                if (!stopList.includes(url)) {
                    stopList.push(url);
                    added++;
                }
            });
            if (added > 0) {
               await fs.writeFile(STOP_URLS_FILE, JSON.stringify(stopList, null, 2), 'utf-8');
               console.log(`🚫 Added ${added} URLs to Stop List`);
            }
        } catch (e) {
            console.error('Failed to update Stop List:', e);
        }
    }
    
    // 默认添加到 "AI 知识萃取" 模块，如果没有则创建
    let targetModule = data.find(m => m.name.includes('AI') && m.name.includes('萃取'));
    if (!targetModule) {
      targetModule = {
        id: `module_ai_${Date.now()}`,
        name: 'AI 知识萃取',
        items: []
      };
      data.push(targetModule);
    }

    let addedCount = 0;
    items.forEach(newItem => {
        // Global ID Check
        const exists = data.some(m => m.items && m.items.some(i => i.id === newItem.id));
        if (!exists) {
            targetModule.items.push(newItem);
            addedCount++;
        }
    });

    await fs.writeFile(KNOWLEDGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, count: addedCount, moduleName: targetModule.name });
  } catch (e) {
    console.error('Batch add error:', e);
    res.status(500).json({ error: e.message });
  }
});

const SYSTEM_PROMPT_ACADEMIC = `
你是一个学术研究领域的专家Agent。
你的任务是根据用户指令，从互联网搜索结果中发现并提取新的知识点。

### 什么是本学科？
这里指代用户当前研究的特定学术领域。
核心知识体系包括：
1. **历史源流**：学科起源、发展历程、关键代表人物。
2. **理论基础**：核心概念、基本原理、理论框架。
3. **关键技术/方法**：
   - 研究方法论
   - 实验技术与工具
   - 数据分析方法
4. **基础设施**：研究资源、实验设备、数据库。
5. **应用与评估**：技术应用、质量评估、实践反馈。

### 判别标准
在分析内容时，请遵循以下标准：
1. **相关性**：内容必须属于上述领域或其交叉点。
2. **新颖性**：寻找尚未被收录的前沿概念、工具或人物。
3. **学术性**：优先提取具有明确定义、时间节点和学术价值的概念。
`;

// Brave Search Helper
async function searchBrave(query, apiKey, options = {}) {
  // Use curl with explicit proxy for CN region connectivity
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
        q: query,
        count: options.count || 10
    });
    
    // search_lang must be a Brave-supported code: zh-hans, zh-hant, en, jp, ko, fr, de, etc.
    const lang = (options.search_lang || 'zh-hans').split(',')[0].trim();
    if (lang && lang !== 'ALL') params.append('search_lang', lang);
    
    // country must be a valid 2-letter code; "ALL" means omit it
    const country = options.country || '';
    if (country && country !== 'ALL') params.append('country', country);
    
    // freshness: pd, pw, pm, py, or YYYY-MM-DDtoYYYY-MM-DD
    if (options.freshness) params.append('freshness', options.freshness);

    const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;
    console.log('   Brave URL:', url);

    const curl = spawn('curl', [
      '-x', 'http://127.0.0.1:15236', // Explicitly use the discovered local proxy
      '-H', 'Accept: application/json',
      '-H', `X-Subscription-Token: ${apiKey}`,
      '-s', // silent
      '-L', // follow redirects
      url
    ]);

    let stdout = '';
    let stderr = '';

    curl.stdout.on('data', (data) => stdout += data);
    curl.stderr.on('data', (data) => stderr += data);

    curl.on('close', (code) => {
      if (code !== 0) {
        console.error('Brave Search curl error:', stderr);
        reject(new Error(`curl failed with code ${code}`));
      } else {
        try {
          if (!stdout) throw new Error('Empty response');
          const parsed = JSON.parse(stdout);
          // Check for Brave API error responses
          if (parsed.type === 'ErrorResponse' || parsed.error) {
            const errMsg = parsed.error?.detail || parsed.error?.code || JSON.stringify(parsed.error);
            const metaErrors = parsed.error?.meta?.errors;
            console.error('❌ Brave API Error:', errMsg);
            if (metaErrors) {
              console.error('   Validation details:', JSON.stringify(metaErrors, null, 2));
            }
            console.error('   Full error:', JSON.stringify(parsed.error));
            // Return empty results instead of rejecting, so the flow continues
            resolve({ web: { results: [] }, _braveError: errMsg + (metaErrors ? ' | ' + metaErrors.map(e => `${e.loc?.join('.')}: ${e.msg} (got: ${e.input})`).join('; ') : '') });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          console.error('Brave Search parse error. Raw output:', stdout.substring(0, 200));
          reject(new Error('Failed to parse curl output: ' + e.message));
        }
      }
    });

    curl.on('error', (err) => reject(new Error('Failed to spawn curl: ' + err.message)));
  });
}

app.post('/api/agent/discover', async (req, res) => {
  const { query, deepseekKey, braveKey, zhipuKey, options, stream } = req.body;
  
  if (!query || !deepseekKey || !braveKey) {
    return res.status(400).json({ error: 'Missing required parameters (query, deepseekKey, braveKey)' });
  }

  // Handle streaming response if requested
  if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();
  }

  const sendLog = (phase, message) => {
      if (stream) {
          res.write(`data: ${JSON.stringify({ type: 'log', phase, message })}\n\n`);
      }
  };

  // Parse user options
  const userOptions = options || {};

  try {
    console.log(`🕵️ Knowledge Agent searching for: "${query}" (Options: ${JSON.stringify(userOptions)})`);
    sendLog('init', `Received request: "${query}"`);
    sendLog('init', `Configuration: ${JSON.stringify(userOptions)}`);

    // 0. Load Stop List
    let stopUrls = [];
    try {
        stopUrls = JSON.parse(await fs.readFile(STOP_URLS_FILE, 'utf-8'));
        sendLog('init', `Loaded ${stopUrls.length} stop URLs`);
    } catch {
        sendLog('init', `No stop list found or empty`);
    }

    // 1. Search Web with Advanced Techniques
    let finalQueryString = query;

    // Helper to get stop url exclusions
    const getExclusions = () => {
        if (stopUrls.length > 0) {
            return stopUrls.slice(0, 20).map(u => {
                // Ensure we only pass the domain/hostname to -site:
                let domain = u;
                try {
                    // If it starts with http, parse it
                    if (u.startsWith('http')) {
                        domain = new URL(u).hostname;
                    } 
                    // If it has path but no scheme, it might confuse URL(), 
                    // but usually stopUrls are either domains or full URLs.
                    // For safety, mainly strip 'https://' and 'http://' prefix manually if URL fails
                    // or just use the parsing result.
                } catch (e) {
                    // Fallback cleanup
                    domain = u.replace(/^https?:\/\//, '').split('/')[0];
                }
                return ` -site:${domain}`;
            }).join('');
        }
        return '';
    };

    let braveParams = {
        count: userOptions.count || 10,
        country: userOptions.country || 'CN',
        search_lang: userOptions.search_lang || 'zh-hans',
        freshness: userOptions.freshness || 'py'
    };

    let searchResults = { web: { results: [] } };
    let queriesToRun = [];

    // --- SMART EXPAND LOGIC ---
    if (userOptions.smartExpand && !userOptions.rawQuery) {
        sendLog('init', '🧠 Smart Expand enabled. Analyzing query intent with DeepSeek...');
        console.log("🧠 Smart Expand enabled. Generating related queries...");
        try {
            const expandResponse = await fetch('https://api.deepseek.com/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekKey}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [
                        { role: "system", content: "You are a search query optimizer for an academic research agent." },
                        { role: "user", content: `Please generate 3 supplementary search queries for "${query}" to broaden the coverage in the context of Translation Studies and AI. \nReturn ONLY a JSON array of strings, e.g. ["query1", "query2"]. Do not output markdown.` }
                    ],
                    temperature: 0.7
                })
            });
            const expandData = await expandResponse.json();
            const content = expandData.choices?.[0]?.message?.content || '[]';
            // Parse JSON cleanly (handle potential markdown fences)
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            const expanded = JSON.parse(cleanContent);
            sendLog('init', `Expanded queries: ${JSON.stringify(expanded)}`);
            
            if (Array.isArray(expanded)) {
                queriesToRun = [query, ...expanded];
                console.log(`🚀 Expanded queries: ${JSON.stringify(queriesToRun)}`);
            } else {
                queriesToRun = [query];
            }
        } catch (e) {
            console.error("Smart Expand failed, falling back to single query:", e);
            sendLog('init', `Smart Expand failed: ${e.message}. Using original query only.`);
            queriesToRun = [query];
        }
    } else {
        queriesToRun = [query];
    }

    // Execute Searches
    let executedQueriesLog = [];
    
    sendLog('search', 'Starting Web Search Phase...');
    // Process all queries
    for (const q of queriesToRun) {
        let currentFinalQuery = q;
        if (userOptions.rawQuery) {
            currentFinalQuery = q;
        } else {
             // Smart Mode Construction
            let advancedQuery = q;
            // Don't modify if user already uses operators
            if (!q.includes('(') && !q.includes('site:')) {
                if (!q.includes('翻译') && !q.includes('Translation')) {
                     advancedQuery += " (人工智能 OR 深度学习 OR 学术研究 OR 理论构建)";
                }
            }
            currentFinalQuery = advancedQuery + getExclusions();
        }
        
        executedQueriesLog.push(currentFinalQuery);
        
        sendLog('search', `Executing Brave Search for: "${q}"`);
        // Execute Search
        let braveRes = await searchBrave(currentFinalQuery, braveKey, braveParams);
        
        // If Brave returned an API error, bubble it up immediately
        if (braveRes._braveError) {
            console.error(`🚨 Brave API error for query "${q}": ${braveRes._braveError}`);
            sendLog('search', `❌ API Error: ${braveRes._braveError}`);
            if (stream) {
                 res.write(`data: ${JSON.stringify({ type: 'error', message: braveRes._braveError })}\n\n`);
                 res.end();
                 return;
            }
            throw new Error(`Brave Search API 错误: ${braveRes._braveError}`);
        }
        
        const count = braveRes.web?.results?.length || 0;
        sendLog('search', `Query "${q}" => Found ${count} results`);
        console.log(`   Query "${q.substring(0, 40)}..." => ${count} results`);

        // Retry logic for PRIMARY query only (if it yields 0 results) 
        // We don't want to retry every single expanded query as it might be too slow
        if (q === query && !userOptions.rawQuery && count === 0) {
            if (currentFinalQuery !== q + getExclusions()) { 
                console.log("⚠️ Primary search yielded 0 results. Retrying broad...");
                sendLog('search', `⚠️ Strict search yielded 0 results. Retrying broad search...`);
                let broadQuery = q + getExclusions();
                currentFinalQuery = broadQuery; // update for log
                // Replace the last log entry
                executedQueriesLog[executedQueriesLog.length - 1] = broadQuery;
                braveRes = await searchBrave(broadQuery, braveKey, braveParams);
                const retryCount = braveRes.web?.results?.length || 0;
                 sendLog('search', `Retry "${q}" => Found ${retryCount} results`);
            }
        }

        if (braveRes.web && braveRes.web.results) {
            searchResults.web.results.push(...braveRes.web.results);
        }
        
        // Simple delay to be nice to API rate limits if multiple
        if (queriesToRun.length > 1) await new Promise(r => setTimeout(r, 500));
    }

    // Deduplicate results by URL
    const seenUrls = new Set();
    const uniqueResults = [];
    if (searchResults.web && searchResults.web.results) {
        for (const item of searchResults.web.results) {
            if (!seenUrls.has(item.url)) {
                seenUrls.add(item.url);
                uniqueResults.push(item);
            }
        }
        searchResults.web.results = uniqueResults;
    }

    finalQueryString = executedQueriesLog.join('\n'); // Join them for display in UI

    console.log(`📊 Total results after all queries: ${searchResults.web?.results?.length || 0}`);
    sendLog('search', `Total unique results found: ${searchResults.web?.results?.length || 0}`);

    // Filter out stopped URLs (Double check for those not in the top 20 query exclusions)
    if (searchResults.web && searchResults.web.results) {
        const originalCount = searchResults.web.results.length;
        searchResults.web.results = searchResults.web.results.filter(r => {
             // Check if url contains any stopUrl (domain or part of url)
             return !stopUrls.some(stop => r.url.includes(stop));
        });
        const filteredCount = searchResults.web.results.length;
        if (originalCount !== filteredCount) {
             console.log(`🚫 Filtered ${originalCount - filteredCount} URLs present in Stop List`);
             sendLog('search', `🚫 Filtered ${originalCount - filteredCount} URLs present in Stop List`);
        }
    }

    const snippets = searchResults.web?.results?.map(r => `[${r.title}](${r.url})\n${r.description}`).join('\n\n') || '';

    if (!snippets) {
      if (stream) {
          res.write(`data: ${JSON.stringify({ 
              type: 'result', 
              data: { success: true, items: [], message: '未找到相关搜索结果 (或已被过滤)', executedQuery: finalQueryString, sources: [] } 
          })}\n\n`);
          res.end();
          return;
      }
      return res.json({ 
          success: true, 
          items: [], 
          message: '未找到相关搜索结果 (或已被过滤)',
          executedQuery: finalQueryString, // Return the query so user can see what failed
          sources: [] 
      });
    }

    console.log(`🔎 Found ${searchResults.web?.results?.length} search results`);

    // 2. Load Existing Terms for context (Lightweight check)
    let existingTerms = [];
    try {
      const knowledgeData = JSON.parse(await fs.readFile(KNOWLEDGE_FILE, 'utf-8'));
      knowledgeData.forEach(m => m.items && m.items.forEach(i => existingTerms.push(i.term)));
    } catch (e) { 
        console.error('Failed to load existing terms', e); 
    }

    // 3. Extract Candidates using DeepSeek
    sendLog('analyze', 'Starting DeepSeek analysis...');
    sendLog('analyze', `Feeding ${searchResults.web?.results?.length} snippets to LLM.`);
    
    const extractResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_ACADEMIC },
          { role: "user", content: `
请根据以下搜索结果，提取可能属于"本学科"的新知识点。

**已有知识点(部分)**: ${existingTerms.slice(0, 50).join(', ')}...

**搜索结果**:
${snippets}

**要求**:
1. 仅提取相关性高且未在"已有知识点"中出现的概念。
2. 返回JSON格式列表。

返回格式(JSON):
{
  "candidates": [
    {
      "term": "概念名称",
      "definition": "定义的草稿...",
      "time": "年份/未知",
      "reason": "为什么属于本学科"
    }
  ]
}` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    const aiData = await extractResponse.json();
    sendLog('analyze', 'DeepSeek analysis complete.');
    const content = aiData.choices?.[0]?.message?.content || '{}';
    sendLog('analyze', `DeepSeek Output Length: ${content.length} chars`);

    let candidates = [];
    try {
        candidates = JSON.parse(content).candidates || [];
    } catch(e) {
         sendLog('analyze', `JSON Parse Error: ${e.message}`);
    }

    console.log(`✅ Agent found ${candidates.length} candidates`);
    sendLog('analyze', `Extracted ${candidates.length} candidates.`);
    
    // Add IDs to candidates
    const finalCandidates = candidates.map(c => ({
      ...c,
      id: `kc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      subModule: 'AI推荐',
      importance: 3,
      difficulty: 3
    }));

    // --- Save Search History ---
    try {
        const historyRecord = {
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          query: query,
          candidatesCount: finalCandidates.length,
          sourcesCount: searchResults.web?.results?.length || 0,
          candidates: finalCandidates,
          sources: searchResults.web?.results || []
        };
        
        const historyData = JSON.parse(await fs.readFile(AGENT_HISTORY_FILE, 'utf-8').catch(() => '[]'));
        historyData.unshift(historyRecord);
        // Keep last 100 searches
        if (historyData.length > 100) {
            historyData.length = 100;
        }
        await fs.writeFile(AGENT_HISTORY_FILE, JSON.stringify(historyData, null, 2), 'utf-8');
    } catch (histErr) {
        console.error('Failed to save search history:', histErr);
    }

    const resultPayload = { success: true, candidates: finalCandidates, sources: searchResults.web?.results, executedQuery: finalQueryString };
    
    if (stream) {
        res.write(`data: ${JSON.stringify({ type: 'result', data: resultPayload })}\n\n`);
        res.end();
    } else {
        res.json(resultPayload);
    }

  } catch (e) {
    console.error('❌ Agent Error:', e);
    if (stream) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
        res.end();
    } else {
        res.status(500).json({ error: e.message });
    }
  }
});

app.get('/api/agent/history', async (req, res) => {
  try {
    const data = await fs.readFile(AGENT_HISTORY_FILE, 'utf-8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch agent history' });
  }
});

// --- Inspirations API ---

// Get Inspirations
app.get('/api/inspirations', async (req, res) => {
  try {
    const data = await fs.readFile(INSPIRATIONS_FILE, 'utf-8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inspirations' });
  }
});

// Save (Create/Update) Inspiration
app.post('/api/inspirations', async (req, res) => {
  const { id, content, associations } = req.body;
  
  // Allow empty content if it's an update or if explicitly provided as empty string
  if (content === undefined && associations === undefined) {
      return res.status(400).json({ error: 'Content or associations required' });
  }

  try {
    const data = await fs.readFile(INSPIRATIONS_FILE, 'utf-8').catch(() => '[]');
    let inspirations = JSON.parse(data);
    
    const now = new Date().toISOString();
    
    if (id) {
      // Update
      const index = inspirations.findIndex(i => i.id === id);
      if (index !== -1) {
        inspirations[index] = {
          ...inspirations[index],
          content: content !== undefined ? content : inspirations[index].content,
          associations: associations || inspirations[index].associations,
          updated_at: now
        };
      } else {
        // Create with ID provided (unlikely but possible)
        inspirations.push({
            id,
            content: content || '',
            associations: associations || [],
            created_at: now,
            updated_at: now
        });
      }
    } else {
      // Create New
      const newId = Date.now().toString();
      const newInspiration = {
        id: newId,
        content: content || '',
        associations: associations || [],
        created_at: now,
        updated_at: now
      };
      inspirations.push(newInspiration);
      // Return the new ID
      await fs.writeFile(INSPIRATIONS_FILE, JSON.stringify(inspirations, null, 2), 'utf-8');
      res.json({ success: true, inspiration: newInspiration });
      return;
    }
    
    await fs.writeFile(INSPIRATIONS_FILE, JSON.stringify(inspirations, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    console.error('Save inspiration error:', e);
    res.status(500).json({ error: 'Failed to save inspiration' });
  }
});

// Generate Academic Text for Inspiration
app.post('/api/magic/generate-academic-text', async (req, res) => {
  const { inspirationContent, associations, apiKey } = req.body;
  
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing apiKey' });
  }

  // Build context from associations
  let contextStr = "Supporting Materials:\n";
  if (associations && associations.length > 0) {
      associations.forEach((assoc, idx) => {
          contextStr += `\n[${idx+1}] Type: ${assoc.type}\nSummary: ${assoc.summary}\nDetail: ${assoc.detail || ''}\n`;
      });
  } else {
      contextStr += "None.";
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an academic writing assistant.
Your task is to generate a coherent, academically standardized paragraph based on the user's notes and supporting materials.

Requirements:
1. **Academic Style**: Use formal, objective, and precise language suitable for a research book.
2. **Integration**: Seamlessly integrate the user's inspiration note with the provided supporting materials (references, highlights, knowledge points).
3. **Citations**: STRICTLY follow the 《中国翻译》 (Chinese Translators Journal) citation style.
   - For Chinese authors: (Name, Year: Page) or (Name, Year). Example: (王仁强, 2025: 5) or (查明建, 2025).
   - For English authors: (Surname, Year: Page) or (Surname, Year). Example: (Baker, 1995: 223).
   - If specific page numbers are not available in the supporting material, omit the page number: (Name, Year).
   - Do NOT invent citations. Only use the provided supporting materials. If a supporting material is a Reference or Highlight, cite it using its metadata.
4. **Structure**: The output should be a single, well-structured paragraph (or two if necessary) that expands on the user's initial thought using the evidence.
5. **Language**: Chinese (unless the user's note is fully English).

Input Format:
- User Note: The core idea.
- Supporting Materials: List of associated content to use as evidence.

Output:
- Return ONLY the generated text. No preamble.`
          },
          {
            role: "user",
            content: `User Note: ${inspirationContent}\n\n${contextStr}`
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    const result = data.choices[0].message.content;
    res.json({ success: true, result });

  } catch (e) {
    console.error('Generation error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate Paper Draft (Streaming)
app.post('/api/magic/generate-paper', async (req, res) => {
  const { items, apiKey } = req.body;
  
  if (!items || !Array.isArray(items) || items.length === 0 || !apiKey) {
    return res.status(400).json({ error: 'Missing items or apiKey' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    let contextStr = "Selected Notes & Materials:\n";
    items.forEach((item, idx) => {
        contextStr += `\n[Note ${idx+1}] Content: ${item.content}\n`;
        if (item.associations && item.associations.length > 0) {
            contextStr += "  Associated Materials:\n";
            item.associations.forEach(assoc => {
                contextStr += `    - [${assoc.type}] ${assoc.summary} (${assoc.detail || ''})\n`;
            });
        }
    });

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a distinguished scholar in Translation Studies and an expert writer for the "Chinese Translators Journal" (《中国翻译》).
Your task is to synthesize the provided notes and materials into a comprehensive, high-quality academic paper draft.

Requirements:
1.  **Format**: Follow the structure and style of "Chinese Translators Journal".
    -   Title (Academic and concise)
    -   Abstract (Chinese)
    -   Keywords
    -   Introduction (Background, Significance, Research Gap)
    -   Theoretical Framework
    -   Main Body (Logical argumentation, using the provided notes as core evidence)
    -   Conclusion
2.  **Length**: Aim for a substantial draft (approx. 8000 words logic, though actual output is limited by token limits, try to be as detailed and extensive as possible within one response, or structure it to be the first part of a series). *Note: Due to output limits, focus on generating a detailed outline and the full Introduction + First Major Section, or as much as possible.*
3.  **Tone**: Rigorous, objective, academic, insightful.
4.  **Citations**: Use the provided materials as sources. Cite them appropriately using (Author, Year) format if metadata is available, or describe them as "notes suggest...".
5.  **Language**: Chinese.

Input:
- A collection of user's inspiration notes and associated materials.

Output:
- Stream the generated paper content directly. Start with the Title.`
          },
          {
            role: "user",
            content: `Please generate the paper draft based on these materials:\n\n${contextStr}`
          }
        ],
        stream: true
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
        res.end();
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            const content = json.choices[0].delta.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (e) {
    console.error('Paper generation error:', e);
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

// Delete Inspiration
app.delete('/api/inspirations/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(INSPIRATIONS_FILE, 'utf-8').catch(() => '[]');
    let inspirations = JSON.parse(data);
    inspirations = inspirations.filter(i => i.id !== id);
    await fs.writeFile(INSPIRATIONS_FILE, JSON.stringify(inspirations, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete inspiration' });
  }
});

// --- Voice Memos API ---

// Get Voice Memos
app.get('/api/voice-memos', async (req, res) => {
  try {
    const data = await fs.readFile(VOICE_MEMOS_FILE, 'utf-8').catch(() => '[]');
    let memos = JSON.parse(data);
    memos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(memos);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch voice memos' });
  }
});

// Save Voice Memo (Create/Update)
app.post('/api/voice-memos', async (req, res) => {
  const { id, ...memoData } = req.body;
  
  try {
    const data = await fs.readFile(VOICE_MEMOS_FILE, 'utf-8').catch(() => '[]');
    let memos = JSON.parse(data);
    
    const index = memos.findIndex(m => m.id === id);
    if (index !== -1) {
        // Update
        memos[index] = { ...memos[index], ...memoData };
    } else {
        // Create
        memos.push({ id, ...memoData });
    }
    
    await fs.writeFile(VOICE_MEMOS_FILE, JSON.stringify(memos, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    console.error('Save voice memo error:', e);
    res.status(500).json({ error: 'Failed to save voice memo' });
  }
});

// Delete Voice Memo
app.delete('/api/voice-memos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(VOICE_MEMOS_FILE, 'utf-8').catch(() => '[]');
    let memos = JSON.parse(data);
    memos = memos.filter(m => m.id !== id);
    await fs.writeFile(VOICE_MEMOS_FILE, JSON.stringify(memos, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete voice memo' });
  }
});

// --- Weibo API ---

// Get Weibo Posts
app.get('/api/weibo', async (req, res) => {
  try {
    const data = await fs.readFile(WEIBO_FILE, 'utf-8').catch(() => '[]');
    let posts = JSON.parse(data);
    // Sort by created_at desc
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch weibo posts' });
  }
});

// Create Weibo Post
app.post('/api/weibo', async (req, res) => {
  const { content, originId } = req.body;
  
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    const data = await fs.readFile(WEIBO_FILE, 'utf-8').catch(() => '[]');
    let posts = JSON.parse(data);
    
    let originPost = null;
    if (originId) {
        originPost = posts.find(p => p.id === originId);
        // If origin is already a repost, we might want to reference the original original?
        // But for simplicity, we just snapshot the immediate origin.
        if (originPost) {
            // Increment repost count on origin
            originPost.reposts = (originPost.reposts || 0) + 1;
        }
    }

    const newPost = {
      id: Date.now().toString(),
      content,
      created_at: new Date().toISOString(),
      likes: 0,
      reposts: 0,
      comments: [],
      originId: originId || null,
      origin: originPost ? {
          id: originPost.id,
          content: originPost.content,
          author: '我' // Hardcoded for now
      } : null
    };
    
    posts.push(newPost);
    await fs.writeFile(WEIBO_FILE, JSON.stringify(posts, null, 2), 'utf-8');
    res.json({ success: true, post: newPost });
  } catch (e) {
    console.error('Save weibo error:', e);
    res.status(500).json({ error: 'Failed to save post' });
  }
});

// Like Weibo Post
app.post('/api/weibo/:id/like', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(WEIBO_FILE, 'utf-8').catch(() => '[]');
    let posts = JSON.parse(data);
    
    const index = posts.findIndex(p => p.id === id);
    if (index !== -1) {
        posts[index].likes = (posts[index].likes || 0) + 1;
        await fs.writeFile(WEIBO_FILE, JSON.stringify(posts, null, 2), 'utf-8');
        res.json({ success: true, likes: posts[index].likes });
    } else {
        res.status(404).json({ error: 'Post not found' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to like post' });
  }
});

// Comment on Weibo Post
app.post('/api/weibo/:id/comments', async (req, res) => {
  const { id } = req.params;
  const { content, isAuto } = req.body;
  
  if (!content) return res.status(400).json({ error: 'Content required' });

  try {
    const data = await fs.readFile(WEIBO_FILE, 'utf-8').catch(() => '[]');
    let posts = JSON.parse(data);
    
    const index = posts.findIndex(p => p.id === id);
    if (index !== -1) {
        if (!posts[index].comments) posts[index].comments = [];
        
        const newComment = {
            id: Date.now().toString(),
            content,
            user: isAuto ? 'AI主编' : '我',
            created_at: new Date().toISOString()
        };
        
        posts[index].comments.push(newComment);
        await fs.writeFile(WEIBO_FILE, JSON.stringify(posts, null, 2), 'utf-8');
        res.json({ success: true, comments: posts[index].comments });
    } else {
        res.status(404).json({ error: 'Post not found' });
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to comment' });
  }
});

// Delete Weibo Post
app.delete('/api/weibo/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const data = await fs.readFile(WEIBO_FILE, 'utf-8').catch(() => '[]');
    let posts = JSON.parse(data);
    posts = posts.filter(p => p.id !== id);
    await fs.writeFile(WEIBO_FILE, JSON.stringify(posts, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// Smart Reply (Streaming)
app.post('/api/weibo/smart-reply', async (req, res) => {
  const { content, history, apiKey } = req.body;
  
  if ((!content && !history) || !apiKey) {
    return res.status(400).json({ error: 'Missing content/history or apiKey' });
  }

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const messages = [
        {
          role: "system",
          content: `You are the Editor-in-Chief of "Chinese Translators Journal" (《中国翻译》), a top-tier academic journal.
Your persona:
- Authoritative yet encouraging academic mentor.
- Deep expertise in Academic Research and Writing.
- Use academic terminology but keep it accessible for a social media context (Weibo).
- Your goal: Provide an academic perspective on the user's post, suggesting theoretical connections, research methodologies, or refinements to make the idea more scholarly.
- Tone: Professional, insightful, constructive.
- Interaction: You are engaging in a multi-turn conversation. Respond to the latest user message while considering the full context.

Language: Chinese.`
        }
    ];

    // If history is provided, use it. Otherwise fall back to single content.
    if (history && Array.isArray(history)) {
        // history should be [{ role: 'user'|'assistant', content: '...' }]
        messages.push(...history);
    } else {
        messages.push({
            role: "user",
            content: `User Post: ${content}`
        });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: messages,
        stream: true
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        res.write(`data: ${JSON.stringify({ error: errText })}\n\n`);
        res.end();
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            const content = json.choices[0].delta.content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
    
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (e) {
    console.error('Smart reply error:', e);
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

// Upload Voice
app.post('/api/upload-voice', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  // Use public/assets/audio/
  const audioDir = path.join(__dirname, 'public/assets/audio');
  // Use .webm or .wav usually from MediaRecorder
  const filename = `${Date.now()}_${fixUtf8(req.file.originalname)}`;
  const targetPath = path.join(audioDir, filename);

  try {
    await fs.mkdir(audioDir, { recursive: true });
    await fs.copyFile(req.file.path, targetPath);
    await fs.unlink(req.file.path);

    const publicUrl = `/assets/audio/${filename}`;
    res.json({ success: true, url: publicUrl, path: targetPath });
  } catch (e) {
    console.error('Audio upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Transcribe Voice (using Volcengine/Doubao)
app.post('/api/transcribe-volc', async (req, res) => {
  console.log('[Transcribe] Request received');
  const { audioPath, appId, accessToken } = req.body;
  
  if (!audioPath || !appId || !accessToken) {
    console.error('[Transcribe] Missing parameters');
    return res.status(400).json({ error: 'Missing parameters' });
  }

  let filePath = audioPath;
  if (audioPath.startsWith('/assets/audio/')) {
      filePath = path.join(__dirname, 'public', audioPath);
  }
  console.log('[Transcribe] Resolving file:', filePath);

  try {
    const fileBuffer = await fs.readFile(filePath);
    console.log('[Transcribe] File read success, size:', fileBuffer.length);
    
    // Convert to Base64
    const base64Data = fileBuffer.toString('base64');
    
    // UUID v4 generator
    const uuidv4 = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    };

    const url = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash";
    const requestId = uuidv4();
    
    const headers = {
        "X-Api-App-Key": appId,
        "X-Api-Access-Key": accessToken,
        "X-Api-Resource-Id": "volc.bigasr.auc_turbo", 
        "X-Api-Request-Id": requestId,
        "X-Api-Sequence": "-1",
        "Content-Type": "application/json"
    };

    console.log('[Transcribe] Calling Volcengine API...');

    const body = {
        "user": {
            "uid": appId
        },
        "audio": {
            "data": base64Data
        },
        "request": {
            "model_name": "bigmodel"
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
    });

    console.log('[Transcribe] Volcengine status:', response.status);
    const data = await response.json();
    console.log('[Transcribe] Volcengine response:', JSON.stringify(data).substring(0, 200) + '...');
    
    // Check header status if possible, or assume body structure implies success
    const statusCode = response.headers.get('x-api-status-code');
    if (statusCode && statusCode !== '20000000') {
        const msg = response.headers.get('x-api-message');
        console.error('[Transcribe] Volcengine API Error Header:', statusCode, msg);
        return res.status(500).json({ error: `Volcengine API Error: ${msg} (Code: ${statusCode})` });
    }

    // Also check body for safety
    if (data.result && data.result.text) {
        res.json({ success: true, text: data.result.text });
    } else {
         console.log('[Transcribe] No text in result:', data);
         res.json({ success: true, text: "（未识别到内容）" });
    }

  } catch (e) {
    console.error('[Transcribe] Error:', e);
    res.status(500).json({ error: 'Transcription failed: ' + e.message });
  }
});

// ⚠️ Old duplicate endpoint removed - using optimized version at line ~1860

// Generate SVG Academic Illustration
app.post('/api/magic/generate-svg', async (req, res) => {
  const { content, apiKey } = req.body;
  
  if (!content || !apiKey) {
    return res.status(400).json({ error: 'Missing content or apiKey' });
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are an expert academic illustrator and data visualization specialist.
Your task is to generate an SVG code for a diagram based on the user's text.
The diagram should be suitable for insertion into a Chinese academic journal (CSSCI, e.g., "Chinese Translators Journal").

Requirements:
1.  **Style**: Strictly Black & White (Grayscale). High contrast. Professional, clean, vector style. No colored backgrounds.
2.  **Format**: Return ONLY the raw \`<svg>...</svg>\` code. Do not wrap in markdown code blocks.
3.  **Content**: Visualize the key concepts, relationships, or processes described in the user's text. Use boxes, arrows, labels, and hierarchical structures.
4.  **Text**: If the input text is Chinese, use Chinese labels in the SVG. Ensure font-family is generic (e.g., "sans-serif") to support rendering.
5.  **Size**: Default viewBox="0 0 800 600" (or appropriate aspect ratio).

Output:
- ONLY valid XML SVG code.`
          },
          {
            role: "user",
            content: `Create an academic diagram for the following concept:\n\n${content.slice(0, 2000)}`
          }
        ],
        stream: false
      })
    });

    if (!response.ok) {
       const errText = await response.text();
       console.error('DeepSeek API Error:', errText);
       return res.status(response.status).json({ error: 'DeepSeek API failed', details: errText });
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('Unexpected DeepSeek response:', data);
        return res.status(500).json({ error: 'Invalid response from AI provider', raw: data });
    }

    let svg = data.choices[0].message.content;
    
    // Cleanup markdown if present
    svg = svg.replace(/```xml/g, '').replace(/```svg/g, '').replace(/```/g, '').trim();
    
    // Ensure it starts with <svg
    const svgStart = svg.indexOf('<svg');
    const svgEnd = svg.lastIndexOf('</svg>');
    
    if (svgStart !== -1 && svgEnd !== -1) {
        svg = svg.substring(svgStart, svgEnd + 6);
    }

    res.json({ success: true, svg });

  } catch (e) {
    console.error('Generate SVG error:', e);
    res.status(500).json({ error: 'Internal server error: ' + e.message });
  }
});

// ==========================================
// External Read-Only API for Third-Party Tools
// ==========================================

// Helper: Format reference as citation string
const formatRefCitation = (ref) => {
  // Simple GB/T 7714 style approximation
  let citation = '';
  if (ref.authors && ref.authors.length > 0) {
    citation += ref.authors.join(', ') + '. ';
  } else if (ref.author) {
    citation += ref.author + '. ';
  }
  
  if (ref.title) citation += ref.title;
  if (ref.typeCode) citation += `[${ref.typeCode}]`;
  citation += '. ';
  
  if (ref.source) citation += ref.source;
  if (ref.year) citation += `, ${ref.year}`;
  
  return citation;
};

// 1. Search References (Bibliography)
app.get('/api/external/references/search', async (req, res) => {
  const query = req.query.q || '';
  const limit = parseInt(req.query.limit) || 10;
  const requireFullText = req.query.has_full_text === 'true';
  const searchMode = req.query.mode || 'basic'; // 'basic' (metadata) or 'deep' (full text content)
  
  try {
    const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    const references = JSON.parse(referencesData);
    
    let results = references;

    // 1. Filter by Full Text Availability if requested
    if (requireFullText) {
      results = results.filter(ref => ref.type === 'pdf-parsed');
    }
    
    // 2. Search Logic
    if (query) {
      const lowerQ = query.toLowerCase();
      
      if (searchMode === 'deep') {
        // DEEP SEARCH: Scan metadata AND full text content
        const deepResults = [];
        
        // Use a limit to prevent scanning too many files if dataset is huge, 
        // but for personal use, scanning all parsed papers is acceptable.
        for (const ref of results) {
          let isMatch = false;
          let matchContext = null;

          // Check metadata first (fast)
          if ((ref.title && ref.title.toLowerCase().includes(lowerQ)) ||
              (ref.author && ref.author.toLowerCase().includes(lowerQ)) ||
              (ref.year && ref.year.includes(query))) {
            isMatch = true;
          } 
          // Check full text if not matched yet and available
          else if (ref.type === 'pdf-parsed') {
             try {
               const contentPath = path.join(PAPERS_DIR, ref.id, 'content.md');
               const content = await fs.readFile(contentPath, 'utf-8');
               const contentLower = content.toLowerCase();
               const matchIndex = contentLower.indexOf(lowerQ);
               
               if (matchIndex !== -1) {
                 isMatch = true;
                 // Extract a snippet around the match
                 const start = Math.max(0, matchIndex - 60);
                 const end = Math.min(content.length, matchIndex + 140);
                 matchContext = '...' + content.slice(start, end).replace(/\s+/g, ' ') + '...';
               }
             } catch (e) {
               // Ignore file read errors
             }
          }

          if (isMatch) {
            deepResults.push({ ref, matchContext });
          }
        }
        
        results = deepResults; // Results are now objects { ref, matchContext }

      } else {
        // BASIC SEARCH: Metadata only
        results = results.filter(ref => {
          return (ref.title && ref.title.toLowerCase().includes(lowerQ)) ||
                 (ref.author && ref.author.toLowerCase().includes(lowerQ)) ||
                 (ref.year && ref.year.includes(query));
        }).map(ref => ({ ref, matchContext: null }));
      }
    } else {
      // No query, just map to structure
      results = results.map(ref => ({ ref, matchContext: null }));
    }
    
    // Format for external use
    const formattedResults = results.slice(0, limit).map(({ ref, matchContext }) => ({
      id: ref.id,
      title: ref.title,
      author: ref.author || (ref.authors ? ref.authors.join(', ') : ''),
      year: ref.year,
      source: ref.source,
      type: ref.type,
      has_full_text: ref.type === 'pdf-parsed', // Boolean flag
      citation: formatRefCitation(ref),
      url: ref.url || null,
      match_context: matchContext // Snippet from full text if deep search matched
    }));
    
    res.json({ 
      success: true, 
      count: formattedResults.length, 
      results: formattedResults 
    });
    
  } catch (e) {
    console.error('External API Error:', e);
    res.status(500).json({ error: 'Failed to search references' });
  }
});

// 2. Get Single Reference Detail
app.get('/api/external/references/:id', async (req, res) => {
  const { id } = req.params;
  const includeContent = req.query.include_content === 'true'; // Allow fetching full text
  
  try {
    const referencesData = await fs.readFile(REFS_FILE, 'utf-8').catch(() => '[]');
    const references = JSON.parse(referencesData);
    const ref = references.find(r => r.id === id);
    
    if (!ref) return res.status(404).json({ error: 'Reference not found' });
    
    let content = null;
    let contentSnippet = null;

    if (ref.type === 'pdf-parsed') {
       try {
         const contentPath = path.join(PAPERS_DIR, ref.id, 'content.md');
         const fullText = await fs.readFile(contentPath, 'utf-8');
         
         if (includeContent) {
           content = fullText;
         }
         contentSnippet = fullText.slice(0, 1000) + '...';
       } catch (e) { /* ignore */ }
    }

    res.json({
      success: true,
      data: {
        ...ref,
        has_full_text: ref.type === 'pdf-parsed',
        citation: formatRefCitation(ref),
        contentSnippet,
        content: content // Only present if include_content=true
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to get reference' });
  }
});

// 3. Search Knowledge
app.get('/api/external/knowledge/search', async (req, res) => {
  const query = req.query.q || '';
  try {
    const knowledgeData = await fs.readFile(KNOWLEDGE_FILE, 'utf-8').catch(() => '[]');
    let modules = [];
    try {
        modules = JSON.parse(knowledgeData);
    } catch (e) {
        modules = [];
    }
    
    // Safety check for module structure
    const allItems = Array.isArray(modules) 
        ? modules.flatMap(m => Array.isArray(m.items) ? m.items : [])
        : [];
    
    let results = allItems;
    if (query) {
      const lowerQ = query.toLowerCase();
      results = allItems.filter(i => 
        i.term.toLowerCase().includes(lowerQ) || 
        (i.definition && i.definition.toLowerCase().includes(lowerQ))
      );
    }
    
    res.json({
      success: true,
      results: results.map(i => ({
        id: i.id,
        term: i.term,
        definition: i.definition,
        importance: i.importance,
        difficulty: i.difficulty
      }))
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to search knowledge' });
  }
});

// 4. Get Inspirations
app.get('/api/external/inspirations', async (req, res) => {
  try {
    const data = await fs.readFile(INSPIRATIONS_FILE, 'utf-8').catch(() => '[]');
    const inspirations = JSON.parse(data);
    
    res.json({
      success: true,
      results: inspirations.map(i => ({
        id: i.id,
        content: i.content,
        created_at: i.created_at,
        tags: i.tags || []
      }))
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch inspirations' });
  }
});

// --- Stop List API ---
app.get('/api/config/stop-urls', async (req, res) => {
  try {
    const data = await fs.readFile(STOP_URLS_FILE, 'utf-8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: 'Failed to load stop urls' });
  }
});

app.post('/api/config/stop-urls', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    let list = JSON.parse(await fs.readFile(STOP_URLS_FILE, 'utf-8').catch(() => '[]'));
    if (!list.includes(url)) {
      list.push(url);
      await fs.writeFile(STOP_URLS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    }
    res.json({ success: true, list });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save stop url' });
  }
});

app.delete('/api/config/stop-urls', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    let list = JSON.parse(await fs.readFile(STOP_URLS_FILE, 'utf-8').catch(() => '[]'));
    list = list.filter(u => u !== url);
    await fs.writeFile(STOP_URLS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    res.json({ success: true, list });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove stop url' });
  }
});

// Used from global scope
// const RESEARCH_CONCEPTS_FILE = './src/data/research_concepts.json';

app.get('/api/research-concepts', async (req, res) => {
  try {
    // Ensure directory exists
    const dir = path.dirname(RESEARCH_CONCEPTS_FILE);
    await fs.mkdir(dir, { recursive: true });
    
    const data = await fs.readFile(RESEARCH_CONCEPTS_FILE, 'utf-8').catch(() => '[]');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading concepts:', error);
    res.status(500).json({ error: 'Failed to read concepts' });
  }
});

app.post('/api/research-concepts', async (req, res) => {
  try {
    const concepts = req.body;
    // Ensure directory exists
    const dir = path.dirname(RESEARCH_CONCEPTS_FILE);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(RESEARCH_CONCEPTS_FILE, JSON.stringify(concepts, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving concepts:', error);
    res.status(500).json({ error: 'Failed to save concepts' });
  }
});

// --- Word Insight API ---
const WORD_ANALYSIS_FILE = './src/data/word_analysis_result.json';

app.get('/api/analysis/result', async (req, res) => {
    try {
        const data = await fs.readFile(WORD_ANALYSIS_FILE, 'utf-8').catch(() => null);
        
        // Prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (!data) return res.json(null);
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read result' });
    }
});

app.post('/api/analysis/run', async (req, res) => {
    const { type = 'mixed', target = 'all' } = req.body;
    console.log('Triggering NLP Analysis:', type, target);
    
    // Spawn python process
    // Note: Use venv python which has jieba installed
    const pythonScript = path.join(__dirname, 'scripts', 'nlp_analyze.py');
    const pythonExecutable = path.join(__dirname, 'venv/bin/python');
    const pythonProcess = spawn(pythonExecutable, [pythonScript, '--type', type, '--target', target]);

    let output = '';
    
    pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        console.log(`Child process exited with code ${code}`);
        if (code === 0) {
            res.json({ success: true, message: 'Analysis complete' });
        } else {
            res.status(500).json({ error: 'Analysis failed', details: output });
        }
    });
});

app.post('/api/analysis/insight', async (req, res) => {
    const { words, apiKey } = req.body;
    if (!words || !apiKey) return res.status(400).json({ error: 'Missing words or apiKey' });

    try {
        const prompt = `
你是一个学术研究助手。这里是当前数据库中提取出的高频词汇（包含词性），请根据这些词汇，结合“学术研究”领域背景，生成一份简短的研究热点与趋势洞察报告。
前50个高频词：
${JSON.stringify(words.slice(0, 50))}

请从以下几个方面进行分析（使用Markdown格式）：
1. **核心研究主题**：当前最关注的对象是什么？
2. **主要研究方法**：有哪些高频的方法论词汇？
3. **潜在的新兴趋势**：结合你的知识库，指出这些词汇组合可能暗示的新方向。
4. **缺失点**：有哪些重要的翻译学概念可能未被充分覆盖？

请保持专业、客观。不要说“根据提供的列表”，直接给出分析结果。
        `;

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are an expert in Translation Studies and Artificial Intelligence." },
                    { role: "user", content: prompt }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`DeepSeek API Error: ${err}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        res.json({ success: true, content });

    } catch (e) {
        console.error('Insight Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
  console.log(`API Server running at http://localhost:${PORT}`);
});
