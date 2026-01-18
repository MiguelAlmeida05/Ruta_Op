
-- 1. Tabla de Pedidos (Orders)
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id), -- Puede ser NULL si es usuario anónimo temporalmente
  seller_id VARCHAR(50) REFERENCES sellers(id),
  product_id VARCHAR(50) REFERENCES products(id),
  
  -- Detalles del pedido
  weight_kg FLOAT NOT NULL, -- Kilos seleccionados
  price_per_kg FLOAT NOT NULL, -- Precio unitario snapshot
  
  -- Costos Base
  product_cost FLOAT NOT NULL, -- weight * price_per_kg
  
  -- Logística
  distance_km FLOAT NOT NULL,
  estimated_duration_min FLOAT NOT NULL,
  transport_cost FLOAT NOT NULL, -- Calculado en backend
  
  -- Totales
  total_cost FLOAT NOT NULL, -- product_cost + transport_cost
  
  -- Estado
  status VARCHAR(20) DEFAULT 'simulated', -- simulated, confirmed, delivering, delivered, cancelled
  
  -- KPIs Finales (se actualizan al completar)
  actual_duration_min FLOAT,
  delivery_score FLOAT, -- 1-5 Satisfacción
  punctuality_score FLOAT, -- %
  freshness_score FLOAT, -- %
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices para reportes
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
