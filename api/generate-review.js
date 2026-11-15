// api/generate-review.js
// BAR BER SHOP 髪座 口コミ下書き生成（Vercel Serverless Function）
// POST /api/generate-review
// 受け取るデータ: { language, visit, occasion, menus[], points[], freeText }

const OpenAI = require("openai");

const MAX_FREETEXT_LENGTH = 200;
const LANGS = ["ja", "en", "ko", "zh_cn", "zh_tw"];

const SHOP = {
  ja: { name: "BAR BER SHOP 髪座", desc: "京都・二条駅／大宮駅から歩いて行ける理容室" },
  en: { name: "BAR BER SHOP Kamiza", desc: "a barbershop in Kyoto, within walking distance of Nijo and Omiya stations" },
  ko: { name: "BAR BER SHOP 카미자", desc: "교토 니조역·오미야역에서 걸어갈 수 있는 이용실" },
  zh_cn: { name: "BAR BER SHOP 髪座", desc: "位于京都二条站／大宫站步行可达的理发店" },
  zh_tw: { name: "BAR BER SHOP 髪座", desc: "位於京都二條站／大宮站步行可達的理髮店" },
};

const MASTER = {
  menus: {
    m1: { ja: "メンズカット", en: "Men's Cut", ko: "남성 커트", zh_cn: "男士剪发", zh_tw: "男士剪髮" },
    m2: { ja: "スキンフェード", en: "Skin Fade", ko: "스킨 페이드", zh_cn: "渐变理发", zh_tw: "漸層理髮" },
    m3: { ja: "カラー", en: "Color", ko: "컬러", zh_cn: "染发", zh_tw: "染髮" },
    m4: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m5: { ja: "メッシュ", en: "Highlights", ko: "메쉬", zh_cn: "挑染", zh_tw: "挑染" },
    // 濡れパンは口コミでは「パーマ」として書く（AIに「濡れパン」という言葉は渡さない）
    m6: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m7: { ja: "顔そり", en: "Shave", ko: "면도", zh_cn: "修面", zh_tw: "修面" },
  },
  // 選ばれたら口コミに必ず入れる言葉（フェード・パーマ・メッシュ）
  mustWords: {
    m2: { ja: "フェード", en: "fade", ko: "페이드", zh_cn: "渐变", zh_tw: "漸層" },
    m4: { ja: "パーマ", en: "perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m5: { ja: "メッシュ", en: "highlights", ko: "메쉬", zh_cn: "挑染", zh_tw: "挑染" },
    m6: { ja: "パーマ", en: "perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
  },
  // 来店回数（文章の書き分けに使う）
  visits: {
    v1: { ja: "初めての来店", en: "first visit", ko: "첫 방문", zh_cn: "第一次来", zh_tw: "第一次來" },
    v2: { ja: "何度か来店している", en: "has visited a few times", ko: "몇 번 방문함", zh_cn: "来过几次", zh_tw: "來過幾次" },
    v3: { ja: "いつも通っている常連", en: "a regular customer", ko: "단골", zh_cn: "常客", zh_tw: "常客" },
  },
  // 今回のきっかけ（文章の書き分けに使う）
  occasions: {
    o1: { ja: "いつものメンテナンス", en: "regular maintenance trim", ko: "평소 관리", zh_cn: "日常修剪", zh_tw: "日常修剪" },
    o2: { ja: "仕事・就活の前", en: "before work or job hunting", ko: "일·취업 준비 전", zh_cn: "工作或求职前", zh_tw: "工作或求職前" },
    o3: { ja: "イベント・結婚式の前", en: "before an event or a wedding", ko: "행사·결혼식 전", zh_cn: "活动或婚礼前", zh_tw: "活動或婚禮前" },
    o4: { ja: "気分を変えたくて", en: "wanted a change", ko: "기분 전환", zh_cn: "想换个心情", zh_tw: "想換個心情" },
    o5: { ja: "旅行中に立ち寄った", en: "stopped by while traveling", ko: "여행 중에 들름", zh_cn: "旅行途中顺路来", zh_tw: "旅行途中順路來" },
  },
  points: {
    p1: {
      ja: [
        "カウンセリングが丁寧",
        "ざっくりした注文でも意図を汲み取ってくれた",
        "髪質や骨格に合わせた提案をしてくれた",
        "細かい要望までしっかり聞いてくれた",
      ],
      en: "Careful consultation", ko: "꼼꼼한 상담", zh_cn: "细致的咨询", zh_tw: "仔細的諮詢",
    },
    p2: { ja: "希望通りの仕上がり", en: "Finish as imagined", ko: "원하던 스타일 완성", zh_cn: "符合预期的效果", zh_tw: "符合預期的效果" },
    p3: { ja: "手際が良くスピーディー", en: "Quick and skillful", ko: "빠르고 능숙함", zh_cn: "手法娴熟", zh_tw: "手法俐落" },
    p4: { ja: "落ち着いた接客", en: "Attentive service", ko: "친절한 응대", zh_cn: "周到的服务", zh_tw: "周到的服務" },
    p5: { ja: "駅からの近さ", en: "Close to the station", ko: "역에서 가까움", zh_cn: "离车站近", zh_tw: "離車站近" },
    p6: { ja: "落ち着く内装", en: "Relaxing interior", ko: "편안한 인테리어", zh_cn: "舒适的内饰", zh_tw: "舒適的裝潢" },
    p7: { ja: "シャンプーが快適", en: "Comfortable shampoo", ko: "시원한 샴푸", zh_cn: "舒适的洗发", zh_tw: "舒服的洗髮" },
  },
};

// ===== System Prompt（言語別）=====
const SYSTEM_PROMPTS = {
  ja: `あなたは京都の理容室に実際に行ったお客様として、Googleマップに投稿する口コミを書きます。

【絶対ルール】
- 150〜300文字程度の自然な日本語
- 普通の人が書いたような、肩の力が抜けた口語の文体
- 渡された情報だけを基に書く（行っていない施術や、なかった出来事を作らない）
- 大げさな褒め言葉、宣伝っぽい表現、絵文字の多用はしない
- 「結論として」「総じて」など機械的なまとめ言葉は使わない
- 店名は「BAR BER SHOP 髪座」または「髪座」と書き、カギ括弧などの括弧で囲まない
- 「二条」「大宮」は、駅からの近さや場所の話の流れで自然に触れられるときだけ使う
- 改行は2〜3回程度
- 毎回、書き出し・構成・言い回しを変える
- 出力は口コミ本文のみ。前置きや説明は一切書かない`,

  en: `You write a Google Maps review as a real customer who visited a barbershop in Kyoto, Japan.

[Strict rules]
- 60–130 words of natural, casual English
- Sound like an ordinary person, not AI
- Use only the facts provided (do not invent services or events)
- No exaggerated praise, salesy wording, or heavy emoji use
- Never put the shop name in quotation marks or brackets
- Mention Nijo or Omiya only when it fits naturally (e.g. location, access)
- Vary the opening, structure, and wording every time
- Output only the review body, with no preamble`,

  ko: `당신은 교토의 이용실을 실제로 방문한 손님으로서 구글 지도에 올릴 리뷰를 작성합니다.

【엄격한 규칙】
- 150~300자 정도의 자연스러운 한국어 구어체
- AI가 쓴 것처럼 보이지 않게, 평범한 사람의 문체
- 제공된 정보만으로 작성(받지 않은 시술이나 없던 일을 지어내지 않음)
- 과장된 칭찬, 광고성 표현, 이모지 남발 금지
- 가게 이름을 따옴표나 괄호로 감싸지 않음
- 니조·오미야는 위치나 접근성 이야기에서 자연스러울 때만 언급
- 매번 시작·구성·표현을 다르게
- 리뷰 본문만 출력(서두·설명 불필요)`,

  zh_cn: `你是一位实际去过京都一家理发店的顾客，正在写要发布在 Google 地图上的评价。

【严格规则】
- 约 100–200 字的自然简体中文口语
- 像普通人写的，不要像 AI
- 只根据提供的信息撰写（不要编造没做过的项目或没发生的事）
- 不要夸张赞美、广告口吻或大量表情符号
- 店名不要加引号或括号
- 只有在谈到位置或交通时才自然提到二条或大宫
- 每次都改变开头、结构和措辞
- 只输出评价正文，不要任何前言`,

  zh_tw: `你是一位實際去過京都一家理髮店的顧客，正在寫要發布在 Google 地圖上的評論。

【嚴格規則】
- 約 100–200 字的自然繁體中文口語
- 像一般人寫的，不要像 AI
- 只根據提供的資訊撰寫（不要編造沒做過的項目或沒發生的事）
- 不要誇張讚美、廣告口吻或大量表情符號
- 店名不要加引號或括號
- 只有在談到位置或交通時才自然提到二條或大宮
- 每次都改變開頭、結構和措辭
- 只輸出評論本文，不要任何前言`,
};

// ===== 小さな道具 =====
const pickLabel = (entry, lang) => {
  if (!entry) return null;
  const v = entry[lang];
  if (Array.isArray(v)) return v[Math.floor(Math.random() * v.length)];
  return v || null;
};

const unique = (arr) => [...new Set(arr.filter(Boolean))];

// 店名のまわりの括弧を消す（AIが勝手につけた場合の保険）
function stripShopBrackets(text) {
  const names = ["BAR BER SHOP 髪座", "BAR BER SHOP Kamiza", "BAR BER SHOP 카미자", "髪座", "Kamiza", "카미자"];
  let out = text;
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`[「『【〈《“"']\\s*${esc}\\s*[」』】〉》”"']`, "g"), n);
  }
  return out;
}

// ===== User Prompt ビルダ =====
function buildUserPrompt(lang, d) {
  const shop = SHOP[lang];
  const none = { ja: "（指定なし）", en: "(not specified)", ko: "(미지정)", zh_cn: "（未指定）", zh_tw: "（未指定）" }[lang];
  const list = (arr, sep) => (arr.length ? arr.join(sep) : none);

  if (lang === "ja") {
    return `次の情報を基に、Googleマップの口コミを1つ書いてください。

■ お店：${shop.name}（${shop.desc}）
■ 来店回数：${d.visit || none}
■ 今回のきっかけ：${d.occasion || none}
■ 受けたメニュー：${list(d.menus, "、")}
■ 良かった点：${list(d.points, "、")}
${d.mustWords.length ? `■ 次の言葉は必ず本文に自然な形で入れる：${d.mustWords.join("、")}` : ""}
${d.freeText ? `■ お客様自身の一言（意味を変えずに文中へ自然に取り込む）：${d.freeText}` : ""}

口コミ本文のみを出力してください。`;
  }

  if (lang === "en") {
    return `Write one Google Maps review based on the information below.

- Shop: ${shop.name} (${shop.desc})
- Visits: ${d.visit || none}
- Reason for this visit: ${d.occasion || none}
- Services received: ${list(d.menus, ", ")}
- What was good: ${list(d.points, ", ")}
${d.mustWords.length ? `- These words must appear naturally in the review: ${d.mustWords.join(", ")}` : ""}
${d.freeText ? `- Customer's own words (keep the meaning, include naturally): ${d.freeText}` : ""}

Output only the review body.`;
  }

  if (lang === "ko") {
    return `아래 정보를 바탕으로 구글 지도 리뷰 한 편을 작성해 주세요.

· 매장: ${shop.name} (${shop.desc})
· 방문 횟수: ${d.visit || none}
· 이번 방문 계기: ${d.occasion || none}
· 받은 시술: ${list(d.menus, ", ")}
· 좋았던 점: ${list(d.points, ", ")}
${d.mustWords.length ? `· 다음 단어는 반드시 자연스럽게 포함: ${d.mustWords.join(", ")}` : ""}
${d.freeText ? `· 손님 본인의 한마디(의미를 바꾸지 말고 자연스럽게 포함): ${d.freeText}` : ""}

리뷰 본문만 출력하세요.`;
  }

  const isCn = lang === "zh_cn";
  return `${isCn ? "请根据以下信息，写一则 Google 地图评价。" : "請根據以下資訊，寫一則 Google 地圖評論。"}

・${isCn ? "店家" : "店家"}：${shop.name}（${shop.desc}）
・${isCn ? "到访次数" : "到訪次數"}：${d.visit || none}
・${isCn ? "这次来的原因" : "這次來的原因"}：${d.occasion || none}
・${isCn ? "做的项目" : "做的項目"}：${list(d.menus, "、")}
・${isCn ? "满意的地方" : "滿意的地方"}：${list(d.points, "、")}
${d.mustWords.length ? `・${isCn ? "以下词语必须自然地出现在正文中" : "以下詞語必須自然地出現在正文中"}：${d.mustWords.join("、")}` : ""}
${d.freeText ? `・${isCn ? "顾客自己的话（不改变意思，自然融入）" : "顧客自己的話（不改變意思，自然融入）"}：${d.freeText}` : ""}

${isCn ? "只输出评价正文。" : "只輸出評論本文。"}`;
}

// ===== ハンドラ本体（Vercel形式）=====
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  body = body || {};

  const lang = LANGS.includes(body.language) ? body.language : "ja";
  const menuIds = Array.isArray(body.menus) ? body.menus.filter((id) => MASTER.menus[id]) : [];
  const pointIds = Array.isArray(body.points) ? body.points.filter((id) => MASTER.points[id]) : [];

  if (menuIds.length === 0) {
    return res.status(400).json({ error: "menus is required" });
  }

  const freeText = typeof body.freeText === "string"
    ? body.freeText.replace(/[\r\n]+/g, " ").replace(/[<>]/g, "").trim().slice(0, MAX_FREETEXT_LENGTH)
    : "";

  const data = {
    visit: pickLabel(MASTER.visits[body.visit], lang),
    occasion: pickLabel(MASTER.occasions[body.occasion], lang),
    menus: unique(menuIds.map((id) => pickLabel(MASTER.menus[id], lang))),
    points: unique(pointIds.map((id) => pickLabel(MASTER.points[id], lang))),
    mustWords: unique(menuIds.map((id) => pickLabel(MASTER.mustWords[id], lang))),
    freeText,
  };

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
    return res.status(500).json({ error: "Server is not configured" });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[lang] },
        { role: "user", content: buildUserPrompt(lang, data) },
      ],
      temperature: 0.9,
      top_p: 0.95,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
      max_tokens: 600,
    });

    let review = (completion.choices[0]?.message?.content || "").trim();
    review = stripShopBrackets(review);

    if (!review) throw new Error("Empty completion");

    return res.status(200).json({ review });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(500).json({ error: "Generation failed" });
  }
};
