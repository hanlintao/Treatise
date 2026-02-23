
// Simple JWT generation for Zhipu (if needed, but V4 often accepts raw key if SDK handles it, 
// here we might need to handle it if raw key fails. But for now, we follow existing server.js pattern).
// Actually, Zhipu *requires* JWT for raw HTTP calls. 
// If the existing server.js works without it, maybe the user puts a token?
// I will implement a JWT generator just in case, using 'crypto' from Node.
import crypto from 'crypto';

function generateToken(apiKey, expireSeconds = 600) {
    try {
        const [id, secret] = apiKey.split('.');
        if (!id || !secret) return apiKey; // Return raw if not in id.secret format

        const now = Date.now();
        const payload = {
            api_key: id,
            exp: now + (expireSeconds * 1000),
            timestamp: now,
        };

        const header = {
            alg: 'HS256',
            sign_type: 'SIGN',
        };

        const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
        const signature = crypto
            .createHmac('sha256', secret)
            .update(`${encode(header)}.${encode(payload)}`)
            .digest('base64url');

        return `${encode(header)}.${encode(payload)}.${signature}`;
    } catch (e) {
        return apiKey;
    }
}

export function chunkText(text, maxChars = 1000, overlap = 200) {
    if (!text) return [];
    
    // Split by double newlines to respect paragraphs
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';
    
    for (const para of paragraphs) {
        // Cleaning
        const cleanPara = para.trim();
        if (!cleanPara) continue;

        if ((currentChunk + '\n\n' + cleanPara).length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            
            // Overlap strategy
            if (overlap > 0 && currentChunk.length > overlap) {
                // Take last 'overlap' characters, but try to cut at a space
                let start = currentChunk.length - overlap;
                let overlapText = currentChunk.slice(start);
                // Adjust to space
                const firstSpace = overlapText.indexOf(' ');
                if (firstSpace > 0 && firstSpace < 20) {
                    overlapText = overlapText.slice(firstSpace + 1);
                }
                currentChunk = overlapText + '\n\n' + cleanPara;
            } else {
                currentChunk = cleanPara;
            }
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + cleanPara;
        }
    }
    
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }
    
    // Safety check: if any chunk is still too huge (single massive paragraph), hard split it
    const finalChunks = [];
    for (const chunk of chunks) {
        if (chunk.length > maxChars * 1.5) {
             let remaining = chunk;
             while (remaining.length > 0) {
                 finalChunks.push(remaining.slice(0, maxChars));
                 remaining = remaining.slice(maxChars - overlap);
                 if (remaining.length <= overlap) break; 
             }
        } else {
            finalChunks.push(chunk);
        }
    }
    
    return finalChunks;
}

export async function generateZhipuEmbedding(text, apiKey, dimensions = 2048) {
    if (!apiKey) throw new Error("API Key is required");
    
    // Ensure we have a valid token
    const token = generateToken(apiKey);
    
    const url = 'https://open.bigmodel.cn/api/paas/v4/embeddings';
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "embedding-3",
                input: text,
                dimensions: dimensions 
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Zhipu API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].embedding;
        } else {
            throw new Error("No embedding returned");
        }
    } catch (e) {
        console.error("Zhipu Embedding Failed:", e.message);
        throw e;
    }
}
