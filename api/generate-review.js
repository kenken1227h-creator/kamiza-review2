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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  
  try {
    // Vercelのお作法に合わせてデータを読み込む
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
    ・店名（BAR BER SHOP 髪座、髪座など）を書く際、「」や『』などの括弧は絶対に使用しないでください。
    ・「結論として」「まとめると」「特筆すべき点は」「〜にお伺いしました」などの、AI特有の堅苦しい表現は絶対に使用禁止です。
    ・箇条書きは禁止です。一つの自然な文章の流れとして書いてください。
    ・実際の人間がスマホでパッと打ったような、少しラフでリアルな温度感のある文章にしてください。
    ・短くてスパッとした文（例：「とても良いバーバーでした。」「ご丁寧で気持ちいい。」）や、少し感情的な文（例：「想像以上の仕上がりに嬉しかったです。」）を混ぜてリアルさを出してください。
    `;

    if (lang === "ja") {
      systemPrompt += `
    ・MEO対策として「二条」か「大宮」の地名と、「理容室」「${cutKeyword}」を文章に含めてください。
    ・【超重要】地名やキーワードは検索対策っぽくならないよう、極めて自然に溶け込ませてください。
      例：「二条で${cutKeyword}の上手い理容室を探していて…」
      例：「大宮エリアにある歴史のありそうな理容室です。」
      例：「京都に来たので二条の理容室でお願いしました。」
      `;
    } else {
      systemPrompt += `
    ・海外からの旅行者が日本（京都）を訪れて、素晴らしい体験をしたときのトーンで書いてください。
    ・少し感動を表現したり、「京都に来たらまた行きます」「日本で最高の技術でした」といったフレンドリーな内容を含めると自然です。
      `;
    }

    const userPrompt = `メニュー：${menuTexts.join(", ")}\n良かった点：${pointTexts.join(", ")}\n自由記述：${freeText}\n\nこの条件で、本物の人間が書いたような自然な口コミを生成してください。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.8,
    });

    let review = (response.choices[0]?.message?.content || "").trim();

    // AIが勝手につけた括弧をプログラムで強制的に削除する
    review = review.replace(/「BAR BER SHOP 髪座」/g, "BAR BER SHOP 髪座");
    review = review.replace(/『BAR BER SHOP 髪座』/g, "BAR BER SHOP 髪座");
    review = review.replace(/「髪座」/g, "髪座");
    review = review.replace(/『髪座』/g, "髪座");

    res.status(200).json({ review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
