import os
from PIL import Image

SCREENSHOTS_DIR = 'screenshots'
TARGET_SIZE = (1280, 800)
BG_COLOR = (248, 250, 252) # #f8fafc

def process_image(filename):
    filepath = os.path.join(SCREENSHOTS_DIR, filename)
    try:
        with Image.open(filepath) as img:
            # Convert to RGB (removes alpha)
            if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                bg = Image.new('RGB', img.size, (255, 255, 255))
                bg.paste(img, mask=img.split()[3] if img.mode == 'RGBA' else None)
                img = bg
            else:
                img = img.convert('RGB')

            # Calculate aspect ratios
            target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
            img_ratio = img.width / img.height

            # If ratio is close (within 15%), resize to fill
            if 0.85 * target_ratio < img_ratio < 1.15 * target_ratio:
                new_img = img.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
            else:
                # Resize to fit
                ratio = min(TARGET_SIZE[0] / img.width, TARGET_SIZE[1] / img.height)
                new_size = (int(img.width * ratio), int(img.height * ratio))
                resized = img.resize(new_size, Image.Resampling.LANCZOS)
                
                # Create background
                new_img = Image.new('RGB', TARGET_SIZE, BG_COLOR)
                
                # Center the image
                x = (TARGET_SIZE[0] - new_size[0]) // 2
                y = (TARGET_SIZE[1] - new_size[1]) // 2
                new_img.paste(resized, (x, y))

            # Save as JPEG
            new_filename = os.path.splitext(filename)[0] + '.jpg'
            new_filepath = os.path.join(SCREENSHOTS_DIR, new_filename)
            
            new_img.save(new_filepath, 'JPEG', quality=90)
            print(f"Processed {filename} -> {new_filename}")

            # Remove original if name changed (e.g. png -> jpg)
            if filename != new_filename:
                os.remove(filepath)
                print(f"Removed original {filename}")

    except Exception as e:
        print(f"Error processing {filename}: {e}")

def main():
    if not os.path.exists(SCREENSHOTS_DIR):
        print(f"Directory {SCREENSHOTS_DIR} not found.")
        return

    files = [f for f in os.listdir(SCREENSHOTS_DIR) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    
    # Limit to 5 if there are more (though user said "Up to 5", if we have more we might need to pick. 
    # But currently we have 4. If we had >5, we should probably warn or just process top 5. 
    # I'll process all existing ones as there are only 4.)
    
    for f in files:
        process_image(f)

if __name__ == '__main__':
    main()
