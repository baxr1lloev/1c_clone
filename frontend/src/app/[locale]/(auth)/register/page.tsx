'use client';

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
import { PiCalculatorBold, PiSpinnerGapBold, PiWarningCircleBold } from 'react-icons/pi';
import type { RegisterData } from '@/types';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  company_name: z.string().min(2),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const t = useTranslations('auth');
  const te = useTranslations('errors');
  const { register: registerUser, isRegistering, registerError } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = (data: RegisterFormData) => {
    const { confirmPassword, ...registerData } = data;
    registerUser(registerData as RegisterData);
  };

  return (
    <Card className="shadow-xl border-0">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="p-3 rounded-full bg-primary">
            <PiCalculatorBold className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">{t('registerTitle')}</CardTitle>
        <CardDescription>Create your organization account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          {registerError && (
            <Alert variant="destructive">
              <PiWarningCircleBold className="h-4 w-4" />
              <AlertDescription>{t('registerError')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="company_name">{t('companyName')}</Label>
            <Input
              id="company_name"
              placeholder="Acme Corp"
              {...register('company_name')}
              className={errors.company_name ? 'border-destructive' : ''}
            />
            {errors.company_name && (
              <p className="text-sm text-destructive">{te('required')}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">{t('firstName')}</Label>
              <Input
                id="first_name"
                placeholder="John"
                {...register('first_name')}
                className={errors.first_name ? 'border-destructive' : ''}
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{te('required')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">{t('lastName')}</Label>
              <Input
                id="last_name"
                placeholder="Doe"
                {...register('last_name')}
                className={errors.last_name ? 'border-destructive' : ''}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{te('required')}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="john@acme.com"
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
              <p className="text-sm text-destructive">{te('minLength', { min: 8 })}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              {...register('confirmPassword')}
              className={errors.confirmPassword ? 'border-destructive' : ''}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button type="submit" className="w-full" disabled={isRegistering}>
            {isRegistering ? (
              <>
                <PiSpinnerGapBold className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              t('register')
            )}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            {t('hasAccount')}{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              {t('login')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
