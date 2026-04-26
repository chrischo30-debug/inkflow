-- Update size and placement fields that haven't been customized (still text with no options)
-- to use select with sensible defaults. Leaves artists who already changed these alone.

UPDATE form_fields
SET input_type = 'select',
    options = '["Tiny (under 2\")", "Small (2–4\")", "Medium (4–6\")", "Large (6–10\")", "Extra large (10\"+)"]'::jsonb
WHERE field_key = 'size'
  AND input_type = 'text'
  AND (options IS NULL OR options = '[]'::jsonb);

UPDATE form_fields
SET input_type = 'select',
    options = '["Arm", "Forearm", "Wrist", "Hand", "Shoulder", "Chest", "Back", "Ribs", "Hip", "Thigh", "Leg", "Calf", "Ankle", "Foot", "Neck", "Other"]'::jsonb
WHERE field_key = 'placement'
  AND input_type = 'text'
  AND (options IS NULL OR options = '[]'::jsonb);
