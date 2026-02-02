import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/app/lib/supabase/server'
import { sendWelcomeEmail } from '@/app/lib/email'
import { NextRequest, NextResponse } from 'next/server'

// Generate a random temp password
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

// Admin client with service role for user management
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET() {
  try {
    const supabase = await createServerClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    // Get all users with profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Get user emails from auth using admin client
    const adminClient = getAdminClient()
    const { data: authUsers } = await adminClient.auth.admin.listUsers()
    
    // Merge email addresses into profiles
    const usersWithEmail = profiles?.map(p => {
      const authUser = authUsers?.users?.find(u => u.id === p.id)
      return {
        ...p,
        email: authUser?.email || 'Unknown'
      }
    }) || []
    
    return NextResponse.json({ users: usersWithEmail })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check if current user is admin
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    if (adminProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }
    
    const { email, full_name } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }
    
    // Generate temp password
    const tempPassword = generateTempPassword()
    
    // Create user with admin client
    const adminClient = getAdminClient()
    
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Skip email confirmation
      user_metadata: {
        full_name: full_name || email.split('@')[0]
      }
    })
    
    if (createError) {
      console.error('Create user error:', createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }
    
    // Create profile with password_changed = false
    const { error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: newUser.user.id,
        full_name: full_name || email.split('@')[0],
        role: 'user',
        password_changed: false
      })
    
    if (profileError) {
      console.error('Create profile error:', profileError)
      // User created but profile failed - not critical
    }
    
    // Send welcome email with temp password
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://compound.app'
    const emailResult = await sendWelcomeEmail({
      to: email,
      name: full_name || email.split('@')[0],
      tempPassword,
      loginUrl
    })
    
    if (!emailResult.success) {
      console.error('Email send failed:', emailResult.error)
      // Return success but note email failed - admin can resend
      return NextResponse.json({ 
        success: true, 
        user: newUser.user,
        tempPassword, // Return so admin can manually share if email fails
        emailSent: false,
        message: 'User created but email failed to send. Temp password shown below.'
      })
    }
    
    return NextResponse.json({ 
      success: true, 
      user: newUser.user,
      emailSent: true,
      message: 'User created and welcome email sent!'
    })
    
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
