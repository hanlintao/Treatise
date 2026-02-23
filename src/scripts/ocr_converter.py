import base64
import os
import requests
import sys
import json
import fitz  # PyMuPDF
import time

# API Configuration
# Default fallback to the original hardcoded values if env vars not set
DEFAULT_API_URL = "https://x4q9me44v532c390.aistudio-app.com/layout-parsing"
DEFAULT_TOKEN = ""

API_URL = os.environ.get("PADDLE_API_URL", DEFAULT_API_URL)
TOKEN = os.environ.get("PADDLE_TOKEN", DEFAULT_TOKEN)

def report_progress(current, total, status="processing", message=""):
    print(json.dumps({
        "type": "progress",
        "current": current,
        "total": total,
        "status": status,
        "message": message
    }), flush=True)

def convert_pdf_to_markdown(file_path, output_dir_md, output_dir_imgs, img_url_prefix):
    """
    Converts PDF to Markdown using Paddle OCR API page by page.
    """
    
    # Open PDF
    try:
        doc = fitz.open(file_path)
        total_pages = len(doc)
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Failed to open PDF: {str(e)}"}), flush=True)
        sys.exit(1)

    report_progress(0, total_pages, "started", "PDF opened, starting conversion...")

    combined_markdown = ""
    
    # Create directories
    os.makedirs(os.path.dirname(output_dir_md), exist_ok=True)
    os.makedirs(output_dir_imgs, exist_ok=True)

    headers = {
        "Authorization": f"token {TOKEN}",
        "Content-Type": "application/json"
    }

    for page_num in range(total_pages):
        try:
            # 1. Render page to image
            page = doc.load_page(page_num)
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2)) # Zoom in for better OCR
            img_data = pix.tobytes("jpg")
            base64_img = base64.b64encode(img_data).decode("ascii")
            
            # 2. Prepare Payload
            payload = {
                "file": base64_img,
                "fileType": 1, # 1 for Image
                "useDocOrientationClassify": False,
                "useDocUnwarping": False,
                "useChartRecognition": False,
            }

            # 3. Call API
            # Retry logic
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    response = requests.post(API_URL, json=payload, headers=headers, timeout=30)
                    if response.status_code == 200:
                        break
                    time.sleep(1) # Wait before retry
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise e
                    time.sleep(1)
            
            if response.status_code != 200:
                print(f"Warning: Page {page_num+1} failed with status {response.status_code}", file=sys.stderr)
                combined_markdown += f"\n\n> [Page {page_num+1} Conversion Failed]\n\n"
                report_progress(page_num + 1, total_pages, "processing", f"Page {page_num+1} failed")
                continue

            result = response.json().get("result")
            if not result:
                combined_markdown += f"\n\n> [Page {page_num+1} No Result]\n\n"
                continue

            layout_results = result.get("layoutParsingResults", [])
            
            for res in layout_results:
                markdown_text = res["markdown"]["text"]
                images_map = res["markdown"].get("images", {})
                
                # Handle images in the page
                for img_rel_path, img_url in images_map.items():
                    img_filename = os.path.basename(img_rel_path)
                    unique_img_name = f"p{page_num}_{img_filename}"
                    full_img_save_path = os.path.join(output_dir_imgs, unique_img_name)
                    
                    try:
                        img_response = requests.get(img_url, timeout=10)
                        if img_response.status_code == 200:
                            with open(full_img_save_path, "wb") as img_file:
                                img_file.write(img_response.content)
                            
                            public_img_url = os.path.join(img_url_prefix, unique_img_name)
                            markdown_text = markdown_text.replace(f"({img_rel_path})", f"({public_img_url})")
                    except Exception:
                        pass # Ignore image download failures
                
                combined_markdown += markdown_text + "\n\n"
            
            report_progress(page_num + 1, total_pages, "processing", f"Converted page {page_num+1}/{total_pages}")
            
        except Exception as e:
            print(f"Error processing page {page_num}: {str(e)}", file=sys.stderr)
            combined_markdown += f"\n\n> [Error processing page {page_num+1}]\n\n"
            report_progress(page_num + 1, total_pages, "processing", f"Error on page {page_num+1}")

    # 4. Save Markdown
    with open(output_dir_md, "w", encoding="utf-8") as f:
        f.write(combined_markdown)
    
    print(json.dumps({
        "type": "complete",
        "markdown_path": output_dir_md,
        "total_pages": total_pages
    }), flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python ocr_converter.py <pdf_path> <output_md_path> <output_img_dir> <img_url_prefix>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    output_md_path = sys.argv[2]
    output_img_dir = sys.argv[3]
    img_url_prefix = sys.argv[4]
    
    convert_pdf_to_markdown(pdf_path, output_md_path, output_img_dir, img_url_prefix)
