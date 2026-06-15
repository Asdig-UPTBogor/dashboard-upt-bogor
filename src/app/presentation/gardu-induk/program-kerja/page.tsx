/**
 * SUPERSEDED — deck standalone Gardu Induk (data hardcoded 2026-05-07) digantikan
 * deck utama multi-slide /presentation/program-kerja (slide 4 = Gardu Induk,
 * data snapshot Supabase). Redirect supaya tidak ada deck dengan data basi.
 */
import { redirect } from "next/navigation";

export default function GarduIndukDeckRedirect() {
    redirect("/presentation/program-kerja?slide=4");
}
