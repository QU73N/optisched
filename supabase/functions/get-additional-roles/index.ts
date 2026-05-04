import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request) => {
  try {
    const { userId } = await req.json()
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid request: userId required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create service client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get user by ID to access metadata
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId)

    if (userError) {
      console.error('Error fetching user:', userError)
      return new Response(JSON.stringify({ error: userError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const additionalRoles = user.user_metadata?.additional_roles || []

    return new Response(JSON.stringify({ additional_roles: additionalRoles }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error in get-additional-roles:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
