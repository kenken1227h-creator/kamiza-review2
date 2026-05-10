// netlify/functions/generate-review.js
const OpenAI = require("openai");

const ALLOWED_ORIGINS = [
  "https://your-site.netlify.app", // 本番公開時に自分のNetlifyドメインに変更します
  "http://localhost:8888",
  "http://127.0.0.1:8888",
];

const MAX_FREETEXT_LENGTH = 200;

const MASTER = {
  ja: {
    shopName: "BAR BER SHOP 髪座",
    frequencies: { first: "初めての来店", repeat: "リピーター（2回目以降）" },
    emotions: { e1: "技術力の高さ", e2: "店内の雰囲気と居心地の良さ", e3: "手際の良さとスピーディーさ" },
    menus: { m1: "メンズカット", m2: "スキンフェード", m3: "カラー", m4: "パーマ", m5: "メッシュ", m6: "濡れパン" },
    points: { p1: "髪の悩みを丁寧に聞いて似合うスタイルを提案してくれた", p2: "イメージ通りの完璧な仕上がりだった", p3: "丁寧かつ手際よくスピーディーに仕上げてくれた", p4: "会話も楽しくとても居心地の良い時間を過ごせた", p5: "二条駅・大宮駅から近くて通いやすい", p6: "店内の雰囲気が渋くて落ち着く", p7: "京都で一番カッコよくなった", p8: "シャンプーがとても気持ちよかった" },
    endings: { styleA: "大満足", styleB: "最高（高めの熱量）", styleC: "とても良かった（落ち着いた満足感）" }
  },
  en: {
    frequencies: { first: "first visit", repeat: "returning customer" },
    emotions: { e1: "the high level of technique", e2: "the atmosphere and comfort of the shop", e3: "the efficiency and speed of the service" },
    menus: { m1: "men's cut", m2: "skin fade", m3: "hair color", m4: "perm", m5: "highlights", m6: "wet punch perm" },
    points: { p1: "they carefully listened to my hair concerns and suggested a style that suited me", p2: "the finish was exactly as I imagined", p3: "they were thorough yet fast and efficient", p4: "the conversation was enjoyable and the time spent was very comfortable", p5: "it is conveniently located near Nijo and Omiya stations", p6: "the shop has a cool, relaxing atmosphere", p7: "it made me feel like the coolest guy in Kyoto", p8: "the shampoo felt amazing" },
    endings: { styleA: "highly satisfied", styleB: "absolutely awesome", styleC: "very good" }
  },
  zh_tw: {
    frequencies: { first: "第一次造訪", repeat: "回頭客（第二次以上）" },
    emotions: { e1: "高超的技術", e2: "店內氛圍與舒適度", e3: "俐落迅速的手法" },
    menus: { m1: "男士剪髮", m2: "漸層理髮(Skin Fade)", m3: "染髮", m4: "燙髮", m5: "挑染", m6: "濕髮感燙" },
    points: { p1: "仔細聆聽我的頭髮困擾，並推薦了適合的造型", p2: "完全符合我想像的完美造型", p3: "服務非常仔細，而且手法俐落迅速", p4: "聊天很愉快，度過了非常舒適的時光", p5: "離二條站和大宮站很近，非常方便", p6: "店內氛圍復古舒適", p7: "讓我變成了京都最帥的造型", p8: "洗髮非常舒服" },
    endings: { styleA: "非常滿意", styleB: "太棒了", styleC: "非常好" }
  },
  ko: {
    frequencies: { first: "처음 방문", repeat: "재방문(2회 이상)" },
    emotions: { e1: "높은 기술력", e2: "매장 분위기와 편안함", e3: "능숙함과 빠른 시술" },
    menus: { m1: "남성 커트", m2: "스킨 페이드", m3: "컬러", m4: "파마", m5: "메쉬", m6: "젖은 펀치 파마" },
    points: { p1: "모발 고민을 꼼꼼히 듣고 어울리는 스타일을 제안해 주신", p2: "생각했던 대로 완벽하게 완성된", p3: "매우 꼼꼼하면서도 능숙하고 빠르게 마무리해 주신", p4: "대화도 즐겁고 편안한 시간을 보낼 수 있었던", p5: "니조역과 오미야역에서 가까워 방문하기 편한", p6: "매장 분위기가 차분하고 멋진", p7: "교토에서 가장 멋지게 변신할 수 있었던", p8: "샴푸가 아주 시원하고 기분 좋았던" },
    endings: { styleA: "대만족", styleB: "최고", styleC: "정말 좋았어요" }
  },
  zh_cn: {
    frequencies: { first: "第一次来店", repeat: "回头客（第二次以上）" },
    emotions: { e1: "技术高超", e2: "店内氛围与舒适度", e3: "手法利落与迅速" },
    menus: { m1: "男士剪发", m2: "渐变理发(Skin Fade)", m3: "染发", m4: "烫发", m5: "挑染", m6: "湿发感烫" },
    points: { p1: "仔细倾听我的头发困扰，并推荐了适合的造型", p2: "完全符合我想象的完美造型", p3: "服务非常仔细，而且手法利落迅速", p4: "聊天很愉快，度过了非常舒适的时光", p5: "离二条站和大宫站很近，非常方便", p6: "店内氛围复古舒适", p7: "让我变成了京都最帅的造型", p8: "洗发非常舒服" },
    endings: { styleA: "非常满意", styleB: "太棒了", styleC: "非常好" }
  }
};

exports.handler = async function (event, context) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const lang = body.language || "ja";
    const data = MASTER[lang] || MASTER.ja;

    const freqText = data.frequencies[body.frequency] || "";
    const emotionText = data.emotions[body.emotion] || "";
    const menuTexts = (body.menus || []).map(m => data.menus[m]).filter(Boolean);
    const pointTexts = (body.points || []).map(p => data.points[p]).filter(Boolean);
    const endingText = data.endings[body.ending] || "";
    const freeText = (body.freeText || "").substring(0, MAX_FREETEXT_LENGTH);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const systemPrompt = `
    あなたはGoogleマップの口コミを代筆するプロのコピーライターであり、MEO（ローカルSEO）の専門家です。
    ユーザーが選択した条件をもとに、指定された言語（${lang}）で、自然で人間味のある口コミを作成してください。
    
    【絶対遵守のルール】
    ・文字数は150〜300文字程度
    ・「AIが書いたような不自然さ」や、「〜し、」という表現の連続は絶対に避けること
    ・嘘や捏造は絶対に書かない
    ・文章のトーン＆マナー：${endingText}

    【MEO対策のための特別ルール】
    以下のキーワードを、不自然にならないように文章の中に散りばめてください。
    必ずしも全て使う必要はありませんが、文脈に合わせて自然に2〜3個を含めること。
    ・対象キーワード：「京都」「二条」「大宮」「バーバー」「理容室」「フェード」
    （※キーワードの不自然な羅列はGoogleのスパム判定を受けるため、あくまで日常会話に溶け込ませること）
    `;

    const userPrompt = `
    以下の条件で口コミを作成してください。
    ・来店回数：${freqText}
    ・最も感動した点：${emotionText}
    ・施術メニュー：${menuTexts.join(", ")}
    ・具体的に良かった点：${pointTexts.join(", ")}
    ・お客様からの追加コメント（あれば組み込む）：${freeText}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.85,
      max_tokens: 600,
    });

    const review = response.choices[0].message.content.trim();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ review }),
    };

  } catch (error) {
    console.error("Error API:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "口コミの生成に失敗しました。" }),
    };
  }
};
