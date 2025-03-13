import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

// Check for environment variables
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// Initialize Stripe with secret key - use type assertion for API version
const stripe = stripeSecretKey 
  ? new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' as Stripe.LatestApiVersion }) 
  : null;

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    if (!stripe || !stripeSecretKey) {
      return NextResponse.json({ 
        error: 'Stripe API key is missing', 
        details: 'Please check your environment variables'
      }, { status: 500 });
    }

    const body = await request.json();
    const { hostId } = body;
    
    if (!hostId) {
      return NextResponse.json({ error: 'Host ID is required' }, { status: 400 });
    }
    
    // Get host from database
    const { data: host, error: hostError } = await supabase
      .from('hosts')
      .select('*')
      .eq('id', hostId)
      .single();
    
    if (hostError || !host) {
      return NextResponse.json({ 
        error: 'Host not found', 
        details: hostError?.message 
      }, { status: 404 });
    }
    
    // If host already has a Stripe account, return the dashboard link
    if (host.stripe_account_id) {
      try {
        const accountLink = await stripe.accountLinks.create({
          account: host.stripe_account_id,
          refresh_url: `${appUrl}/dashboard/settings`,
          return_url: `${appUrl}/dashboard/settings`,
          type: 'account_onboarding',
        });
        
        return NextResponse.json({ url: accountLink.url });
      } catch (linkError: any) {
        // If the account is invalid or doesn't exist anymore, create a new one
        if (linkError.code === 'resource_missing') {
          // Continue with creating a new account below
          console.log('Previous Stripe account invalid, creating a new one');
        } else {
          throw linkError;
        }
      }
    }
    
    try {
      // Create a new Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        email: host.email,
        metadata: {
          hostId,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      
      // Save the Stripe account ID to the database
      await supabase
        .from('hosts')
        .update({ stripe_account_id: account.id })
        .eq('id', hostId);
        
      // Create an account link for onboarding
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${appUrl}/dashboard/settings`,
        return_url: `${appUrl}/dashboard/settings`,
        type: 'account_onboarding',
      });
      
      return NextResponse.json({ url: accountLink.url });
    } catch (stripeError: any) {
      // Handle the specific case where Stripe Connect is not activated
      if (stripeError.message?.includes('create accounts')) {
        return NextResponse.json({ 
          error: 'Stripe Connect not activated', 
          details: 'You need to activate Stripe Connect in your Stripe Dashboard first. Visit https://stripe.com/docs/connect/get-started to learn how.',
          stripeError: stripeError.message
        }, { status: 403 });
      }
      
      throw stripeError;
    }
  } catch (error: any) {
    console.error('Detailed error in create-stripe-connect:', error);
    return NextResponse.json({ 
      error: 'Failed to create Stripe Connect account',
      details: error.message 
    }, { status: 500 });
  }
} 