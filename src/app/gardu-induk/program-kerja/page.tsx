import { ProgramKerjaGarduIndukContent } from "./_components/GarduIndukContent";

interface ProgramKerjaGarduIndukPageProps {
  /** True kalau di-embed di hub /program-kerja Tabs — sembunyikan page header. */
  embedded?: boolean;
}

/**
 * Program Kerja Gardu Induk (HARGI) — UPT Bogor 2026.
 * Sumber data: SNAPSHOT (Supabase Postgres) via useSnapshot, bukan BigQuery (suspend).
 * Visual: harmonisasi dengan Program Kerja Proteksi + golden Program Kerja Transmisi.
 */
export default function ProgramKerjaGarduIndukPage({ embedded }: ProgramKerjaGarduIndukPageProps = {}) {
  return <ProgramKerjaGarduIndukContent embedded={embedded} />;
}
