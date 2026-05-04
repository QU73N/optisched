import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req: Request) => {
  try {
    const { userId, additionalRoles } = await req.json()
    
    if (!userId || !Array.isArray(additionalRoles)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Validate additional roles
    const validRoles = ['schedule_admin', 'schedule_manager']
    const invalidRoles = additionalRoles.filter((r: string) => !validRoles.includes(r))
    if (invalidRoles.length > 0) {
      return new Response(JSON.stringify({ error: `Invalid roles: ${invalidRoles.join(', ')}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Create service client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Update auth.user metadata with additional_roles
    const { data: { user }, error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        user_metadata: { additional_roles: additionalRoles }
      }
    )

    if (updateError) {
      console.error('Error updating user metadata:', updateError)
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Log the action
    const { error: logError } = await supabase.rpc('log_audit', {
      p_action: 'additional_roles_updated',
      p_target_table: 'profiles',
      p_target_id: userId,
      p_details: { additional_roles: additionalRoles }
    })

    if (logError) {
      console.error('Error logging audit:', logError)
      // Don't fail the request if logging fails
    }

    return new Response(JSON.stringify({ success: true, user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    console.error('Error in set-additional-roles:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
