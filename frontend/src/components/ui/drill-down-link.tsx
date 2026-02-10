import Link from "next/link"
import { cn } from "@/lib/utils"

interface DrillDownLinkProps {
    value: string | number
    href: string
    className?: string
    align?: "left" | "right" | "center"
}

export function DrillDownLink({ value, href, className, align = "right" }: DrillDownLinkProps) {
    return (
        <div className={cn("group flex items-center",
            align === "right" && "justify-end",
            align === "center" && "justify-center",
            align === "left" && "justify-start",
            className
        )}>
            <Link
                href={href}
                className="font-mono text-primary hover:underline hover:text-blue-600 decoration-blue-600 underline-offset-2 transition-colors cursor-pointer block truncate"
            >
                {value}
            </Link>
        </div>
    )
}
