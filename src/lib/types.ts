export type Host = {
  id: string;
  email: string;
  name: string;
  created_at: string;
  stripe_account_id?: string;
  stripe_publishable_key?: string;
  google_calendar_connected: boolean;
};

export type Property = {
  id: string;
  host_id: string;
  name: string;
  description?: string;
  address?: string;
  base_rate: number;
  weekend_rate?: number;
  min_stay: number;
  created_at: string;
};

export type CustomPricing = {
  id: string;
  property_id: string;
  date: string;
  price: number;
};

export type Booking = {
  id: string;
  property_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  check_in: string;
  check_out: string;
  guests_count: number;
  special_requests?: string;
  status: 'confirmed' | 'cancelled';
  payment_id?: string;
  created_at: string;
};

export type UnavailableDate = {
  id: string;
  property_id: string;
  date: string;
  reason?: string;
  booking_id?: string;
  event_id?: string;
};

export type CalendarConnection = {
  id: string;
  property_id: string;
  source: 'airbnb' | 'other';
  ical_url: string;
  last_synced: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  property_id: string;
  source: 'airbnb' | 'other';
  external_id: string | null;
  summary: string | null;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}; 