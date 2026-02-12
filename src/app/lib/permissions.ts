// Tier-based feature permissions

export type SubscriptionTier = 'starter' | 'pro' | 'studio' | 'gym';

export interface TierFeatures {
  maxClients: number;
  nutrition: boolean;
  customBranding: boolean;
  apiAccess: boolean;
  prioritySupport: boolean;
  teamAccounts: boolean;
  whiteLabel: boolean;
}

export const TIER_FEATURES: Record<SubscriptionTier, TierFeatures> = {
  starter: {
    maxClients: 10,
    nutrition: false,
    customBranding: false,
    apiAccess: false,
    prioritySupport: false,
    teamAccounts: false,
    whiteLabel: false,
  },
  pro: {
    maxClients: 30,
    nutrition: true,
    customBranding: false,
    apiAccess: false,
    prioritySupport: true,
    teamAccounts: false,
    whiteLabel: false,
  },
  studio: {
    maxClients: 75,
    nutrition: true,
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    teamAccounts: true,
    whiteLabel: false,
  },
  gym: {
    maxClients: -1, // unlimited
    nutrition: true,
    customBranding: true,
    apiAccess: true,
    prioritySupport: true,
    teamAccounts: true,
    whiteLabel: true,
  },
};

export function getTierFeatures(tier: string): TierFeatures {
  return TIER_FEATURES[tier as SubscriptionTier] || TIER_FEATURES.starter;
}

export function hasFeature(tier: string, feature: keyof TierFeatures): boolean {
  const features = getTierFeatures(tier);
  return !!features[feature];
}

export function getUpgradeTier(currentTier: string, feature: keyof TierFeatures): SubscriptionTier | null {
  const tiers: SubscriptionTier[] = ['starter', 'pro', 'studio', 'gym'];
  const currentIndex = tiers.indexOf(currentTier as SubscriptionTier);
  
  for (let i = currentIndex + 1; i < tiers.length; i++) {
    if (TIER_FEATURES[tiers[i]][feature]) {
      return tiers[i];
    }
  }
  
  return null;
}
