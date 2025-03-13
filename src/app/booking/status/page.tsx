'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'payment_failed' | 'refunded';

interface BookingDetails {
  bookingId: string;
  bookingStatus: BookingStatus;
  paymentStatus: string;
  propertyName: string;
  propertyAddress: string;
  guestName: string;
  guestEmail: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestsCount: number;
  amount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  isTestBooking?: boolean;
  isTestProperty?: boolean;
}

export default function BookingStatusPage() {
  const searchParams = useSearchParams();
  const paymentIntent = searchParams.get('payment_intent');
  const bookingSuccess = searchParams.get('success') === 'true';
  
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const checkBookingStatus = async () => {
      if (!paymentIntent) {
        setError('No booking information found');
        setLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/payment/status?payment_intent=${paymentIntent}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch booking status');
        }
        
        const data = await response.json();
        setBooking(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    checkBookingStatus();
  }, [paymentIntent]);
  
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };
  
  // Get status color based on booking status
  const getStatusColor = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
      case 'payment_failed':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Get a human-readable status message
  const getStatusMessage = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return 'Your booking is confirmed!';
      case 'pending':
        return 'Your booking is pending payment confirmation.';
      case 'cancelled':
        return 'This booking has been cancelled.';
      case 'payment_failed':
        return 'Payment for this booking failed. Please try again.';
      case 'refunded':
        return 'This booking has been refunded.';
      default:
        return 'Unknown status';
    }
  };
  
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-4 bg-gray-200 rounded w-full mb-3"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6 mb-10"></div>
          <div className="h-20 bg-gray-200 rounded mb-6"></div>
          <div className="h-40 bg-gray-200 rounded mb-6"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10">
        <div className="bg-red-50 border border-red-200 rounded-md p-6 mb-6">
          <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error}</p>
        </div>
        <Link 
          href="/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          aria-label="Go to homepage"
        >
          Return to Home
        </Link>
      </div>
    );
  }
  
  if (!booking) {
    return (
      <div className="max-w-3xl mx-auto p-6 mt-10">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 mb-6">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Booking Not Found</h2>
          <p className="text-yellow-700">We couldn't find your booking information. If you've just completed a booking, it may take a moment to process.</p>
        </div>
        <Link 
          href="/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          aria-label="Go to homepage"
        >
          Return to Home
        </Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-3xl mx-auto p-6 mt-10">
      {/* Test Booking Banner */}
      {(booking.isTestBooking || booking.isTestProperty) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
          <p className="text-yellow-800 font-medium">
            This is a booking for a test property created with Stripe test mode.
          </p>
        </div>
      )}
      
      <h1 className="text-3xl font-bold mb-2">Booking Summary</h1>
      <p className="text-gray-600 mb-6">Booking Reference: {booking.bookingId}</p>
      
      <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-6 ${getStatusColor(booking.bookingStatus)}`}>
        {booking.bookingStatus.toUpperCase()}
      </div>
      
      <div className="bg-white border rounded-lg shadow-sm overflow-hidden mb-8">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold mb-4">Status</h2>
          <p className="text-gray-700 mb-2">
            {getStatusMessage(booking.bookingStatus)}
          </p>
          {booking.bookingStatus === 'confirmed' && (
            <p className="text-gray-600">
              A confirmation email has been sent to {booking.guestEmail}.
            </p>
          )}
        </div>
        
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold mb-4">Booking Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold text-gray-700">Property</h3>
              <p className="text-gray-600">{booking.propertyName}</p>
              <p className="text-gray-600">{booking.propertyAddress}</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700">Dates</h3>
              <p className="text-gray-600">Check-in: {formatDate(booking.checkIn)}</p>
              <p className="text-gray-600">Check-out: {formatDate(booking.checkOut)}</p>
              <p className="text-gray-600">{booking.nights} night{booking.nights !== 1 ? 's' : ''}</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700">Guest</h3>
              <p className="text-gray-600">{booking.guestName}</p>
              <p className="text-gray-600">{booking.guestEmail}</p>
              <p className="text-gray-600">{booking.guestsCount} guest{booking.guestsCount !== 1 ? 's' : ''}</p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-700">Payment</h3>
              <p className="text-gray-600 font-medium">
                {booking.currency === 'eur' ? '€' : '$'}{booking.amount.toFixed(2)}
              </p>
              <p className="text-gray-600">Status: {booking.paymentStatus}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <Link 
          href="/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          aria-label="Go to homepage"
        >
          Return to Home
        </Link>
        
        {booking.bookingStatus === 'confirmed' && (
          <button 
            className="px-4 py-2 bg-white border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
            onClick={() => window.print()}
            aria-label="Print booking confirmation"
          >
            Print Confirmation
          </button>
        )}
      </div>
    </div>
  );
} 