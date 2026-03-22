-- OB1 Schema Setup for Brain Server Integration
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/jmdccivoxtiumrpsujwg/sql/new

-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create thoughts table for user memories/context
CREATE TABLE IF NOT EXISTS thoughts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenRouter ada-002 dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS thoughts_embedding_idx ON thoughts USING ivfflat (embedding vector_cosine_ops);

-- Create match_thoughts function for semantic search
CREATE OR REPLACE FUNCTION match_thoughts(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'
)
RETURNS TABLE(
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.content,
    t.metadata,
    1 - (t.embedding <=> query_embedding) AS similarity
  FROM thoughts t
  WHERE 1 - (t.embedding <=> query_embedding) > match_threshold
  ORDER BY t.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable Row Level Security (allow all for now - restrict as needed)
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- Policy: allow public read/write (for brain integration)
DROP POLICY IF EXISTS "Allow all for thoughts" ON thoughts;
CREATE POLICY "Allow all for thoughts" ON thoughts
  FOR ALL USING (true) WITH CHECK (true);

-- Insert a test thought
INSERT INTO thoughts (content, embedding) VALUES 
  ('I am working on integrating OB1 brain with the brain server', 
   array_fill(0.0, ARRAY[1536])::vector);
