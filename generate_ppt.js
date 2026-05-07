const pptxgen = require('pptxgenjs');

async function createPresentation() {
  const pptx = new pptxgen();

  // Set PPT metadata and layout
  pptx.author = 'UPT Bogor Dashboard';
  pptx.company = 'PLN';
  pptx.title = 'Dashboard UPT Bogor';
  pptx.layout = 'LAYOUT_16x9';

  // Define Colors
  const COLORS = {
    Kritis: '3b82f6',     // Blue
    Bahaya2: 'facc15',    // Yellow
    Bahaya1: 'ef4444',    // Red
    Target: '3b82f6',     // Blue
    Realisasi: '0f766e',  // Dark Teal
    VeryGood: '00ff00',
    Good: 'a3e635',
    Fair: 'facc15',
    Poor: 'fb923c',
    VeryPoor: 'ef4444',
    Background: 'f8fafc', // Light slate
    Title: '1e293b'       // Dark slate
  };

  // Add a slide
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.Background };

  // Title
  slide.addText('DASHBOARD UPT BOGOR', {
    x: 0.5,
    y: 0.3,
    w: '90%',
    h: 0.5,
    fontSize: 24,
    bold: true,
    color: COLORS.Title,
    align: 'center'
  });

  // 1. Line Chart: Trending Tegakan
  const chartDataTrending = [
    {
      name: 'Bahaya 2',
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      values: [40082, 38292, 37761, 41773]
    },
    {
      name: 'Bahaya 1',
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      values: [33405, 31835, 29560, 20154]
    },
    {
      name: 'Kritis',
      labels: ['Jan', 'Feb', 'Mar', 'Apr'],
      values: [0, 0, 0, 0]
    }
  ];

  slide.addChart(pptx.ChartType.line, chartDataTrending, {
    x: 0.5,
    y: 1.0,
    w: 5.5,
    h: 3.5,
    chartColors: [COLORS.Bahaya2, COLORS.Bahaya1, COLORS.Kritis],
    showTitle: true,
    title: 'Trending Tegakan UPT Bogor',
    titleColor: COLORS.Title,
    titleFontSize: 16,
    showLegend: true,
    legendPos: 'b',
    showValue: true,
    lineDataSymbol: 'circle'
  });

  // 2. Bar Chart (Horizontal): Anti Binatang Tower
  const chartDataAntiBinatang = [
    {
      name: 'Target',
      labels: ['Anti Binatang'],
      values: [16]
    },
    {
      name: 'Realisasi',
      labels: ['Anti Binatang'],
      values: [0]
    }
  ];

  slide.addChart(pptx.ChartType.bar, chartDataAntiBinatang, {
    x: 6.5,
    y: 0.8,
    w: 6.0,
    h: 1.5,
    barDir: 'bar', // horizontal
    chartColors: [COLORS.Target, COLORS.Realisasi],
    showTitle: true,
    title: 'ANTI BINATANG TOWER',
    titleColor: COLORS.Title,
    titleFontSize: 14,
    showLegend: true,
    legendPos: 'b',
    showValue: true
  });

  // 3. Bar Chart (Horizontal): Tapak Tower
  const chartDataTapak = [
    {
      name: 'Total',
      labels: ['Tapak Tower'],
      values: [29]
    },
    {
      name: 'Realisasi',
      labels: ['Tapak Tower'],
      values: [29]
    }
  ];

  slide.addChart(pptx.ChartType.bar, chartDataTapak, {
    x: 6.5,
    y: 2.6,
    w: 6.0,
    h: 1.5,
    barDir: 'bar',
    chartColors: [COLORS.Target, COLORS.Realisasi],
    showTitle: true,
    title: 'TAPAK TOWER',
    titleColor: COLORS.Title,
    titleFontSize: 14,
    showLegend: false, // Already know colors from previous
    showValue: true
  });

  // 4. Bar Chart (Horizontal): AHI Tower
  // Note: pptxgenjs doesn't natively support different colors for each bar in a single series easily without multiple series.
  // We'll use one series for simplicity.
  const chartDataAHI = [
    {
      name: 'Jumlah',
      labels: ['Very Good', 'Good', 'Fair', 'Poor', 'Very Poor'],
      values: [381, 1168, 137, 2, 0]
    }
  ];

  slide.addChart(pptx.ChartType.bar, chartDataAHI, {
    x: 6.5,
    y: 4.4,
    w: 6.0,
    h: 2.5,
    barDir: 'bar',
    chartColors: [COLORS.Good], // Using a single color for the series
    showTitle: true,
    title: 'AHI TOWER',
    titleColor: COLORS.Title,
    titleFontSize: 14,
    showLegend: false,
    showValue: true
  });

  // 5. Text Box: Highlights
  const highlightText = [
    { text: '• ROW 9700 POHON (didalam Span)\n', options: { bold: true, color: '000000' } },
    { text: '  - 3853 bambu/Pisang (Penambahan bulan April)\n', options: { color: '333333' } },
    { text: '  - 5847 Pohon Keras\n', options: { color: '333333' } },
    { text: '• ANTI BINATANG TOWER 16 TOWER\n', options: { bold: true, color: '000000' } },
    { text: '  - Proses PO material\n', options: { color: '333333' } },
    { text: '• TAPAK TOWER\n', options: { bold: true, color: '000000' } },
    { text: '  - Selesai Dibersihkan\n', options: { color: '333333' } },
    { text: '• AHI TOWER\n', options: { bold: true, color: '000000' } },
    { text: '  - Perkuatan tower pada SUTT 150 kV Gis Pratu - Semenjawa + Cibadakbaru T.24 & T.31', options: { color: '333333' } }
  ];

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 4.7,
    w: 5.5,
    h: 2.5,
    fill: { color: 'fffbeb' }, // Light yellow background
    line: { color: 'facc15', width: 1 }
  });

  slide.addText(highlightText, {
    x: 0.6,
    y: 4.8,
    w: 5.3,
    h: 2.3,
    fontSize: 10,
    align: 'left',
    valign: 'top'
  });

  // Save the presentation
  await pptx.writeFile({ fileName: 'Dashboard_UPT_Bogor.pptx' });
  console.log('Presentation created successfully as Dashboard_UPT_Bogor.pptx');
}

createPresentation().catch(err => {
  console.error('Error creating presentation:', err);
});
