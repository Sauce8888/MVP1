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

// Function to add event_id column to unavailable_dates table
async function addEventIdColumn() {
  console.log('Adding event_id column to unavailable_dates table...');
  
  try {
    // Use the rpc function to execute SQL directly
    const { error } = await supabase.rpc('execute_sql', {
      query: 'ALTER TABLE unavailable_dates ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL'
    });
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Successfully added event_id column to unavailable_dates table');
  } catch (err) {
    console.error('Error updating schema:', err);
    
    // Fall back to using Supabase REST API if RPC fails
    console.log('Trying alternative method...');
    
    try {
      // Attempt to execute raw SQL
      const { error } = await supabase.query(`
        ALTER TABLE unavailable_dates 
        ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL
      `);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Successfully added event_id column to unavailable_dates table');
    } catch (fallbackErr) {
      console.error('Alternative method also failed:', fallbackErr);
      console.log('\nManual instructions:');
      console.log('1. Go to your Supabase dashboard: https://app.supabase.io');
      console.log('2. Open your project and go to the SQL Editor');
      console.log('3. Execute this SQL:');
      console.log('   ALTER TABLE unavailable_dates ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;');
    }
  }
}

// Run the migration
addEventIdColumn()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

console.log('Migration Instructions:');
console.log('The migration needs to be done directly in the Supabase Studio.');
console.log('Please follow these steps:');
console.log('1. Go to your Supabase dashboard: https://app.supabase.io');
console.log('2. Open your project and go to the SQL Editor');
console.log('3. Create a new query and execute this SQL:');
console.log('');
console.log('ALTER TABLE unavailable_dates');
console.log('ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL;');
console.log('');
console.log('4. After running the query, restart the application.'); 