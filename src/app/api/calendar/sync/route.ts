'use server';

import { NextRequest, NextResponse } from 'next/server';
import { syncCalendarEvents } from '@/lib/ical-utils';
import { createClient } from '@supabase/supabase-js';

// Enable this flag to bypass auth checks for development
const BYPASS_AUTH = true; // TODO: Set to false in production

// Create a server-side Supabase client using the request cookies
const createServerClient = (request: NextRequest) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  
  // When bypassing auth in development, use the service role key to bypass RLS
  if (BYPASS_AUTH) {
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      console.error('⚠️ SUPABASE_SERVICE_ROLE_KEY is not set. Using admin RLS bypass approach instead.');
      
      // Alternative approach: Create client with anon key but add special headers
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        },
        global: {
          headers: {
            // Set a header that your RLS policies can check for admin access
            'x-admin-access': 'true'
          }
        }
      });
    }
    
    console.log('⚠️ Using service role key to bypass RLS');
    return createClient(supabaseUrl, supabaseServiceKey);
  }
  
  // For normal auth flow, use anon key with cookies
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  const cookieHeader = request.headers.get('cookie') || '';
  
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    global: {
      headers: {
        cookie: cookieHeader
      }
    }
  });
};

export async function POST(request: NextRequest) {
  try {
    // Create a Supabase client that uses cookies from the request headers
    const supabase = createServerClient(request);
    
    // Get authenticated user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log('Session check result:', { 
      hasSession: !!session, 
      userId: session?.user?.id,
      sessionError,
      cookieHeader: request.headers.get('cookie')?.substring(0, 50) + '...' // Log a partial cookie for debugging
    });
    
    // Use the bypass option during development if enabled
    let userId: string;
    
    if (BYPASS_AUTH) {
      // If bypassing auth, use a known test ID or fetch first host
      const { data: firstHost } = await supabase
        .from('hosts')
        .select('id')
        .limit(1)
        .single();
        
      userId = firstHost?.id || '00000000-0000-0000-0000-000000000000';
      console.log('⚠️ BYPASSING AUTH - Using host ID:', userId);
    } else {
      // Normal authentication flow
      if (sessionError || !session) {
        console.error('Authentication error:', sessionError);
        return NextResponse.json(
          { error: 'You must be signed in to sync calendars' },
          { status: 401 }
        );
      }
      
      userId = session.user.id;
    }
    
    // Parse request body
    const body = await request.json();
    const { propertyId } = body;

    // Validate request
    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }
    
    // Verify property exists and belongs to authenticated user (skip host_id check if bypassing auth)
    let propertyQuery = supabase
      .from('properties')
      .select('id, host_id')
      .eq('id', propertyId);
      
    if (!BYPASS_AUTH) {
      propertyQuery = propertyQuery.eq('host_id', userId);
    }
    
    const { data: property, error: propertyError } = await propertyQuery.single();

    if (propertyError || !property) {
      console.error('Property verification error:', propertyError);
      return NextResponse.json(
        { error: 'Property not found or not owned by you' },
        { status: 404 }
      );
    }

    // Get calendar connections for this property
    const { data: connections, error } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('property_id', propertyId);

    if (error) {
      console.error('Error fetching connections:', error);
      throw error;
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json(
        { error: 'No calendar connections found for this property' },
        { status: 404 }
      );
    }

    // Sync each connection
    const results = [];
    
    for (const connection of connections) {
      try {
        const result = await syncCalendarEvents(connection, supabase);
        results.push({
          source: connection.source,
          result,
          success: true
        });
      } catch (syncError) {
        console.error(`Error syncing ${connection.source} calendar:`, syncError);
        results.push({
          source: connection.source,
          error: syncError instanceof Error ? syncError.message : 'Unknown error',
          success: false
        });
      }
    }

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error) {
    console.error('Error syncing calendars:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to sync calendars',
        success: false
      },
      { status: 500 }
    );
  }
} 