import os
import json
import shutil
import zipfile

def build_firefox_zip():
    src_dir = r"c:\Users\nrame\OneDrive\Desktop\Link Sharing App\extension"
    dist_dir = r"c:\Users\nrame\OneDrive\Desktop\Link Sharing App\firefox_dist"
    zip_path = r"c:\Users\nrame\OneDrive\Desktop\Link Sharing App\kurate-firefox.zip"

    # Clean up
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    if os.path.exists(zip_path):
        os.remove(zip_path)

    # Copy files
    shutil.copytree(src_dir, dist_dir)

    # Fix manifest.json for Firefox
    manifest_path = os.path.join(dist_dir, "manifest.json")
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    # Firefox MV3 prefers 'scripts' over 'service_worker' in background
    if 'background' in manifest:
        if 'service_worker' in manifest['background']:
            # Move service_worker to scripts if not already there
            sw = manifest['background'].pop('service_worker')
            if 'scripts' not in manifest['background']:
                manifest['background']['scripts'] = [sw]
            elif sw not in manifest['background']['scripts']:
                manifest['background']['scripts'].append(sw)
        
        # Firefox doesn't support 'service_worker' as a key in 'background' for some versions
        # and it can cause validation errors if both exist. 
        # Actually, in most recent FF versions it works, but 'scripts' is safer for cross-browser.

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=4)

    # Create ZIP with forward slashes
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Calculate the path inside the archive - must use forward slashes
                arcname = os.path.relpath(file_path, dist_dir).replace(os.path.sep, '/')
                zipf.write(file_path, arcname)

    # Final cleanup
    shutil.rmtree(dist_dir)
    print(f"Successfully created {zip_path}")

if __name__ == "__main__":
    build_firefox_zip()
