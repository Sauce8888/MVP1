-- Check if table exists first, then create only if it doesn't
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'calendar_events'
    ) THEN
        -- Create the calendar_events table
        CREATE TABLE public.calendar_events (
            id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
            property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
            source TEXT NOT NULL CHECK (source IN ('airbnb', 'other')),
            external_id TEXT,
            summary TEXT,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL CHECK (end_date >= start_date),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
        );

        -- Create index for faster lookups
        CREATE INDEX calendar_events_property_id_idx ON public.calendar_events(property_id);

        -- Add RLS (Row Level Security) policies
        ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

        -- Only allow hosts to see their own calendar events (read policy)
        CREATE POLICY "Hosts can view their own calendar events" ON public.calendar_events
            FOR SELECT USING (
                property_id IN (
                    SELECT id FROM public.properties
                    WHERE host_id = auth.uid()
                )
            );

        -- Only allow hosts to create events for their own properties (insert policy)
        CREATE POLICY "Hosts can insert calendar events for their properties" ON public.calendar_events
            FOR INSERT WITH CHECK (
                property_id IN (
                    SELECT id FROM public.properties
                    WHERE host_id = auth.uid()
                )
            );

        -- Only allow hosts to update events for their own properties (update policy)
        CREATE POLICY "Hosts can update their own calendar events" ON public.calendar_events
            FOR UPDATE USING (
                property_id IN (
                    SELECT id FROM public.properties
                    WHERE host_id = auth.uid()
                )
            );

        -- Only allow hosts to delete events for their own properties (delete policy)
        CREATE POLICY "Hosts can delete their own calendar events" ON public.calendar_events
            FOR DELETE USING (
                property_id IN (
                    SELECT id FROM public.properties
                    WHERE host_id = auth.uid()
                )
            );

        -- Create a trigger to update the 'updated_at' timestamp when a record is updated
        CREATE OR REPLACE FUNCTION update_calendar_events_updated_at()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        CREATE TRIGGER update_calendar_events_updated_at
        BEFORE UPDATE ON public.calendar_events
        FOR EACH ROW
        EXECUTE FUNCTION update_calendar_events_updated_at();
        
        RAISE NOTICE 'Calendar_events table created successfully';
    ELSE
        RAISE NOTICE 'Calendar_events table already exists, no changes made';
    END IF;
END
$$; 