const WORLD_SIZE = 26;
const MARGIN = 2;
const SPEED = 0.06; // tiles per tick (100ms = ~0.6 tiles/sec)

export function randomDestination() {
  return {
    x: MARGIN + Math.random() * (WORLD_SIZE - MARGIN * 2),
    y: MARGIN + Math.random() * (WORLD_SIZE - MARGIN * 2),
  };
}

export function tickMovement(agent) {
  if (agent.status !== 'walking') return false;
  if (agent.destination_x == null || agent.destination_y == null) return false;

  const dx = agent.destination_x - agent.x;
  const dy = agent.destination_y - agent.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < SPEED) {
    agent.x = agent.destination_x;
    agent.y = agent.destination_y;
    agent.destination_x = null;
    agent.destination_y = null;
    agent.status = 'idle';
    agent.speed = 0;
    return true; // arrived
  }

  // Move toward destination
  agent.x += (dx / dist) * SPEED;
  agent.y += (dy / dist) * SPEED;
  agent.speed = SPEED;

  // Update facing direction
  if (Math.abs(dx) > Math.abs(dy)) {
    agent.facing = dx > 0 ? 'right' : 'left';
  } else {
    agent.facing = dy > 0 ? 'down' : 'up';
  }

  return false;
}

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}
