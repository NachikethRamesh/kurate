import os
import shutil
import zipfile

def build_chrome_zip():
    src_dir = r"c:\Users\nrame\OneDrive\Desktop\Link Sharing App\extension"
    dist_dir = r"c:\Users\nrame\OneDrive\Desktop\Link Sharing App\chrome_dist"
    zip_path = r"c:\Users\nrame\OneDrive\Desktop\Link Sharing App\kurate-chrome.zip"

    # Clean up
    if os.path.exists(dist_dir):
        shutil.rmtree(dist_dir)
    if os.path.exists(zip_path):
        os.remove(zip_path)

    # Copy files
    shutil.copytree(src_dir, dist_dir)

    # Chrome manifest is already in the correct format in the source dir
    # No modifications needed like Firefox requires

    # Create ZIP with forward slashes
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(dist_dir):
            for file in files:
                # Skip README and other non-extension files if necessary, 
                # but standard practice is to include them if they aren't harmful
                if file.endswith('.md'):
                    continue
                    
                file_path = os.path.join(root, file)
                # Calculate the path inside the archive - must use forward slashes
                arcname = os.path.relpath(file_path, dist_dir).replace(os.path.sep, '/')
                zipf.write(file_path, arcname)

    # Final cleanup
    shutil.rmtree(dist_dir)
    print(f"Successfully created {zip_path}")

if __name__ == "__main__":
    build_chrome_zip()
