import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Stripe from 'stripe';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

// Disable Next.js body parsing for raw body access needed for webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  // Validate inputs
  if (!signature) {
    console.error('Missing Stripe signature header');
    return NextResponse.json({ error: 'Missing Stripe signature header' }, { status: 400 });
  }

  if (!webhookSecret) {
    console.error('Missing Stripe webhook secret in environment variables');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    console.log('Webhook received:', event.type);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleSuccessfulPayment(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handleFailedPayment(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.canceled':
        await handleCanceledPayment(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleRefund(event.data.object as Stripe.Charge);
        break;
      default:
        // Unexpected event type
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, status: 'success', type: event.type });
  } catch (error) {
    console.error(`Error handling webhook ${event.type}:`, error);
    return NextResponse.json({ 
      error: 'Error processing webhook', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// Handle successful payment
async function handleSuccessfulPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing successful payment:', paymentIntent.id);

  try {
    // Get booking details first to avoid race conditions
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*, properties(*, hosts(id, email, stripe_account_id))')
      .eq('payment_id', paymentIntent.id)
      .single();

    if (fetchError || !booking) {
      console.error('Booking not found for payment:', paymentIntent.id, fetchError);
      return;
    }

    // Don't update if already confirmed
    if (booking.status === 'confirmed') {
      console.log('Booking already confirmed:', booking.id);
      return;
    }

    // 1. Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString(),
        payment_details: { stripe_payment_intent: paymentIntent.id, amount: paymentIntent.amount }
      })
      .eq('payment_id', paymentIntent.id);

    if (error) {
      console.error('Error updating booking status:', error);
      throw error;
    }

    // 2. Add unavailable dates to block the calendar
    const checkIn = new Date(booking.check_in);
    const checkOut = new Date(booking.check_out);
    
    // Generate array of dates for the stay
    const unavailableDates = [];
    const currentDate = new Date(checkIn);
    
    while (currentDate < checkOut) {
      unavailableDates.push({
        property_id: booking.property_id,
        date: currentDate.toISOString().split('T')[0],
        reason: `Booking #${booking.id}`,
        booking_id: booking.id
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Insert unavailable dates
    if (unavailableDates.length > 0) {
      const { error: datesError } = await supabase
        .from('unavailable_dates')
        .upsert(unavailableDates, { onConflict: 'property_id,date' });
      
      if (datesError) {
        console.error('Error blocking calendar dates:', datesError);
        // We don't throw here as the booking status is already updated
      }
    }

    // 3. Prepare to send confirmation emails
    const guestDetails = {
      name: booking.guest_name,
      email: booking.guest_email,
      bookingId: booking.id,
      checkIn: new Date(booking.check_in).toLocaleDateString(),
      checkOut: new Date(booking.check_out).toLocaleDateString(),
      propertyName: booking.properties?.name || 'Property',
      totalAmount: (paymentIntent.amount / 100).toFixed(2),
      currency: paymentIntent.currency.toUpperCase(),
    };

    const hostDetails = {
      email: booking.properties?.hosts?.email,
      hostId: booking.properties?.hosts?.id,
    };

    // Log the details that would be sent in emails
    console.log('Booking confirmed:', booking.id);
    console.log('Guest details:', guestDetails);
    console.log('Host details:', hostDetails);

    // TODO: Send confirmation emails
    // sendEmailToGuest(guestDetails);
    // sendEmailToHost(hostDetails, guestDetails);
    
    // TODO: Update Google Calendar if connected
    // updateGoogleCalendar(booking, booking.properties?.hosts?.id);

    return { success: true, bookingId: booking.id };
  } catch (error) {
    console.error('Error handling successful payment:', error);
    throw error;
  }
}

// Handle failed payment
async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing failed payment:', paymentIntent.id);
  
  try {
    // Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'payment_failed',
        updated_at: new Date().toISOString(),
        payment_details: { 
          stripe_payment_intent: paymentIntent.id, 
          failure_code: paymentIntent.last_payment_error?.code,
          failure_message: paymentIntent.last_payment_error?.message
        }
      })
      .eq('payment_id', paymentIntent.id);

    if (error) {
      console.error('Error updating booking status for failed payment:', error);
      throw error;
    }

    // Get booking details for notifications
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, guest_name, guest_email, property_id, properties(name, hosts(email))')
      .eq('payment_id', paymentIntent.id)
      .single();

    if (booking) {
      // TODO: Send payment failure notification to guest
      console.log('Payment failed for booking:', booking.id);
      console.log('Guest to notify:', booking.guest_email);
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling failed payment:', error);
    throw error;
  }
}

// Handle canceled payment
async function handleCanceledPayment(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing canceled payment:', paymentIntent.id);
  
  try {
    // Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString(),
        payment_details: { stripe_payment_intent: paymentIntent.id, status: 'canceled' }
      })
      .eq('payment_id', paymentIntent.id);

    if (error) {
      console.error('Error updating booking status for canceled payment:', error);
      throw error;
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling canceled payment:', error);
    throw error;
  }
}

// Handle refund
async function handleRefund(charge: Stripe.Charge) {
  console.log('Processing refund for charge:', charge.id);
  
  if (!charge.payment_intent) {
    console.log('No payment intent associated with this charge');
    return { success: false, reason: 'no_payment_intent' };
  }
  
  // Convert to string if it's a Stripe object
  const paymentIntentId = typeof charge.payment_intent === 'string' 
    ? charge.payment_intent 
    : charge.payment_intent.id;
  
  try {
    // Update booking status
    const { error } = await supabase
      .from('bookings')
      .update({ 
        status: 'refunded',
        updated_at: new Date().toISOString(),
        payment_details: { 
          stripe_payment_intent: paymentIntentId, 
          stripe_charge: charge.id,
          refund_amount: charge.amount_refunded,
          refund_date: new Date().toISOString()
        }
      })
      .eq('payment_id', paymentIntentId);

    if (error) {
      console.error('Error updating booking status for refund:', error);
      throw error;
    }

    // Get booking details for notifications
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, guest_name, guest_email, check_in, check_out, property_id, properties:property_id(name, hosts:host_id(email))')
      .eq('payment_id', paymentIntentId)
      .single();

    if (booking) {
      // Remove unavailable dates to unblock the calendar
      const { error: deleteError } = await supabase
        .from('unavailable_dates')
        .delete()
        .eq('booking_id', booking.id);
      
      if (deleteError) {
        console.error('Error removing unavailable dates:', deleteError);
      }
      
      // TODO: Send refund notification to guest and host
      console.log('Refund processed for booking:', booking.id);
      console.log('Guest to notify:', booking.guest_email);
      
      // Safely log host email if available
      let hostEmail = 'No host email found';
      try {
        // @ts-ignore - The nested structure may be hard for TypeScript to infer
        if (booking.properties && booking.properties.hosts && booking.properties.hosts.email) {
          // @ts-ignore
          hostEmail = booking.properties.hosts.email;
        }
      } catch (e) {
        console.error('Error extracting host email:', e);
      }
      console.log('Host to notify:', hostEmail);
    }

    return { success: true };
  } catch (error) {
    console.error('Error handling refund:', error);
    throw error;
  }
} 