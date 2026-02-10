"use client"

import * as React from "react"
import { PiMonitorBold, PiTableBold } from "react-icons/pi"
import { useInterfaceMode } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function InterfaceModeToggle() {
    const { mode, setMode } = useInterfaceMode()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Switch Interface Mode">
                    {mode === 'modern' ? <PiMonitorBold className="h-[1.2rem] w-[1.2rem]" /> : <PiTableBold className="h-[1.2rem] w-[1.2rem]" />}
                    <span className="sr-only">Toggle mode</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setMode("modern")}>
                    Modern
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setMode("classic")}>
                    Classic 1C
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
