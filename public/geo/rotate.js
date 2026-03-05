const fs = require('fs');
const dir = '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/dashboard/public/geo';

// Rebuild from source + rotate 90° CW (Bogor=left, Sukabumi=right)
const ultgMap = {
  BOGOR: ['bogor-kab.geojson', 'bogor-kota.geojson'],
  SUKABUMI: ['sukabumi-kab.geojson', 'sukabumi-kota.geojson'],
};

const features = [];
Object.entries(ultgMap).forEach(([ultg, files]) => {
  files.forEach((fname, i) => {
    const geo = JSON.parse(fs.readFileSync(dir + '/' + fname, 'utf8'));
    (geo.features || []).forEach(feat => {
      feat.properties.name = i === 0 ? ultg : ultg + '_' + i;
      feat.properties.ultg = ultg;
      features.push(feat);
    });
  });
});

// Rotate 90° CW around center
const cx = 106.75, cy = -6.75;
function rot(c) {
  const x = c[0] - cx, y = c[1] - cy;
  // 90° CW: new_x = cx + y, new_y = cy - x  (cos90=0, sin90=-1 for CW)
  return [+(cx - y).toFixed(7), +(cy + x).toFixed(7)];
}
function walk(a) { return typeof a[0] === 'number' ? rot(a) : a.map(walk); }

features.forEach(f => { f.geometry.coordinates = walk(f.geometry.coordinates); });

const out = { type: 'FeatureCollection', features };
fs.writeFileSync(dir + '/ultg-regions.json', JSON.stringify(out));
console.log('Done! ' + features.length + ' features, rotated 90° CW');
