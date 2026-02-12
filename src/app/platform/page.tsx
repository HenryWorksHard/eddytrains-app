'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import { Users, Building2, DollarSign, TrendingUp, Eye, Search, Plus, X, Trash2, Activity, UserPlus, CreditCard, UserMinus, ChevronDown, ChevronRight, UserCheck } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  subscription_tier: string;
  subscription_status: string;
  client_limit: number;
  created_at: string;
  custom_monthly_price?: number | null;
  trial_ends_at?: string | null;
  stripe_subscription_id?: string | null;
  stripe_customer_id?: string | null;
  organization_type?: string;
  max_trainers?: number;
  profiles?: { email: string; full_name: string }[];
  client_count?: number;
}

interface Trainer {
  id: string;
  email: string;
  full_name: string | null;
  company_id: string | null;
  organization_id: string | null;
  client_count?: number;
}

interface Stats {
  totalTrainers: number;
  totalClients: number;
  activeSubscriptions: number;
  trialingOrgs: number;
  trialingNoPlan: number;
  mrr: number;
  totalCompanies: number;
}

const TIER_PRICES: Record<string, number> = {
  starter: 39,
  pro: 79,
  studio: 149,
  gym: 299,
};

export default function PlatformPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [soloTrainers, setSoloTrainers] = useState<Organization[]>([]);
  const [companies, setCompanies] = useState<Organization[]>([]);
  const [companyTrainers, setCompanyTrainers] = useState<Record<string, Trainer[]>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [showAddTrainer, setShowAddTrainer] = useState(false);
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [addingTrainer, setAddingTrainer] = useState(false);
  const [addingCompany, setAddingCompany] = useState(false);
  const [newTrainer, setNewTrainer] = useState({
    email: '',
    password: '',
    fullName: '',
    orgName: '',
    orgSlug: '',
    accessType: 'trial' as 'trial' | 'lifetime' | 'custom',
    expiryDate: '',
    tier: 'starter' as 'starter' | 'pro' | 'studio' | 'gym',
    customMonthlyPrice: '',
  });
  const [newCompany, setNewCompany] = useState({
    name: '',
    slug: '',
    customMonthlyPrice: '',
    maxTrainers: '5',
    adminEmail: '',
    adminPassword: '',
    adminFullName: '',
  });
  const [editingCompany, setEditingCompany] = useState<Organization | null>(null);
  const [editCompanyData, setEditCompanyData] = useState({
    name: '',
    slug: '',
    customMonthlyPrice: '',
    maxTrainers: '',
  });
  const [deletingOrgId, setDeletingOrgId] = useState<string | null>(null);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editTier, setEditTier] = useState('');
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'super_admin') {
      router.push('/dashboard');
      return;
    }

    setIsSuperAdmin(true);

    // Fetch all organizations
    const { data: allOrgs } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (allOrgs) {
      // Get client counts for each org
      const orgsWithCounts = await Promise.all(
        allOrgs.map(async (org: Organization) => {
          const { count } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id)
            .eq('role', 'client');
          
          // Get owner info
          const { data: ownerProfile } = await supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', org.owner_id)
            .single();

          return { 
            ...org, 
            client_count: count || 0,
            profiles: ownerProfile ? [ownerProfile] : []
          };
        })
      );

      // Split into solo trainers and companies
      const solo = orgsWithCounts.filter(o => o.organization_type !== 'company');
      const comps = orgsWithCounts.filter(o => o.organization_type === 'company');

      setSoloTrainers(solo);
      setCompanies(comps);

      // Get trainers for each company
      const trainersByCompany: Record<string, Trainer[]> = {};
      for (const company of comps) {
        const { data: trainers } = await supabase
          .from('profiles')
          .select('id, email, full_name, company_id, organization_id')
          .eq('company_id', company.id)
          .eq('role', 'trainer');

        if (trainers) {
          const trainersWithClients = await Promise.all(
            trainers.map(async (t) => {
              const { count } = await supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('trainer_id', t.id)
                .eq('role', 'client');
              return { ...t, client_count: count || 0 };
            })
          );
          trainersByCompany[company.id] = trainersWithClients;
        }
      }
      setCompanyTrainers(trainersByCompany);

      // Calculate stats
      const activeOrgs = solo.filter(o => o.subscription_status === 'active');
      const trialingOrgs = solo.filter(o => o.subscription_status === 'trialing');
      const trialingNoPlan = trialingOrgs.filter(o => !o.stripe_subscription_id);
      const totalClients = orgsWithCounts.reduce((sum, o) => sum + (o.client_count || 0), 0);
      const mrr = activeOrgs.reduce((sum, o) => {
        const price = o.custom_monthly_price ?? TIER_PRICES[o.subscription_tier] ?? 0;
        return sum + price;
      }, 0) + comps.reduce((sum, o) => sum + (o.custom_monthly_price || 0), 0);

      setStats({
        totalTrainers: solo.length + Object.values(trainersByCompany).flat().length,
        totalClients,
        activeSubscriptions: activeOrgs.length,
        trialingOrgs: trialingOrgs.length,
        trialingNoPlan: trialingNoPlan.length,
        mrr,
        totalCompanies: comps.length,
      });
    }

    setLoading(false);
  }

  const filteredSoloTrainers = soloTrainers.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const filteredCompanies = companies.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const toggleCompany = (companyId: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
    }
    setExpandedCompanies(newExpanded);
  };

  const handleImpersonate = async (orgId: string) => {
    const res = await fetch('/api/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    });
    
    if (res.ok) {
      sessionStorage.setItem('impersonating_org', orgId);
      router.push('/dashboard');
      router.refresh();
    }
  };

  const handleDeleteTrainer = async (org: Organization) => {
    const confirmText = `Are you sure you want to delete "${org.name}"?\n\nThis will permanently remove:\n- The trainer account\n- All ${org.client_count || 0} clients\n- All programs and workouts\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmText)) return;

    const typedName = prompt(`Type "${org.name}" to confirm deletion:`);
    if (typedName !== org.name) {
      alert('Organization name did not match. Deletion cancelled.');
      return;
    }

    setDeletingOrgId(org.id);

    try {
      const response = await fetch(`/api/trainers/${org.id}`, { method: 'DELETE' });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to delete trainer');
        return;
      }

      setSoloTrainers(orgs => orgs.filter(o => o.id !== org.id));
      alert(data.message || 'Trainer deleted successfully');
    } catch (error) {
      console.error('Error deleting trainer:', error);
      alert('Failed to delete trainer');
    } finally {
      setDeletingOrgId(null);
    }
  };

  const handleDeleteCompany = async (company: Organization) => {
    const trainerCount = companyTrainers[company.id]?.length || 0;
    const confirmText = `Are you sure you want to delete "${company.name}"?\n\nThis will permanently remove:\n- The company\n- ${trainerCount} trainers\n- All their clients and data\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmText)) return;

    const typedName = prompt(`Type "${company.name}" to confirm deletion:`);
    if (typedName !== company.name) {
      alert('Company name did not match. Deletion cancelled.');
      return;
    }

    setDeletingOrgId(company.id);

    try {
      // Delete company (cascade will handle trainers)
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', company.id);

      if (error) throw error;

      setCompanies(comps => comps.filter(c => c.id !== company.id));
      alert('Company deleted successfully');
    } catch (error) {
      console.error('Error deleting company:', error);
      alert('Failed to delete company');
    } finally {
      setDeletingOrgId(null);
    }
  };

  const handleEditPrice = (org: Organization) => {
    setEditingOrg(org);
    setEditPrice(org.custom_monthly_price?.toString() || '');
    setEditTier(org.subscription_tier);
    setEditStatus(org.subscription_status);
  };

  const handleSavePrice = async () => {
    if (!editingOrg) return;

    const newPrice = editPrice === '' ? null : parseInt(editPrice);
    const tierClientLimits: Record<string, number> = {
      starter: 10,
      pro: 30,
      studio: 75,
      gym: -1,
    };

    try {
      const { error } = await supabase
        .from('organizations')
        .update({ 
          custom_monthly_price: newPrice,
          subscription_tier: editTier,
          subscription_status: editStatus,
          client_limit: tierClientLimits[editTier] || 10,
        })
        .eq('id', editingOrg.id);

      if (error) throw error;

      setSoloTrainers(orgs =>
        orgs.map(o =>
          o.id === editingOrg.id ? { 
            ...o, 
            custom_monthly_price: newPrice,
            subscription_tier: editTier,
            subscription_status: editStatus,
            client_limit: tierClientLimits[editTier] || 10,
          } : o
        )
      );

      setEditingOrg(null);
      loadData(); // Refresh stats
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('Failed to update subscription');
    }
  };

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingTrainer(true);

    try {
      const response = await fetch('/api/trainers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTrainer),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to create trainer');
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error('Error creating trainer:', error);
      alert('Failed to create trainer');
    } finally {
      setAddingTrainer(false);
    }
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCompany(true);

    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompany),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to create company');
        return;
      }

      setShowAddCompany(false);
      setNewCompany({ name: '', slug: '', customMonthlyPrice: '', maxTrainers: '5', adminEmail: '', adminPassword: '', adminFullName: '' });
      loadData();
      alert(`Company created! Admin can login with: ${newCompany.adminEmail}`);
    } catch (error) {
      console.error('Error creating company:', error);
      alert('Failed to create company');
    } finally {
      setAddingCompany(false);
    }
  };

  const handleEditCompany = (company: Organization) => {
    setEditingCompany(company);
    setEditCompanyData({
      name: company.name,
      slug: company.slug,
      customMonthlyPrice: company.custom_monthly_price?.toString() || '',
      maxTrainers: company.max_trainers?.toString() || '5',
    });
  };

  const handleSaveCompany = async () => {
    if (!editingCompany) return;

    try {
      const response = await fetch('/api/companies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCompany.id,
          ...editCompanyData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || 'Failed to update company');
        return;
      }

      setEditingCompany(null);
      loadData();
    } catch (error) {
      console.error('Error updating company:', error);
      alert('Failed to update company');
    }
  };

  const handleImpersonateCompany = async (companyId: string) => {
    const res = await fetch('/api/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId: companyId }),
    });
    
    if (res.ok) {
      sessionStorage.setItem('impersonating_org', companyId);
      router.push('/dashboard');
      router.refresh();
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-64 bg-zinc-800 rounded mb-4"></div>
        <div className="h-4 w-48 bg-zinc-800 rounded"></div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return (
    <>
    <div className="max-w-6xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Platform Management</h1>
              <p className="text-zinc-400">Overview of all trainers and companies</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAddCompany(true)}
                className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-medium transition-colors"
              >
                <Building2 className="w-5 h-5" />
                Add Company
              </button>
              <button
                onClick={() => setShowAddTrainer(true)}
                className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black px-4 py-2 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-5 h-5" />
                Add Trainer
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <UserCheck className="w-5 h-5 text-yellow-400" />
                  <span className="text-zinc-400 text-sm">Trainers</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalTrainers}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="w-5 h-5 text-blue-400" />
                  <span className="text-zinc-400 text-sm">Companies</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalCompanies}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span className="text-zinc-400 text-sm">Clients</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.totalClients}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">Paying</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.activeSubscriptions}</p>
              </div>

              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-zinc-400 text-sm">MRR</span>
                </div>
                <p className="text-2xl font-bold text-white">${stats.mrr}</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search trainers or companies..."
                className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
            </div>
          </div>

          {/* TRAINERS SECTION */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-yellow-400" />
              Trainers ({filteredSoloTrainers.length})
            </h2>
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left p-4 text-zinc-400 font-medium">Trainer</th>
                    <th className="text-left p-4 text-zinc-400 font-medium">Owner</th>
                    <th className="text-left p-4 text-zinc-400 font-medium">Plan</th>
                    <th className="text-left p-4 text-zinc-400 font-medium">Status</th>
                    <th className="text-left p-4 text-zinc-400 font-medium">Trial / Billing</th>
                    <th className="text-left p-4 text-zinc-400 font-medium">Clients</th>
                    <th className="text-left p-4 text-zinc-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSoloTrainers.map((org) => (
                    <tr key={org.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                      <td className="p-4">
                        <div>
                          <p className="text-white font-medium">{org.name}</p>
                          <p className="text-zinc-500 text-sm">/{org.slug}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <p className="text-zinc-300">{org.profiles?.[0]?.full_name || 'Unknown'}</p>
                        <p className="text-zinc-500 text-sm">{org.profiles?.[0]?.email || ''}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-yellow-400/10 text-yellow-400 rounded text-sm capitalize">
                          {org.subscription_tier}
                        </span>
                        <p className="text-zinc-500 text-xs mt-1">
                          ${org.custom_monthly_price ?? TIER_PRICES[org.subscription_tier] ?? 0}/mo
                          {org.custom_monthly_price !== null && org.custom_monthly_price !== undefined && ' (custom)'}
                        </p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-sm ${
                          org.subscription_status === 'active' ? 'bg-green-500/10 text-green-400' :
                          org.subscription_status === 'trialing' ? 'bg-blue-500/10 text-blue-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          {org.subscription_status}
                        </span>
                      </td>
                      <td className="p-4">
                        {org.subscription_status === 'trialing' && org.trial_ends_at ? (
                          <div>
                            <p className="text-white text-sm">
                              {Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left
                            </p>
                            {org.stripe_subscription_id ? (
                              <span className="text-green-400 text-xs">✓ Plan selected</span>
                            ) : (
                              <span className="text-yellow-400 text-xs">⚠ No plan selected</span>
                            )}
                          </div>
                        ) : org.subscription_status === 'active' ? (
                          <span className="text-green-400 text-sm">Active</span>
                        ) : (
                          <span className="text-zinc-500 text-sm">—</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-white">{org.client_count} / {org.client_limit === -1 ? '∞' : org.client_limit}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleEditPrice(org)} className="px-3 py-1.5 bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-400 rounded-lg text-sm">Edit</button>
                          <button onClick={() => handleImpersonate(org.id)} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm">View</button>
                          <button onClick={() => handleDeleteTrainer(org)} disabled={deletingOrgId === org.id} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm disabled:opacity-50">
                            {deletingOrgId === org.id ? '...' : 'Remove'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredSoloTrainers.length === 0 && (
                <div className="p-8 text-center text-zinc-500">No trainers found</div>
              )}
            </div>
          </div>

          {/* COMPANIES SECTION */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              Companies ({filteredCompanies.length})
            </h2>
            <div className="space-y-3">
              {filteredCompanies.map((company) => (
                <div key={company.id} className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  {/* Company Row */}
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50"
                    onClick={() => toggleCompany(company.id)}
                  >
                    <div className="flex items-center gap-4">
                      <button className="p-1">
                        {expandedCompanies.has(company.id) ? (
                          <ChevronDown className="w-5 h-5 text-zinc-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-zinc-400" />
                        )}
                      </button>
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">{company.name}</p>
                        <p className="text-zinc-500 text-sm">/{company.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-white font-medium">{companyTrainers[company.id]?.length || 0}/{company.max_trainers || 5}</p>
                        <p className="text-zinc-500 text-xs">Trainers</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">{company.client_count}</p>
                        <p className="text-zinc-500 text-xs">Clients</p>
                      </div>
                      <div className="text-center">
                        <p className="text-green-400 font-medium">${company.custom_monthly_price || 0}/mo</p>
                        <p className="text-zinc-500 text-xs">Price</p>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleEditCompany(company)}
                          className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleImpersonateCompany(company.id)}
                          className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm"
                        >
                          View
                        </button>
                        <button 
                          onClick={() => handleDeleteCompany(company)} 
                          disabled={deletingOrgId === company.id}
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm disabled:opacity-50"
                        >
                          {deletingOrgId === company.id ? '...' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Trainers */}
                  {expandedCompanies.has(company.id) && (
                    <div className="border-t border-zinc-800 bg-zinc-950/50">
                      {companyTrainers[company.id]?.length > 0 ? (
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-zinc-800">
                              <th className="text-left p-3 pl-16 text-zinc-500 text-xs font-medium">Trainer</th>
                              <th className="text-left p-3 text-zinc-500 text-xs font-medium">Email</th>
                              <th className="text-left p-3 text-zinc-500 text-xs font-medium">Clients</th>
                            </tr>
                          </thead>
                          <tbody>
                            {companyTrainers[company.id].map((trainer) => (
                              <tr key={trainer.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                                <td className="p-3 pl-16 text-white">{trainer.full_name || '—'}</td>
                                <td className="p-3 text-zinc-400">{trainer.email}</td>
                                <td className="p-3 text-white">{trainer.client_count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="p-4 pl-16 text-zinc-500 text-sm">No trainers in this company yet</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {filteredCompanies.length === 0 && (
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center text-zinc-500">
                  No companies found. Add your first company to get started.
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Add Trainer Modal */}
      {showAddTrainer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-white">Add Trainer</h2>
              <button onClick={() => setShowAddTrainer(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTrainer} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={newTrainer.fullName}
                  onChange={(e) => setNewTrainer({ ...newTrainer, fullName: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="John Smith"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Email</label>
                <input
                  type="email"
                  value={newTrainer.email}
                  onChange={(e) => setNewTrainer({ ...newTrainer, email: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="trainer@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Password</label>
                <input
                  type="password"
                  value={newTrainer.password}
                  onChange={(e) => setNewTrainer({ ...newTrainer, password: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Organization Name</label>
                <input
                  type="text"
                  value={newTrainer.orgName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    setNewTrainer({ ...newTrainer, orgName: name, orgSlug: slug });
                  }}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="Smith Fitness"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Plan Tier</label>
                <select
                  value={newTrainer.tier}
                  onChange={(e) => setNewTrainer({ ...newTrainer, tier: e.target.value as 'starter' | 'pro' | 'studio' | 'gym' })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                >
                  <option value="starter">Starter - $39/mo</option>
                  <option value="pro">Pro - $79/mo</option>
                  <option value="studio">Studio - $149/mo</option>
                  <option value="gym">Gym - $299/mo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Access Type</label>
                <div className="space-y-2">
                  {['trial', 'lifetime', 'custom'].map((type) => (
                    <label key={type} className="flex items-center gap-3 p-3 bg-zinc-800 border border-zinc-700 rounded-xl cursor-pointer">
                      <input
                        type="radio"
                        name="accessType"
                        value={type}
                        checked={newTrainer.accessType === type}
                        onChange={() => setNewTrainer({ ...newTrainer, accessType: type as 'trial' | 'lifetime' | 'custom' })}
                      />
                      <span className="text-white capitalize">{type === 'trial' ? '14-Day Trial' : type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddTrainer(false)} className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl">Cancel</button>
                <button type="submit" disabled={addingTrainer} className="flex-1 px-4 py-3 bg-yellow-400 text-black rounded-xl font-medium disabled:opacity-50">
                  {addingTrainer ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Company Modal */}
      {showAddCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-white">Add Company</h2>
              <button onClick={() => setShowAddCompany(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCompany} className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="pb-2 border-b border-zinc-800">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Company Details</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Company Name</label>
                <input
                  type="text"
                  value={newCompany.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                    setNewCompany({ ...newCompany, name, slug });
                  }}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="Adelaide Fitness"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">URL Slug</label>
                <input
                  type="text"
                  value={newCompany.slug}
                  onChange={(e) => setNewCompany({ ...newCompany, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="adelaide-fitness"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Monthly Price ($)</label>
                  <input
                    type="number"
                    value={newCompany.customMonthlyPrice}
                    onChange={(e) => setNewCompany({ ...newCompany, customMonthlyPrice: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Max Trainers</label>
                  <input
                    type="number"
                    value={newCompany.maxTrainers}
                    onChange={(e) => setNewCompany({ ...newCompany, maxTrainers: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                    placeholder="5"
                  />
                </div>
              </div>

              <div className="pt-4 pb-2 border-b border-zinc-800">
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Admin Account</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Full Name</label>
                <input
                  type="text"
                  value={newCompany.adminFullName}
                  onChange={(e) => setNewCompany({ ...newCompany, adminFullName: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Email</label>
                <input
                  type="email"
                  value={newCompany.adminEmail}
                  onChange={(e) => setNewCompany({ ...newCompany, adminEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="admin@adelaidefitness.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Password</label>
                <input
                  type="password"
                  value={newCompany.adminPassword}
                  onChange={(e) => setNewCompany({ ...newCompany, adminPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddCompany(false)} className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl">Cancel</button>
                <button type="submit" disabled={addingCompany} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50">
                  {addingCompany ? 'Creating...' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {editingCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Edit Company</h2>
              <button onClick={() => setEditingCompany(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Company Name</label>
                <input
                  type="text"
                  value={editCompanyData.name}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">URL Slug</label>
                <input
                  type="text"
                  value={editCompanyData.slug}
                  onChange={(e) => setEditCompanyData({ ...editCompanyData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Monthly Price ($)</label>
                  <input
                    type="number"
                    value={editCompanyData.customMonthlyPrice}
                    onChange={(e) => setEditCompanyData({ ...editCompanyData, customMonthlyPrice: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Max Trainers</label>
                  <input
                    type="number"
                    value={editCompanyData.maxTrainers}
                    onChange={(e) => setEditCompanyData({ ...editCompanyData, maxTrainers: e.target.value })}
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingCompany(null)} className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl">Cancel</button>
              <button onClick={handleSaveCompany} className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-xl font-medium">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {editingOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Edit Subscription</h2>
              <button onClick={() => setEditingOrg(null)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-zinc-400 text-sm">{editingOrg.name}</p>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Plan Tier</label>
                <select value={editTier} onChange={(e) => setEditTier(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white">
                  <option value="starter">Starter - $39/mo</option>
                  <option value="pro">Pro - $79/mo</option>
                  <option value="studio">Studio - $149/mo</option>
                  <option value="gym">Gym - $299/mo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white">
                  <option value="trialing">Trialing</option>
                  <option value="active">Active</option>
                  <option value="canceled">Canceled</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Custom Price</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                  <input
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white"
                    placeholder={`${TIER_PRICES[editTier] || 0}`}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setEditingOrg(null)} className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-xl">Cancel</button>
              <button onClick={handleSavePrice} className="flex-1 px-4 py-3 bg-yellow-400 text-black rounded-xl font-medium">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
