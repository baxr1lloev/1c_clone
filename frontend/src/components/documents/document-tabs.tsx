import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DocumentTabsProps {
    generalContent: React.ReactNode;
    linesContent: React.ReactNode;
    totalsContent: React.ReactNode;
    postingsContent?: React.ReactNode;
    isPosted?: boolean;
}

export function DocumentTabs({
    generalContent,
    linesContent,
    totalsContent,
    postingsContent,
    isPosted = false
}: DocumentTabsProps) {
    return (
        <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="lines">Lines</TabsTrigger>
                <TabsTrigger value="totals">Totals</TabsTrigger>
                <TabsTrigger value="postings" disabled={!isPosted}>
                    Postings {!isPosted && '(Not Posted)'}
                </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Document Information</CardTitle>
                        <CardDescription>Basic document details and references</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {generalContent}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="lines" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Line Items</CardTitle>
                        <CardDescription>Document line items and quantities</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {linesContent}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="totals" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Totals & Summary</CardTitle>
                        <CardDescription>Document totals, taxes, and currency information</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {totalsContent}
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="postings" className="mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Accounting Postings</CardTitle>
                        <CardDescription>Journal entries created by this document</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {postingsContent || (
                            <div className="text-center py-8 text-muted-foreground">
                                No postings available. Document must be posted to view accounting entries.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
