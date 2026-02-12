'use client';

import Link from 'next/link';
import { Lock, Sparkles } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { TierFeatures, getUpgradeTier } from '@/app/lib/permissions';

interface FeatureGateProps {
  feature: keyof TierFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
}

export function FeatureGate({ feature, children, fallback, showUpgrade = true }: FeatureGateProps) {
  const { loading, can, tier } = usePermissions();

  if (loading) {
    return <div className="animate-pulse bg-zinc-800 rounded-xl h-20" />;
  }

  if (can(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgrade) {
    return null;
  }

  const upgradeTier = getUpgradeTier(tier, feature);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
      <div className="w-12 h-12 bg-yellow-400/10 rounded-xl flex items-center justify-center mx-auto mb-4">
        <Lock className="w-6 h-6 text-yellow-400" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">Upgrade Required</h3>
      <p className="text-zinc-400 text-sm mb-4">
        This feature is available on the {upgradeTier ? upgradeTier.charAt(0).toUpperCase() + upgradeTier.slice(1) : 'higher'} plan and above.
      </p>
      <Link
        href="/billing"
        className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-medium rounded-lg transition-colors"
      >
        <Sparkles className="w-4 h-4" />
        Upgrade Now
      </Link>
    </div>
  );
}

// Inline version for smaller UI elements
export function FeatureBadge({ feature, children }: { feature: keyof TierFeatures; children: React.ReactNode }) {
  const { can, loading } = usePermissions();

  if (loading) return null;

  if (can(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">{children}</div>
      <Link
        href="/billing"
        className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 rounded-lg"
      >
        <span className="flex items-center gap-1 text-xs text-yellow-400">
          <Lock className="w-3 h-3" />
          Pro
        </span>
      </Link>
    </div>
  );
}
