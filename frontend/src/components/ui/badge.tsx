"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm hover:shadow-md",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-gradient-to-r from-destructive to-destructive/90 text-destructive-foreground shadow-sm hover:shadow-md",
        success:
          "border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm hover:shadow-md",
        warning:
          "border-transparent bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm hover:shadow-md",
        info:
          "border-transparent bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-sm hover:shadow-md",
        outline: "text-foreground hover:bg-accent hover:text-accent-foreground",
        // 1C-style status badges
        posted:
          "border-transparent bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm",
        draft:
          "border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300",
        cancelled:
          "border-transparent bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm",
        deleted:
          "border-transparent bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm line-through",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
