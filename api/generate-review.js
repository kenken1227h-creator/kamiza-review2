const OpenAI = require("openai");

const MASTER = {
  menus: {
    m1: { ja: "メンズカット", en: "Men's Cut", ko: "남성 커트", zh_cn: "男士剪发", zh_tw: "男士剪髮" },
    m2: { ja: "スキンフェード", en: "Skin Fade", ko: "스킨 페이드", zh_cn: "渐变理发", zh_tw: "漸層理髮" },
    m3: { ja: "カラー", en: "Color", ko: "컬러", zh_cn: "染发", zh_tw: "染髮" },
    m4: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m5: { ja: "メッシュ", en: "Highlights", ko: "메쉬", zh_cn: "挑染", zh_tw: "挑染" },
    // 濡れパンは口コミでは「パーマ」として書く（AIに「濡れパン」という言葉は渡さない）
    m6: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" }
  },
  points: {
    p1: {
      ja: [
        "カウンセリングが丁寧",
        "ざっくりした注文でも意図を汲み取ってくれた",
        "髪質や骨格に合わせた提案をしてくれた",
        "細かい要望までしっかり聞いてくれた"
      ],
      en: "Careful counseling", ko: "꼼꼼한 상담", zh_cn: "细致的咨询", zh_tw: "仔細的諮詢"
    },
    p2: { ja: "希望通りの仕上がり", en: "Finish as imagined", ko: "원하던 스타일 완성", zh_cn: "符合预期的效果", zh_tw: "符合預期的效果" },
    p3: { ja: "手際が良くスピーディー", en: "Efficiency", ko: "빠르고 능숙함", zh_cn: "手法娴熟", zh_tw: "手法俐落" },
    p4: { ja: "落ち着いた接客", en: "Friendly atmosphere", ko: "편안한 분위기", zh_cn: "轻松的氛围", zh_tw: "輕鬆的氛圍" },
    p5: { ja: "駅からの近さ", en: "Close to the station", ko: "역에서 가까움", zh_cn: "离车站近", zh_tw: "離車站近" },
    p6: { ja: "落ち着く内装", en: "Relaxing interior", ko: "편안한 인테리어", zh_cn: "舒适的内饰", zh_tw: "舒適的裝潢" },
    p7: { ja: "シャンプーが快適", en: "Comfortable shampoo", ko: "시원한 샴푸", zh_cn: "舒适的洗发", zh_tw: "舒服的洗髮" }
  }
};

// 必ず本文に入れるキーワード（フェード・パーマ・メッシュ・濡れパン→パーマ）
const PERM_WORD = { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" };
const REQUIRED_KEYWORDS_MAP = {
  m2: { ja: "フェード", en: "Fade", ko: "페이드", zh_cn: "渐变", zh_tw: "漸層" },
  m4: PERM_WORD,
  m5: { ja: "メッシュ", en: "Highlights", ko: "메쉬", zh_cn: "挑染", zh_tw: "挑染" },
  m6: PERM_WORD
};

const LANG_NAMES = {
  ja: "日本語",
  en: "英語 (English)",
  ko: "韓国語 (Korean)",
  zh_cn: "簡体字中国語 (Simplified Chinese)",
  zh_tw: "繁体字中国語 (Traditional Chinese)"
};

// 文章に入っていない必須キーワードを返す（英語は大文字・小文字を区別しない）
function findMissing(text, keywords) {
  const lower = (text || "").toLowerCase();
  return keywords.filter(kw => !lower.includes(kw.toLowerCase()));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    // 対応していない言語が来たら日本語で作る
    const lang = LANG_NAMES[body.language] ? body.language : "ja";
    const selectedMenuIds = Array.isArray(body.menus) ? body.menus : [];
    const selectedPointIds = Array.isArray(body.points) ? body.points : [];

    // --- 良かった点のランダム間引き ---
    let finalPointIds = [...selectedPointIds];
    finalPointIds.sort(() => Math.random() - 0.5);

    if (finalPointIds.length > 3) {
      const randomCount = Math.floor(Math.random() * 2) + 2;
      finalPointIds = finalPointIds.slice(0, randomCount);
    } else if (finalPointIds.length === 3) {
      if (Math.random() < 0.3) {
        finalPointIds = finalPointIds.slice(0, 2);
      }
    }

    // ?. … 知らない番号（例：p8）が来てもエラーにせず、その項目だけ飛ばす
    const menuTexts = [...new Set(selectedMenuIds.map(m => MASTER.menus[m]?.[lang]).filter(Boolean))];
    const pointTexts = finalPointIds.map(p => {
      const val = MASTER.points[p]?.[lang];
      if (Array.isArray(val)) return val[Math.floor(Math.random() * val.length)];
      return val;
    }).filter(Boolean);

    const freeText = typeof body.freeText === "string" ? body.freeText : "";

    const hasSkinFade = selectedMenuIds.includes("m2");
    const hasSpeedy = finalPointIds.includes("p3");
    const cutKeyword = hasSkinFade ? "フェード" : "カット";

    // 選ばれたメニューから必須キーワードを取り出す
    const requiredKeywords = [...new Set(selectedMenuIds
      .map(id => REQUIRED_KEYWORDS_MAP[id]?.[lang])
      .filter(Boolean))];

    const targetLang = LANG_NAMES[lang];

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let systemPrompt = `
    あなたは理容室の顧客として、Googleマップに投稿する自然な口コミを作成します。

    【最重要出力ルール】
    出力する文章は、絶対に「${targetLang}」のみで記述してください。

    【多様性とランダム性の確保】
    ・提供された「良かった点」の中から、毎回ランダムに2〜3個だけをピックアップして文章化し、残りはあえて無視してください。
    ・過去の投稿と内容が被って怪しまれないよう、毎回「書き出しの言葉」「文章の順番」「語尾」を意図的にバラバラに変化させてください。

    【文体と長さの絶対的な指定】
    長文や、AI特有の「結論から言うと」といった堅苦しい表現は絶対に使用禁止です。
    主語（スタッフ、理容師など）は極力省き、短くてスパッとした、無駄のない自然な大人の文章にしてください。

    【状況の捏造禁止に関する重要ルール】
    ・【初来店の制限】入力された「一言感想」に「初めて」等の言葉がない限り、「初めて行った」等とは絶対に書かないこと。
    ・【次回来店の制限】入力された「一言感想」に「また来ます」等の言葉がない限り、「また利用します」等とは絶対に書かないこと。
    `;

    if (hasSpeedy) {
      systemPrompt += `\n・【禁止事項】手際の良さに触れる際、「待ち時間も少なく」や「時間がないときに助かる」といった表現は絶対に使わないでください。`;
    }
    if (hasSkinFade) {
      systemPrompt += `\n・【フェードに関する表現ルール】「フェードが綺麗」「フェードが上手い」など、シンプルで自然な言葉を使ってください。`;
    }
    if (freeText.trim() !== "") {
      systemPrompt += `\n・【最重要事項】お客様からの「一言感想」が入力されています。この内容や感情を文章の「最優先の主軸」として必ず取り入れてください。`;
    }
    if (requiredKeywords.length > 0) {
      systemPrompt += `\n・【必須キーワード】「${requiredKeywords.join("」「")}」という言葉を必ず本文中に各1回だけ自然に含めてください。箇条書きやメニュー名の羅列は避け、感想の中に自然に混ぜてください。`;
    }

    if (lang === "ja") {
      systemPrompt += `\n・地名（二条、大宮）や店名（BAR BER SHOP 髪座）は無理に入れず、極めて自然に入れられる場合に限りたまに使用する程度にしてください。「理容室」や「${cutKeyword}」という言葉は、不自然にならない範囲で混ぜてください。`;
    } else {
      systemPrompt += `\n・海外からの旅行者が日本（京都）を訪れた際のトーンで書いてください。過剰に興奮したトーンは避け、良かった事実をシンプルに伝えてください。`;
    }

    const userPrompt = `メニュー：${menuTexts.join(", ")}\n良かった点：${pointTexts.join(", ")}\n自由記述（一言感想）：${freeText}\n\n絶対にAIが書いたとバレない、短くドライでリアルな口コミを生成してください。必ず「${targetLang}」だけで出力してください。`;

    const generate = async (extraPrompt = "") => {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt + extraPrompt }
        ],
        temperature: 0.85,
      });
      // 念のため：「濡れパン」と書かれていたら「パーマ」に置き換えてからチェックする
      return (response.choices[0]?.message?.content || "").trim().replace(/濡れパン/g, "パーマ");
    };

    let review = await generate();

    // 必須キーワードが抜けていたら1回だけやり直し、良くなった時だけ採用する
    if (requiredKeywords.length > 0) {
      const missingKeywords = findMissing(review, requiredKeywords);

      if (missingKeywords.length > 0) {
        const retryPrompt = `\n\n【再生成の指示】先ほどの文章には必須キーワード「${missingKeywords.join("」「")}」が含まれていませんでした。これらを必ず含めて、もう一度自然な口コミを書き直してください。`;
        const retry = await generate(retryPrompt);

        if (retry && findMissing(retry, requiredKeywords).length < missingKeywords.length) {
          review = retry;
        }
      }
    }

    // 1回目もやり直しも空だった場合はエラーとして返す
    if (!review) {
      return res.status(500).json({ error: "Empty review" });
    }

    review = review.replace(/「BAR BER SHOP 髪座」/g, "BAR BER SHOP 髪座");
    review = review.replace(/『BAR BER SHOP 髪座』/g, "BAR BER SHOP 髪座");
    review = review.replace(/「髪座」/g, "髪座");
    review = review.replace(/『髪座』/g, "髪座");

    return res.status(200).json({ review });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
