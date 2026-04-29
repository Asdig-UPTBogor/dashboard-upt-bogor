/**
 * Data Input Dashboard — layout passthrough.
 * Navigasi Master UPT/ULTG/GI/Bay ada di main sidebar (SIDEBAR_SECTIONS)
 * — tidak perlu section-isolated sidebar lagi.
 */
export default function DataInputLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
