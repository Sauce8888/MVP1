-- First, let's fetch a valid property ID from your database
-- (We'll select from the properties table and use the first property ID we find)
DO $$
DECLARE
    valid_property_id UUID;
BEGIN
    -- Get a valid property ID from the database
    SELECT id INTO valid_property_id
    FROM properties
    WHERE host_id = auth.uid()
    LIMIT 1;
    
    IF valid_property_id IS NULL THEN
        RAISE EXCEPTION 'No valid property found for the current user';
    END IF;
    
    -- Output the property ID we're using
    RAISE NOTICE 'Using property ID: %', valid_property_id;
    
    -- Insert a test event with the valid property ID
    INSERT INTO calendar_events (
        property_id,
        source,
        summary,
        start_date,
        end_date,
        external_id
    )
    VALUES (
        valid_property_id,                         -- Property ID (valid one from our query)
        'other',                                  -- Source
        'Test Event from SQL',                    -- Summary
        CURRENT_DATE,                             -- Start date (today)
        CURRENT_DATE + INTERVAL '3 days',         -- End date (3 days from today)
        NULL                                      -- External ID
    );
    
    -- Confirm the insertion
    RAISE NOTICE 'Test event inserted successfully';
END $$;

-- Now select the events for the current user to verify
SELECT calendar_events.* 
FROM calendar_events
JOIN properties ON calendar_events.property_id = properties.id
WHERE properties.host_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10; 