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
    p6: { ja: "落ち着く内装", en: "Relaxing interior", ko: "편안한 인테리어", zh_cn: "舒适的内饰", zh_tw: "舒適的裝潢" },
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
    const selectedPointIds = body.points || [];
    const menuTexts = selectedMenuIds.map(m => MASTER.menus[m][lang]).filter(Boolean);
    const pointTexts = selectedPointIds.map(p => MASTER.points[p][lang]).filter(Boolean);
    const freeText = body.freeText || "";

    const hasSkinFade = selectedMenuIds.includes("m2");
    const hasSpeedy = selectedPointIds.includes("p3");
    const cutKeyword = hasSkinFade ? "フェード" : "カット";

    const langNames = {
      ja: "日本語",
      en: "英語 (English)",
      ko: "韓国語 (Korean)",
      zh_cn: "簡体字中国語 (Simplified Chinese)",
      zh_tw: "繁体字中国語 (Traditional Chinese)"
    };
    const targetLang = langNames[lang];

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let systemPrompt = `
    あなたは理容室の顧客として、Googleマップに投稿する自然な口コミを作成します。
    
    【最重要出力ルール】
    出力する文章は、絶対に「${targetLang}」のみで記述してください。
    
    【文体と長さの絶対的な指定（以下の例に完全に寄せること）】
    長文や、AI特有の「結論から言うと」「〜という印象です」といった堅苦しい表現は絶対に使用禁止です。
    主語（スタッフ、理容師など）は極力省き、以下の例文のような短くてスパッとした、無駄のない自然な文章にしてください。

    ＜理想の出力例（このトーンと長さを厳守）＞
    ・希望通りの仕上がりで満足。カットも丁寧で安心できた。
    ・カウンセリングが丁寧で、細かい要望もしっかり聞いてくれた。フェードが綺麗で仕上がりもとてもいい。落ち着く内装でリラックスできる空間だった。
    ・手際が良くスピーディー。カラーとパーマをお願いしたが、手早くスムーズに進めてくれた。仕上がりも思い通りで満足。
    ・初めて利用したが、落ち着いた接客で居心地が良かった。カットの仕上がりも大満足。
    ・メッシュの仕上がりが想像以上で大満足。シャンプーがとても気持ちよくてリラックスできた。また来ます！
    ・初めての濡れパンだったが、最高だった。フェードが上手く、希望通りのスタイルになった。駅から近くアクセスも良いのでまた行きます。

    【状況の捏造禁止に関する重要ルール】
    ・【初来店の制限】入力された「一言感想」に「初めて」等の初来店を意味する言葉がない限り、「初めて行った」等とは絶対に書かないこと。
    ・【次回来店の制限】入力された「一言感想」に「また来ます」等のリピート意欲がない限り、「また利用します」等とは絶対に書かないこと。一言感想の意思を最も重視する。
    `;

    if (hasSpeedy) {
      systemPrompt += `
    ・【禁止事項】手際の良さに触れる際、「待ち時間も少なく」や「時間がないときに助かる」といった表現は絶対に使わないでください。
      `;
    }
    
    if (hasSkinFade) {
      systemPrompt += `
    ・【フェードに関する表現ルール】「フェードが綺麗」「フェードが上手い」など、シンプルで自然な言葉を使ってください。
      `;
    }

    if (freeText.trim() !== "") {
      systemPrompt += `
    ・【最重要事項】お客様からの「一言感想」が入力されています。この内容や感情を文章の「主軸」として自然に取り入れてください。
      `;
    }

    if (lang === "ja") {
      systemPrompt += `
    ・地名（二条、大宮）や店名（BAR BER SHOP 髪座）は、基本的には無理に入れなくて構いません。極めて自然に入れられる場合に限り、たまに使用する程度にしてください。
    ・「理容室」や「${cutKeyword}」という言葉は、不自然にならない範囲で混ぜてください。
      `;
    } else {
      systemPrompt += `
    ・海外からの旅行者が日本（京都）を訪れた際のトーンで書いてください。過剰に興奮したトーンは避け、良かった事実をシンプルに伝えてください。
      `;
    }

    const userPrompt = `メニュー：${menuTexts.join(", ")}\n良かった点：${pointTexts.join(", ")}\n自由記述（一言感想）：${freeText}\n\nこの条件で、先ほどの「理想の出力例」のような、短くドライでリアルな口コミを生成してください。必ず「${targetLang}」だけで出力してください。`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      temperature: 0.7, 
    });

    let review = (response.choices[0]?.message?.content || "").trim();

    review = review.replace(/「BAR BER SHOP 髪座」/g, "BAR BER SHOP 髪座");
    review = review.replace(/『BAR BER SHOP 髪座』/g, "BAR BER SHOP 髪座");
    review = review.replace(/「髪座」/g, "髪座");
    review = review.replace(/『髪座』/g, "髪座");

    res.status(200).json({ review });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
