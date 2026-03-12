import OpenAI from 'openai';

let openai;

function getClient() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

export async function chat(messages, { maxTokens = 150 } = {}) {
  const client = getClient();
  if (!client) return null;

  try {
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
      temperature: 0.9,
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error('[ai] chat error:', err.message);
    return null;
  }
}

export async function summarize(text) {
  return chat([
    { role: 'system', content: 'Summarize this conversation in 1-2 sentences from the perspective of the first participant. Use first person.' },
    { role: 'user', content: text },
  ], { maxTokens: 100 });
}
