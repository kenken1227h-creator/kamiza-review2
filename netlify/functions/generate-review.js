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

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body);
    const lang = body.language || "ja";
    const menuTexts = (body.menus || []).map(m => MASTER.menus[m][lang]).filter(Boolean);
    const pointTexts = (body.points || []).map(p => MASTER.points[p][lang]).filter(Boolean);
    const freeText = body.freeText || "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // AIへの指示書
    let systemPrompt = `
    あなたは理容室「BAR BER SHOP 髪座」の常連客、または新規客として自然な口コミを書くガイドです。
    必ず指定された言語（${lang}）で出力してください。

    【重要：誇張の禁止】
    ・「最高すぎる」「感動の嵐」のような大げさな表現は絶対に避けてください。
    ・「良かった」「満足」「また行きたい」程度の、落ち着いた大人のトーンで書いてください。
    ・サクラやAIだと思われないよう、淡々と事実を述べるスタイルが好ましいです。
    ・箇条書きは使わず、自然な文章にしてください。
    `;

    // 日本語の場合のみ、MEO対策キーワードを狙う
    if (lang === "ja") {
      systemPrompt += `
    ・MEO対策として「二条」「理容室」「フェード」という言葉を、不自然にならないように文脈に合わせて自然に混ぜてください（無理に全て入れなくてもよい）。
      `;
    }

    const userPrompt = `
    条件：
    ・メニュー：${menuTexts.join(", ")}
    ・良かった点：${pointTexts.join(", ")}
    ・自由記述：${freeText}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ review: response.choices[0].message.content.trim() }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
