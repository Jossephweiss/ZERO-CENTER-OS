// הסוכן — שלב ראשון (טקסט), Cloudflare Workers AI.
// דורש binding בשם AI בהגדרות פרויקט ה-Pages (Settings → Bindings → Workers AI).
// שום תשובה לא נשמרת כאן. הבקשה עוברת למודל ומוחזרת.

const MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';

const RULERS = {
  7: 'חוסן במשבר', 8: 'הבחנה', 9: 'מבט רחב', 10: 'התעוררות', 11: 'יישום', 12: 'שלמות',
};

const SYSTEM = `אתה סוכן תרגול אישי בעברית, בכלי "אלומת קשב": מראה לקשב — לראות לאן הוא נודד, ולכוון אותו מחדש.
הכלי משקף ולא מאבחן. הוא עוסק בניהול קשב, לא בטיפול.

המשתמש ריבון וקובע את הקצב. אתה משקף, לא מאבחן ולא קובע.
כללים:
- כתוב בעברית פשוטה, קצרה וחמה. עד 5 משפטים.
- כל התשובה בצורת פנייה אחת בלבד, מההתחלה ועד הסוף. אל תערבב יחיד ורבים, ואל תערבב זכר ונקבה.
- המגדר של המשתמש לא ידוע, לכן כתוב בשמות פועל ובמשפטים סתמיים: "אפשר לעצור רגע", "כדאי לשים לב", "מה נשאר יציב?". הימנע מ"אתה", "את", "שלך", "לך".
- התובנה שהמשתמש קיבל כתובה ברבים ("בחרו", "שימו לב"). אל תעתיק אותה. המר אותה לשם פועל ("לבחור", "לשים לב").
- משפטים קצרים ופשוטים. אם ניסוח נשמע לך מסורבל, כתוב משפט פשוט יותר.
- שקף, אל תאבחן: "סימנת 2 בחוסן", לא "החוסן שלך נמוך". אל תמציא מספרים.
- חבר את התובנה שהמשתמש קיבל למה שהוא כתב במילים שלו. אל תוסיף הוראות חדשות.
- אל תקריא את התובנה מילה במילה.
- סיים בשאלה אחת קצרה על הצעד הבא: עוד תרגול, לקבוע מועד, או משהו שהוא מציע.
- אל תטיף, אל תבטיח, אל תדבר על עצמך.
בטיחות:
- אם יש בדברי המשתמש סימן למצוקה חריפה, סכנה לעצמו או לאחרים, או ייאוש עמוק: פתח את תשובתך בדיוק במילה [מצוקה], ואז כתוב בחום שלא צריך להחזיק את זה לבד, שאפשר לפנות עכשיו לער"ן בטלפון 1201 בכל שעה, ואל תציע תרגול.`;

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin');
  if (!origin || new URL(origin).host !== new URL(request.url).host) {
    return json({ error: 'forbidden' }, 403);
  }
  if (!env.AI) return json({ error: 'no-ai-binding' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad-request' }, 400); }

  const clip = (s, n) => String(s ?? '').slice(0, n);
  const answers = (Array.isArray(body.answers) ? body.answers : []).slice(0, 3).map(a => clip(a, 800));
  const questions = (Array.isArray(body.questions) ? body.questions : []).slice(0, 3).map(q => clip(q, 200));
  const values = {};
  for (const id of Object.keys(RULERS)) {
    const v = Number(body.values?.[id]);
    if (Number.isFinite(v)) values[id] = Math.max(0, Math.min(9, Math.round(v)));
  }
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: clip(m.content, 800),
  }));

  const lines = [];
  lines.push('תשובות המשתמש לשאלות:');
  answers.forEach((a, i) => { if (a.trim()) lines.push(`- ${questions[i] || 'שאלה'} ${a}`); });
  if (body.core) lines.push(`המשפט המרכזי של יחידת התרגול: ${clip(body.core, 200)}`);
  if (body.anchor) lines.push(`העוגן שבחר: ${clip(body.anchor, 60)}`);
  if (Object.keys(values).length) {
    lines.push('הסרגלים שסימן (0–9): ' + Object.entries(values).map(([id, v]) => `${RULERS[id]} ${v}`).join(', '));
  }
  if (body.insight) lines.push(`התובנה שקיבל: ${clip(body.insight, 300)}`);
  lines.push('כתוב לו שיקוף קצר.');

  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: lines.join('\n') },
    ...history,
  ];

  let out;
  try {
    out = await env.AI.run(MODEL, { messages, max_tokens: 450, temperature: 0.6 });
  } catch (e) {
    return json({ error: 'model-failed' }, 502);
  }
  let text = out?.response ?? out?.result?.response ?? '';
  if (typeof text !== 'string') text = String(text);
  const distress = /^\s*\[מצוקה\]/.test(text);
  text = text.replace(/^\s*\[מצוקה\]\s*/, '').trim();
  return json({ text, distress });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
