-- Add affiliation column to institutes table
ALTER TABLE institutes 
ADD COLUMN IF NOT EXISTS affiliation TEXT;

-- Add comment to column
COMMENT ON COLUMN institutes.affiliation IS 'Institute affiliation information (e.g., CBSE Board, State Board, etc.)';
