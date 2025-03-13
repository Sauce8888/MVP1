import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateSchema() {
  console.log('Updating database schema...');
  
  try {
    // Use the rpc function to execute SQL directly
    const { error } = await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE hosts ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT'
    });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Successfully added the stripe_publishable_key column to hosts table');
  } catch (err) {
    console.error('Error updating schema:', err);
    
    // Fall back to using Supabase REST API if RPC fails
    console.log('Trying alternative method...');
    
    try {
      // Create a temporary webhook to execute SQL
      const { error: webhookError } = await supabase
        .from('_manual_migrations')
        .insert({
          name: 'add_stripe_publishable_key',
          sql: 'ALTER TABLE hosts ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT'
        });
        
      if (webhookError) {
        throw webhookError;
      }
      
      console.log('✅ Migration queued. Please check your Supabase dashboard.');
    } catch (fallbackErr) {
      console.error('Alternative method also failed:', fallbackErr);
      console.log('\nManual instructions:');
      console.log('1. Go to your Supabase dashboard: https://app.supabase.io');
      console.log('2. Open your project and go to the SQL Editor');
      console.log('3. Execute this SQL:');
      console.log('   ALTER TABLE hosts ADD COLUMN IF NOT EXISTS stripe_publishable_key TEXT;');
    }
  }
}

updateSchema(); 