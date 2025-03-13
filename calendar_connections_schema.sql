-- Create the calendar_connections table
CREATE TABLE public.calendar_connections (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('airbnb', 'other')),
    ical_url TEXT NOT NULL,
    last_synced TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(property_id, source)
);

-- Create index for faster lookups
CREATE INDEX calendar_connections_property_id_idx ON public.calendar_connections(property_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

-- Only allow hosts to see their own calendar connections (read policy)
CREATE POLICY "Hosts can view their own calendar connections" ON public.calendar_connections
    FOR SELECT USING (
        property_id IN (
            SELECT id FROM public.properties
            WHERE host_id = auth.uid()
        )
    );

-- Only allow hosts to create connections for their own properties (insert policy)
CREATE POLICY "Hosts can insert calendar connections for their properties" ON public.calendar_connections
    FOR INSERT WITH CHECK (
        property_id IN (
            SELECT id FROM public.properties
            WHERE host_id = auth.uid()
        )
    );

-- Only allow hosts to update connections for their own properties (update policy)
CREATE POLICY "Hosts can update their own calendar connections" ON public.calendar_connections
    FOR UPDATE USING (
        property_id IN (
            SELECT id FROM public.properties
            WHERE host_id = auth.uid()
        )
    );

-- Only allow hosts to delete connections for their own properties (delete policy)
CREATE POLICY "Hosts can delete their own calendar connections" ON public.calendar_connections
    FOR DELETE USING (
        property_id IN (
            SELECT id FROM public.properties
            WHERE host_id = auth.uid()
        )
    );

-- Create a trigger to update the 'updated_at' timestamp when a record is updated
CREATE OR REPLACE FUNCTION update_calendar_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_calendar_connections_updated_at
BEFORE UPDATE ON public.calendar_connections
FOR EACH ROW
EXECUTE FUNCTION update_calendar_connections_updated_at(); 