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
    p5: { ja: "駅からの近さ", en: "Close to the station", ko: "역에서 가까움", zh_cn: "离车站近", zh_tw: "離車站近" },
    p6: { ja: "渋くて落ち着く内装", en: "Cool & relaxing interior", ko: "멋진 인테리어", zh_cn: "复古舒适的内饰", zh_tw: "復古舒適的裝潢" },
    p7: { ja: "シャンプーが快適", en: "Comfortable shampoo", ko: "시원한 샴푸", zh_cn: "舒适的洗发", zh_tw: "舒服的洗髮" }
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const lang = body.language || "ja";
    const selectedMenuIds = body.menus || [];
    const menuTexts = selectedMenuIds.map(m => MASTER.menus[m][lang]).filter(Boolean);
    const pointTexts = (body.points || []).map(p => MASTER.points[p][lang]).filter(Boolean);
    const freeText = body.freeText || "";

    const hasSkinFade = selectedMenuIds.includes("m2");
    const cutKeyword = hasSkinFade ? "フェード" : "カット";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // AIへのベース指示
    let systemPrompt = `
    あなたは理容室の顧客として、Googleマップに投稿する自然な口コミを作成します。
    指定された言語（${lang}）で出力してください。

    【絶対的なルール（サクラ感を完全に消すこと）】
    ・「とても」「本当に」「最近」という言葉は、わざとらしくなるため絶対に使用しないでください。
    ・「結論から言うと」「今回、」等のAI特有の堅苦しい表現は使用禁止。
    ・感情を抑え、事実だけを淡々と述べるドライなトーンにしてください。大げさな喜びや感動は不要です。
    ・短くてスパッとした一文（例：「仕上がりに満足。」「手際が良かった。」）を混ぜて、リアルな男性客が書いたような雰囲気を長文にならないように出してください。
    ・店名を書く際、「」や『』などの括弧は絶対に使用しないこと。
    
    【内容の構成と優先順位】
    ・お客様が選んだ「具体的に良かった点」を中心に、事実に基づいた体験談を書いてください。
    `;

    if (freeText.trim() !== "") {
      systemPrompt += `
    ・【最重要事項】お客様からの「一言感想」が入力されています。この一言感想の内容を一番のメインとして、自然な文脈で必ず反映してください。
      `;
    }

    if (lang === "ja") {
      systemPrompt += `
    ・地名（二条、大宮）や店名（BAR BER SHOP 髪座）は、無理に入れないでください。文脈として極めて自然にサラッと書ける場合のみ、たまに入れる程度で結構です。一切入っていなくても構いません。
    ・「理容室」や「${cutKeyword}」という言葉は、不自然にならない範囲で体験談の中に混ぜてください。
      `;
    } else {
      systemPrompt += `
    ・海外からの旅行者が日本（京都）を訪れた際のトーンで書いてください。ただし、過剰に興奮したトーンは避け、良かった事実をシンプルに伝える内容にしてください。
      `;
    }

    const userPrompt = `メニュー：${menuTexts.join(", ")}\n良かった点：${pointTexts.join(", ")}\n自由記述（一言感想）：${freeText}\n\nこの条件で、絶対にAIが書いたとバレない、ドライで人間らしい口コミを生成してください。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.75, // 感情のブレ（創造性）を少し抑えるために数値を下げました
    });

    let review = (response.choices[0]?.message?.content || "").trim();

    // AIが勝手につけた括弧をプログラムで強制的に削除する（最終防衛線）
    review = review.replace(/「BAR BER SHOP 髪座」/g, "BAR BER SHOP 髪座");
    review = review.replace(/『BAR BER SHOP 髪座』/g, "BAR BER SHOP 髪座");
    review = review.replace(/「髪座」/g, "髪座");
    review = review.replace(/『髪座』/g, "髪座");

    res.status(200).json({ review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
