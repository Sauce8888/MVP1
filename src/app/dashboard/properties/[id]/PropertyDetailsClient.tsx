'use client';

import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Property, CustomPricing, Booking, CalendarEvent } from '@/lib/types';
import Link from 'next/link';
import CalendarSettings from '@/components/CalendarSettings';

type PropertyDetailsClientProps = {
  propertyId: string;
};

export default function PropertyDetailsClient({ propertyId }: PropertyDetailsClientProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [property, setProperty] = useState<Property | null>(null);
  const [customPricing, setCustomPricing] = useState<CustomPricing[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  
  // Form fields for editing
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [weekendRate, setWeekendRate] = useState('');
  const [minStay, setMinStay] = useState('');
  
  // Custom pricing fields
  const [newPriceDate, setNewPriceDate] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [savingCustomPrice, setSavingCustomPrice] = useState(false);

  useEffect(() => {
    if (!user) {
      // Redirect to login if no user
      router.push('/auth/signin');
      return;
    }
    
    const userId = user.id;
    
    async function fetchPropertyDetails() {
      try {
        // Fetch property
        const { data: propertyData, error: propertyError } = await supabase
          .from('properties')
          .select('*')
          .eq('id', propertyId)
          .eq('host_id', userId)
          .single();

        if (propertyError) throw propertyError;
        
        if (!propertyData) {
          router.push('/dashboard/properties');
          return;
        }
        
        setProperty(propertyData);
        
        // Set form fields
        setName(propertyData.name);
        setDescription(propertyData.description || '');
        setAddress(propertyData.address || '');
        setBaseRate(propertyData.base_rate.toString());
        setWeekendRate(propertyData.weekend_rate ? propertyData.weekend_rate.toString() : '');
        setMinStay(propertyData.min_stay.toString());
        
        // Fetch custom pricing
        const { data: pricingData, error: pricingError } = await supabase
          .from('custom_pricing')
          .select('*')
          .eq('property_id', propertyId)
          .order('date', { ascending: true });
          
        if (pricingError) throw pricingError;
        setCustomPricing(pricingData || []);
        
        // Fetch bookings for this property
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .eq('property_id', propertyId);
          
        if (bookingsError) throw bookingsError;
        setBookings(bookingsData || []);
        
        try {
          // Fetch calendar events for this property - handle case where table might not exist yet
          const { data: calendarData, error: calendarError } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('property_id', propertyId);
            
          if (calendarError) {
            // Check if error is because the table doesn't exist
            const errorMessage = calendarError.message || '';
            if (errorMessage.includes('does not exist')) {
              console.log('Calendar events table does not exist yet. This is expected while building the calendar feature.');
              setCalendarEvents([]); // Set empty array
            } else {
              throw calendarError; // Re-throw if it's a different error
            }
          } else {
            setCalendarEvents(calendarData || []);
          }
        } catch (calendarErr) {
          console.warn('Error fetching calendar events:', calendarErr);
          // Don't let this stop the whole page from loading
          setCalendarEvents([]);
        }
        
      } catch (err: any) {
        console.error('Error fetching property details:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    
    fetchPropertyDetails();
  }, [user, propertyId, router]);
  
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const { error: updateError } = await supabase
        .from('properties')
        .update({
          name,
          description,
          address,
          base_rate: Number(baseRate),
          weekend_rate: weekendRate ? Number(weekendRate) : null,
          min_stay: Number(minStay),
        })
        .eq('id', propertyId);
        
      if (updateError) throw updateError;
      
      // Refresh property data
      const { data: refreshedData, error: refreshError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();
        
      if (refreshError) throw refreshError;
      setProperty(refreshedData);
      setIsEditing(false);
      
    } catch (err: any) {
      setError(err.message || 'Failed to update property');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddCustomPrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceDate || !newPrice) return;
    
    setSavingCustomPrice(true);
    setError(null);
    
    try {
      // Check if date already exists
      const existingIndex = customPricing.findIndex(
        p => p.date === newPriceDate
      );
      
      if (existingIndex >= 0) {
        // Update existing price
        const { error: updateError } = await supabase
          .from('custom_pricing')
          .update({ price: Number(newPrice) })
          .eq('id', customPricing[existingIndex].id);
          
        if (updateError) throw updateError;
        
        // Update local state
        const updatedPricing = [...customPricing];
        updatedPricing[existingIndex] = {
          ...updatedPricing[existingIndex],
          price: Number(newPrice),
        };
        setCustomPricing(updatedPricing);
      } else {
        // Insert new price
        const { data: newPriceData, error: insertError } = await supabase
          .from('custom_pricing')
          .insert({
            property_id: propertyId,
            date: newPriceDate,
            price: Number(newPrice),
          })
          .select();
          
        if (insertError) throw insertError;
        
        // Add to local state
        if (newPriceData) {
          setCustomPricing([...customPricing, newPriceData[0]]);
        }
      }
      
      // Reset form
      setNewPriceDate('');
      setNewPrice('');
      
    } catch (err: any) {
      setError(err.message || 'Failed to save custom price');
    } finally {
      setSavingCustomPrice(false);
    }
  };
  
  const handleDeleteCustomPrice = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_pricing')
        .delete()
        .eq('id', id);
        
      if (error) throw error;
      
      // Update local state
      setCustomPricing(customPricing.filter(p => p.id !== id));
      
    } catch (err: any) {
      setError(err.message || 'Failed to delete custom price');
    }
  };
  
  const handleGetEmbedCode = () => {
    // Generate embed code for carrd.co
    const embedCode = `<iframe src="${window.location.origin}/widget/${propertyId}" width="100%" height="600" frameborder="0"></iframe>`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(embedCode)
      .then(() => {
        alert('Embed code copied to clipboard!');
      })
      .catch(err => {
        console.error('Failed to copy embed code:', err);
        alert('Failed to copy embed code. Please try again.');
      });
  };
  
  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4">Loading property details...</p>
      </div>
    );
  }
  
  if (error || !property) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Error</h2>
        <p>{error || 'Property not found'}</p>
        <Link 
          href="/dashboard/properties" 
          className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          tabIndex={0}
          aria-label="Go back to properties"
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
        >
          Back to Properties
        </Link>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {property?.name || 'Property Details'}
        </h1>
        <div className="flex space-x-2">
          <Link
            href="/dashboard/properties"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back to Properties
          </Link>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Edit Property
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="animate-pulse p-4 bg-white rounded-lg shadow">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-full mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-1 pb-4 text-sm font-medium ${
                  activeTab === 'details'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Details
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-1 pb-4 text-sm font-medium ${
                  activeTab === 'pricing'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Custom Pricing
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-1 pb-4 text-sm font-medium ${
                  activeTab === 'calendar'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Calendar
              </button>
              <button
                onClick={() => setActiveTab('embed')}
                className={`px-1 pb-4 text-sm font-medium ${
                  activeTab === 'embed'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Embed Code
              </button>
            </nav>
          </div>

          {/* Tab content */}
          {activeTab === 'details' && (
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              {isEditing ? (
                <form onSubmit={handleUpdate}>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Property Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                        Address
                      </label>
                      <input
                        type="text"
                        id="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label htmlFor="baseRate" className="block text-sm font-medium text-gray-700">
                          Base Rate per Night ($) *
                        </label>
                        <input
                          type="number"
                          id="baseRate"
                          value={baseRate}
                          onChange={(e) => setBaseRate(e.target.value)}
                          required
                          min="0"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label htmlFor="weekendRate" className="block text-sm font-medium text-gray-700">
                          Weekend Rate per Night ($)
                        </label>
                        <input
                          type="number"
                          id="weekendRate"
                          value={weekendRate}
                          onChange={(e) => setWeekendRate(e.target.value)}
                          min="0"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label htmlFor="minStay" className="block text-sm font-medium text-gray-700">
                          Minimum Stay (Nights)
                        </label>
                        <input
                          type="number"
                          id="minStay"
                          value={minStay}
                          onChange={(e) => setMinStay(e.target.value)}
                          min="1"
                          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex space-x-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-md bg-gray-200 px-4 py-2 text-gray-800 shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h2 className="text-xl font-semibold mb-2">Property Details</h2>
                      <p className="text-gray-600">{property.description || 'No description provided'}</p>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit Details
                    </button>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-6">
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Address</dt>
                        <dd className="mt-1 text-gray-900">{property.address || 'Not specified'}</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Base Rate</dt>
                        <dd className="mt-1 text-gray-900">${property.base_rate}/night</dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Weekend Rate</dt>
                        <dd className="mt-1 text-gray-900">
                          {property.weekend_rate ? `$${property.weekend_rate}/night` : 'Same as base rate'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-sm font-medium text-gray-500">Minimum Stay</dt>
                        <dd className="mt-1 text-gray-900">
                          {property.min_stay} {property.min_stay === 1 ? 'night' : 'nights'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="bg-white shadow rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-6">Custom Pricing</h2>
              
              <form onSubmit={handleAddCustomPrice} className="mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-1">
                    <label htmlFor="newPriceDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      id="newPriceDate"
                      value={newPriceDate}
                      onChange={(e) => setNewPriceDate(e.target.value)}
                      required
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label htmlFor="newPrice" className="block text-sm font-medium text-gray-700 mb-1">
                      Price per Night ($)
                    </label>
                    <input
                      type="number"
                      id="newPrice"
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      required
                      min="0"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-1 flex items-end">
                    <button
                      type="submit"
                      disabled={savingCustomPrice}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-300"
                    >
                      {savingCustomPrice ? 'Saving...' : 'Set Price'}
                    </button>
                  </div>
                </div>
              </form>
              
              {customPricing.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customPricing.map((pricing) => (
                        <tr key={pricing.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(pricing.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            ${pricing.price}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleDeleteCustomPrice(pricing.id)}
                              className="text-red-600 hover:text-red-800"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No custom pricing set. Your base rate will apply to all dates.
                </div>
              )}
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="bg-white rounded-lg shadow overflow-hidden p-6">
              <CalendarSettings propertyId={propertyId} />
            </div>
          )}

          {activeTab === 'embed' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Booking Widget</h2>
              <p className="mb-4">
                Use this embed code to add a booking widget to your website. 
                Simply copy the code and paste it into your carrd.co site.
              </p>
              
              <button
                onClick={handleGetEmbedCode}
                className="rounded-md bg-green-600 px-4 py-2 text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Copy Embed Code
              </button>
              
              <div className="mt-6 p-4 bg-gray-50 rounded border border-gray-200">
                <h3 className="font-semibold mb-2">Preview</h3>
                <div className="h-64 bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">Booking widget preview will appear here</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 