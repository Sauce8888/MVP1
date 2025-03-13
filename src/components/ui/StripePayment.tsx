'use client';

import { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';

type PaymentFormProps = {
  clientSecret: string;
  amount: number;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
};

// Payment form component that uses Stripe Elements
const PaymentForm = ({ clientSecret, amount, onSuccess, onError }: PaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js has not yet loaded
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      const { error: submitError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (submitError) {
        setError(submitError.message || 'An error occurred while processing your payment');
        onError(submitError.message || 'Payment failed');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment successful
        onSuccess(paymentIntent.id);
      } else {
        setError('Something went wrong with your payment. Please try again.');
        onError('Payment status unexpected');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      onError('Payment system error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <PaymentElement />
      </div>

      {error && (
        <div className="p-3 mb-4 text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
        aria-label="Pay now"
      >
        {processing ? 'Processing...' : `Pay €${amount}`}
      </button>
    </form>
  );
};

// Wrapper component that initializes Stripe
type StripePaymentProps = {
  clientSecret: string;
  publishableKey: string;
  amount: number;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
};

const StripePayment = ({ clientSecret, publishableKey, amount, onSuccess, onError }: StripePaymentProps) => {
  const [stripePromise] = useState<Promise<Stripe | null>>(() => 
    loadStripe(publishableKey)
  );
  
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div className="mt-6">
      <h3 className="text-xl font-bold mb-4">Payment Details</h3>
      
      {/* Display test mode notice in development */}
      {isDevelopment && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-800">
          <p><strong>Test Mode</strong> - No real charges will be made. Use test card 4242 4242 4242 4242.</p>
        </div>
      )}
      
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <PaymentForm 
            clientSecret={clientSecret} 
            amount={amount} 
            onSuccess={onSuccess} 
            onError={onError} 
          />
        </Elements>
      ) : (
        <div className="p-4 text-center">
          <div className="animate-pulse">Loading payment form...</div>
        </div>
      )}
      
      <div className="mt-4 text-xs text-gray-500 text-center">
        <p>Your payment is secure and encrypted. We do not store your card details.</p>
        <p className="mt-2">For testing, use card number: 4242 4242 4242 4242</p>
        <p>Any future expiry date and any 3-digit CVC code.</p>
      </div>
    </div>
  );
};

export default StripePayment; 