-- Simulation Events Table
CREATE TABLE IF NOT EXISTS simulation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_id UUID NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'rain', 'traffic', 'protest'
  trigger_location JSONB NOT NULL, -- {lat, lng}
  trigger_progress FLOAT NOT NULL, -- 0.0 to 1.0
  impact_metrics JSONB NOT NULL, -- { time_added, distance_added }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulation_events_sim_id ON simulation_events(simulation_id);
