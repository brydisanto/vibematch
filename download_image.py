import urllib.request
import os
url = "http://localhost:3000/bg-new.jpg"
outpath = "/Users/bryan/.gemini/antigravity/playground/vibematch/public/assets/bg-new.jpg"
urllib.request.urlretrieve(url, outpath)
print(f"Downloaded to {outpath}")
