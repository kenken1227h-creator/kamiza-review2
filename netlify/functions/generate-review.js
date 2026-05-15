const OpenAI = require("openai");

const MASTER = {
  menus: {
    m1: { ja: "メンズカット", en: "Men's Cut", ko: "남성 커트", zh_cn: "男士剪发", zh_tw: "男士剪髮" },
    m2: { ja: "スキンフェード", en: "Skin Fade", ko: "스킨 페이드", zh_cn: "渐变理发", zh_tw: "漸層理髮" },
    m3: { ja: "カラー", en: "Color", ko: "컬러", zh_cn: "染发", zh_tw: "染髮" },
    m4: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m5: { ja: "メッシュ", en: "Highlights", ko: "메쉬", zh_cn: "挑染", zh_tw: "挑染" },
    m6: { ja: "濡れパン", en: "Wet Punch", ko: "젖은 펀치 파마", zh_cn: "湿发感烫", zh_tw: "濕髮感燙" }
  },
  points: {
    p1: { ja: "カウンセリングが丁寧", en: "Careful counseling", ko: "꼼꼼한 상담", zh_cn: "细致的咨询", zh_tw: "仔細的諮詢" },
    p2: { ja: "希望通りの仕上がり", en: "Finish as imagined", ko: "원하던 스타일 완성", zh_cn: "符合预期的效果", zh_tw: "符合預期的效果" },
    p3: { ja: "手際が良くスピーディー", en: "Efficiency", ko: "빠르고 능숙함", zh_cn: "手法娴熟", zh_tw: "手法俐落" },
    p4: { ja: "落ち着いた接客", en: "Friendly atmosphere", ko: "편안한 분위기", zh_cn: "轻松的氛围", zh_tw: "輕鬆的氛圍" },
    p5: { ja: "二条駅・大宮駅からのアクセスが良い", en: "Close to Nijo/Omiya station", ko: "니조역/오미야역에서 가까움", zh_cn: "离二条站/大宫站近", zh_tw: "離二條站/大宮站近" },
    p6: { ja: "渋くてかっこいい店の雰囲気", en: "Cool & relaxing interior", ko: "멋진 인테리어", zh_cn: "复古舒适的内饰", zh_tw: "復古舒適的裝潢" },
    p7: { ja: "シャンプーが気持ちいい", en: "Comfortable shampoo", ko: "시원한 샴푸", zh_cn: "舒适的洗发", zh_tw: "舒服的洗髮" }
  }
};

// ===== 言語ごとのシステムプロンプト（必ずその言語自身で書く）=====
function buildSystemPrompt(lang, hasSkinFade) {
  const cutKeyword = hasSkinFade ? "フェード" : "カット";

  if (lang === "ja") {
    return `あなたは京都の理容室「髪座」を実際に利用したリアルな顧客として、Googleマップに投稿する自然な口コミを日本語で作成します。

【絶対ルール（AIっぽさを完全に消す）】
・出力は必ず日本語のみ。他の言語は一切混ぜない。
・店名（BAR BER SHOP 髪座、髪座など）に「」『』""''などの括弧類は絶対に使わない。
・「結論として」「まとめると」「特筆すべき点は」「〜にお伺いしました」等のAI特有の堅い表現は禁止。
・箇条書き禁止。自然な文章の流れで書く。
・実際の人間がスマホでパッと打ったような、少しラフでリアルな温度感にする。
・短くスパッとした文（例：とても良いバーバーでした。 ご丁寧で気持ちいい。）や、少し感情的な文（例：想像以上の仕上がりに嬉しかったです。）を混ぜてリアルさを出す。

【MEO対策】
・「二条」か「大宮」のどちらかの地名と、「理容室」「${cutKeyword}」を文中に必ず含める。
・地名やキーワードは検索対策臭くならないよう、極めて自然に文章へ溶け込ませる。
  例：二条で${cutKeyword}の上手い理容室を探していて…
  例：大宮エリアにある歴史のありそうな理容室です。
  例：京都に来たので二条の理容室でお願いしました。

口コミ本文のみを出力すること。前置きや見出し、注釈は一切不要。`;
  }

  if (lang === "en") {
    return `You are a real customer of "Kamiza" — a barbershop in Kyoto, Japan — writing a natural Google Maps review.

[Strict rules — output must NOT feel AI-generated]
- Output ONLY in English. Never mix in Japanese, Korean, Chinese, or any other language.
- When you mention the shop name (BAR BER SHOP Kamiza, or just Kamiza), do NOT wrap it in any kind of brackets such as 「」『』 "" ''.
- Avoid stiff, AI-like phrases such as "In conclusion", "To summarize", "It is worth noting that", "Furthermore".
- No bullet points. Write as one or two natural flowing paragraphs.
- Sound like a real person who just tapped this out on their phone — a little casual, with genuine warmth.
- Mix short punchy sentences (e.g. "Such a great barber.", "Super friendly and skilled.") with slightly emotional ones (e.g. "Honestly thrilled with how it turned out.").

[Tone]
- Write as an international tourist who visited Kyoto and had a great experience.
- Friendly phrases like "I'll definitely come back next time I'm in Kyoto" or "Best barber experience I've had in Japan" feel natural and welcome.

Output the review body only. No preamble, no headings, no notes.`;
  }

  if (lang === "ko") {
    return `당신은 일본 교토에 있는 이용실 "카미자(髪座)"의 실제 고객으로서, 구글 지도에 올릴 자연스러운 리뷰를 한국어로 작성합니다.

[엄수 규칙 — AI 느낌을 완전히 없앨 것]
- 반드시 한국어로만 출력하세요. 일본어, 영어, 중국어 등 다른 언어를 절대 섞지 마세요.
- 매장명(BAR BER SHOP 髪座, 카미자 등)에 「」『』 "" '' 같은 괄호류를 절대 사용하지 마세요.
- "결론적으로", "정리하자면", "특히 주목할 점은", "더 나아가" 같은 AI 특유의 딱딱한 표현은 금지.
- 글머리 기호(불릿) 금지. 한두 문단의 자연스러운 흐름으로 쓰세요.
- 진짜 사람이 휴대폰으로 막 입력한 듯한, 약간 캐주얼하고 따뜻한 온도감을 살리세요.
- 짧고 단호한 문장(예: 정말 좋은 바버샵이에요. 친절하고 손도 빨라요.)과 약간 감정적인 문장(예: 생각보다 훨씬 잘 잘라주셔서 기뻤어요.)을 섞으세요.

[톤]
- 한국에서 교토로 여행 온 관광객의 톤으로 쓰세요.
- "다음에 교토 오면 또 갈게요", "일본에서 받은 커트 중 최고였어요" 같은 친근한 표현이 자연스럽습니다.

리뷰 본문만 출력하세요. 서두, 제목, 주석은 일절 쓰지 마세요.`;
  }

  if (lang === "zh_tw") {
    return `你是日本京都某理髮店「髪座（Kamiza）」的真實顧客，正在用繁體中文撰寫要發布在 Google 地圖上的自然評論。

【嚴格規則 — 完全消除 AI 感】
- 必須只用繁體中文輸出。絕對不要混入日文、英文、簡體中文等其他語言。
- 提到店名（BAR BER SHOP 髪座、髪座等）時，絕對不要用「」『』 "" '' 等任何括號包起來。
- 禁止使用「綜上所述」「總結來說」「值得一提的是」「此外」等 AI 特有的生硬表達。
- 禁止條列式。請以一兩段自然流暢的文字書寫。
- 寫得像真人在手機上隨手打字的感覺，帶點口語、有真實溫度。
- 混合短而俐落的句子（例：真的是很棒的理髮店。又親切又專業。）和略帶情感的句子（例：成品比想像中還滿意，超開心。）。

【語氣】
- 以從台灣或香港來京都旅遊的旅客口吻撰寫。
- 「下次來京都還會再去」「在日本剪過最好的一次」這類表達很自然。

只輸出評論本文，不要任何前言、標題或註解。`;
  }

  // zh_cn
  return `你是日本京都某理发店"髪座（Kamiza）"的真实顾客，正在用简体中文撰写要发布在 Google 地图上的自然评论。

【严格规则 — 完全消除 AI 感】
- 必须只用简体中文输出。绝对不要混入日文、英文、繁体中文等其他语言。
- 提到店名（BAR BER SHOP 髪座、髪座等）时，绝对不要用「」『』 "" '' 等任何括号包起来。
- 禁止使用"综上所述""总结来说""值得一提的是""此外"等 AI 特有的生硬表达。
- 禁止条列式。请以一两段自然流畅的文字书写。
- 写得像真人在手机上随手打字的感觉，带点口语、有真实温度。
- 混合短而利落的句子（例：真的是很棒的理发店。又亲切又专业。）和略带情感的句子（例：成品比想象中还满意，超开心。）。

【语气】
- 以从中国大陆来京都旅游的旅客口吻撰写。
- "下次来京都还会再去""在日本剪过最好的一次"这类表达很自然。

只输出评论本文，不要任何前言、标题或注释。`;
}

// ===== 言語ごとのユーザープロンプト（ラベルもその言語にする）=====
function buildUserPrompt(lang, menuTexts, pointTexts, freeText) {
  const L = {
    ja:    { menu: "メニュー",       point: "良かった点",          free: "お客様自身の言葉", dash: "（特になし）",
             outro: "上記の情報のみを根拠に、本物の人間が書いたような自然で温度感のある日本語の口コミを1つ作成してください。" },
    en:    { menu: "Services",       point: "What I liked",         free: "Customer's own words", dash: "(none)",
             outro: "Using only the info above, write ONE natural English review that sounds like a real human wrote it on their phone." },
    ko:    { menu: "받은 서비스",     point: "좋았던 점",            free: "손님의 직접적인 말", dash: "(없음)",
             outro: "위 정보만을 근거로, 실제 사람이 휴대폰으로 쓴 듯한 자연스러운 한국어 리뷰를 한 편 작성해 주세요." },
    zh_tw: { menu: "服務項目",       point: "覺得不錯的地方",       free: "顧客自己的話",     dash: "（無）",
             outro: "請僅根據以上資訊，撰寫一則像真人在手機上隨手打的自然繁體中文評論。" },
    zh_cn: { menu: "服务项目",       point: "觉得不错的地方",       free: "顾客自己的话",     dash: "（无）",
             outro: "请仅根据以上信息，撰写一则像真人在手机上随手打的自然简体中文评论。" },
  }[lang] || (() => { throw new Error("unsupported lang"); })();

  return `${L.menu}: ${menuTexts.length ? menuTexts.join(", ") : L.dash}
${L.point}: ${pointTexts.length ? pointTexts.join(", ") : L.dash}
${L.free}: ${freeText && freeText.trim() ? freeText.trim() : L.dash}

${L.outro}`;
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body || "{}");
    const lang = ["ja", "en", "ko", "zh_tw", "zh_cn"].includes(body.language) ? body.language : "ja";
    const selectedMenuIds = Array.isArray(body.menus) ? body.menus : [];
    const selectedPointIds = Array.isArray(body.points) ? body.points : [];

    const menuTexts = selectedMenuIds
      .map(id => MASTER.menus[id] && MASTER.menus[id][lang])
      .filter(Boolean);
    const pointTexts = selectedPointIds
      .map(id => MASTER.points[id] && MASTER.points[id][lang])
      .filter(Boolean);
    const freeText = typeof body.freeText === "string" ? body.freeText.slice(0, 300) : "";

    const hasSkinFade = selectedMenuIds.includes("m2");

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = buildSystemPrompt(lang, hasSkinFade);
    const userPrompt = buildUserPrompt(lang, menuTexts, pointTexts, freeText);

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: 600,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review: response.choices[0].message.content.trim() }),
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
