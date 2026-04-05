import React from "react";
import { type LucideIcon } from "lucide-react";

export interface ServiceTabDef {
    id: string;
    label: string;
    icon?: LucideIcon;
}

export function ServiceTabs({
    tabs,
    activeTab,
    onChange,
}: {
    tabs: ServiceTabDef[];
    activeTab: string;
    onChange: (id: string) => void;
}) {
    return (
        <div className="flex items-center gap-1 mb-6 border-b border-border">
            {tabs.map(({ id, label, icon: Icon }) => (
                <button
                    key={id}
                    onClick={() => onChange(id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition-all border-b-2 -mb-px ${
                        activeTab === id
                            ? "border-blue-500 text-foreground"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {label}
                </button>
            ))}
        </div>
    );
}
