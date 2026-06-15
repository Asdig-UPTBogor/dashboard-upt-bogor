/**
 * SUPERSEDED — deck standalone Transmisi digantikan deck utama multi-slide
 * /presentation/program-kerja (slide 3 = Transmisi, data snapshot Supabase).
 * Redirect permanen supaya tidak ada deck dengan data basi/BigQuery (suspended).
 */
import { redirect } from "next/navigation";

export default function TransmisiDeckRedirect() {
    redirect("/presentation/program-kerja?slide=3");
}
