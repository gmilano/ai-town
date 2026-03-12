import { query } from '../db/index.js';
import { tickMovement } from './movement.js';
import { getAgents, getActiveConvs, tickAgents, refreshFromDB } from './agents.js';

const TICK_MS = 100;
let io = null;
let tickCount = 0;

export function setIO(socketIO) {
  io = socketIO;
}

export function getWorldState() {
  return {
    agents: getAgents().map(a => ({
      id: a.id, name: a.name, character: a.character,
      x: a.x, y: a.y, facing: a.facing, speed: a.speed,
      status: a.status, thought: a.current_thought,
      conversationId: a.current_conversation_id,
    })),
    conversations: getActiveConvs(),
  };
}

export async function startGameLoop() {
  await refreshFromDB();
  console.log('[world] Game loop started');

  setInterval(async () => {
    tickCount++;
    const now = Date.now();
    const agents = getAgents();

    // Move walking agents
    for (const agent of agents) {
      if (agent.status !== 'walking') continue;
      const arrived = tickMovement(agent);
      if (arrived) {
        await query('UPDATE agents SET x=$1, y=$2, status=$3, destination_x=NULL, destination_y=NULL WHERE id=$4',
          [agent.x, agent.y, 'idle', agent.id]);
      } else {
        // Batch DB updates every 10 ticks to reduce load
        if (tickCount % 10 === 0) {
          await query('UPDATE agents SET x=$1, y=$2, facing=$3 WHERE id=$4',
            [agent.x, agent.y, agent.facing, agent.id]);
        }
      }
    }

    // AI decisions (async, don't block the tick)
    if (tickCount % 5 === 0) {
      tickAgents(now).catch(e => console.error('[world] tickAgents error:', e.message));
    }

    // Broadcast world state every tick
    if (io) {
      io.emit('worldState', getWorldState());
    }
  }, TICK_MS);
}
