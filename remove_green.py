from PIL import Image
import sys
import math

def chroma_key(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    width, height = img.size

    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # Simple green screen removal
            # The background is extremely bright green: (0..50, 200..255, 0..50)
            if g > 150 and r < g * 0.5 and b < g * 0.5:
                # Calculate alpha based on how "green" it is, for smooth edges
                # Pure green -> alpha = 0
                green_ratio = g / max((r + b) / 2, 1)
                
                if green_ratio > 3.0:
                    pixels[x, y] = (0, 0, 0, 0)
                else:
                    # Edge transition pixel
                    # Try to remove the green cast and make it partially transparent
                    new_a = int(255 * (3.0 - green_ratio) / 2.0)
                    new_a = max(0, min(255, new_a))
                    # Desaturate the green spike by averaging R and B
                    new_g = int((r + b) / 2)
                    pixels[x, y] = (r, new_g, b, new_a)

    img.save(output_path, "PNG")
    print("Background removed successfully!")

if __name__ == "__main__":
    chroma_key(sys.argv[1], sys.argv[2])
