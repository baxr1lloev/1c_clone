'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Link2, Check } from 'lucide-react';

interface CopyLinkButtonProps {
    entityType: string;
    entityId: number;
    className?: string;
}

export function CopyLinkButton({ entityType, entityId, className }: CopyLinkButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const url = `${window.location.origin}/${entityType}s/${entityId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={className}
        >
            {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            <span className="ml-2">{copied ? 'Copied!' : 'Copy Link'}</span>
        </Button>
    );
}
