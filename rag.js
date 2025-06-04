const fs = require('fs');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function loadPDF(path) {
  const dataBuffer = fs.readFileSync(path);
  const data = await pdfParse(dataBuffer);
  return data.text;
}

function splitText(text, chunkSize = 1000, overlap = 200) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

async function embedTexts(texts) {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: texts
  });
  return resp.data.map(r => r.embedding);
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function createStore(pdfPath) {
  const text = await loadPDF(pdfPath);
  const chunks = splitText(text);
  const embeddings = await embedTexts(chunks);
  return chunks.map((c, i) => ({ text: c, embedding: embeddings[i] }));
}

async function answerQuestion(store, question, k = 3) {
  const [qEmbedding] = await embedTexts([question]);
  const top = store
    .map(item => ({ text: item.text, score: cosine(item.embedding, qEmbedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  const context = top.map(t => t.text).join('\n---\n');

  const chat = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Answer questions using the provided context.' },
      { role: 'user', content: `Context:\n${context}\nQuestion: ${question}` }
    ]
  });
  return chat.choices[0].message.content.trim();
}

(async () => {
  if (!process.argv[2]) {
    console.error('Usage: node rag.js <path-to-pdf>');
    process.exit(1);
  }
  const store = await createStore(process.argv[2]);
  console.log('Type your question (or "exit" to quit)');
  const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  const ask = () => {
    rl.question('> ', async q => {
      if (q.toLowerCase() === 'exit') return rl.close();
      try {
        const answer = await answerQuestion(store, q);
        console.log(answer);
      } catch (e) {
        console.error('Error:', e.message);
      }
      ask();
    });
  };
  ask();
})();
