export const C = {
    indigo: "#818cf8", teal: "#2dd4bf", amber: "#fbbf24",
    purple: "#c084fc", pink: "#f472b6", emerald: "#34d399",
    rose: "#fb7185", blue: "#60a5fa", cyan: "#22d3ee", orange: "#fb923c",
};

export interface GI {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "GI Type": string;
    "Voltage (kV)": string;
    Latitude: string;
    Longitude: string;
    "Status Kepemilikan"?: string;
    "Status Operasi"?: string;
    "Tanggal Operasi"?: string;
}

export interface Bay {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "Bay/Diameter": string;
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

export interface Trafo {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "Master Bay": string;
    "Merek": string;
    "Phasa": string;
    "MVA": string;
    "Tipe": string;
    "Serial Id": string;
    "Tahun Buat": string;
    "Tahun Operasi": string;
    "Status Usia": string;
}

/** Generic MTU equipment row (PMT, PMS, CT, CVT, LA, Kabel Power) */
export interface MTUEquipment {
    "Master ULTG": string;
    "Master Gardu Induk": string;
    "Master Bay": string;
    /** Only present on MTU CT */
    "MTU"?: string;
}

/** Equipment type keys (order matches overview.json dataSources index) */
export const EQUIPMENT_TYPES = [
    { key: "trafo", label: "Trafo", sheetIdx: 3, icon: "Zap", color: C.amber },
    { key: "pmt", label: "PMT", sheetIdx: 4, icon: "CircleDot", color: C.indigo },
    { key: "pms", label: "PMS", sheetIdx: 5, icon: "ToggleRight", color: C.teal },
    { key: "ct", label: "CT", sheetIdx: 6, icon: "Gauge", color: C.rose },
    { key: "cvt", label: "CVT", sheetIdx: 7, icon: "Activity", color: C.purple },
    { key: "la", label: "LA", sheetIdx: 8, icon: "Shield", color: C.emerald },
    { key: "kabelPower", label: "Kabel Power", sheetIdx: 9, icon: "Cable", color: C.orange },
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
    total: number;
}

export const EMPTY_EQUIPMENT_COUNTS: EquipmentCounts = {
    trafo: 0, pmt: 0, pms: 0, ct: 0, cvt: 0, la: 0, kabelPower: 0, total: 0,
};
