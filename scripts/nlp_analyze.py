import sys
import json
import os
import jieba
import jieba.posseg as pseg
import argparse
from collections import Counter, defaultdict
import re

# 配置路径
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(CURRENT_DIR) # treatise/
DATA_DIR = os.path.join(PROJECT_ROOT, 'src', 'data')
PUBLIC_PAPERS_DIR = os.path.join(PROJECT_ROOT, 'public', 'papers')
STOP_WORDS_FILE = os.path.join(DATA_DIR, 'stop_words.txt')
OUTPUT_FILE = os.path.join(DATA_DIR, 'word_analysis_result.json')
REFERENCES_FILE = os.path.join(DATA_DIR, 'references.json')

def load_stop_words():
    stop_words = set()
    if os.path.exists(STOP_WORDS_FILE):
        with open(STOP_WORDS_FILE, 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip()
                if word and not word.startswith('//'):
                    stop_words.add(word)
    return stop_words

def clean_text(text):
    if not text:
        return ""
    # 去除 Markdown 标记, 但保留标点以便分句
    text = re.sub(r'\!\[.*?\]\(.*?\)', '', text) # 图片
    text = re.sub(r'\[.*?\]\(.*?\)', '', text)   # 链接
    text = re.sub(r'[#*`>]', ' ', text)          # 符号, 保留 - 可能是负号
    return text

def split_sentences(text):
    # 简单的分句策略
    return re.split(r'(。|！|？|\.|\!|\?|\n)', text)

def process_text(text, stop_words, stats, current_source_id, year_map):
    # Unpack stats
    word_counter = stats['word_counter']
    pos_map = stats['pos_map']
    word_sources = stats['word_sources']
    word_snippets = stats['word_snippets']
    word_co = stats['word_co']
    word_years = stats['word_years']

    # Yearly info
    current_year = year_map.get(str(current_source_id), 'Unknown')

    # Allowed POS: expanded to include adjectives, adverbs, idioms, people
    allowed_pos = {
        'n', 'vn', 'ns', 'nt', 'nz', 'nr', 'eng',  # Nouns & Proper Nouns (nr=person)
        'v', 'vd',                           # Verbs
        'a', 'ad', 'an', 'ag', 'al',         # Adjectives
        'd',                                 # Adverbs
        'i'                                  # Idioms
    } 
    
    # Pre-clean
    text = clean_text(text)
    
    # Split into sentences to capture context and limit co-occurrence to sentence boundary
    sentences = split_sentences(text)
    
    # Re-join delimiters to sentences (simple logic)
    # A cleaner way is just iteration
    full_sentences = []
    temp_sent = ""
    for part in sentences:
        temp_sent += part
        if re.match(r'[。！?\.!\?\n]', part):
            if temp_sent.strip():
                full_sentences.append(temp_sent.strip())
            temp_sent = ""
    if temp_sent.strip():
        full_sentences.append(temp_sent.strip())

    for sent_idx, sentence in enumerate(full_sentences):
        if len(sentence) < 5: continue

        words = pseg.cut(sentence)
        tokens = []
        
        # Filter and Collect
        for word, flag in words:
            word = word.strip()
            if len(word) < 2: continue
            if word in stop_words: continue
            
            # Record All valid tokens in this sentence for co-occurrence
            if flag in allowed_pos or (flag == 'eng' and len(word) > 2):
                tokens.append(word)
                
                # Basic Stats
                word_counter[word] += 1
                if word not in pos_map: pos_map[word] = flag
                
                # Source
                if current_source_id:
                    if word not in word_sources: word_sources[word] = set()
                    word_sources[word].add(str(current_source_id))
                
                # Year
                if current_year != 'Unknown':
                    if word not in word_years: word_years[word] = Counter()
                    word_years[word][current_year] += 1

                # Snippets (KWIC) - Limit to 5 per word
                if word not in word_snippets: word_snippets[word] = []
                if len(word_snippets[word]) < 5:
                    # Avoid duplicates if possible
                    if not any(sentence in s for s in word_snippets[word]):
                        # Truncate if too long
                        display_sent = sentence
                        if len(display_sent) > 100:
                            if word in display_sent:
                                idx = display_sent.index(word)
                                start = max(0, idx - 40)
                                end = min(len(display_sent), idx + 40)
                                display_sent = "..." + display_sent[start:end] + "..."
                            else:
                                display_sent = display_sent[:100] + "..."
                        word_snippets[word].append(display_sent)

        # Co-occurrence (Window size 5)
        for i in range(len(tokens)):
            target = tokens[i]
            if target not in word_co: word_co[target] = Counter()
            
            start = max(0, i - 5)
            end = min(len(tokens), i + 5 + 1)
            
            for j in range(start, end):
                if i == j: continue
                neighbor = tokens[j]
                word_co[target][neighbor] += 1

def analyze_references(stop_words, stats, target_ids, year_map):
    if not os.path.exists(REFERENCES_FILE): return

    with open(REFERENCES_FILE, 'r', encoding='utf-8') as f:
        refs = json.load(f)

    count = 0
    for ref in refs:
        if target_ids and str(ref['id']) not in target_ids: continue
        
        current_id = str(ref['id'])
        
        # 关键词权重 x5 -> Repeat text
        keywords = ref.get('keywords', [])
        if isinstance(keywords, str): keywords = [keywords]
        kw_text = (" ".join(keywords) + "。") * 5
        
        # 标题权重 x3
        title_text = (ref.get('title', '') + "。") * 3
        
        abstract = ref.get('abstract', '')
        
        full_text = f"{title_text} {kw_text} {abstract}"
        process_text(full_text, stop_words, stats, current_id, year_map)
        count += 1
    
    print(f"Processed {count} references.")

def analyze_papers(stop_words, stats, target_ids, year_map):
    if not os.path.exists(PUBLIC_PAPERS_DIR): return
    
    search_dirs = []
    if target_ids:
        for tid in target_ids:
            target_dir = os.path.join(PUBLIC_PAPERS_DIR, str(tid))
            if os.path.exists(target_dir):
                search_dirs.append((str(tid), target_dir))
    else:
        for d in os.listdir(PUBLIC_PAPERS_DIR):
            full_path = os.path.join(PUBLIC_PAPERS_DIR, d)
            if os.path.isdir(full_path):
                search_dirs.append((d, full_path))
    
    count = 0
    for ref_id, d in search_dirs:
        for fname in os.listdir(d):
            if fname.endswith('.md'):
                fpath = os.path.join(d, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        content = f.read()
                        process_text(clean_text(content), stop_words, stats, ref_id, year_map)
                        count += 1
                except Exception as e:
                    print(f"Error reading {fpath}: {e}")
    
    print(f"Processed {count} paper markdown files.")

def get_year_map():
    mapping = {}
    if os.path.exists(REFERENCES_FILE):
        try:
            with open(REFERENCES_FILE, 'r', encoding='utf-8') as f:
                refs = json.load(f)
                for r in refs:
                    if 'id' in r and 'year' in r:
                        mapping[str(r['id'])] = str(r['year'])
        except:
            pass
    return mapping

def main():
    parser = argparse.ArgumentParser(description='Word Insight Analysis')
    parser.add_argument('--type', choices=['references', 'papers', 'mixed'], default='mixed')
    parser.add_argument('--target', default='all')
    
    args = parser.parse_args()
    
    target_ids = None
    if args.target and args.target != 'all':
        # Enhanced splitting to handle potential whitespace
        target_ids = set([t.strip() for t in args.target.split(',') if t.strip()])
    
    stop_words = load_stop_words()
    year_map = get_year_map()
    
    # Combined stats object
    stats = {
        'word_counter': Counter(),
        'pos_map': {},
        'word_sources': {},
        'word_snippets': {},
        'word_co': {}, # nested Counter
        'word_years': {} # nested Counter
    }
    
    print("Starting analysis...")
    print(f"Type: {args.type}, Target: {args.target}")

    if args.type in ['references', 'mixed']:
        analyze_references(stop_words, stats, target_ids, year_map)
        
    if args.type in ['papers', 'mixed']:
        analyze_papers(stop_words, stats, target_ids, year_map)
        
    # Format Output
    result_list = []
    # Limit to Top 500
    for word, freq in stats['word_counter'].most_common(500):
        # Top 10 co-occurring words
        co_words = []
        if word in stats['word_co']:
            co_words = [{"name": k, "value": v} for k, v in stats['word_co'][word].most_common(10)]
            
        result_list.append({
            "name": word,
            "value": freq,
            "pos": stats['pos_map'].get(word, 'unknown'),
            "sources": list(stats['word_sources'].get(word, set())),
            "snippets": stats['word_snippets'].get(word, []),
            "co_occurrence": co_words,
            "yearly": dict(stats['word_years'].get(word, Counter()))
        })
        
    output_data = {
        "meta": {
            "type": args.type,
            "target": args.target,
            "total_words": sum(stats['word_counter'].values()),
            "unique_words": len(stats['word_counter'])
        },
        "word_list": result_list
    }
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print(f"Analysis complete. Saved to {OUTPUT_FILE}")
    print(json.dumps(output_data['meta']))

if __name__ == "__main__":
    main()
