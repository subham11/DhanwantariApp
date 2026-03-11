#!/usr/bin/env python3
"""Convert DhanwantariAI Architecture markdown to a styled PDF using weasyprint."""

import sys
from pathlib import Path

import markdown
from weasyprint import HTML

MD_PATH = Path(__file__).resolve().parent.parent / "Doc" / "DhanwantariAI_Architecture_End_to_End.md"
PDF_PATH = MD_PATH.with_suffix(".pdf")

CSS = """
@page {
    size: A4;
    margin: 2cm 2.5cm;
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9pt;
        color: #666;
    }
    @top-right {
        content: "DhanwantariAI — Confidential";
        font-size: 8pt;
        color: #999;
    }
}
body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
}
h1 {
    font-size: 22pt;
    color: #0d47a1;
    border-bottom: 3px solid #0d47a1;
    padding-bottom: 6px;
    margin-top: 40px;
    page-break-before: always;
}
h1:first-of-type { page-break-before: avoid; }
h2 {
    font-size: 15pt;
    color: #1565c0;
    border-bottom: 1px solid #90caf9;
    padding-bottom: 4px;
    margin-top: 28px;
}
h3 {
    font-size: 12pt;
    color: #1976d2;
    margin-top: 18px;
}
h4 { font-size: 11pt; color: #333; }
code {
    font-family: "SF Mono", "Fira Code", "Consolas", monospace;
    font-size: 9pt;
    background: #f5f5f5;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #e0e0e0;
}
pre {
    background: #263238;
    color: #eeffff;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 8.5pt;
    line-height: 1.45;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
    page-break-inside: avoid;
}
pre code {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
}
th {
    background: #1565c0;
    color: white;
    padding: 8px 10px;
    text-align: left;
    font-weight: 600;
}
td {
    padding: 6px 10px;
    border-bottom: 1px solid #e0e0e0;
}
tr:nth-child(even) td { background: #f8f9fa; }
blockquote {
    border-left: 4px solid #1976d2;
    margin: 12px 0;
    padding: 8px 16px;
    background: #e3f2fd;
    color: #0d47a1;
}
hr {
    border: none;
    border-top: 2px solid #e0e0e0;
    margin: 24px 0;
}
ul, ol { padding-left: 24px; }
li { margin-bottom: 3px; }
strong { color: #0d47a1; }
a { color: #1565c0; text-decoration: none; }
"""


def main():
    md_path = Path(sys.argv[1]) if len(sys.argv) > 1 else MD_PATH
    pdf_path = Path(sys.argv[2]) if len(sys.argv) > 2 else md_path.with_suffix(".pdf")

    md_text = md_path.read_text(encoding="utf-8")

    html_body = markdown.markdown(
        md_text,
        extensions=["tables", "fenced_code", "toc", "attr_list"],
    )

    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><style>{CSS}</style></head>
<body>{html_body}</body>
</html>"""

    HTML(string=full_html).write_pdf(str(pdf_path))
    print(f"PDF saved: {pdf_path}  ({pdf_path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
