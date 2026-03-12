import { query, queryOne, queryAll } from '../db/index.js';
import { chat } from '../ai/chat.js';
import { getMemories, rememberConversation } from './memory.js';

const MAX_TURNS = 5; // exchanges per conversation

export async function startConversation(agent1, agent2) {
  const now = Date.now();

  // Create conversation record
  const conv = await queryOne(
    'INSERT INTO conversations (agent1_id, agent2_id, started_at, status) VALUES ($1, $2, $3, $4) RETURNING *',
    [agent1.id, agent2.id, now, 'active']
  );

  // Update agent statuses
  await query('UPDATE agents SET status=$1, current_conversation_id=$2 WHERE id=$3', ['talking', conv.id, agent1.id]);
  await query('UPDATE agents SET status=$1, current_conversation_id=$2 WHERE id=$3', ['talking', conv.id, agent2.id]);

  // Generate opening line
  const memories = await getMemories(agent1.id, agent2.name);
  const memText = memories.length
    ? '\nYour memories about ' + agent2.name + ':\n' + memories.map(m => '- ' + m.description).join('\n')
    : '';

  const opening = await chat([{
    role: 'system',
    content: `You are ${agent1.name}. ${agent1.identity}\nYour goal: ${agent1.plan}${memText}\nYou just ran into ${agent2.name} (${agent2.identity.split('.')[0]}). Say one short opening line (max 15 words). Just the dialogue, no quotes, no name prefix.`
  }]);

  if (opening) {
    await addMessage(conv.id, agent1.id, opening);
  }

  console.log(`[conv] Started: ${agent1.name} ↔ ${agent2.name} (conv #${conv.id})`);
  return conv;
}

export async function continueConversation(conv, agents) {
  const msgs = await queryAll(
    'SELECT m.*, a.name as agent_name FROM messages m JOIN agents a ON m.agent_id=a.id WHERE m.conversation_id=$1 ORDER BY m.id',
    [conv.id]
  );

  if (msgs.length >= MAX_TURNS * 2) {
    await endConversation(conv, agents, msgs);
    return;
  }

  // Determine who speaks next
  const lastMsg = msgs[msgs.length - 1];
  const speakerId = lastMsg?.agent_id === conv.agent1_id ? conv.agent2_id : conv.agent1_id;
  const listenerId = speakerId === conv.agent1_id ? conv.agent2_id : conv.agent1_id;

  const speaker = agents.find(a => a.id === speakerId);
  const listener = agents.find(a => a.id === listenerId);
  if (!speaker || !listener) return;

  const history = msgs.map(m => ({ role: m.agent_id === speakerId ? 'assistant' : 'user', content: m.text }));

  const reply = await chat([
    {
      role: 'system',
      content: `You are ${speaker.name}. ${speaker.identity}\nYour goal: ${speaker.plan}\nYou are talking to ${listener.name}. Reply with ONE short sentence (max 15 words). Just dialogue, no quotes, no name prefix.`
    },
    ...history
  ]);

  if (reply) {
    await addMessage(conv.id, speakerId, reply);
  }
}

export async function endConversation(conv, agents, msgs = null) {
  if (!msgs) {
    msgs = await queryAll(
      'SELECT * FROM messages WHERE conversation_id=$1 ORDER BY id',
      [conv.id]
    );
  }

  await query('UPDATE conversations SET status=$1, ended_at=$2 WHERE id=$3', ['ended', Date.now(), conv.id]);
  await query('UPDATE agents SET status=$1, current_conversation_id=NULL WHERE current_conversation_id=$2', ['idle', conv.id]);

  // Store memories
  await rememberConversation(conv, msgs, agents);
  console.log(`[conv] Ended conv #${conv.id}`);
}

async function addMessage(convId, agentId, text) {
  return queryOne(
    'INSERT INTO messages (conversation_id, agent_id, text, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
    [convId, agentId, text, Date.now()]
  );
}

export async function getActiveConversations(agents) {
  const convs = await queryAll("SELECT * FROM conversations WHERE status='active'");
  const result = [];
  for (const conv of convs) {
    const msgs = await queryAll(
      'SELECT m.text, a.name FROM messages m JOIN agents a ON m.agent_id=a.id WHERE m.conversation_id=$1 ORDER BY m.id DESC LIMIT 3',
      [conv.id]
    );
    const a1 = agents.find(a => a.id === conv.agent1_id);
    const a2 = agents.find(a => a.id === conv.agent2_id);
    result.push({ id: conv.id, agent1: a1?.name, agent2: a2?.name, messages: msgs.reverse() });
  }
  return result;
}
