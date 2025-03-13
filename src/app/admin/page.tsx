'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

type Host = {
  id: string;
  name: string;
  email: string;
  created_at: string;
  stripe_account_id: string | null;
  google_calendar_connected: boolean;
  has_test_property?: boolean;
  properties: {
    id: string;
    name: string;
    base_rate: number;
    created_at: string;
  }[];
};

type WebsiteTemplate = {
  id: string;
  name: string;
  description: string;
  propertyDetails: {
    name: string;
    description: string;
    address: string;
    base_rate: number;
    weekend_rate: number;
    min_stay: number;
  };
};

// Define available website templates
const websiteTemplates: WebsiteTemplate[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Beach House Template',
    description: 'A beautiful beach house template with ocean views',
    propertyDetails: {
      name: 'Beach House Retreat',
      description: 'A beautiful beach house with stunning ocean views.',
      address: '123 Oceanview Drive, Seaside Town',
      base_rate: 150,
      weekend_rate: 180,
      min_stay: 2
    }
  }
];

export default function AdminDashboard() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [connectionMessages, setConnectionMessages] = useState<Record<string, string>>({});
  const [selectedTemplates, setSelectedTemplates] = useState<Record<string, string>>({});
  
  // Simple admin authentication (for demo purposes)
  const [password, setPassword] = useState('');
  
  // In a real app, you'd use proper authentication
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123';
  
  useEffect(() => {
    // Check if admin is authenticated from localStorage
    const adminAuth = localStorage.getItem('adminAuthenticated');
    if (adminAuth === 'true') {
      setIsAuthenticated(true);
      fetchHosts();
    } else {
      setLoading(false);
    }
  }, []);
  
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password === adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('adminAuthenticated', 'true');
      fetchHosts();
    } else {
      setError('Invalid password');
    }
  };
  
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuthenticated');
  };
  
  const handleTemplateSelect = (hostId: string, templateId: string) => {
    setSelectedTemplates(prev => ({ ...prev, [hostId]: templateId }));
  };
  
  const connectWebsiteTemplate = async (hostId: string, hostEmail: string) => {
    // If there's only one template, use it directly
    const templateId = websiteTemplates.length === 1 
      ? websiteTemplates[0].id 
      : selectedTemplates[hostId];
      
    if (!templateId) {
      setConnectionMessages(prev => ({ 
        ...prev, 
        [hostId]: 'Please select a template first' 
      }));
      return;
    }
    
    setConnecting(prev => ({ ...prev, [hostId]: true }));
    setConnectionMessages(prev => ({ ...prev, [hostId]: '' }));
    
    try {
      const template = websiteTemplates.find(t => t.id === templateId);
      if (!template) {
        throw new Error('Selected template not found');
      }
      
      // Check if the template property exists
      const { data: existingProperty, error: propertyCheckError } = await supabase
        .from('properties')
        .select('id, host_id')
        .eq('id', templateId)
        .single();
        
      if (propertyCheckError && propertyCheckError.code !== 'PGRST116') {
        throw new Error(`Error checking for template property: ${propertyCheckError.message}`);
      }
      
      if (!existingProperty) {
        // Create the template property with the host's ID
        const { error: createPropertyError } = await supabase
          .from('properties')
          .insert({
            id: templateId,
            host_id: hostId,
            name: template.propertyDetails.name,
            description: template.propertyDetails.description,
            address: template.propertyDetails.address,
            base_rate: template.propertyDetails.base_rate,
            weekend_rate: template.propertyDetails.weekend_rate,
            min_stay: template.propertyDetails.min_stay,
            created_at: new Date().toISOString()
          });
          
        if (createPropertyError) {
          throw new Error(`Failed to create template property: ${createPropertyError.message}`);
        }
        
        setConnectionMessages(prev => ({ 
          ...prev, 
          [hostId]: `"${template.name}" created and connected to ${hostEmail}` 
        }));
      } else {
        // Property exists, update it to be owned by this host
        const { error: updateError } = await supabase
          .from('properties')
          .update({ 
            host_id: hostId,
            name: template.propertyDetails.name,
            description: template.propertyDetails.description,
            address: template.propertyDetails.address,
            base_rate: template.propertyDetails.base_rate,
            weekend_rate: template.propertyDetails.weekend_rate,
            min_stay: template.propertyDetails.min_stay
          })
          .eq('id', templateId);
          
        if (updateError) {
          throw new Error(`Failed to update template property: ${updateError.message}`);
        }
        
        setConnectionMessages(prev => ({ 
          ...prev, 
          [hostId]: `"${template.name}" connected to ${hostEmail}` 
        }));
      }
      
      // Refresh the hosts data
      await fetchHosts();
      
    } catch (error) {
      console.error('Error connecting website template:', error);
      setConnectionMessages(prev => ({ 
        ...prev, 
        [hostId]: error instanceof Error ? error.message : 'Unknown error connecting template' 
      }));
    } finally {
      setConnecting(prev => ({ ...prev, [hostId]: false }));
    }
  };

  async function fetchHosts() {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch hosts with their properties
      const { data, error: hostsError } = await supabase
        .from('hosts')
        .select(`
          *,
          properties:properties(id, name, base_rate, created_at)
        `)
        .order('created_at', { ascending: false });
        
      if (hostsError) throw hostsError;
      
      // Check which hosts have template properties
      const hostsWithTemplateProperties = data?.map(host => {
        const hostTemplates = websiteTemplates.filter(template => 
          host.properties.some((prop: any) => prop.id === template.id)
        );
        
        return {
          ...host,
          has_test_property: hostTemplates.length > 0
        };
      }) || [];
      
      setHosts(hostsWithTemplateProperties);
    } catch (err: any) {
      console.error('Error fetching hosts:', err);
      setError('Failed to load hosts data');
    } finally {
      setLoading(false);
    }
  }
  
  // Admin login form
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
          
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Admin Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-lg">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-gray-200 text-gray-800 py-2 px-4 rounded hover:bg-gray-300 transition"
          >
            Logout
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded mb-6">
            {error}
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Hosts Overview</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-lg font-medium text-blue-700">Total Hosts</p>
                <p className="text-3xl font-bold">{hosts.length}</p>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-lg font-medium text-green-700">Total Properties</p>
                <p className="text-3xl font-bold">
                  {hosts.reduce((total, host) => total + host.properties.length, 0)}
                </p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-lg font-medium text-purple-700">Connected to Stripe</p>
                <p className="text-3xl font-bold">
                  {hosts.filter(host => host.stripe_account_id).length}
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Host Details</h2>
          </div>
          
          {hosts.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No hosts found
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {hosts.map(host => (
                <div key={host.id} className="p-6">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{host.name}</h3>
                      <p className="text-gray-600">{host.email}</p>
                      <p className="text-sm text-gray-500">
                        Joined: {new Date(host.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="mt-2 md:mt-0 flex flex-wrap gap-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        host.stripe_account_id 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {host.stripe_account_id ? 'Stripe Connected' : 'No Stripe'}
                      </span>
                      
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        host.google_calendar_connected 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {host.google_calendar_connected ? 'Calendar Connected' : 'No Calendar'}
                      </span>
                      
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        host.has_test_property 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {host.has_test_property ? 'Has Template Site' : 'No Template Site'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Website Template Dropdown and Connect Button */}
                  <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="w-full sm:w-64">
                      <select
                        value={selectedTemplates[host.id] || ""}
                        onChange={(e) => handleTemplateSelect(host.id, e.target.value)}
                        className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 text-sm"
                        disabled={host.has_test_property}
                        aria-label="Select website template"
                      >
                        <option value="" disabled>Select a website template...</option>
                        {websiteTemplates.map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <button
                      onClick={() => connectWebsiteTemplate(host.id, host.email)}
                      disabled={connecting[host.id] || host.has_test_property || !selectedTemplates[host.id]}
                      className={`px-3 py-1.5 text-sm rounded ${
                        host.has_test_property
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : !selectedTemplates[host.id]
                            ? 'bg-gray-300 text-gray-600 cursor-not-allowed' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                      } transition disabled:opacity-50`}
                      aria-label={`Connect website template to ${host.email}`}
                    >
                      {connecting[host.id] ? 'Connecting...' : host.has_test_property ? 'Template Connected' : 'Connect Template'}
                    </button>
                    
                    {connectionMessages[host.id] && (
                      <p className="text-sm text-green-600">{connectionMessages[host.id]}</p>
                    )}
                  </div>
                  
                  {host.properties.length === 0 ? (
                    <p className="text-gray-500 mt-4">No properties</p>
                  ) : (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Properties ({host.properties.length})</h4>
                      <ul className="space-y-2">
                        {host.properties.map(property => {
                          const isTemplateProperty = websiteTemplates.some(t => t.id === property.id);
                          const templateName = isTemplateProperty 
                            ? websiteTemplates.find(t => t.id === property.id)?.name 
                            : null;
                            
                          return (
                            <li key={property.id} className="text-sm">
                              <div className="flex items-center">
                                <span className="font-medium">{property.name}</span>
                                <span className="mx-2 text-gray-400">•</span>
                                <span className="text-gray-600">€{property.base_rate}/night</span>
                                {isTemplateProperty && (
                                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                    {templateName || 'Template Site'}
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 