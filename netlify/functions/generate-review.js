// netlify/functions/generate-review.js
// 髪座 口コミ生成エンドポイント
// POST /.netlify/functions/generate-review

const OpenAI = require("openai");

// ===== 設定 =====
// 本番デプロイ時は自店のドメインに置き換える（例: "https://kamiza.example.com"）
// ローカル開発と Netlify プレビューも許可したい場合は配列で複数指定可
const ALLOWED_ORIGINS = [
  "https://your-site.netlify.app",       // ← 本番ドメインに変更
  "http://localhost:8888",                // netlify dev
  "http://127.0.0.1:8888",
];

const MAX_FREETEXT_LENGTH = 200;          // 自由記述の最大文字数

// ===== マスタデータ（フロントの id と一致させる）=====
const MASTER = {
  ja: {
    shopName: "BAR BER SHOP 髪座",
    shopDesc: "京都・二条駅／大宮駅から徒歩圏の理容室",
    frequencies: { first: "初めての来店", repeat: "リピーター（2回目以降）" },
    emotions: {
      e1: "技術力の高さ",
      e2: "店内の雰囲気と居心地の良さ",
      e3: "手際の良さとスピーディーさ",
    },
    menus: {
      m1: "メンズカット", m2: "スキンフェード", m3: "カラー",
      m4: "パーマ", m5: "メッシュ", m6: "濡れパン（ウェットなパンチパーマ）",
    },
    points: {
      p1: "髪の悩みを丁寧に聞いて似合うスタイルを提案してくれた",
      p2: "イメージ通りの完璧な仕上がりだった",
      p3: "丁寧かつ手際よくスピーディーに仕上げてくれた",
      p4: "会話も楽しくとても居心地の良い時間を過ごせた",
      p5: "二条駅・大宮駅から近くて通いやすい",
      p6: "店内の雰囲気が渋くて落ち着く",
      p7: "京都で一番カッコよくなった",
      p8: "シャンプーがとても気持ちよかった",
    },
    endings: {
      styleA: "大満足",
      styleB: "最高（高めの熱量）",
      styleC: "とても良かった（落ち着いた満足感）",
    },
  },
  en: {
    shopName: "BAR BER SHOP Kamiza",
    shopDesc: "a barbershop in Kyoto, near Nijo and Omiya stations",
    frequencies: { first: "first visit", repeat: "returning customer" },
    emotions: {
      e1: "the high level of technique",
      e2: "the atmosphere and comfort of the shop",
      e3: "the efficiency and speed of the service",
    },
    menus: {
      m1: "men's cut", m2: "skin fade", m3: "hair color",
      m4: "perm", m5: "highlights", m6: "wet punch perm",
    },
    points: {
      p1: "they carefully listened to my hair concerns and suggested a style that suited me",
      p2: "the finish was exactly as I imagined",
      p3: "they were thorough yet fast and efficient",
      p4: "the conversation was enjoyable and the time spent was very comfortable",
      p5: "it is conveniently located near Nijo and Omiya stations",
      p6: "the shop has a cool, relaxing atmosphere",
      p7: "it made me feel like the coolest guy in Kyoto",
      p8: "the shampoo felt amazing",
    },
    endings: {
      styleA: "highly satisfied",
      styleB: "absolutely awesome (strong enthusiasm)",
      styleC: "very good (calm, sincere satisfaction)",
    },
  },
  zh_tw: {
    shopName: "BAR BER SHOP 髪座",
    shopDesc: "位於京都二條站／大宮站附近的理髮店",
    frequencies: { first: "第一次造訪", repeat: "回頭客（第二次以上）" },
    emotions: {
      e1: "高超的技術",
      e2: "店內氛圍與舒適度",
      e3: "俐落迅速的手法",
    },
    menus: {
      m1: "男士剪髮", m2: "漸層理髮(Skin Fade)", m3: "染髮",
      m4: "燙髮", m5: "挑染", m6: "濕髮感燙",
    },
    points: {
      p1: "仔細聆聽頭髮困擾並推薦適合的造型",
      p2: "完全符合想像的完美造型",
      p3: "服務仔細且手法俐落迅速",
      p4: "聊天愉快，度過非常舒適的時光",
      p5: "離二條站和大宮站很近，非常方便",
      p6: "店內氛圍復古舒適",
      p7: "變成京都最帥的造型",
      p8: "洗髮非常舒服",
    },
    endings: {
      styleA: "非常滿意",
      styleB: "太棒了（高度熱情）",
      styleC: "非常好（沉穩的滿足感）",
    },
  },
  ko: {
    shopName: "BAR BER SHOP 카미자",
    shopDesc: "교토 니조역・오미야역 근처의 이용실",
    frequencies: { first: "첫 방문", repeat: "재방문(2회 이상)" },
    emotions: {
      e1: "높은 기술력",
      e2: "매장 분위기와 편안함",
      e3: "능숙함과 빠른 시술",
    },
    menus: {
      m1: "남성 커트", m2: "스킨 페이드", m3: "컬러",
      m4: "파마", m5: "메쉬", m6: "젖은 펀치 파마",
    },
    points: {
      p1: "모발 고민을 꼼꼼히 듣고 어울리는 스타일을 제안해 주셨다",
      p2: "생각했던 그대로 완벽하게 완성되었다",
      p3: "꼼꼼하면서도 능숙하고 빠르게 마무리해 주셨다",
      p4: "대화도 즐겁고 편안한 시간을 보낼 수 있었다",
      p5: "니조역과 오미야역에서 가까워 다니기 편하다",
      p6: "매장 분위기가 차분하고 멋지다",
      p7: "교토에서 가장 멋지게 변신할 수 있었다",
      p8: "샴푸가 시원하고 기분 좋았다",
    },
    endings: {
      styleA: "대만족",
      styleB: "최고(강한 열정)",
      styleC: "정말 좋았다(차분한 만족감)",
    },
  },
  zh_cn: {
    shopName: "BAR BER SHOP 髪座",
    shopDesc: "位于京都二条站／大宫站附近的理发店",
    frequencies: { first: "第一次到访", repeat: "回头客（第二次以上）" },
    emotions: {
      e1: "高超的技术",
      e2: "店内氛围与舒适度",
      e3: "利落迅速的手法",
    },
    menus: {
      m1: "男士剪发", m2: "渐变理发(Skin Fade)", m3: "染发",
      m4: "烫发", m5: "挑染", m6: "湿发感烫",
    },
    points: {
      p1: "仔细倾听头发困扰并推荐适合的造型",
      p2: "完全符合想象的完美造型",
      p3: "服务仔细且手法利落迅速",
      p4: "聊天愉快，度过非常舒适的时光",
      p5: "离二条站和大宫站很近，非常方便",
      p6: "店内氛围复古舒适",
      p7: "变成京都最帅的造型",
      p8: "洗发非常舒服",
    },
    endings: {
      styleA: "非常满意",
      styleB: "太棒了（高度热情）",
      styleC: "非常好（沉稳的满足感）",
    },
  },
};

// ===== System Prompt（言語別）=====
const SYSTEM_PROMPTS = {
  ja: `あなたは京都の理容室を訪れた一般のお客様として、Googleマップに投稿する自然な口コミを書きます。

【絶対ルール】
- 200〜350文字程度の自然な日本語
- AIが書いたと気づかれない、口語的で人間味のある文体
- 提示された情報のみを基に書く（事実を捏造しない）
- 過度な絵文字や記号は使わない
- 改行は2〜4回程度、適度に入れる
- 毎回必ず異なる文章構成・語彙・語順で書く（テンプレ感を完全排除）
- 不自然な敬語の連発や、宣伝臭い表現は避ける
- 出力はレビュー本文のみ。前置きや「以下が口コミです」などの説明文は一切不要`,

  en: `You write natural Google Maps reviews as a real customer of a barbershop in Kyoto, Japan.

[Strict rules]
- 80–150 words, natural English
- Sound like a real human, not AI-generated
- Use only the facts provided (do not invent details)
- No excessive emojis or salesy language
- Vary sentence structure and vocabulary every time
- Output the review body only — no preamble`,

  zh_tw: `你是一位實際造訪了京都理髮店的顧客，正在撰寫要發布在 Google 地圖上的自然評論。

【嚴格規則】
- 約 150–250 字的自然繁體中文
- 像真人寫的，而非 AI 生成
- 只根據提供的事實撰寫（不可捏造）
- 避免過多表情符號或廣告口吻
- 每次都改變句型、詞彙、順序
- 只輸出評論本文，不要任何前言`,

  ko: `당신은 교토의 이용실을 실제로 방문한 손님으로서, 구글 지도에 올릴 자연스러운 리뷰를 작성합니다.

【엄격한 규칙】
- 200~350자 정도의 자연스러운 한국어
- AI가 쓴 것처럼 보이지 않게, 진짜 사람 같은 문체
- 제공된 사실만으로 작성(꾸며내지 않음)
- 과한 이모지나 광고성 표현 금지
- 매번 문장 구조·어휘·순서를 다르게
- 리뷰 본문만 출력(서두·설명 불필요)`,

  zh_cn: `你是一位实际造访了京都理发店的顾客，正在撰写要发布在 Google 地图上的自然评论。

【严格规则】
- 约 150–250 字的自然简体中文
- 像真人写的，而非 AI 生成
- 只根据提供的事实撰写（不可捏造）
- 避免过多表情符号或广告口吻
- 每次都改变句型、词汇、顺序
- 只输出评论本文，不要任何前言`,
};

// ===== ハンドラ本体 =====
exports.handler = async (event) => {
  // --- CORS / Origin チェック ---
  const origin = event.headers.origin || event.headers.Origin || "";
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  const corsHeaders = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  // 本番では他ドメインからの呼び出しを拒否
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Forbidden origin" }),
    };
  }

  // --- 入力パース ---
  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const {
    language = "ja",
    frequency,
    emotion,
    menus = [],
    points = [],
    ending,
    freeText = "",
  } = payload;

  // --- 入力検証 ---
  const m = MASTER[language];
  if (!m) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "Unsupported language" }) };
  }
  if (!emotion || !m.emotions[emotion]) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "emotion is required" }) };
  }
  if (!ending || !m.endings[ending]) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: "ending is required" }) };
  }
  if (typeof freeText !== "string" || freeText.length > MAX_FREETEXT_LENGTH) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: `freeText must be <= ${MAX_FREETEXT_LENGTH} chars` }),
    };
  }

  // 自由記述のサニタイズ（プロンプトインジェクション対策の最低限）
  const safeFreeText = freeText
    .replace(/[\r\n]+/g, " ")
    .replace(/[<>]/g, "")
    .slice(0, MAX_FREETEXT_LENGTH);

  // --- User Prompt 構築 ---
  const menuLabels = menus.map((id) => m.menus[id]).filter(Boolean);
  const pointLabels = points.map((id) => m.points[id]).filter(Boolean);

  const userPrompt = buildUserPrompt(language, m, {
    frequency: m.frequencies[frequency] || m.frequencies.first,
    emotion: m.emotions[emotion],
    menuLabels,
    pointLabels,
    ending: m.endings[ending],
    freeText: safeFreeText,
  });

  // --- OpenAI 呼び出し ---
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.ja },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.95,        // 高めにして毎回違う文章に
      top_p: 0.95,
      presence_penalty: 0.6,
      frequency_penalty: 0.3,
      max_tokens: 600,           // 1件あたりのコスト上限
    });

    const review = (completion.choices[0]?.message?.content || "").trim();

    if (!review) {
      throw new Error("Empty completion");
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ review }),
    };
  } catch (err) {
    console.error("OpenAI error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Generation failed", detail: String(err?.message || err) }),
    };
  }
};

// ===== User Prompt ビルダ =====
function buildUserPrompt(lang, m, data) {
  const { frequency, emotion, menuLabels, pointLabels, ending, freeText } = data;

  if (lang === "ja") {
    return `以下の情報を基に、自然なGoogleマップ口コミを1つ書いてください。

■ お店：${m.shopName}（${m.shopDesc}）
■ 来店：${frequency}
■ 最も感動したポイント：${emotion}
■ 受けたメニュー：${menuLabels.length ? menuLabels.join("、") : "（指定なし。一般的な来店として書いてOK）"}
■ 特に良かった点：
${pointLabels.length ? pointLabels.map((p) => `  ・${p}`).join("\n") : "  ・（指定なし）"}
■ 締めくくりのトーン：${ending}
${freeText ? `■ お客様自身の言葉（必ず文中に自然に取り込む）：「${freeText}」` : ""}

口コミ本文のみを出力してください。`;
  }

  if (lang === "en") {
    return `Write one natural Google Maps review based on the information below.

- Shop: ${m.shopName} (${m.shopDesc})
- Visit: ${frequency}
- Most impressive point: ${emotion}
- Services received: ${menuLabels.length ? menuLabels.join(", ") : "(unspecified, write as a general visit)"}
- What was particularly good:
${pointLabels.length ? pointLabels.map((p) => `  - ${p}`).join("\n") : "  - (unspecified)"}
- Closing tone: ${ending}
${freeText ? `- Customer's own words (incorporate naturally): "${freeText}"` : ""}

Output only the review body.`;
  }

  if (lang === "zh_tw") {
    return `請根據以下資訊，撰寫一則自然的 Google 地圖評論。

‧ 店家：${m.shopName}（${m.shopDesc}）
‧ 造訪：${frequency}
‧ 最感動的部分：${emotion}
‧ 接受的服務：${menuLabels.length ? menuLabels.join("、") : "（未指定，請以一般造訪撰寫）"}
‧ 特別好的地方：
${pointLabels.length ? pointLabels.map((p) => `  ・${p}`).join("\n") : "  ・（未指定）"}
‧ 結尾語氣：${ending}
${freeText ? `‧ 顧客自己的話（請自然融入文中）：「${freeText}」` : ""}

請只輸出評論本文。`;
  }

  if (lang === "ko") {
    return `아래 정보를 바탕으로 자연스러운 구글 지도 리뷰 한 편을 작성해 주세요.

· 매장: ${m.shopName}(${m.shopDesc})
· 방문: ${frequency}
· 가장 감동한 포인트: ${emotion}
· 받은 서비스: ${menuLabels.length ? menuLabels.join(", ") : "(미지정, 일반적인 방문으로 작성)"}
· 특히 좋았던 점:
${pointLabels.length ? pointLabels.map((p) => `  · ${p}`).join("\n") : "  · (미지정)"}
· 마무리 톤: ${ending}
${freeText ? `· 손님 본인의 말(자연스럽게 본문에 포함): "${freeText}"` : ""}

리뷰 본문만 출력하세요.`;
  }

  // zh_cn
  return `请根据以下信息，撰写一则自然的 Google 地图评论。

‧ 店家：${m.shopName}（${m.shopDesc}）
‧ 到访：${frequency}
‧ 最感动的部分：${emotion}
‧ 接受的服务：${menuLabels.length ? menuLabels.join("、") : "（未指定，请以一般到访撰写）"}
‧ 特别好的地方：
${pointLabels.length ? pointLabels.map((p) => `  ・${p}`).join("\n") : "  ・（未指定）"}
‧ 结尾语气：${ending}
${freeText ? `‧ 顾客自己的话（请自然融入文中）：“${freeText}”` : ""}

请只输出评论本文。`;
}
