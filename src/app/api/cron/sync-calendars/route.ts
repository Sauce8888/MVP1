'use server';

import { NextRequest, NextResponse } from 'next/server';
import { syncAllCalendars } from '@/lib/ical-utils';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // Get API key from authorization header
  const authHeader = request.headers.get('authorization');
  const apiKey = process.env.CRON_API_KEY;
  
  // Validate API key to ensure only authorized services can call this endpoint
  if (!authHeader || !apiKey || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== apiKey) {
    return NextResponse.json({ 
      error: 'Unauthorized', 
      success: false 
    }, { status: 401 });
  }
  
  try {
    // Create a server-side supabase client with service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    
    if (!supabaseServiceKey) {
      console.error('Missing service role key');
      return NextResponse.json({ 
        error: 'Server configuration error', 
        success: false 
      }, { status: 500 });
    }
    
    // Initialize with service role for admin privileges that bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Pass the admin client to sync all calendars
    await syncAllCalendars(supabase);
    
    return NextResponse.json({ 
      success: true, 
      message: 'All calendars synced successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error syncing calendars:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 