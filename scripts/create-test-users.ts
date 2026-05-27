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

const testUsers = [
  { email: 'usuario1@test.com', password: 'password123', username: 'usuario1' },
  { email: 'usuario2@test.com', password: 'password123', username: 'usuario2' },
  { email: 'usuario3@test.com', password: 'password123', username: 'usuario3' },
  { email: 'usuario4@test.com', password: 'password123', username: 'usuario4' },
  { email: 'usuario5@test.com', password: 'password123', username: 'usuario5' },
]

async function createTestUsers() {
  console.log('Creating test users...\n')

  for (const user of testUsers) {
    try {
      // 1. Create user in auth.users
      const { data: userData, error: userError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: {
          username: user.username
        }
      })

      if (userError) {
        console.error(`Error creating ${user.email}:`, userError.message)
        continue
      }

      console.log(`✓ Created: ${user.email} / ${user.password}`)
      console.log(`  User ID: ${userData.user.id}`)
      console.log(`  Username: ${user.username}\n`)

      // Wait a moment for the trigger to create the profile
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Unexpected error for ${user.email}:`, error)
    }
  }

  console.log('\n========================================')
  console.log('Test users created successfully!')
  console.log('========================================')
  console.log('\nCredentials for testing:')
  console.log('----------------------------------------')
  testUsers.forEach(user => {
    console.log(`Email: ${user.email}`)
    console.log(`Password: ${user.password}`)
    console.log('---')
  })
  console.log('\nYou can now login with these credentials.')
  console.log('\nGlobal Admin (if created):')
  console.log('Email: admin@fixture-mundial.com')
  console.log('Password: admin123')
  console.log('\n========================================')
}

createTestUsers()
