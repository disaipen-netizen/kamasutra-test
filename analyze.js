// /api/analyze.js — Vercel Serverless Function
// Этот файл проксирует запросы от твоего сайта к Claude API,
// скрывая API-ключ от пользователей

export default async function handler(req, res) {
  // CORS — разрешаем запросы с любого сайта (можно сузить до твоего домена)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { name, archetype, totalScore, scores, goals, answers } = req.body;

    // Формируем подробный промпт для Claude
    const userPrompt = `Ты — Эльвира, эксперт по женской энергии и сексуальности, автор методики Камасутра-Фитнес. Ты пишешь персональную расшифровку для женщины, прошедшей твой тест.

Имя: ${name}
Архетип: ${archetype}
Общий уровень женственности: ${totalScore}%

Детальные метрики:
- Внешняя женственность: ${scores.looks}%
- Чувственность и тело: ${scores.body}%
- Сексуальная энергия: ${scores.sexual}%
- Внутренняя гармония: ${scores.inner}%

Что она хочет в себе изменить: ${(goals || []).join(', ') || 'не указано'}

Её ответы на ключевые интимные вопросы:
${(answers || []).slice(7, 10).map(a => `- "${a.question}" — ${['Никогда', 'Иногда', 'Часто', 'Всегда'][a.value - 1]}`).join('\n')}

Напиши тёплый, поддерживающий, личный текст-расшифровку для ${name}.

Структура — РОВНО 3 абзаца:
1. Первый абзац (3-4 предложения): что у неё уже есть сильного, что в ней раскрыто. Конкретно, опираясь на её самые высокие метрики и ответы.
2. Второй абзац (3-4 предложения): где её зона роста, мягко, без осуждения. Опираясь на самые низкие метрики и интимные ответы.
3. Третий абзац (3-4 предложения): что конкретно ей даст пробный урок Камасутра-Фитнес именно с её запросом — как изменится её ощущение себя через 4-6 недель регулярных занятий.

Тон: по-сестрински, на "ты", тепло, без клише, без воды. Никаких списков, только связный текст. Не упоминай конкретные проценты — пиши на уровне ощущений. Имя ${name} используй 1 раз в первом абзаце.

ВАЖНО: верни ответ в формате JSON-массива ровно из 3-х строк, каждая строка — один абзац:
["абзац 1", "абзац 2", "абзац 3"]

Никакого другого текста, только этот JSON-массив.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return res.status(response.status).json({ error: 'API error', details: error });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Try to parse as JSON array
    let analysis;
    try {
      // Strip potential markdown code blocks
      const cleaned = text.replace(/```json\s*|\s*```/g, '').trim();
      analysis = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude response:', text);
      return res.status(500).json({ error: 'Invalid response format', raw: text });
    }

    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ error: 'Server error', message: error.message });
  }
}
