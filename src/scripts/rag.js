const fs = require('fs')
const pdfParse = require('pdf-parse')
const { OpenAI } = require('openai')
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') })
const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json())

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
console.log('OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Loaded' : 'Not set')

async function loadPDF(path) {
  const dataBuffer = fs.readFileSync(path)
  const data = await pdfParse(dataBuffer)
  return data.text
}

function splitText(text, chunkSize = 1000, overlap = 200) {
  const words = text.split(/\s+/)
  const chunks = []
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '))
  }
  return chunks
}

async function embedTexts(texts) {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: texts,
  })
  return resp.data.map(r => r.embedding)
}

function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function createStore(pdfPath) {
  const text = await loadPDF(pdfPath)
  const chunks = splitText(text)
  const embeddings = await embedTexts(chunks)
  return chunks.map((c, i) => ({ text: c, embedding: embeddings[i] }))
}

async function answerQuestion(store, question, k = 3) {
  const [qEmbedding] = await embedTexts([question])
  const top = store
    .map(item => ({ text: item.text, score: cosine(item.embedding, qEmbedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
  const context = top.map(t => t.text).join('\n---\n')

  const chat = await openai.chat.completions.create({
    model: 'o4-mini-2025-04-16',
    messages: [
      { role: 'system', content: 'Answer questions using the provided context.' },
      { role: 'user', content: `Context:\n${context}\nQuestion: ${question}` },
    ],
  })
  return chat.choices[0].message.content.trim()
}

let store = null;

// Load the PDF and create the store once at startup
(async () => {
  try {
    store = await createStore('sample.pdf')
    console.log('Store loaded')
  } catch (e) {
    console.error('Error during store creation:', e)
    process.exit(1)
  }
})()

app.post('/ask', async (req, res) => {
  const { question } = req.body
  if (!store) return res.status(503).json({ error: 'Store not ready' })
  try {
    const answer = await answerQuestion(store, question)
    res.json({ answer })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = 3001
app.listen(PORT, () => console.log(`RAG server running on port ${PORT}`))
