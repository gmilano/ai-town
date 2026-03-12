import { query, queryAll } from '../db/index.js';
import { summarize } from '../ai/chat.js';

export async function getMemories(agentId, otherName = null) {
  let sql = 'SELECT * FROM memories WHERE agent_id = $1';
  const params = [agentId];
  if (otherName) {
    sql += ' AND description ILIKE $2 ORDER BY last_accessed DESC LIMIT 3';
    params.push(`%${otherName}%`);
  } else {
    sql += ' ORDER BY last_accessed DESC LIMIT 5';
  }
  return queryAll(sql, params);
}

export async function storeMemory(agentId, description, importance = 5) {
  await query(
    'INSERT INTO memories (agent_id, description, importance, created_at, last_accessed) VALUES ($1, $2, $3, $4, $4)',
    [agentId, description, importance, Date.now()]
  );
}

export async function rememberConversation(conversation, messages, agents) {
  if (messages.length < 2) return;

  const a1 = agents.find(a => a.id === conversation.agent1_id);
  const a2 = agents.find(a => a.id === conversation.agent2_id);
  if (!a1 || !a2) return;

  const transcript = messages
    .map(m => `${agents.find(a => a.id === m.agent_id)?.name || '?'}: ${m.text}`)
    .join('\n');

  const summary = await summarize(`${a1.name} and ${a2.name} talked:\n${transcript}`);
  if (!summary) return;

  const now = Date.now();
  const desc1 = `Conversation with ${a2.name}: ${summary}`;
  const desc2 = `Conversation with ${a1.name}: ${summary}`;

  await storeMemory(a1.id, desc1, 6);
  await storeMemory(a2.id, desc2, 6);
  console.log(`[memory] Stored memories for ${a1.name} and ${a2.name}`);
}
