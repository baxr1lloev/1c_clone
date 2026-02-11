"""
Generate comprehensive PDF documentation for 1C Clone ERP System
"""

import markdown
import pdfkit
from pathlib import Path

# Read the markdown file
md_file = Path(__file__).parent / "COMPLETE_TECHNICAL_DOCUMENTATION.md"
with open(md_file, 'r', encoding='utf-8') as f:
    md_content = f.read()

# Convert markdown to HTML
html_content = markdown.markdown(md_content, extensions=['tables', 'fenced_code', 'codehilite'])

# Add CSS styling
html_with_style = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>1C Clone ERP - Technical Documentation</title>
    <style>
        body {{
            font-family: 'Segoe UI', Helvetica, Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            page-break-before: always;
        }}
        h1:first-child {{
            page-break-before: avoid;
        }}
        h2 {{
            color: #34495e;
            border-bottom: 2px solid #bdc3c7;
            padding-bottom: 8px;
            margin-top: 30px;
        }}
        h3 {{
            color: #7f8c8d;
            margin-top: 25px;
        }}
        code {{
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
        }}
        pre {{
            background-color: #2c3e50;
            color: #ecf0f1;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            page-break-inside: avoid;
        }}
        pre code {{
            background-color: transparent;
            color: #ecf0f1;
            padding: 0;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
            page-break-inside: avoid;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background-color: #3498db;
            color: white;
            font-weight: bold;
        }}
        tr:nth-child(even) {{
            background-color: #f2f2f2;
        }}
        blockquote {{
            border-left: 4px solid #3498db;
            margin-left: 0;
            padding-left: 20px;
            color: #555;
            font-style: italic;
        }}
        .page-break {{
            page-break-after: always;
        }}
        @media print {{
            body {{
                max-width: 100%;
            }}
            pre, blockquote, table {{
                page-break-inside: avoid;
            }}
        }}
    </style>
</head>
<body>
{html_content}
</body>
</html>
"""

# Save HTML
html_file = Path(__file__).parent / "documentation.html"
with open(html_file, 'w', encoding='utf-8') as f:
    f.write(html_with_style)

print(f"HTML file created: {html_file}")

# Try to convert to PDF using wkhtmltopdf (if installed)
try:
    options = {
        'page-size': 'A4',
        'margin-top': '20mm',
        'margin-right': '20mm',
        'margin-bottom': '20mm',
        'margin-left': '20mm',
        'encoding': 'UTF-8',
        'enable-local-file-access': None,
        'print-media-type': None,
    }
    
    pdf_file = Path(__file__).parent / "1C_Clone_ERP_Technical_Documentation.pdf"
    pdfkit.from_file(str(html_file), str(pdf_file), options=options)
    print(f"✓ PDF created successfully: {pdf_file}")
    
except Exception as e:
    print(f"⚠ Could not create PDF using pdfkit: {e}")
    print(f"You can manually convert {html_file} to PDF using:")
    print(f"  - Open {html_file} in Chrome/Edge")
    print(f"  - Press Ctrl+P")
    print(f"  - Select 'Save as PDF'")
