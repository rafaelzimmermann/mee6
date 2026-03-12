-- Add calendars table for storing named Google Calendar targets.
-- Safe to run repeatedly: uses IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS calendars (
    id               VARCHAR PRIMARY KEY,
    label            VARCHAR NOT NULL,
    calendar_id      VARCHAR NOT NULL,
    credentials_file VARCHAR NOT NULL DEFAULT '/app/data/credentials.json'
);
