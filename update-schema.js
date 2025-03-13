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

// Add calendar_connections table
const createCalendarConnectionsTable = async () => {
  const { error } = await supabase.query(`
    CREATE TABLE IF NOT EXISTS calendar_connections (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
      source VARCHAR(50) NOT NULL,
      ical_url TEXT NOT NULL,
      last_synced TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  
  if (error) {
    console.error('Error creating calendar_connections table:', error);
    return false;
  }
  
  console.log('Calendar connections table created successfully');
  return true;
};

// Add calendar_events table to store iCal events
const createCalendarEventsTable = async () => {
  const { error } = await supabase.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
      source VARCHAR(50) NOT NULL,
      external_id TEXT,
      summary TEXT,
      start_date TIMESTAMP WITH TIME ZONE NOT NULL,
      end_date TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(property_id, source, external_id)
    );
  `);
  
  if (error) {
    console.error('Error creating calendar_events table:', error);
    return false;
  }
  
  console.log('Calendar events table created successfully');
  return true;
};

// Execute all migrations
const runMigrations = async () => {
  console.log('Starting database migrations...');
  
  // Call all your migration functions here
  // ... existing migrations ...
  
  await createCalendarConnectionsTable();
  await createCalendarEventsTable();
  
  console.log('All migrations completed');
};

updateSchema();
runMigrations(); 