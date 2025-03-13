-- Insert a test event directly with SQL
INSERT INTO calendar_events (
  property_id,
  source,
  summary,
  start_date,
  end_date,
  external_id
)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',  -- Property ID
  'other',                                  -- Source
  'Test Event from SQL',                    -- Summary
  '2025-03-20',                             -- Start date
  '2025-03-21',                             -- End date
  NULL                                      -- External ID
)
RETURNING *;  -- Return the inserted row 