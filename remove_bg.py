from PIL import Image
import sys

def remove_black_background(input_path, output_path, threshold=20):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    for item in datas:
        # Change all black (also shades of black)
        # to transparent
        if item[0] < threshold and item[1] < threshold and item[2] < threshold:
            # Calculate alpha based on how far it is from threshold for smoother edges
            alpha = int((max(item[0], item[1], item[2]) / threshold) * 255)
            # If it's very dark, make it fully transparent
            if max(item[0], item[1], item[2]) < threshold / 2:
                new_data.append((0, 0, 0, 0))
            else:
                new_data.append((item[0], item[1], item[2], alpha))
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    img.save(output_path, "PNG")

if __name__ == "__main__":
    remove_black_background(sys.argv[1], sys.argv[2])
