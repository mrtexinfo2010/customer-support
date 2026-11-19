require('dotenv').config();
const express = require('express');
const crypto = require('crypto');

const app = express();

// Signature যাচাইয়ের জন্য raw body রাখা হচ্ছে
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

const { VERIFY_TOKEN, PAGE_ACCESS_TOKEN, APP_SECRET, OPENAI_API_KEY, PORT = 3000 } = process.env;

// ====== আপনার দোকানের তথ্য (এখানে এডিট করুন) ======
const STORE_INFO = `
প্রোডাক্ট: Smart Watch Pro 8
দাম: ৯৫০ টাকা (ফিক্সড, দামাদামি নেই)
ডেলিভারি চার্জ: ঢাকার ভেতরে ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা
ডেলিভারি সময়: ২-৩ দিন, ক্যাশ অন ডেলিভারি
পলিসি: ৭ দিনের রিপ্লেসমেন্ট ওয়ারেন্টি
অর্ডারে লাগবে: নাম, মোবাইল নাম্বার, সম্পূর্ণ ঠিকানা
`;

const SYSTEM_PROMPT = `তুমি একটি অনলাইন দোকানের বিক্রয় সহকারী।
- কাস্টমার ইংরেজি, বাংলা বা বাংলিশ যেভাবেই লিখুক, তুমি সহজ ও বিনয়ী বাংলায় উত্তর দেবে।
- শুধুমাত্র নিচের তথ্য ব্যবহার করবে। তথ্য না থাকলে বানিয়ে বলবে না, বলবে "আমি বিষয়টি চেক করে জানাচ্ছি"।
- উত্তর ২-৩ বাক্যে ছোট রাখবে।
- অর্ডার নিতে চাইলে নাম, ফোন ও ঠিকানা চাইবে।

${STORE_INFO}`;

// ====== Webhook যাচাই (Meta প্রথমবার এটা কল করে) ======
app.get('/webhook', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.status(200).send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// ====== নতুন মেসেজ গ্রহণ ======
app.post('/webhook', (req, res) => {
  if (!verifySignature(req)) return res.sendStatus(403);
  res.sendStatus(200); // Meta-কে দ্রুত 200 দিতে হয়

  if (req.body.object !== 'page') return;

  for (const entry of req.body.entry || []) {
    for (const event of entry.messaging || []) {
      // নিজের পাঠানো মেসেজ (echo) বাদ দিয়ে শুধু কাস্টমারের টেক্সট
      if (event.message?.text && !event.message.is_echo) {
        handleMessage(event.sender.id, event.message.text).catch(console.error);
      }
    }
  }
});

function verifySignature(req) {
  const sig = req.get('x-hub-signature-256');
  if (!sig || !APP_SECRET) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ====== কথোপকথনের মেমরি (সার্ভার রিস্টার্ট হলে মুছে যাবে) ======
const history = new Map();

async function handleMessage(psid, text) {
  await sendAction(psid, 'typing_on');

  const past = history.get(psid) || [];
  past.push({ role: 'user', content: text });

  const reply = await askAI(past.slice(-8));

  past.push({ role: 'assistant', content: reply });
  history.set(psid, past.slice(-8));

  await sendText(psid, reply);
}

// ====== AI থেকে রিপ্লাই ======
async function askAI(messages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini', // ডকুমেন্টেশনে বর্তমান মডেলের নাম দেখে নিন
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      temperature: 0.4,
    }),
  });
  const data = await r.json();
  return data.choices?.[0]?.message?.content?.trim()
    || 'দুঃখিত ভাইয়া, আমি একটু পরে আপনাকে জানাচ্ছি।';
}

// ====== Facebook-এ রিপ্লাই পাঠানো ======
async function callSendAPI(body) {
  const r = await fetch(
    `https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) console.error('Send API error:', await r.text());
}

const sendText = (psid, text) =>
  callSendAPI({ recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text } });

const sendAction = (psid, action) =>
  callSendAPI({ recipient: { id: psid }, sender_action: action });

app.listen(PORT, () => console.log(`Bot running on port ${PORT}`));
