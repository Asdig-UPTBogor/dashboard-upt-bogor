const fs = require('fs');
const dir = '/home/server-01/Workspace/GCP Project/Dashboard-UPT-Bogor/dashboard/public/geo';

// Only REAL data kabupaten - NO Cianjur
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
    console.log(ultg + ': ' + fname);
  });
});

const out = { type: 'FeatureCollection', features };
fs.writeFileSync(dir + '/ultg-regions.json', JSON.stringify(out));
console.log('Done! ' + features.length + ' features, ' + fs.statSync(dir + '/ultg-regions.json').size + ' bytes');
