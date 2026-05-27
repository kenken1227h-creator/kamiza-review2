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

    let systemPrompt = `
    あなたは理容室のリアルな顧客として、Googleマップに投稿する自然な口コミを作成します。
    指定された言語（${lang}）で出力してください。

    【絶対的なルール（AIっぽさを完全に消すこと）】
    ・「結論から言うと」「今回、」「〜という印象です」「特筆すべき点は」「〜にお伺いしました」といった、AI特有の堅苦しく優等生すぎる表現やレポートのような書き出しは絶対に使用禁止です。
    ・箇条書きは禁止です。
    ・実際の人間がスマホでパッと打ったような、少しラフでリアルな温度感のある文章にしてください。短くてスパッとした一文を混ぜるのがコツです。
    ・必ず文章のどこかに「BAR BER SHOP 髪座」という店名を含めてください。
    ・店名を書く際、「」や『』などの括弧は絶対に使用しないでください。
    `;

    if (lang === "ja") {
      systemPrompt += `
    ・MEO対策として「二条」または「大宮」のいずれかの地名と、「理容室」「${cutKeyword}」を文章に含めてください。
    ・【超重要】地名は文章の冒頭で唐突に出すのではなく、文の途中（中盤）の自然な文脈に溶け込ませてください。
      良い例：「家から近い二条周辺で${cutKeyword}が上手い理容室を探していて、BAR BER SHOP 髪座を見つけました。」
      良い例：「大宮エリアで通いやすいお店を探していたので、大満足です。」
      `;
    } else {
      systemPrompt += `
    ・海外からの旅行者が日本（京都）を訪れて、素晴らしい体験をしたときのトーンで書いてください。
    ・少し感動を表現したり、「京都に来たらまた行きます」「日本で最高の技術でした」といったフレンドリーな内容を含めると自然です。
      `;
    }

    const userPrompt = `メニュー：${menuTexts.join(", ")}\n良かった点：${pointTexts.join(", ")}\n自由記述：${freeText}\n\nこの条件で、絶対にAIが書いたとバレない本物の人間のような口コミを生成してください。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.85, 
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
