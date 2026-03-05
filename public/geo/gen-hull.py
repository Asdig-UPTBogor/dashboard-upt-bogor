import json, math

bogor_gis = [
    [106.82083, -6.59387], [106.79200, -6.47310], [106.50533, -6.50644],
    [106.84840, -6.65751], [106.91392, -6.44112], [106.89114, -6.48467],
    [106.80181, -6.55945], [106.93648, -6.45636], [106.85652, -6.52520],
    [106.91383, -6.43942], [106.95318, -6.43192], [106.64416, -6.61712],
    [106.75725, -6.57028], [106.83832, -6.62834], [106.91625, -6.44031],
]
sukabumi_gis = [
    [106.76582, -6.86561], [106.89223, -6.95728], [106.86377, -6.97293],
    [106.76644, -6.86550], [106.75506, -6.95024], [106.54507, -7.02227],
    [106.67292, -6.74026], [106.64828, -6.74188],
]

def cross(O, A, B):
    return (A[0]-O[0])*(B[1]-O[1]) - (A[1]-O[1])*(B[0]-O[0])

def convex_hull(points):
    points = sorted(set(map(tuple, points)))
    if len(points) <= 1: return list(points)
    lower = []
    for p in points:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0: lower.pop()
        lower.append(p)
    upper = []
    for p in reversed(points):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0: upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]

def buffer_hull(hull, buf=0.06):
    cx = sum(p[0] for p in hull) / len(hull)
    cy = sum(p[1] for p in hull) / len(hull)
    out = []
    for p in hull:
        dx, dy = p[0] - cx, p[1] - cy
        d = math.sqrt(dx*dx + dy*dy)
        if d == 0: continue
        s = (d + buf) / d
        out.append([round(cx + dx*s, 6), round(cy + dy*s, 6)])
    out.append(out[0])
    return out

features = []
for ultg, pts in [("BOGOR", bogor_gis), ("SUKABUMI", sukabumi_gis)]:
    hull = convex_hull(pts)
    buf = buffer_hull(hull)
    features.append({
        "type": "Feature",
        "properties": {"name": ultg, "ultg": ultg},
        "geometry": {"type": "Polygon", "coordinates": [buf]}
    })
    print(f"{ultg}: {len(pts)} GI -> {len(hull)} hull -> buffered")

geo = {"type": "FeatureCollection", "features": features}
with open('/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/dashboard/public/geo/ultg-regions.json', 'w') as f:
    json.dump(geo, f)
print("Done!")
