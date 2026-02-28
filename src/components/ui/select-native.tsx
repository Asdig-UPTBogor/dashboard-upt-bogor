import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

interface SelectNativeProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    icon?: React.ReactNode
}

const SelectNative = React.forwardRef<HTMLSelectElement, SelectNativeProps>(
    ({ className, children, icon, ...props }, ref) => {
        return (
            <div className="relative">
                {icon && (
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {icon}
                    </span>
                )}
                <select
                    ref={ref}
                    className={cn(
                        "h-8 w-full appearance-none rounded-md border border-input bg-background px-3 pr-8 text-xs shadow-xs",
                        "transition-colors focus:border-ring focus:ring-ring/50 focus:ring-[3px] focus:outline-none",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        icon && "pl-8",
                        className
                    )}
                    {...props}
                >
                    {children}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
        )
    }
)
SelectNative.displayName = "SelectNative"

export { SelectNative }
