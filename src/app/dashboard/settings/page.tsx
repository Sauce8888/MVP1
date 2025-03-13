'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Host } from '@/lib/types';

export default function Settings() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [host, setHost] = useState<Host | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [stripeKey, setStripeKey] = useState('');
  
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    async function fetchHostData() {
      try {
        const { data, error } = await supabase
          .from('hosts')
          .select('*')
          .eq('id', user!.id)
          .single();
          
        if (error) throw error;
        setHost(data);
        if (data?.stripe_publishable_key) {
          setStripeKey(data.stripe_publishable_key);
        }
      } catch (err: any) {
        console.error('Error fetching host data:', err);
        setError('Failed to load your account information');
      } finally {
        setLoading(false);
      }
    }
    
    fetchHostData();
  }, [user]);
  
  const handleSaveStripeKey = async () => {
    if (!user) {
      setError('You must be logged in to connect a Stripe account.');
      return;
    }
    
    if (!stripeKey || !stripeKey.startsWith('pk_')) {
      setError('Please enter a valid Stripe publishable key (starts with pk_)');
      return;
    }
    
    setIsConnectingStripe(true);
    setError(null);
    setMessage(null);
    
    try {
      // Update the host record with the Stripe publishable key
      const { error: updateError } = await supabase
        .from('hosts')
        .update({ 
          stripe_publishable_key: stripeKey,
          // Set a placeholder value for stripe_account_id to indicate it's connected
          stripe_account_id: 'direct-integration' 
        })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      // Update local state
      setHost(prev => prev ? { 
        ...prev, 
        stripe_publishable_key: stripeKey,
        stripe_account_id: 'direct-integration'
      } : null);
      
      setMessage('Stripe account successfully connected!');
      
    } catch (error: any) {
      console.error('Stripe key save error:', error);
      setError(error.message || 'Failed to save Stripe key');
    } finally {
      setIsConnectingStripe(false);
    }
  };
  
  const handleConnectCalendar = async () => {
    if (!user) {
      setError('You must be logged in to connect Google Calendar.');
      return;
    }
    
    setIsConnectingCalendar(true);
    setError(null);
    
    try {
      // In a real app, this would use OAuth2 with Google
      // For this MVP, we'll simulate it
      
      // Just update the flag in the database
      const { error: updateError } = await supabase
        .from('hosts')
        .update({ google_calendar_connected: true })
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      // Update local state
      setHost(prev => prev ? { ...prev, google_calendar_connected: true } : null);
      setMessage('Google Calendar successfully connected!');
      
      // This would normally redirect to Google OAuth
      // window.location.href = googleAuthUrl;
      
    } catch (err: any) {
      console.error('Error connecting Google Calendar:', err);
      setError(err.message || 'Failed to connect Google Calendar');
    } finally {
      setIsConnectingCalendar(false);
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Account Settings</h1>
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}
      
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {message}
        </div>
      )}
      
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Account Information</h2>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <p className="text-gray-900">{host?.name}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <p className="text-gray-900">{host?.email}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Payment Processing</h2>
        </div>
        
        <div className="p-6">
          <div className="flex items-start mb-6">
            <div className="flex-grow">
              <h3 className="font-medium mb-1">Stripe Account</h3>
              <p className="text-gray-600 mb-3">
                Connect your Stripe account to receive payments directly from guests.
              </p>
              
              {host?.stripe_account_id ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-green-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Your Stripe account is connected
                  </p>
                  {host.stripe_publishable_key && (
                    <p className="text-sm text-green-700 mt-1">
                      Key: {host.stripe_publishable_key.substring(0, 8)}...
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="stripeKey" className="block text-sm font-medium text-gray-700 mb-1">
                      Stripe Publishable Key
                    </label>
                    <input
                      type="text"
                      id="stripeKey"
                      placeholder="pk_test_..."
                      value={stripeKey}
                      onChange={(e) => setStripeKey(e.target.value)}
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      You can find your publishable key in your Stripe Dashboard under Developers → API keys
                    </p>
                  </div>
                  
                  <button
                    onClick={handleSaveStripeKey}
                    disabled={isConnectingStripe}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:bg-blue-300"
                  >
                    {isConnectingStripe ? 'Connecting...' : 'Connect Stripe Account'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Calendar Integration</h2>
        </div>
        
        <div className="p-6">
          <div className="flex items-start mb-6">
            <div className="flex-grow">
              <h3 className="font-medium mb-1">Google Calendar</h3>
              <p className="text-gray-600 mb-3">
                Connect your Google Calendar to sync bookings and avoid double bookings.
              </p>
              
              {host?.google_calendar_connected ? (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-green-800 flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Your Google Calendar is connected
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleConnectCalendar}
                  disabled={isConnectingCalendar}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition disabled:bg-blue-300"
                >
                  {isConnectingCalendar ? 'Connecting...' : 'Connect Google Calendar'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Account Actions</h2>
        </div>
        
        <div className="p-6">
          <button
            onClick={handleSignOut}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
} 