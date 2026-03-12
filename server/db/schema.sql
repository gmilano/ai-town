CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS agents (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  character VARCHAR(10) NOT NULL,
  identity TEXT NOT NULL,
  plan TEXT NOT NULL,
  x FLOAT DEFAULT 10,
  y FLOAT DEFAULT 10,
  facing VARCHAR(10) DEFAULT 'down',
  speed FLOAT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'idle',
  current_conversation_id INT,
  destination_x FLOAT,
  destination_y FLOAT,
  current_thought TEXT DEFAULT 'Just arrived in town...',
  last_decision_at BIGINT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  agent1_id INT REFERENCES agents(id),
  agent2_id INT REFERENCES agents(id),
  started_at BIGINT,
  ended_at BIGINT,
  status VARCHAR(20) DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT REFERENCES conversations(id),
  agent_id INT REFERENCES agents(id),
  text TEXT NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);

CREATE TABLE IF NOT EXISTS memories (
  id SERIAL PRIMARY KEY,
  agent_id INT REFERENCES agents(id),
  description TEXT NOT NULL,
  importance INT DEFAULT 5,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000,
  last_accessed BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())*1000
);
