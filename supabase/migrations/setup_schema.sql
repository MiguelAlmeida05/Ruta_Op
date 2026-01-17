-- Enable Row Level Security
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS saved_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pois ENABLE ROW LEVEL SECURITY;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Saved Routes Table
CREATE TABLE IF NOT EXISTS saved_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  route_name VARCHAR(100) NOT NULL,
  origin_coords JSONB NOT NULL,
  destination_coords JSONB NOT NULL,
  route_coordinates JSONB NOT NULL,
  total_distance FLOAT NOT NULL,
  total_duration INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_routes_user_id ON saved_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_routes_created_at ON saved_routes(created_at DESC);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  image_url TEXT,
  price_per_unit FLOAT NOT NULL,
  unit VARCHAR(20) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sellers Table
CREATE TABLE IF NOT EXISTS sellers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  coordinates JSONB NOT NULL,
  products TEXT[] NOT NULL,
  demand_factor FLOAT DEFAULT 1.0,
  rating FLOAT DEFAULT 0.0,
  trips_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist if table was already created
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sellers' AND column_name='rating') THEN
    ALTER TABLE sellers ADD COLUMN rating FLOAT DEFAULT 0.0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sellers' AND column_name='trips_count') THEN
    ALTER TABLE sellers ADD COLUMN trips_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Points of Interest Table
CREATE TABLE IF NOT EXISTS pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  category VARCHAR(50) NOT NULL,
  coordinates JSONB NOT NULL,
  description TEXT,
  address VARCHAR(300),
  opening_hours JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);
CREATE INDEX IF NOT EXISTS idx_pois_coordinates ON pois USING GIN (coordinates);

-- Limpiar tabla antes de insertar para evitar duplicados por nombre
DELETE FROM pois;

-- Insert sample POIs for Portoviejo 
INSERT INTO pois (name, category, coordinates, description, address) VALUES 
('Parque Central Eloy Alfaro', 'attraction', '{"lat": -1.0577502, "lng": -80.4536057}', 'Plaza principal de Portoviejo', 'Centro de Portoviejo'), 
('Universidad Técnica de Manabí', 'education', '{"lat": -1.04417, "lng": -80.45583}', 'Universidad pública principal', 'Av. José María Urbina y Che Guevara'), 
('Terminal Terrestre Portoviejo', 'transport', '{"lat": -1.0618968, "lng": -80.46134}', 'Principal terminal de buses', 'Av. del Ejército'), 
('Hospital Verdi Cevallos', 'health', '{"lat": -1.0592565, "lng": -80.4471837}', 'Hospital regional principal', 'Calle Olmedo'), 
('Parque La Rotonda', 'attraction', '{"lat": -1.04500, "lng": -80.46000}', 'Parque recreativo y deportivo', 'Av. Antonio Menéndez'), 
('Estadio Reales Tamarindos', 'attraction', '{"lat": -1.04849, "lng": -80.45395}', 'Estadio de fútbol principal', 'Av. Universitaria y César Chávez Cañarte'), 
('Jardín Botánico', 'attraction', '{"lat": -1.0378694, "lng": -80.4630835}', 'Reserva natural urbana', 'Av. Universitaria') 
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  coordinates = EXCLUDED.coordinates,
  description = EXCLUDED.description,
  address = EXCLUDED.address;


-- Seed Products
INSERT INTO products (id, name, icon, image_url, price_per_unit, unit) VALUES
('maiz', 'Maíz', 'corn', 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=200&auto=format&fit=crop', 15.50, 'qq'),
('cacao', 'Cacao', 'bean', 'https://images.unsplash.com/photo-1589354656249-14732d847877?q=80&w=200&auto=format&fit=crop', 120.00, 'qq'),
('cebolla', 'Cebolla', 'onion', 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?q=80&w=200&auto=format&fit=crop', 25.00, 'saco'),
('arroz', 'Arroz', 'rice', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=200&auto=format&fit=crop', 38.00, 'saco'),
('platano', 'Plátano', 'banana', 'https://images.unsplash.com/photo-1528825871115-3581a5387919?q=80&w=200&auto=format&fit=crop', 8.50, 'racimo'),
('pitahaya', 'Pitahaya', 'dragonfruit', 'https://images.unsplash.com/photo-1527324688151-0e627063f2b1?q=80&w=200&auto=format&fit=crop', 4.50, 'kg')
ON CONFLICT (id) DO NOTHING;

-- Seed Sellers
INSERT INTO sellers (id, name, type, coordinates, products, demand_factor, rating, trips_count) VALUES
('mercado_1', 'Mercado Central', 'Mercado', '{"lat": -1.0547, "lng": -80.4525}', ARRAY['maiz', 'cebolla', 'arroz', 'platano', 'pitahaya'], 1.2, 4.8, 156),
('mayorista_1', 'Comercial El Granjero', 'Mayorista', '{"lat": -1.0505, "lng": -80.4612}', ARRAY['maiz', 'cacao', 'arroz'], 1.5, 4.5, 89),
('minorista_1', 'Tienda Doña María', 'Minorista', '{"lat": -1.0612, "lng": -80.4425}', ARRAY['cebolla', 'platano', 'pitahaya'], 0.8, 4.9, 210),
('mercado_2', 'Mercado No. 2', 'Mercado', '{"lat": -1.0455, "lng": -80.4558}', ARRAY['cacao', 'cebolla', 'arroz', 'pitahaya'], 1.1, 4.2, 45),
('vendedor_centro', 'Distribuidora Centro', 'Mayorista', '{"lat": -1.0515, "lng": -80.4505}', ARRAY['maiz', 'cacao', 'cebolla', 'arroz', 'platano'], 1.3, 0.0, 0),
('vendedor_norte', 'Agro Norte', 'Minorista', '{"lat": -1.0312, "lng": -80.4415}', ARRAY['maiz', 'arroz', 'pitahaya'], 0.9, 4.7, 12),
('vendedor_sur', 'Mercado del Sur', 'Mercado', '{"lat": -1.0715, "lng": -80.4462}', ARRAY['cebolla', 'platano', 'cacao'], 1.0, 4.6, 78)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  coordinates = EXCLUDED.coordinates,
  products = EXCLUDED.products,
  demand_factor = EXCLUDED.demand_factor,
  rating = EXCLUDED.rating,
  trips_count = EXCLUDED.trips_count;
