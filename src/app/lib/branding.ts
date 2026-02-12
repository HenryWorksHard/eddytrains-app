import { createClient } from './supabase/client';

export interface OrganizationBranding {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
}

const DEFAULT_BRANDING: OrganizationBranding = {
  id: '',
  name: 'CMPD Fitness',
  slug: 'cmpd',
  logoUrl: null,
  brandColor: '#FACC15',
};

export async function getOrganizationBranding(userId: string): Promise<OrganizationBranding> {
  const supabase = createClient();
  
  // Get user's organization
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.organization_id) {
    return DEFAULT_BRANDING;
  }

  // Get organization details
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url, brand_color')
    .eq('id', profile.organization_id)
    .single();

  if (!org) {
    return DEFAULT_BRANDING;
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    brandColor: org.brand_color || '#FACC15',
  };
}

export async function getOrganizationBySlug(slug: string): Promise<OrganizationBranding | null> {
  const supabase = createClient();
  
  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, logo_url, brand_color')
    .eq('slug', slug)
    .single();

  if (!org) {
    return null;
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    logoUrl: org.logo_url,
    brandColor: org.brand_color || '#FACC15',
  };
}
