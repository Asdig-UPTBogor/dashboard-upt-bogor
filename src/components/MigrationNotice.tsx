"use client";

/**
 * MigrationNotice — Banner notifikasi "Proses Migrasi ke Supabase Postgre".
 *
 * Tampil di atas konten halaman yang MASIH baca data dari BigQuery (lihat
 * `src/lib/migration-status.ts`). Subtle, ramping, sesuai design system
 * (ds-* class + CSS var token, amber accent). Bisa di-dismiss per-path
 * (state disimpan di localStorage) supaya ga muncul terus setelah ditutup.
 *
 * Render terpusat lewat <MigrationNoticeGate/> di LayoutChrome — komponen ini
 * tidak perlu dipasang manual per page.
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Database, ArrowRightLeft, X } from "lucide-react";
import { shouldShowMigrationNotice } from "@/lib/migration-status";

const DISMISS_PREFIX = "migration-notice-dismissed:";

interface MigrationNoticeProps {
  /** Catatan tambahan opsional, tampil sebagai baris kecil di bawah sub-teks. */
  note?: string;
  /** Override pathname (default: ambil dari usePathname). Dipakai gate. */
  pathname?: string;
}

export function MigrationNotice({ note, pathname }: MigrationNoticeProps) {
  const [dismissed, setDismissed] = useState(true);

  const dismissKey = pathname ? `${DISMISS_PREFIX}${pathname}` : null;

  // Cek localStorage saat mount / ganti path. Default tersembunyi sampai
  // kita pastikan belum di-dismiss (hindari flash banner yang sudah ditutup).
  useEffect(() => {
    if (!dismissKey) return;
    try {
      setDismissed(window.localStorage.getItem(dismissKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  function handleDismiss() {
    setDismissed(true);
    if (!dismissKey) return;
    try {
      window.localStorage.setItem(dismissKey, "1");
    } catch {
      /* localStorage tidak tersedia — abaikan, tetap dismiss untuk sesi ini */
    }
  }

  if (dismissed) return null;

  return (
    <div
      role="status"
      className="ds-transition"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        padding: "10px 14px",
        marginBottom: "var(--space-stack, 12px)",
        borderRadius: "var(--r-md, 10px)",
        border: "1px solid color-mix(in oklab, var(--color-ps) 35%, transparent)",
        background: "color-mix(in oklab, var(--color-ps) 9%, var(--bg-1))",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
          width: 28,
          height: 28,
          borderRadius: "var(--r-sm, 6px)",
          background: "color-mix(in oklab, var(--color-ps) 18%, transparent)",
          color: "var(--color-ps)",
        }}
      >
        <ArrowRightLeft size={15} strokeWidth={2.25} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "var(--fg-0)",
          }}
        >
          <span className="ds-label" style={{ color: "var(--fg-0)" }}>
            Proses Migrasi ke Supabase Postgre
          </span>
          <Database
            size={12}
            aria-hidden
            style={{ color: "var(--color-ps)", flex: "none" }}
          />
        </div>
        <p className="ds-small" style={{ margin: "2px 0 0" }}>
          Halaman ini masih membaca data dari BigQuery. Sedang dimigrasi bertahap
          ke Supabase.
        </p>
        {note ? (
          <p className="ds-small" style={{ margin: "2px 0 0", color: "var(--color-ps)" }}>
            {note}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Tutup notifikasi migrasi"
        className="ds-transition"
        style={{
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 24,
          height: 24,
          borderRadius: "var(--r-sm, 6px)",
          border: "none",
          background: "transparent",
          color: "var(--fg-2)",
          cursor: "pointer",
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}

/**
 * MigrationNoticeGate — wrapper client yang baca pathname aktif dan render
 * <MigrationNotice/> hanya kalau route saat ini masih baca BigQuery.
 * Dipasang sekali di LayoutChrome, di atas konten page.
 */
export function MigrationNoticeGate() {
  const pathname = usePathname();
  const { show, note } = shouldShowMigrationNotice(pathname ?? "");

  if (!show) return null;

  // key={pathname} → reset state dismissed saat pindah route
  return <MigrationNotice key={pathname} pathname={pathname ?? undefined} note={note} />;
}
