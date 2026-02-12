'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { getTierFeatures, hasFeature, TierFeatures } from '@/app/lib/permissions';

interface PermissionsState {
  loading: boolean;
  tier: string;
  features: TierFeatures;
  isSuperAdmin: boolean;
  organizationId: string | null;
}

export function usePermissions() {
  const supabase = createClient();
  const [state, setState] = useState<PermissionsState>({
    loading: true,
    tier: 'starter',
    features: getTierFeatures('starter'),
    isSuperAdmin: false,
    organizationId: null,
  });

  useEffect(() => {
    async function loadPermissions() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setState(prev => ({ ...prev, loading: false }));
        return;
      }

      const isSuperAdmin = profile.role === 'super_admin';

      // Super admins have all features
      if (isSuperAdmin) {
        setState({
          loading: false,
          tier: 'gym',
          features: getTierFeatures('gym'),
          isSuperAdmin: true,
          organizationId: profile.organization_id,
        });
        return;
      }

      // Get organization tier
      if (profile.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('subscription_tier')
          .eq('id', profile.organization_id)
          .single();

        const tier = org?.subscription_tier || 'starter';
        setState({
          loading: false,
          tier,
          features: getTierFeatures(tier),
          isSuperAdmin: false,
          organizationId: profile.organization_id,
        });
      } else {
        setState(prev => ({ ...prev, loading: false }));
      }
    }

    loadPermissions();
  }, [supabase]);

  const can = (feature: keyof TierFeatures): boolean => {
    if (state.isSuperAdmin) return true;
    return hasFeature(state.tier, feature);
  };

  return {
    ...state,
    can,
  };
}
