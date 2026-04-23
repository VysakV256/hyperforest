import urllib.request
import os
import re

print("Initializing Hubbard Brook Photo Scraper...")

# We extract raw image paths from the general galleries
categories = [10, 15, 18, 34]
image_urls = []

for cat in categories:
    url = f"http://data.hubbardbrook.org/photos/index.php?/category/{cat}"
    try:
        html = urllib.request.urlopen(url).read().decode('utf-8')
        # Find all image paths
        matches = re.findall(r'src=\"([^\"]+\.jpg)\"', html)
        for m in matches:
            # Upgrade thumb (-th) or extra-small (-xs) to medium (-me) or huge (-la) for the manifold
            m_highres = m.replace('-th.jpg', '-me.jpg').replace('-xs.jpg', '-me.jpg')
            if m_highres.startswith('./'):
                full_url = "http://data.hubbardbrook.org/photos/" + m_highres[2:]
            elif m_highres.startswith('_data/'):
                full_url = "http://data.hubbardbrook.org/photos/" + m_highres
            else:
                continue
                
            if full_url not in image_urls:
                image_urls.append(full_url)
    except Exception as e:
        print(f"Failed parsing category {cat}: {e}")

os.makedirs('public/backgrounds', exist_ok=True)

success_count = 0
for url in image_urls:
    if success_count >= 5: # We only need 5 rich textures for the shader manifold
        break
    try:
        urllib.request.urlretrieve(url, f'public/backgrounds/bg_{success_count}.jpg')
        success_count += 1
        print(f"Successfully scraped texture layer {success_count}...")
    except Exception as e:
        print(f"Skipping texture due to error: {e}")

print("Generative textures structurally compiled into public/backgrounds/!")
