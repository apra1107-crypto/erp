-- Add mobile number and access code columns to students table
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS mobile VARCHAR(15),
ADD COLUMN IF NOT EXISTS access_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS code_used BOOLEAN DEFAULT FALSE;

-- Add mobile number and access code columns to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS mobile VARCHAR(15),
ADD COLUMN IF NOT EXISTS access_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS code_used BOOLEAN DEFAULT FALSE;

-- Create index on mobile for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_mobile ON students(mobile);
CREATE INDEX IF NOT EXISTS idx_teachers_mobile ON teachers(mobile);
