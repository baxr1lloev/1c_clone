'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const { theme, setTheme } = useTheme();
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('settings')}</h1>
        <p className="text-muted-foreground">Manage your application settings and preferences.</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the application looks properly on your device.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between space-x-2">
              <Label htmlFor="theme" className="flex flex-col space-y-1">
                <span>Dark Mode</span>
                <span className="font-normal text-muted-foreground">Toggle dark mode on or off.</span>
              </Label>
              <Switch 
                id="theme" 
                checked={theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
            <div className="space-y-2">
                <Label>Language</Label>
                <Select defaultValue="ru">
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="ru">Русский</SelectItem>
                    <SelectItem value="uz">O'zbek</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
            <Button variant="outline">{tc('cancel')}</Button>
            <Button>{tc('save')}</Button>
        </div>
      </div>
    </div>
  );
}
