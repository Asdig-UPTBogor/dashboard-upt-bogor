import "./presentation.css";

/**
 * Layout khusus mode presentasi.
 * No app chrome (sidebar/header) — full bleed.
 */
export default function PresentationLayout({ children }: { children: React.ReactNode }) {
    return <div className="presentation-root">{children}</div>;
}
