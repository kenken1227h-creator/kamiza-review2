const OpenAI = require("openai");

const MASTER = {
  menus: { m1: "メンズカット", m2: "スキンフェード", m3: "カラー", m4: "パーマ", m5: "メッシュ", m6: "濡れパン" },
  points: {
    p1: "カウンセリングが丁寧", p2: "希望通りの仕上がり", p3: "手際が良くスピーディー",
    p4: "落ち着いた接客", p5: "二条駅・大宮駅からのアクセスが良い",
    p6: "渋くてかっこいい店の雰囲気", p7: "シャンプーが気持ちいい"
  }
};

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const body = JSON.parse(event.body);
    const menuTexts = (body.menus || []).map(m => MASTER.menus[m]).filter(Boolean);
    const pointTexts = (body.points || []).map(p => MASTER.points[p]).filter(Boolean);
    const freeText = body.freeText || "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `
    あなたは理容室「BAR BER SHOP 髪座」の常連客、または新規客として自然な口コミを書くガイドです。
    
    【重要：誇張の禁止】
    ・「最高すぎる」「感動の嵐」「宇宙一」のような大げさな表現は絶対に避けてください。
    ・「良かった」「満足」「また行きたい」程度の、落ち着いた大人のトーンで書いてください。
    ・サクラやAIだと思われないよう、淡々と事実を述べるスタイルが好ましいです。
    ・MEO対策として「二条」「理容室」「フェード」という言葉を自然に1回ずつ混ぜてください。

    【構成】
    1. 施術内容の報告
    2. 選んだ「良かった点」の紹介
    3. 締めの一言（シンプルに）
    `;

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
      temperature: 0.7, // 少し値を下げることで、無難で堅実な文章になります
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
