import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PiStarBold, PiStarFill, PiPushPinBold, PiPushPinFill } from 'react-icons/pi';
import Link from 'next/link';

export interface FavoriteItem {
    id: string;
    label: string;
    href: string;
    icon?: string;
    order: number;
    isPinned: boolean;
}

interface FavoritesPanelProps {
    className?: string;
}

export function FavoritesPanel({ className }: FavoritesPanelProps) {
    const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

    // Load favorites from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('user_favorites');
        if (saved) {
            try {
                setFavorites(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load favorites:', e);
            }
        }
    }, []);

    // Save favorites to localStorage
    const saveFavorites = (updatedFavorites: FavoriteItem[]) => {
        localStorage.setItem('user_favorites', JSON.stringify(updatedFavorites));
        setFavorites(updatedFavorites);
    };

    // Toggle favorite
    const toggleFavorite = (item: Omit<FavoriteItem, 'id' | 'order' | 'isPinned'>) => {
        const existing = favorites.find(f => f.href === item.href);

        if (existing) {
            // Remove from favorites
            saveFavorites(favorites.filter(f => f.id !== existing.id));
        } else {
            // Add to favorites
            const newFavorite: FavoriteItem = {
                ...item,
                id: Date.now().toString(),
                order: favorites.length,
                isPinned: false
            };
            saveFavorites([...favorites, newFavorite]);
        }
    };

    // Toggle pin
    const togglePin = (id: string) => {
        saveFavorites(
            favorites.map(f =>
                f.id === id ? { ...f, isPinned: !f.isPinned } : f
            )
        );
    };

    // Sort: pinned first, then by order
    const sortedFavorites = [...favorites].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return a.order - b.order;
    });

    return (
        <div className={className}>
            <div className="px-4 py-2 border-b">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <PiStarFill className="h-4 w-4 text-yellow-500" />
                    Favorites
                </h3>
            </div>

            <div className="p-2">
                {sortedFavorites.length === 0 ? (
                    <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                        No favorites yet
                    </div>
                ) : (
                    <div className="space-y-1">
                        {sortedFavorites.map(item => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between group hover:bg-accent rounded px-2 py-1"
                            >
                                <Link
                                    href={item.href}
                                    className="flex-1 text-sm hover:underline"
                                >
                                    {item.label}
                                </Link>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                    onClick={() => togglePin(item.id)}
                                >
                                    {item.isPinned ? (
                                        <PiPushPinFill className="h-3 w-3" />
                                    ) : (
                                        <PiPushPinBold className="h-3 w-3" />
                                    )}
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Hook to use in pages
export function useFavorite(item: Omit<FavoriteItem, 'id' | 'order' | 'isPinned'>) {
    const [isFavorite, setIsFavorite] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('user_favorites');
        if (saved) {
            try {
                const favorites: FavoriteItem[] = JSON.parse(saved);
                setIsFavorite(favorites.some(f => f.href === item.href));
            } catch (e) {
                console.error('Failed to check favorite:', e);
            }
        }
    }, [item.href]);

    const toggleFavorite = () => {
        const saved = localStorage.getItem('user_favorites');
        let favorites: FavoriteItem[] = saved ? JSON.parse(saved) : [];

        const existing = favorites.find(f => f.href === item.href);

        if (existing) {
            favorites = favorites.filter(f => f.id !== existing.id);
        } else {
            const newFavorite: FavoriteItem = {
                ...item,
                id: Date.now().toString(),
                order: favorites.length,
                isPinned: false
            };
            favorites.push(newFavorite);
        }

        localStorage.setItem('user_favorites', JSON.stringify(favorites));
        setIsFavorite(!existing);
    };

    return { isFavorite, toggleFavorite };
}
