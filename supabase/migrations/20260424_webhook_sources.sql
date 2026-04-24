CREATE TABLE webhook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  field_mappings JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE webhook_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artists manage own webhook sources"
  ON webhook_sources
  USING (artist_id = auth.uid())
  WITH CHECK (artist_id = auth.uid());
