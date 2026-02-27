"use client";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return (
            <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
                <div className="h-7 w-7" />
                <div className="h-7 w-7" />
                <div className="h-7 w-7" />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-0.5 rounded-lg border bg-muted/50 p-0.5">
            {[
                { value: "light", icon: Sun },
                { value: "dark", icon: Moon },
                { value: "system", icon: Monitor },
            ].map(({ value, icon: Icon }) => (
                <Button key={value} variant="ghost" size="icon"
                    className={`h-7 w-7 ${theme === value ? "bg-background shadow-sm" : ""}`}
                    onClick={() => setTheme(value)}>
                    <Icon className="h-3.5 w-3.5" />
                </Button>
            ))}
        </div>
    );
}
