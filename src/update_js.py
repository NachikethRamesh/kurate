
import os

index_path = r'c:\Users\nrame\OneDrive\Desktop\Link Sharing App\src\index.js'
snippet_path = r'c:\Users\nrame\OneDrive\Desktop\Link Sharing App\src\new_render_links_snippet.js'

with open(index_path, 'r', encoding='utf-8') as f:
    content = f.read()

with open(snippet_path, 'r', encoding='utf-8') as f:
    new_func = f.read()

start_marker = 'renderLinks() {'
end_marker = 'async copyLink(url) {'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Error: Could not find markers")
    print(f"Start found: {start_idx != -1}")
    print(f"End found: {end_idx != -1}")
    # Fallback search for copyLink without async if needed, but I saw async
    if end_idx == -1:
         end_marker = 'copyLink(url) {'
         end_idx = content.find(end_marker)
         if end_idx == -1:
             print("Error: Could not find end marker strict or loose")
             exit(1)

# Preserve end marker
new_content = content[:start_idx] + new_func + "\n\n    " + content[end_idx:]

with open(index_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated renderLinks in index.js")
