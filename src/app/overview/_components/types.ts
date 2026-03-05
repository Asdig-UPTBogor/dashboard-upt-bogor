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
}
