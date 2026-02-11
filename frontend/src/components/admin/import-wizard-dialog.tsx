'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, CheckCircle, XCircle, FileText } from 'lucide-react';
import api from '@/lib/api';
import { toast } from 'sonner';

interface ImportWizardDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ImportWizardDialog({ open, onOpenChange }: ImportWizardDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [validateOnly, setValidateOnly] = useState(false);

    const importMutation = useMutation({
        mutationFn: async () => {
            if (!file) throw new Error('No file selected');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('validate_only', validateOnly ? 'true' : 'false');



            const response = await api.post('/migration/import/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });

            return response.data;
        },
        onSuccess: (data) => {
            const action = validateOnly ? 'validated' : 'imported';
            toast.success(`Successfully ${action}: ${data.progress?.created || 0} created`);
            if (!validateOnly) {
                onOpenChange(false);
            }
        },
        onError: (error: any) => {
            toast.error(error.message || 'Import failed');
        }
    });

    const handleImport = () => {
        if (!file) {
            toast.error('Please select a file');
            return;
        }
        importMutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Import from 1C</DialogTitle>
                    <DialogDescription>
                        Upload 1C XML export file to import directories and documents
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="file-upload">1C XML Export File</Label>
                        <div className="flex items-center gap-2">
                            <Input
                                id="file-upload"
                                type="file"
                                accept=".xml"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                disabled={importMutation.isPending}
                            />
                            {file && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="validate-only"
                            checked={validateOnly}
                            onChange={(e) => setValidateOnly(e.target.checked)}
                            disabled={importMutation.isPending}
                            className="h-4 w-4"
                        />
                        <label htmlFor="validate-only" className="text-sm font-medium">
                            Validate only (don't save changes)
                        </label>					</div>

                    {importMutation.isPending && (
                        <Alert>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertDescription>
                                {validateOnly ? 'Validating' : 'Importing'} data... Please wait.
                            </AlertDescription>
                        </Alert>
                    )}

                    {importMutation.isSuccess && importMutation.data && (
                        <Alert className="bg-green-50 border-green-200">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                <div className="font-medium">
                                    {validateOnly ? 'Validation' : 'Import'} successful!
                                </div>
                                <div className="mt-2 text-sm space-y-1">
                                    <div>✅ Created: {importMutation.data.progress?.created || 0}</div>
                                    <div>🔄 Updated: {importMutation.data.progress?.updated || 0}</div>
                                    <div>⏭️ Skipped: {importMutation.data.progress?.skipped || 0}</div>
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}

                    {importMutation.isError && (
                        <Alert className="bg-red-50 border-red-200">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <AlertDescription className="text-red-800">
                                {importMutation.error?.message || 'Import failed'}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={importMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={importMutation.isPending || !file}
                    >
                        {importMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {validateOnly ? 'Validate' : 'Import'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
