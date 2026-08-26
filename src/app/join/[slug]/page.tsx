'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';
import { getOrganizationBySlug, OrganizationBranding } from '@/app/lib/branding';
import { Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import AppLoading from '@/components/AppLoading';

// Audit fix (2026-08-23): this page previously had an "isSignUp" toggle
// that let any unauthenticated visitor with an org slug do
// supabase.auth.signUp() + profiles.upsert({ organization_id, role: 'client' }).
// That let an attacker enumerate a slug and drop themselves into any org
// as a client — cross-tenant bypass.
//
// Fixed by removing the sign-up path entirely. Clients must be invited
// via /accept-invite with a server-issued token. This page is now a
// branded sign-in shortcut only.

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [organization, setOrganization] = useState<OrganizationBranding | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state (sign-in only)
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    async function loadOrganization() {
      const org = await getOrganizationBySlug(slug);
      if (!org) {
        setError('Organization not found');
      }
      setOrganization(org);
      setLoading(false);
    }
    loadOrganization();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push('/dashboard');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <AppLoading />;
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Organization Not Found</h1>
          <p className="text-zinc-400">The invite link you used is invalid or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="w-16 h-16 mx-auto rounded-2xl mb-4"
            />
          ) : (
            <div
              className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
              style={{ backgroundColor: organization.brandColor }}
            >
              <span className="text-black text-2xl font-bold">
                {organization.name.charAt(0)}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-bold text-white">{organization.name}</h1>
          <p className="text-zinc-400 mt-2">
            Sign in to access your workouts
          </p>
        </div>

        {/* Form */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </div>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </div>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 font-semibold rounded-xl transition-colors disabled:opacity-50"
              style={{ backgroundColor: organization.brandColor, color: '#000' }}
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800 text-center space-y-2">
            <p className="text-zinc-400 text-sm">
              New here? Ask your trainer for an invite link — they&apos;ll
              email you a personal one that sets up your account.
            </p>
            <p className="text-zinc-500 text-xs">
              Forgot your password?{' '}
              <Link
                href="/reset-password"
                className="font-medium hover:underline"
                style={{ color: organization.brandColor }}
              >
                Reset it
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
