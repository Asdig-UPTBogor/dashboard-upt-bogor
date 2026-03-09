export const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};

export interface GI {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "Type Gardu Induk": string;
    "Tegangan (kV)": string;
    "Status"?: string;
}

export interface Bay {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "Master Bay": string;
    "Type Bay": string;
}

export interface Relay {
    "ULTG": string;
    "Gardu Induk": string;
    "Type Bay": string;
    "Bay/Diameter": string;
    "Fungsi Proteksi": string;
    "Protection": string;
    "Merk": string;
    "Type": string;
    "Jenis Relay": string;
    "Order Code"?: string;
    "Serial Number"?: string;
    "Tahun\nOperasi"?: string;
    "Status"?: string;
    "Kategori"?: string;
    "Tegangan"?: string;
}

/** Common MTU equipment row — shared by TRAFO, PMT, PMS, CT, CVT, LA, KABEL POWER */
export interface MtuEquipment {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "Master Bay": string;
    "Merek": string;
    "Tipe": string;
    "Serial Id": string;
    "Phasa"?: string;
    "MVA"?: string;           // TRAFO only
    "Tahun Buat": string;
    "Tahun Operasi": string;
    "Status Usia": string;
}

// Keep Trafo alias for backward compat
export type Trafo = MtuEquipment;

/** All equipment type keys */
export const EQUIPMENT_TYPES = [
    { key: "trafo", label: "Trafo", sheetIdx: 3, icon: "Zap", color: C.amber },
    { key: "pmt", label: "PMT", sheetIdx: 4, icon: "Zap", color: C.indigo },
    { key: "pms", label: "PMS", sheetIdx: 5, icon: "Zap", color: C.teal },
    { key: "ct", label: "CT", sheetIdx: 6, icon: "Zap", color: C.rose },
    { key: "cvt", label: "CVT", sheetIdx: 7, icon: "Zap", color: C.purple },
    { key: "la", label: "LA", sheetIdx: 8, icon: "Zap", color: C.cyan },
    { key: "kabelPower", label: "Kabel Power", sheetIdx: 9, icon: "Zap", color: C.orange },
    { key: "sealingEnd", label: "Sealing End", sheetIdx: 10, icon: "Zap", color: C.pink },
] as const;

export type EquipmentKey = (typeof EQUIPMENT_TYPES)[number]["key"];

export interface EquipmentCounts {
    trafo: number;
    pmt: number;
    pms: number;
    ct: number;
    cvt: number;
    la: number;
    kabelPower: number;
    sealingEnd: number;
    total: number;
}

export const EMPTY_EQUIPMENT_COUNTS: EquipmentCounts = {
    trafo: 0, pmt: 0, pms: 0, ct: 0, cvt: 0, la: 0, kabelPower: 0, sealingEnd: 0, total: 0,
};
