
import os

index_path = r'c:\Users\nrame\OneDrive\Desktop\Link Sharing App\src\index.js'
snippet_path = r'c:\Users\nrame\OneDrive\Desktop\Link Sharing App\src\new_styles_snippet.js'

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

with open(snippet_path, 'r', encoding='utf-8') as f:
    new_css_func = f.read()

start_marker = 'function getStylesCSS() {'
end_marker = 'function getAppJS() {'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Error: Could not find markers")
    exit(1)

# Keep the end_marker, replace up to it
new_content = content[:start_idx] + new_css_func + "\n\n" + content[end_idx:]

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated index.js")
