// כללי הבחירה והשיקוף — לפי "הסרגלים והתובנות" במסמך מפת הדרכים.
import { RULERS, INSIGHTS, MAX, ALL_MAX_TEXT } from './data.js';

const WORDS = ['אפס', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];

// ממוצע במילים, לא כמספר עשרוני
export function averageInWords(avg) {
  const n = Math.floor(avg);
  const f = avg - n;
  if (f < 0.2) return 'בערך ' + WORDS[n];
  if (f < 0.5) return 'קצת מעל ' + WORDS[n];
  if (f < 0.8) return 'בין ' + WORDS[n] + ' ל' + WORDS[n + 1];
  return 'כמעט ' + WORDS[n + 1];
}

// values: { 7: n, 8: n, ... }
// distress: המשתמש במצוקה (לפי הסוכן או חוסן 0–2)
// choice: id של סרגל שהמשתמש בחר בשוויון / במצב מאוזן
export function reflect(values, { distress = false, choice = null } = {}) {
  const ids = RULERS.map(r => r.id);
  const vals = ids.map(id => values[id]);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const lows = ids.filter(id => values[id] === min);
  const highs = ids.filter(id => values[id] === max);
  const allEqual = min === max;
  const safety = distress || values[7] <= 2;

  const out = {
    average: avgRound(avg),
    averageWords: averageInWords(avg),
    allEqual,
    allMax: allEqual && min === MAX,
    strong: allEqual ? [] : highs,
    attention: allEqual ? [] : lows,
    tie: !allEqual && lows.length > 1,
    choices: allEqual ? ids : (lows.length > 1 ? lows : []),
    safety,
    focus: null,
    insight: null,
  };

  if (out.allMax) {
    out.insight = ALL_MAX_TEXT;
    return out;
  }
  // בשוויון: הבחירה של המשתמש, אחרת לפי סדר הטבלה (חוסן במשבר קודם)
  let focus = (choice && out.choices.includes(choice)) ? choice : null;
  if (!focus) focus = allEqual ? null : lows[0];
  if (!focus) return out; // מאוזן — מחכים שהמשתמש יבחר סרגל
  out.focus = focus;
  const v = Math.min(values[focus], MAX - 1);
  const [text, flagged] = INSIGHTS[focus][v];
  out.insight = (safety && flagged) ? INSIGHTS[focus][0][0] : text;
  return out;
}

function avgRound(a) { return Math.round(a * 10) / 10; }

export function rulerName(id) { return RULERS.find(r => r.id === id)?.name || ''; }
