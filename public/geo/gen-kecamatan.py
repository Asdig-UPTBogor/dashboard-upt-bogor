import json, math

# GI coordinates per ULTG
gi_coords = {
    "BOGOR": [
        (106.82083, -6.59387), (106.79200, -6.47310), (106.50533, -6.50644),
        (106.84840, -6.65751), (106.91392, -6.44112), (106.89114, -6.48467),
        (106.80181, -6.55945), (106.93648, -6.45636), (106.85652, -6.52520),
        (106.91383, -6.43942), (106.95318, -6.43192), (106.64416, -6.61712),
        (106.75725, -6.57028), (106.83832, -6.62834), (106.91625, -6.44031),
    ],
    "SUKABUMI": [
        (106.76582, -6.86561), (106.89223, -6.95728), (106.86377, -6.97293),
        (106.76644, -6.86550), (106.75506, -6.95024), (106.54507, -7.02227),
        (106.67292, -6.74026), (106.64828, -6.74188),
    ],
}

# Ray casting point-in-polygon
def point_in_polygon(x, y, polygon):
    n = len(polygon)
    inside = False
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside

def point_in_feature(lng, lat, feature):
    geom = feature["geometry"]
    coords = geom["coordinates"]
    if geom["type"] == "Polygon":
        for ring in coords:
            if point_in_polygon(lng, lat, ring):
                return True
    elif geom["type"] == "MultiPolygon":
        for poly in coords:
            for ring in poly:
                if point_in_polygon(lng, lat, ring):
                    return True
    return False

# Load GADM L3
print("Loading GADM Level 3...")
with open("gadm41_IDN_3.json") as f:
    gadm = json.load(f)

print(f"Total kecamatan in Indonesia: {len(gadm['features'])}")

# First, pre-filter to Bogor/Sukabumi region (bounding box)
# Bogor+Sukabumi area: lng 106.3-107.1, lat -7.5 to -6.2
candidates = []
for feat in gadm["features"]:
    props = feat["properties"]
    name2 = props.get("NAME_2", "")
    # Filter to relevant kabupaten/kota
    if any(k in name2.upper() for k in ["BOGOR", "SUKABUMI"]):
        candidates.append(feat)

print(f"Kecamatan in Bogor/Sukabumi area: {len(candidates)}")

# Now find which kecamatan contain GI markers
matched_features = []
matched_names = []

for feat in candidates:
    props = feat["properties"]
    kecamatan = props.get("NAME_3", "")
    kabupaten = props.get("NAME_2", "")
    
    # Determine ULTG based on kabupaten name
    if "BOGOR" in kabupaten.upper():
        ultg = "BOGOR"
    elif "SUKABUMI" in kabupaten.upper():
        ultg = "SUKABUMI"
    else:
        continue
    
    # Check if any GI from this ULTG falls in this kecamatan
    has_gi = False
    gi_in = []
    for lng, lat in gi_coords[ultg]:
        if point_in_feature(lng, lat, feat):
            has_gi = True
            gi_in.append(f"({lng:.4f}, {lat:.4f})")
    
    if has_gi:
        # Simplify properties
        new_feat = {
            "type": "Feature",
            "properties": {
                "name": kecamatan,
                "ultg": ultg,
                "kabupaten": kabupaten,
            },
            "geometry": feat["geometry"]
        }
        matched_features.append(new_feat)
        matched_names.append(f"  {ultg:10s} | {kabupaten:20s} | {kecamatan:20s} | {len(gi_in)} GI")

print(f"\nKecamatan with GI markers: {len(matched_features)}")
for name in sorted(matched_names):
    print(name)

# Save output
output = {"type": "FeatureCollection", "features": matched_features}
out_path = "ultg-regions.json"
with open(out_path, "w") as f:
    json.dump(output, f)

size = len(json.dumps(output))
print(f"\nSaved {out_path}: {len(matched_features)} features, {size} bytes")
