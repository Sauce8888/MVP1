'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Property, CustomPricing, Booking, UnavailableDate } from '@/lib/types';
import Calendar from '@/components/ui/Calendar';
import BookingForm, { BookingFormData } from '@/components/ui/BookingForm';
import PropertyDetails from '@/components/ui/PropertyDetails';
import StripePayment from '@/components/ui/StripePayment';
import { calculateTotalPrice } from '@/lib/template-utils';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// Sample property data for development
const sampleProperty: Property = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  host_id: '456e6789-e89b-12d3-a456-426614174001',
  name: 'Beach House Retreat',
  description: 'A beautiful beach house with stunning ocean views.\n\nThis lovely property offers 3 bedrooms, a spacious living area, and direct beach access. Perfect for families or groups looking for a peaceful getaway by the sea.\n\nEnjoy the sound of waves and breathtaking sunsets from the private deck.',
  address: '123 Oceanview Drive, Seaside Town',
  base_rate: 150,
  weekend_rate: 180,
  min_stay: 2,
  created_at: new Date().toISOString(),
};

// Sample property images
const sampleImages = [
  'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e',
  'https://images.unsplash.com/photo-1465188162913-8fb5709d6d57',
  'https://images.unsplash.com/photo-1433360405326-e50f909805b3',
];

// Extend booking data to include test flag
interface ExtendedBookingData extends BookingFormData {
  property_id: string;
  check_in: string;
  check_out: string;
  is_test_data?: boolean;
}

export default function TemplateSite() {
  const [property, setProperty] = useState<Property>(sampleProperty);
  const [customPricing, setCustomPricing] = useState<CustomPricing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [unavailableDates, setUnavailableDates] = useState<UnavailableDate[]>([]);
  
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  
  const [paymentStep, setPaymentStep] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [bookingComplete, setBookingComplete] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check for payment confirmation on page load
  useEffect(() => {
    const paymentIntent = searchParams.get('payment_intent');
    
    if (paymentIntent) {
      // Payment has been processed, check status
      fetch(`/api/payment/status?payment_intent=${paymentIntent}`)
        .then(res => res.json())
        .then(data => {
          if (data.paymentStatus === 'succeeded' && data.bookingStatus === 'confirmed') {
            setBookingComplete(true);
          }
        })
        .catch(err => {
          console.error('Error checking payment status:', err);
        });
    }
  }, [searchParams]);
  
  // In a real implementation, we would fetch the property data, custom pricing, 
  // bookings, and unavailable dates from the API based on the URL/domain
  useEffect(() => {
    // In real implementation:
    // 1. Get the property based on the domain name or URL parameter
    // 2. Load all the related data
    // For now, we'll use the sample data
    
    // Simulating a small amount of custom pricing
    setCustomPricing([
      {
        id: '1',
        property_id: sampleProperty.id,
        date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        price: 200,
      },
      {
        id: '2',
        property_id: sampleProperty.id,
        date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        price: 200,
      },
    ]);
    
    // Fetch real unavailable dates from the database
    async function fetchUnavailableDates() {
      try {
        // Fetch unavailable dates from the database
        const { data, error } = await supabase
          .from('unavailable_dates')
          .select('*')
          .eq('property_id', sampleProperty.id);
          
        if (error) {
          console.error('Error fetching unavailable dates:', error);
          return;
        }
        
        console.log('Fetched unavailable dates:', data);
        setUnavailableDates(data || []);
        
        // Also fetch confirmed bookings to block those dates
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('check_in, check_out, id')
          .eq('property_id', sampleProperty.id)
          .eq('status', 'confirmed');
          
        if (bookingsError) {
          console.error('Error fetching bookings:', bookingsError);
          return;
        }
        
        // Convert bookings to unavailable dates
        if (bookingsData && bookingsData.length > 0) {
          const bookedDatesArray: UnavailableDate[] = [];
          
          bookingsData.forEach(booking => {
            const checkIn = new Date(booking.check_in);
            const checkOut = new Date(booking.check_out);
            const currentDate = new Date(checkIn);
            
            while (currentDate < checkOut) {
              bookedDatesArray.push({
                id: `booking_${booking.id}_${currentDate.toISOString().split('T')[0]}`,
                property_id: sampleProperty.id,
                date: currentDate.toISOString().split('T')[0],
                reason: `Booking #${booking.id}`
              });
              currentDate.setDate(currentDate.getDate() + 1);
            }
          });
          
          // Add these to the unavailable dates
          setUnavailableDates(prev => [...prev, ...bookedDatesArray]);
        }
      } catch (err) {
        console.error('Error in fetchUnavailableDates:', err);
      }
    }
    
    fetchUnavailableDates();
  }, []);
  
  // Handle date selection from the calendar
  const handleSelectDates = (checkInDate: Date | null, checkOutDate: Date | null) => {
    setCheckIn(checkInDate);
    setCheckOut(checkOutDate);
  };
  
  // Handle booking form submission
  const handleBookingSubmit = async (formData: BookingFormData) => {
    if (!property || !checkIn || !checkOut) {
      return;
    }
    
    try {
      // Add property_id to the form data
      const bookingData: ExtendedBookingData = {
        ...formData,
        property_id: property.id,
        check_in: checkIn.toISOString(),
        check_out: checkOut.toISOString()
      };
      
      // For sample data in development, add test property data to ensure API works
      if (process.env.NODE_ENV === 'development' && property.id === '123e4567-e89b-12d3-a456-426614174000') {
        console.log('Development mode: Using test property data with real Stripe API');
        // Prepare additional test data for backend
        bookingData.is_test_data = true;
      }
      
      // Submit booking to API - now we always use the real API
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create booking');
      }
      
      // Set the client secret for payment
      setPaymentClientSecret(data.clientSecret);
      setTotalAmount(data.amount);
      setPaymentStep(true);
      
    } catch (error) {
      console.error('Booking error:', error);
      if (error instanceof Error) {
        setPaymentError(error.message);
      } else {
        setPaymentError('An unexpected error occurred');
      }
    }
  };
  
  // Handle successful payment
  const handlePaymentSuccess = (paymentId: string) => {
    setBookingComplete(true);
    
    // Refresh the unavailable dates to update the calendar
    if (checkIn && checkOut) {
      const refreshUnavailableDates = async () => {
        try {
          // Fetch unavailable dates from the database
          const { data, error } = await supabase
            .from('unavailable_dates')
            .select('*')
            .eq('property_id', property.id);
            
          if (error) {
            console.error('Error refreshing unavailable dates:', error);
            return;
          }
          
          setUnavailableDates(data || []);
        } catch (err) {
          console.error('Error refreshing unavailable dates:', err);
        }
      };
      
      refreshUnavailableDates();
    }
    
    // Redirect to booking status page after a short delay
    setTimeout(() => {
      window.location.href = `/booking/status?payment_intent=${paymentId}&success=true`;
    }, 1500);
  };
  
  // Handle payment error
  const handlePaymentError = (errorMessage: string) => {
    setPaymentError(errorMessage);
  };
  
  // Reset booking process
  const resetBooking = () => {
    setCheckIn(null);
    setCheckOut(null);
    setPaymentStep(false);
    setPaymentClientSecret('');
    setPaymentError(null);
    setBookingComplete(false);
    
    // Refresh the calendar data when returning to the booking form
    const refreshCalendarData = async () => {
      try {
        // Fetch unavailable dates from the database
        const { data, error } = await supabase
          .from('unavailable_dates')
          .select('*')
          .eq('property_id', property.id);
          
        if (error) {
          console.error('Error refreshing unavailable dates:', error);
          return;
        }
        
        setUnavailableDates(data || []);
        
        // Also fetch updated bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('property_id', property.id);
          
        if (bookingsError) {
          console.error('Error refreshing bookings:', bookingsError);
          return;
        }
        
        setBookings(bookingsData || []);
      } catch (err) {
        console.error('Error refreshing calendar data:', err);
      }
    };
    
    refreshCalendarData();
  };
  
  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">{property.name}</h1>
          <Link href="/" className="text-sm underline">
            Homepage
          </Link>
        </div>
      </header>
      
      {/* Main content */}
      <main className="container mx-auto p-4 md:p-8">
        {bookingComplete ? (
          <div className="max-w-lg mx-auto bg-green-50 border border-green-200 rounded-lg p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-green-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <h2 className="text-2xl font-bold text-green-700 mb-2">Booking Confirmed!</h2>
            <p className="text-green-600 mb-6">
              Thank you for your booking. We've sent a confirmation email with all the details.
            </p>
            <button
              onClick={resetBooking}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
              aria-label="Book again"
            >
              Make Another Booking
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Property details */}
            <div className="lg:col-span-2">
              <PropertyDetails property={property} images={sampleImages} />
            </div>
            
            {/* Booking section */}
            <div className="space-y-6">
              {paymentStep ? (
                <div>
                  {paymentClientSecret ? (
                    <StripePayment
                      clientSecret={paymentClientSecret}
                      publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
                      amount={totalAmount}
                      onSuccess={handlePaymentSuccess}
                      onError={handlePaymentError}
                    />
                  ) : (
                    <div className="p-4 text-center">
                      <div className="animate-pulse">Preparing payment form...</div>
                    </div>
                  )}
                  
                  {paymentError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4">
                      {paymentError}
                    </div>
                  )}
                  
                  <button
                    onClick={() => setPaymentStep(false)}
                    className="mt-4 w-full px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition"
                    aria-label="Back to booking form"
                  >
                    Back to Booking
                  </button>
                </div>
              ) : (
                <>
                  <Calendar
                    property={property}
                    bookings={bookings}
                    unavailableDates={unavailableDates}
                    customPricing={customPricing}
                    onSelectDates={handleSelectDates}
                  />
                  
                  <BookingForm
                    property={property}
                    customPricing={customPricing}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''}
                    onBookingSubmit={handleBookingSubmit}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-100 py-4 mt-12">
        <div className="container mx-auto text-center text-gray-600 text-sm">
          <p>&copy; {new Date().getFullYear()} {property.name}. All rights reserved.</p>
          <p className="mt-1">Direct booking powered by Airbnb Direct Booking Solution</p>
        </div>
      </footer>
    </div>
  );
} 