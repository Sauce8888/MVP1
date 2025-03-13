import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-02-24.acacia',
});

// Disable body parsing, need raw body for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature') as string;
  
  let event: Stripe.Event;
  
  try {
    // Get the webhook secret from the Stripe CLI
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('Missing Stripe webhook secret');
      return NextResponse.json({ error: 'Webhook secret missing' }, { status: 500 });
    }
    
    // Verify the event came from Stripe
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }
  
  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Get booking_id from metadata
    const bookingId = session.metadata?.booking_id;
    
    if (bookingId) {
      // Update booking status to confirmed
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: 'confirmed',
          payment_id: session.payment_intent as string
        })
        .eq('id', bookingId);
        
      if (error) {
        console.error('Error updating booking:', error);
        return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
      }
    }
  }
  
  return NextResponse.json({ received: true });
} 