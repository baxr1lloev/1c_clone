"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export type InterfaceMode = 'modern' | 'classic'

type InterfaceModeContextType = {
    mode: InterfaceMode
    setMode: (mode: InterfaceMode) => void
}

const InterfaceModeContext = React.createContext<InterfaceModeContextType | undefined>(undefined)

export function useInterfaceMode() {
    const context = React.useContext(InterfaceModeContext)
    if (!context) {
        throw new Error("useInterfaceMode must be used within a ThemeProvider")
    }
    return context
}

export function ThemeProvider({
    children,
    ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
    const [mode, setMode] = React.useState<InterfaceMode>('modern')

    // Effect to apply classic class to body
    React.useEffect(() => {
        if (mode === 'classic') {
            document.documentElement.classList.add('theme-classic')
        } else {
            document.documentElement.classList.remove('theme-classic')
        }
    }, [mode])

    return (
        <NextThemesProvider {...props}>
            <InterfaceModeContext.Provider value={{ mode, setMode }}>
                {children}
            </InterfaceModeContext.Provider>
        </NextThemesProvider>
    )
}
