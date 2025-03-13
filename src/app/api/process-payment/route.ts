import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      hostStripeKey,
      bookingId, 
      paymentMethodId, 
      amount,
      customerEmail,
      customerName
    } = body;
    
    if (!hostStripeKey || !bookingId || !paymentMethodId || !amount) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing required parameters' 
      }, { status: 400 });
    }
    
    // Verify the booking exists
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();
      
    if (bookingError || !booking) {
      return NextResponse.json({ 
        success: false,
        error: 'Booking not found' 
      }, { status: 404 });
    }
    
    // Initialize Stripe with the host's key
    const stripe = new Stripe(hostStripeKey, { 
      apiVersion: '2023-10-16' as any
    });
    
    // Create a customer
    const customer = await stripe.customers.create({
      email: customerEmail,
      name: customerName,
      payment_method: paymentMethodId,
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe uses cents
      currency: 'usd',
      customer: customer.id,
      payment_method: paymentMethodId,
      confirm: true, // Confirm the payment immediately
      return_url: `${request.nextUrl.origin}/booking/success?id=${bookingId}`,
      description: `Booking #${bookingId}`,
      metadata: {
        booking_id: bookingId,
      },
    });
    
    // Update booking with payment information
    await supabase
      .from('bookings')
      .update({ 
        payment_id: paymentIntent.id,
        status: paymentIntent.status === 'succeeded' ? 'confirmed' : 'pending'
      })
      .eq('id', bookingId);
    
    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error('Payment processing error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Failed to process payment'
    }, { status: 500 });
  }
} 