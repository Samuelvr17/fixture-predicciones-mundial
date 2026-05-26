import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import ws from 'ws'

// Load environment variables from .env.local
config({ path: '.env.local' })

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
// @ts-ignore - ws transport type issue
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  realtime: {
    transport: ws as any
  }
})

async function createGlobalAdmin() {
  const email = 'admin@fixture-mundial.com'
  const password = 'admin123'
  const username = 'admin'

  console.log('Creating global admin user...')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log('IMPORTANT: Change password after first login!\n')

  try {
    // 1. Create user in auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username
      }
    })

    if (userError) {
      console.error('Error creating user:', userError)
      process.exit(1)
    }

    console.log('✓ User created in auth.users')
    console.log(`  User ID: ${userData.user.id}`)

    // 2. Wait a moment for the trigger to create the profile
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Add user to global_admins table
    const { error: adminError } = await supabase
      .from('global_admins')
      .insert({ user_id: userData.user.id })

    if (adminError) {
      console.error('Error adding user to global_admins:', adminError)
      process.exit(1)
    }

    console.log('✓ User added to global_admins table')
    console.log('\nGlobal admin user created successfully!')
    console.log('You can now login with the credentials above.')
    console.log('IMPORTANT: Change the password immediately after first login!')

  } catch (error) {
    console.error('Unexpected error:', error)
    process.exit(1)
  }
}

createGlobalAdmin()
