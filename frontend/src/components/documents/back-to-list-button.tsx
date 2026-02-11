'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PiArrowLeftBold } from 'react-icons/pi';

interface BackToListButtonProps {
    href?: string;
    label?: string;
    className?: string;
}

export function BackToListButton({
    href,
    label = 'Back to List',
    className
}: BackToListButtonProps) {
    const router = useRouter();

    const handleClick = () => {
        if (href) {
            router.push(href);
        } else {
            router.back();
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            className={className}
        >
            <PiArrowLeftBold className="mr-2 h-4 w-4" />
            {label}
        </Button>
    );
}
