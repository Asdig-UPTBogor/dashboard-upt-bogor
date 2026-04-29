/**
 * Cascade Dropdown — Mapping tab
 * 
 * Saat user pilih GI di kolom D (Map GI Kita), kolom E (Map Bay Kita)
 * otomatis update dropdown-nya hanya tampilkan Bay yang ada di GI tersebut.
 * 
 * Source: Master_Bay sheet (kolom A = GI canonical, B = Bay canonical)
 * Target: Mapping sheet kolom E
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== 'Mapping') return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row < 2) return;

  // Kolom D = Map GI Kita (col index 4)
  if (col === 4) {
    const giValue = e.value || '';
    const ss = e.source;
    const masterBay = ss.getSheetByName('Master_Bay');
    if (!masterBay) return;

    const lastRow = masterBay.getLastRow();
    if (lastRow < 2) return;
    const data = masterBay.getRange(2, 1, lastRow - 1, 2).getValues();
    const bays = data
      .filter(r => String(r[0]).trim() === String(giValue).trim())
      .map(r => r[1]);

    const eCell = sheet.getRange(row, 5);

    // Reset dulu — clear value lama agar tidak nyantol stale
    eCell.clearContent();
    eCell.clearDataValidations();

    if (bays.length > 0) {
      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(bays, true)
        .setAllowInvalid(false)
        .setHelpText('Bay yang ada di ' + giValue)
        .build();
      eCell.setDataValidation(rule);
    }
  }
}
