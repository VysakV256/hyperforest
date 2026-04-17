import os
import random
import json
import urllib.request
import xml.etree.ElementTree as ET
import concurrent.futures

base_dir = "/Users/vysak/Explorations/Hyperforest"
themes = ["Dynamics", "Structure", "Emergence", "Potentiality", "Utopia"]

datasets = []
if os.path.exists(base_dir):
    for entry in os.listdir(base_dir):
        if entry.startswith("knb-lter-") and os.path.isdir(os.path.join(base_dir, entry)):
            datasets.append(entry)

random.seed(42)

def process_dataset(ds):
    try:
        scope, identifier, revision = ds.split(".")
    except:
        return None
    meta_url = f"https://pasta.lternet.edu/package/metadata/eml/{scope}/{identifier}/{revision}"
    title = ds
    abstract = ""
    keywords = []
    
    try:
        req = urllib.request.Request(meta_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read().decode('utf-8')
            root = ET.fromstring(xml_data)
            
            title_node = root.find('.//title')
            if title_node is not None and title_node.text:
                title = title_node.text.strip().replace('\n', ' ')
                
            abstract_node = root.find('.//abstract/para')
            if abstract_node is not None and abstract_node.text:
                abstract = abstract_node.text.strip().replace('\n', ' ')[:300] + "..."
            elif root.find('.//abstract') is not None and ''.join(root.find('.//abstract').itertext()):
                abstract = ''.join(root.find('.//abstract').itertext()).strip().replace('\n', ' ')[:300] + "..."
            
            for kw in root.findall('.//keyword'):
                if kw.text:
                    keywords.append(kw.text.strip().replace('\n', ' '))
    except Exception as e:
        print(f"Error fetching metadata for {ds}: {e}")

    num_themes = random.choices([1, 2], weights=[0.8, 0.2])[0]
    
    text_content = (title + " " + " ".join(keywords) + " " + abstract).lower()
    assigned_themes = []
    if any(w in text_content for w in ["dynamic", "change", "rate", "time", "series", "flow", "flux", "weather", "stream", "precipitation"]): assigned_themes.append("Dynamics")
    if any(w in text_content for w in ["structure", "spatial", "map", "forest", "tree", "canopy", "soil", "wood", "biomass"]): assigned_themes.append("Structure")
    if any(w in text_content for w in ["emergence", "growth", "new", "seedling", "regeneration", "phenology", "spring", "bird", "insect"]): assigned_themes.append("Emergence")
    if any(w in text_content for w in ["potential", "future", "model", "predict", "climate", "scenario", "capacity", "chemistry", "nutrient"]): assigned_themes.append("Potentiality")
    if any(w in text_content for w in ["utopia", "ideal", "balance", "ecosystem", "restore", "conservation", "long-term", "biodiversity"]): assigned_themes.append("Utopia")
    
    if not assigned_themes:
        assigned_themes = random.sample(themes, num_themes)
    else:
        assigned_themes = list(set(assigned_themes))[:num_themes]
        if len(assigned_themes) == 0:
            assigned_themes = random.sample(themes, 1)
        
    ds_path = os.path.join(base_dir, ds)
    files = []
    try:
        files = [f for f in os.listdir(ds_path) if os.path.isfile(os.path.join(ds_path, f))]
        files = [f for f in files if not f.startswith('.')]
        files = files[:5] 
    except Exception:
        pass
    
    node = {
        "id": ds,
        "name": title,
        "package": ds,
        "group": "dataset",
        "val": 3,
        "themes": assigned_themes,
        "files": files,
        "abstract": abstract,
        "keywords": keywords[:5]
    }
    
    links = []
    for t in assigned_themes:
        links.append({
            "source": ds,
            "target": t,
            "value": 1
        })
        
    return node, links

print("Starting metadata fetch for", len(datasets), "datasets...")
nodes = []
links = []

for theme in themes:
    nodes.append({
        "id": theme,
        "name": theme,
        "group": "theme",
        "val": 15
    })

with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
    results = list(executor.map(process_dataset, datasets))
    
for res in results:
    if res is not None:
        nd, lks = res
        nodes.append(nd)
        links.extend(lks)

graph_data = {
    "nodes": nodes,
    "links": links
}

out_path = "/Users/vysak/Explorations/hyperforest-viz/src/datasets.json"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w") as f:
    json.dump(graph_data, f, indent=2)

print(f"Generated {len(nodes)} nodes and {len(links)} links. Saved to {out_path}")
