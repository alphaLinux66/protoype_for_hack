require('dotenv').config();
console.log("OpenAI Key:", process.env.OPENAI_API_KEY);
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// OpenAI connection
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware for multi-tenancy (using tenant_id from header)
app.use((req, res, next) => {
  const tenantId = req.headers['x-tenant-id'];
  if (!tenantId) return res.status(400).send('Missing tenant ID');
  req.tenantId = tenantId;
  next();
});

// GET employees
app.get('/employees', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM employees WHERE tenant_id = $1', [req.tenantId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).send('Database error');
  }
});

// POST ask (chat with OpenAI)
app.post('/ask', async (req, res) => {
  const { message } = req.body;
  try {
    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `You are an employee support assistant for tenant ${req.tenantId}. Help users with HR, IT and Admin queries.` },
        { role: 'user', content: message }
      ],
      temperature: 0.5,
      max_tokens: 300
    });

    res.json({ reply: aiResponse.choices[0].message.content.trim() });
  } catch (err) {
    res.status(500).send('OpenAI error');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
