# Laporan Cross-Check Koordinat GI (Spreadsheet Lama vs Baru)

Tanggal: 7 Maret 2026
Lokasi Script: `scripts/spreadsheet-utils/crosscheck-gi-coords.js`

## Ringkasan Eksekutif
Berdasarkan perbandingan antara:
- **S1 (Lama)**: Spreadsheet `1UiVv0mwnvbhtBZiJUczQkVUJcr22B48edfc17w3WuUQ` (Sheet: Master GI)
- **S2 (Baru)**: Spreadsheet `1A-x4WiaSazBdtx051TdhCBqNKpPpcbMWVFVyWSFUdo4` (Sheet: GARDU INDUK)

Ditemukan beberapa ketidakkonsistenan yang terbagi menjadi:
1. **Perbedaan Penamaan (Missing in S1/S2)**
2. **Koordinat Jauh Berbeda (Mismatch Signifikan)**
3. **Perbedaan Pembulatan Desimal (Mismatch Minor)**

---

## 1. Perbedaan Penamaan (Nama GI Tidak Identik)
Sistem mendeteksi GI ini tidak memiliki pasangan nama yang sama persis di sheet lainnya:

| S1 (Lama) | S2 (Baru) | Kemungkinan Resolusi |
|---|---|---|
| GI 150KV KEDUNG BADAK | GI 150KV KEDUNGBADAK | Hapus spasi di S1 |
| GI 70KV KEDUNG BADAK | GI 70KV KEDUNGBADAK | Hapus spasi di S1 |
| GIS 150KV SALAK BARU | GIS 150KV GUNUNG SALAK BARU | Tambah kata "GUNUNG" |
| GIS 150KV SALAK LAMA | GIS 150KV GUNUNG SALAK LAMA | Tambah kata "GUNUNG" |
| GIS 150KV PELABUHAN RATU | GIS 150KV PLTU PELABUHAN RATU | Tambah kata "PLTU" |
| GI 70KV PELABUHAN RATU | (Tidak ada) | Master Data Perlu di Cek |
| GI 150KV JAMPANG KULON | (Tidak ada) | Master Data Perlu di Cek |


## 2. Koordinat Jauh Berbeda (Mismatch Signifikan)
Hanya ada dua GI yang lokasi titik koordinatnya terlihat benar-benar berbeda jauh:

- **GIS 150KV KATULAMPA**
  - S1: `-6.6283387, 106.8383235`
  - S2: `-6.5907952, 106.7968002`

- **GI 150KV SEMEN JAWA**
  - S1: `-6.9729255, 106.8637672`
  - S2: `-6.2630783, 106.8681783`


## 3. Perbedaan Pembulatan Desimal (Mismatch Minor)
Sebagian besar mismatch lainnya hanyalah perbedaan presisi desimal (contohnya ujungnya `0` vs `4`). 
Secara fisik di peta, perbedaan angka di digit ke-6 desimal hanya berjarak beberapa sentimeter hingga milimeter dan tidak signifikan.

Contoh:
- **GI 150KV BOGOR BARU** | S1: `-6.5938680,106.8208270` | S2: `-6.593868,106.8208271`
- **GI 150KV BOJONG GEDE** | S1: `-6.4730990,106.7919980` | S2: `-6.473099337,106.7919983`
- **GI 150KV BUNAR BARU** | S1: `-6.5064440,106.5053280` | S2: `-6.506444,106.505328`
- **GI 150KV CIAWI** | S1: `-6.6575120,106.8484050` | S2: `-6.6575124,106.8484049`
- **GI 150KV CIBADAK BARU** | S1: `-6.8656100,106.7658190` | S2: `-6.8656104,106.765819`
- **GI 150KV CIBINONG** | S1: `-6.4411190,106.9139200` | S2: `-6.4411188,106.9139199`
- **GI 150KV ITP** | S1: `-6.4846710,106.8911410` | S2: `-6.4846713,106.8911412`
- **GI 150KV LEMBURSITU** | S1: `-6.9572780,106.8922330` | S2: `-6.957277778,106.8922333`
- **GI 150KV SEMEN BARU** | S1: `-6.4563640,106.9364830` | S2: `-6.4563639,106.9364833`
- **GI 150KV SENTUL** | S1: `-6.5251960,106.8565170` | S2: `-6.5251957,106.8565172`
- **GI 70KV CIBADAK BARU** | S1: `-6.8654970,106.7664350` | S2: `-6.8654969,106.7664349`
- **GI 70KV CIBINONG** | S1: `-6.4394250,106.9138260` | S2: `-6.4394247,106.9138263`
- **GI 70KV CILEUNGSI** | S1: `-6.4319250,106.9531780` | S2: `-6.4319249,106.9531783`
- **GI 70KV KRACAK** | S1: `-6.6171210,106.6441600` | S2: `-6.6171213,106.6441597`
- **GI 70KV SEMEN BARU** | S1: `-6.4563640,106.9364830` | S2: `-6.4563639,106.9364833`
- **GI 70KV UBRUG** | S1: `-6.9502400,106.7550560` | S2: `-6.9502395,106.755056`
- **GIS 150KV BOGOR KOTA** | S1: `-6.5702830,106.7572540` | S2: `-6.570283,106.7572544`
- **GITET 500KV CIBINONG** | S1: `-6.4403110,106.9162510` | S2: `-6.4403109,106.9162514`
