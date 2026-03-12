import { query, queryAll } from '../db/index.js';
import { randomDestination, distance } from './movement.js';
import { startConversation, continueConversation, endConversation, getActiveConversations } from './conversation.js';

const DECISION_INTERVAL = 5000; // ms between AI decisions
const CONVERSATION_TURN_INTERVAL = 4000; // ms between conversation turns
const CONVERSATION_MAX_DURATION = 30000; // 30s max per conversation
const PROXIMITY_THRESHOLD = 2.5; // tiles

// In-memory state (synced with DB)
let agents = [];
let activeConversations = [];
let lastConversationTick = new Map(); // convId → lastTurnTime

export async function loadAgents() {
  agents = await queryAll('SELECT * FROM agents ORDER BY id');
  return agents;
}

export function getAgents() { return agents; }
export function getActiveConvs() { return activeConversations; }

export async function tickAgents(now) {
  // 1. AI decisions for idle agents
  for (const agent of agents) {
    if (agent.status !== 'idle') continue;
    if (now - agent.last_decision_at < DECISION_INTERVAL) continue;

    await makeDecision(agent, now);
    agent.last_decision_at = now;
  }

  // 2. Check proximity → start conversations
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i], b = agents[j];
      if (a.status !== 'idle' || b.status !== 'idle') continue;
      if (distance(a, b) < PROXIMITY_THRESHOLD && Math.random() < 0.05) {
        try {
          const conv = await startConversation(a, b);
          a.status = 'talking'; a.current_conversation_id = conv.id;
          b.status = 'talking'; b.current_conversation_id = conv.id;
          lastConversationTick.set(conv.id, now);
          activeConversations = await getActiveConversations(agents);
        } catch (e) {
          console.error('[agents] startConversation error:', e.message);
        }
      }
    }
  }

  // 3. Continue/end active conversations
  for (const conv of activeConversations) {
    const lastTick = lastConversationTick.get(conv.id) || 0;
    const convStart = agents.find(a => a.current_conversation_id === conv.id)?.last_decision_at || now;

    if (now - convStart > CONVERSATION_MAX_DURATION) {
      // Time out the conversation
      const dbConv = { id: conv.id, agent1_id: agents.find(a => a.name === conv.agent1)?.id, agent2_id: agents.find(a => a.name === conv.agent2)?.id };
      await endConversation(dbConv, agents);
      agents = await loadAgents();
      activeConversations = await getActiveConversations(agents);
      lastConversationTick.delete(conv.id);
      continue;
    }

    if (now - lastTick > CONVERSATION_TURN_INTERVAL) {
      try {
        const dbConv = { id: conv.id, agent1_id: agents.find(a => a.name === conv.agent1)?.id, agent2_id: agents.find(a => a.name === conv.agent2)?.id };
        await continueConversation(dbConv, agents);
        lastConversationTick.set(conv.id, now);
        activeConversations = await getActiveConversations(agents);
      } catch (e) {
        console.error('[agents] continueConversation error:', e.message);
      }
    }
  }
}

async function makeDecision(agent, now) {
  const roll = Math.random();

  if (roll < 0.6) {
    // Walk somewhere
    const dest = randomDestination();
    agent.status = 'walking';
    agent.destination_x = dest.x;
    agent.destination_y = dest.y;
    agent.current_thought = 'Going for a walk...';

    await query(
      'UPDATE agents SET status=$1, destination_x=$2, destination_y=$3, current_thought=$4, last_decision_at=$5 WHERE id=$6',
      ['walking', dest.x, dest.y, agent.current_thought, now, agent.id]
    );
  } else if (roll < 0.8) {
    // Stay idle, think
    const thoughts = [
      'Just thinking...', 'Watching the clouds...', 'Resting a bit.',
      'Looking around...', 'Daydreaming.', 'Taking it easy.',
    ];
    agent.current_thought = thoughts[Math.floor(Math.random() * thoughts.length)];
    await query('UPDATE agents SET current_thought=$1, last_decision_at=$2 WHERE id=$3', [agent.current_thought, now, agent.id]);
  }
  // else: do nothing
}

export async function refreshFromDB() {
  agents = await loadAgents();
  activeConversations = await getActiveConversations(agents);
}
