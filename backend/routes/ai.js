/**
 * AI routes - AI asistent + Smart Import.
 * Používá API klíče z .env pro volání externích LLM služeb.
 */

const express = require('express');
const router = express.Router();
const storage = require('../services/gdriveStorage');
const { authenticateAny } = require('../middleware/auth');
const https = require('https');

// ─── Gemini API call ─────────────────────────────────────────

async function callGemini(prompt, systemInstruction = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    url.searchParams.set('key', apiKey);

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      console.warn('[AI] Gemini API error:', response.status, await response.text());
      return null;
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (err) {
    console.error('[AI] Gemini call failed:', err.message);
    return null;
  }
}

// ─── OpenRouter API call (fallback) ──────────────────────────

async function callOpenRouter(prompt, systemPrompt = '') {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'ToolSage'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt || 'Jsi užitečný AI asistent.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      console.warn('[AI] OpenRouter error:', response.status);
      return null;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[AI] OpenRouter call failed:', err.message);
    return null;
  }
}

// ─── AI with fallback chain ──────────────────────────────────

async function callAI(prompt, systemPrompt = '') {
  // Try Gemini first, fallback to OpenRouter
  let result = await callGemini(prompt, systemPrompt);
  if (result) return result;

  result = await callOpenRouter(prompt, systemPrompt);
  if (result) return result;

  // Try DeepSeek
  const deepSeekKey = process.env.DEEPSEEK_API_KEY;
  if (deepSeekKey) {
    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${deepSeekKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt || 'Jsi užitečný AI asistent.' },
            { role: 'user', content: prompt }
          ]
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (e) {
      console.warn('[AI] DeepSeek fallback failed:', e.message);
    }
  }

  return null; // All providers failed
}

// ─── POST /api/ai/chat ───────────────────────────────────────

router.post('/chat', authenticateAny, async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Zpráva je prázdná' });
    }

    // Build context from tool database
    const tools = await storage.getAllTools();
    const toolContext = tools.map(t =>
      `- ${t.name}: ${t.description} (${t.categories?.join(', ')}, hodnocení: ${t.average_rating}/5)`
    ).join('\n');

    const systemPrompt = `Jsi AI asistent ToolSage - inteligentní databáze nástrojů. 
Komunikuješ v češtině. Máš přístup k databázi následujících nástrojů:

${toolContext || '(databáze zatím neobsahuje žádné nástroje)'}

Tvé úkoly:
1. Doporučovat nástroje podle potřeb uživatele
2. Odpovídat na otázky o nástrojích
3. Porovnávat nástroje mezi sebou
4. Pomáhat s importem nových nástrojů

Vždy odpovídej užitečně, přesně a v češtině.`;

    const conversationContext = (conversationHistory || [])
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const prompt = `${conversationContext}\nuser: ${message}\nassistant:`;

    const reply = await callAI(prompt, systemPrompt);

    if (!reply) {
      // Fallback: rule-based response
      return res.json({
        reply: generateFallbackResponse(message, tools),
        suggestedTools: []
      });
    }

    // Extract suggested tool IDs from the response
    const suggestedTools = tools
      .filter(t => reply.toLowerCase().includes(t.name.toLowerCase()))
      .map(t => t.id);

    res.json({
      reply,
      suggestedTools
    });
  } catch (err) {
    console.error('[AI] Chat error:', err);
    res.status(500).json({ error: 'Chyba AI asistenta' });
  }
});

function generateFallbackResponse(query, tools) {
  const lower = query.toLowerCase();
  if (lower.includes('doporuč') || lower.includes('nejlepší')) {
    const top = [...tools].sort((a, b) => b.average_rating - a.average_rating).slice(0, 3);
    return `Na základě databáze doporučuji tyto nástroje:\n\n${
      top.map((t, i) => `${i+1}. **${t.name}** (${t.average_rating}/5) - ${t.description}`).join('\n')
    }\n\nChceš o některém více informací?`;
  }
  return 'Rozumím! Momentálně zpracovávám dotaz. Mohu ti pomoci s vyhledáváním, doporučením nebo porovnáním nástrojů.';
}

// ─── POST /api/tools/smart-import ────────────────────────────

router.post('/tools/smart-import', authenticateAny, async (req, res) => {
  try {
    const { content, source_type, file_name } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Obsah pro import je prázdný' });
    }

    const extractPrompt = `Extrahuj informace o nástrojích z následujícího textu do JSON formátu.
Pro každý nástroj uveď: name, description, categories (pole), tags (pole), pricing_model, links (pole s type a url).
Pokud informace chybí, ponech pole prázdné. Zahrň confidence_score (0-100) pro každé pole.
Odpověď musí být platné JSON pole objektů.

Text k analýze:
${content}`;

    const aiResponse = await callAI(extractPrompt, 'Jsi expert na extrakci dat o software nástrojích. Vracíš pouze validní JSON.');

    let suggestions = [];
    if (aiResponse) {
      try {
        // Try to extract JSON from the response
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.warn('[AI] Failed to parse Smart Import response as JSON');
      }
    }

    // If AI extraction failed, create a basic suggestion
    if (suggestions.length === 0) {
      suggestions = [{
        name: file_name?.replace(/\.\w+$/, '') || 'Rozpoznaný nástroj',
        description: content.substring(0, 500),
        categories: [],
        tags: [],
        confidence_score: 30
      }];
    }

    res.json({
      suggestions: suggestions.map(s => ({
        tool: {
          id: require('uuid').v4(),
          name: s.name || 'Neznámý nástroj',
          description: s.description || '',
          categories: s.categories || [],
          tags: s.tags || [],
          pricing_model: s.pricing_model || '',
          links: s.links || [],
          status: 'pending_review'
        },
        confidence_score: s.confidence_score || 50,
        source_context: content.substring(0, 200)
      }))
    });
  } catch (err) {
    console.error('[AI] Smart Import error:', err);
    res.status(500).json({ error: 'Chyba při inteligentním importu' });
  }
});

module.exports = router;
