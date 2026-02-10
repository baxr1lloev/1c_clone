'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { PiCalculatorBold, PiSpinnerGapBold, PiWarningCircleBold } from 'react-icons/pi';
import type { LoginCredentials } from '@/types';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function LoginPage() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const { login, isLoggingIn, loginError } = useAuth();
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginCredentials) => {
    login(data);
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-primary">
            <PiCalculatorBold className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t('loginTitle')}</CardTitle>
        <CardDescription>1C ERP Accounting System</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {loginError && (
            <Alert variant="destructive">
              <PiWarningCircleBold className="h-4 w-4" />
              <AlertDescription>{t('loginError')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              {...register('email')}
              className={errors.email ? 'border-destructive' : ''}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{te('invalidEmail')}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              className={errors.password ? 'border-destructive' : ''}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{te('minLength', { min: 6 })}</p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
              />
              <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                {t('rememberMe')}
              </Label>
            </div>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              {t('forgotPassword')}
            </Link>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isLoggingIn}>
            {isLoggingIn ? (
              <>
                <PiSpinnerGapBold className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              t('login')
            )}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {t('noAccount')}{' '}
            <Link href="/register" className="text-primary hover:underline font-medium">
              {t('register')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
