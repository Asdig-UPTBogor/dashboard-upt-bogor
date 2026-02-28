"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
    label?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
    ({ className, label, id, ...props }, ref) => {
        const innerId = id || React.useId()
        return (
            <div className="flex items-center gap-2">
                <div className="relative">
                    <input
                        ref={ref}
                        type="checkbox"
                        id={innerId}
                        className="peer sr-only"
                        {...props}
                    />
                    <div
                        className={cn(
                            "h-4 w-4 rounded border border-input shadow-xs transition-all cursor-pointer",
                            "peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-focus-visible:border-ring",
                            "peer-checked:bg-primary peer-checked:border-primary",
                            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
                            className
                        )}
                        onClick={() => {
                            const input = document.getElementById(innerId) as HTMLInputElement
                            if (input) { input.click() }
                        }}
                    >
                        <Check className="h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100 absolute top-0.5 left-0.5 transition-opacity pointer-events-none" />
                    </div>
                    {/* Visible check icon when checked */}
                    <Check className="h-3 w-3 text-primary-foreground absolute top-0.5 left-0.5 opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
                </div>
                {label && (
                    <label htmlFor={innerId} className="text-xs cursor-pointer select-none">
                        {label}
                    </label>
                )}
            </div>
        )
    }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
