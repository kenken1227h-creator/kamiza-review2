// api/generate-review.js
// BAR BER SHOP 髪座 口コミ下書き生成（Vercel Serverless Function）
// POST /api/generate-review
// 受け取るデータ: { language, visit, occasion, menus[], points[], freeText }

const OpenAI = require("openai");

const MAX_FREETEXT_LENGTH = 200;
const LANGS = ["ja", "en", "ko", "zh_cn", "zh_tw"];

const SHOP = {
  ja: { name: "BAR BER SHOP 髪座", desc: "京都・二条駅／大宮駅から歩いて行ける理容室" },
  en: { name: "BAR BER SHOP Kamiza", desc: "a barbershop in Kyoto, within walking distance of Nijo and Omiya stations" },
  ko: { name: "BAR BER SHOP 카미자", desc: "교토 니조역·오미야역에서 걸어갈 수 있는 이용실" },
  zh_cn: { name: "BAR BER SHOP 髪座", desc: "位于京都二条站／大宫站步行可达的理发店" },
  zh_tw: { name: "BAR BER SHOP 髪座", desc: "位於京都二條站／大宮站步行可達的理髮店" },
};

const MASTER = {
  // メニューは4つ：カット／フェード／パーマ／カラー
  // （パーマは濡れパンを含む全種類、カラーはメッシュを含めて一括り。顔そりは扱わない）
  menus: {
    m1: { ja: "カット", en: "Haircut", ko: "커트", zh_cn: "剪发", zh_tw: "剪髮" },
    m2: { ja: "フェード", en: "Fade", ko: "페이드", zh_cn: "渐变", zh_tw: "漸層" },
    m3: { ja: "カラー", en: "Color", ko: "컬러", zh_cn: "染发", zh_tw: "染髮" },
    m4: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
  },
  // 選ばれたメニューは、この言葉を口コミに必ず入れる
  mustWords: {
    m1: { ja: "カット", en: "cut", ko: "커트", zh_cn: "剪发", zh_tw: "剪髮" },
    m2: { ja: "フェード", en: "fade", ko: "페이드", zh_cn: "渐变", zh_tw: "漸層" },
    m3: { ja: "カラー", en: "color", ko: "컬러", zh_cn: "染发", zh_tw: "染髮" },
    m4: { ja: "パーマ", en: "perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
  },
  // 古い画面（スマホに残った前のページ）から届く番号の読みかえ
  legacyMenus: { m5: "m3", m6: "m4" },
  // 来店回数（文章の書き分けに使う）
  visits: {
    v1: { ja: "初めての来店", en: "first visit", ko: "첫 방문", zh_cn: "第一次来", zh_tw: "第一次來" },
    v2: { ja: "何度か来店している", en: "has visited a few times", ko: "몇 번 방문함", zh_cn: "来过几次", zh_tw: "來過幾次" },
    v3: { ja: "いつも通っている常連", en: "a regular customer", ko: "단골", zh_cn: "常客", zh_tw: "常客" },
  },
  // 今回のきっかけ（文章の書き分けに使う）
  occasions: {
    o1: { ja: "髪が伸びてきたから", en: "my hair had grown out", ko: "머리가 길어져서", zh_cn: "头发长长了", zh_tw: "頭髮長長了" },
    o2: { ja: "仕事や就活に向けて整えたくて", en: "wanted to look sharp for work or job hunting", ko: "일이나 취업 준비 때문에 정리하려고", zh_cn: "为了工作或求职想整理一下", zh_tw: "為了工作或求職想整理一下" },
    o5: { ja: "旅行中に立ち寄った", en: "stopped by while traveling", ko: "여행 중에 들름", zh_cn: "旅行途中顺路来", zh_tw: "旅行途中順路來" },
    o6: { ja: "イメチェンしたくて", en: "wanted a new look", ko: "이미지 변신하고 싶어서", zh_cn: "想换个造型", zh_tw: "想換個造型" },
    o7: { ja: "大切な予定の前に整えたくて", en: "wanted to tidy up before something important", ko: "중요한 일정 앞두고 정리하려고", zh_cn: "重要安排前想整理一下", zh_tw: "重要行程前想整理一下" },
  },
  // 古い画面から届くきっかけの番号の読みかえ（結婚式・イベント→大切な予定。気分転換は使わない）
  legacyOccasions: { o3: "o7" },


  // 良かった点（お店の言い方ではなく、お客様が話すときの言い方で渡す。毎回1つを選ぶ）
  points: {
    p1: {
      ja: ["ざっくり頼んでも、ちゃんと汲み取ってくれた", "話をよく聞いてくれた", "髪質に合わせて提案してくれた"],
      en: ["got what I wanted even from a rough description", "really listened to what I wanted"],
      ko: ["대충 말해도 잘 알아들어 줬다", "원하는 걸 잘 들어 줬다"],
      zh_cn: ["随口说说也能明白我要什么", "很认真听我的要求"],
      zh_tw: ["隨口說說也能懂我要什麼", "很認真聽我的需求"],
    },
    p2: {
      ja: ["思ってた感じに仕上がった", "イメージ通りになった", "頼んだ感じにしてもらえた"],
      en: ["came out just how I pictured it", "looks exactly how I wanted"],
      ko: ["생각했던 느낌 그대로 나왔다", "원하던 대로 됐다"],
      zh_cn: ["剪出来跟想的一样", "效果就是我想要的"],
      zh_tw: ["剪出來跟想的一樣", "效果就是我想要的"],
    },
    p3: {
      ja: ["手際がよくて早かった", "テキパキしてて待たされなかった"],
      en: ["quick and efficient", "didn't take long at all"],
      ko: ["손이 빠르고 능숙했다", "오래 걸리지 않았다"],
      zh_cn: ["动作很利落", "没花多少时间"],
      zh_tw: ["動作很俐落", "沒花多少時間"],
    },
    p4: {
      ja: ["気さくで話しやすかった", "接客が落ち着いてて居心地がいい"],
      en: ["easy to talk to", "friendly and relaxed"],
      ko: ["편하게 대화할 수 있었다", "친절하고 편안했다"],
      zh_cn: ["很好聊", "态度亲切"],
      zh_tw: ["很好聊", "態度親切"],
    },
    p5: {
      ja: ["二条駅から歩いてすぐ", "大宮駅からも歩いて行ける"],
      en: ["a short walk from Nijo Station", "walkable from Omiya Station"],
      ko: ["니조역에서 걸어서 금방", "오미야역에서도 걸어갈 수 있다"],
      zh_cn: ["从二条站走过去很近", "从大宫站也能走到"],
      zh_tw: ["從二條站走過去很近", "從大宮站也能走到"],
    },
    p6: {
      ja: ["店内が落ち着く", "雰囲気がよくて居心地がいい"],
      en: ["nice, calm atmosphere", "the shop feels relaxed"],
      ko: ["가게 분위기가 편안하다", "인테리어가 차분하다"],
      zh_cn: ["店里氛围很放松", "环境很舒服"],
      zh_tw: ["店裡氣氛很放鬆", "環境很舒服"],
    },
    p7: {
      ja: ["シャンプーが気持ちよかった", "シャンプーがうまい"],
      en: ["the shampoo felt great", "great shampoo"],
      ko: ["샴푸가 시원했다", "샴푸가 기분 좋았다"],
      zh_cn: ["洗头很舒服", "洗发很舒服"],
      zh_tw: ["洗頭很舒服", "洗髮很舒服"],
    },
  },
};

// ===== 口コミの長さ（毎回ランダムに選ぶ。短い口コミが一番人間らしい）=====
const LENGTHS = {
  ja: ["40〜90文字くらいの短め", "90〜160文字くらい", "160〜240文字くらいの少し長め"],
  en: ["about 15–35 words, short", "about 35–70 words", "about 70–110 words"],
  ko: ["40~90자 정도로 짧게", "90~160자 정도", "160~240자 정도로 조금 길게"],
  zh_cn: ["30–60字左右，简短", "60–110字左右", "110–170字左右，稍长"],
  zh_tw: ["30–60字左右，簡短", "60–110字左右", "110–170字左右，稍長"],
};
const LENGTH_WEIGHTS = [0.45, 0.4, 0.15];

// ===== AIがやりがちな言い回し（入っていたら書き直させる）=====
const BANNED = {
  ja: ["お世話になっ", "大満足", "心地よ", "はもちろん", "おすすめです", "オススメです", "ぜひ", "利用したいと思います", "通い続けたい", "リラックスできる時間", "本当に感謝", "アクセスしやすい", "丁寧なカウンセリング", "希望通りの仕上がり", "素晴らしい", "結論として", "総じて", "スタイリスト", "ちゃった", "ウトウト", "ほんとに"],
  en: ["highly recommend", "top-notch", "exceeded my expectations", "look no further", "hidden gem", "impeccable", "a must-visit"],
  ko: ["강력 추천", "최고의 경험", "기대 이상"],
  zh_cn: ["强烈推荐", "超出预期", "宝藏"],
  zh_tw: ["強烈推薦", "超出預期", "寶藏"],
};

// ===== System Prompt（言語別）=====
const SYSTEM_PROMPTS = {
  ja: `あなたは、京都の理容室で髪を切ってもらったばかりのお客様です。帰り道にスマホで、Googleマップに口コミをさっと書きます。

【書き方】
- 書き手は、ごく普通の男性のお客様。落ち着いた、あっさりした文体で書く
- 基本は「です・ます」か、そっけないくらいの普通の言い切り（「〜だった」「〜と思う」）
- 「！」は使っても1回まで。「〜しちゃった」「〜だな！」「ほんとに」など、甘えた感じや大げさなノリの言い回しはしない
- 渡された材料を全部使わなくていい。印象に残ったことを1〜2個だけ書く
- 「お客様の一言」があるときは、その内容を文章の中心にする。言葉はほぼそのまま地の文として使い、かぎ括弧（「」『』""）で囲まない
- 一言がくだけていても、文章全体は普通の大人の口コミの範囲でくだけさせる程度にする
- 長さは指定に従う。短いときは改行しない
- 渡された情報だけで書く。受けていない施術、なかった出来事、気持ちの描写（寝てしまった、感動した等）を作らない
- 担当者を書くときは「担当の方」「店員さん」などにする。「スタイリストさん」とは書かない

【使わない言い回し】
- 「いつもお世話になっています」などのビジネスメールの書き出し
- 「大満足」「心地よい」「〜はもちろん」「素晴らしい」「リラックスできる時間」「本当に感謝」
- 「おすすめです」「ぜひ」「また利用したいと思います」「通い続けたいと思います」などの決まった締め
- 「丁寧なカウンセリング」「希望通りの仕上がり」「アクセスしやすい」などのお店の宣伝のような言葉
- 「結論として」「総じて」などの機械的なまとめ言葉

【お店のルール】
- 店名を書くときは「髪座」または「BAR BER SHOP 髪座」。括弧で囲まない。店名は書かなくてもいい
- 出力は口コミ本文のみ。前置きや説明は書かない`,

  en: `You just got a haircut at a barbershop in Kyoto, Japan. On your way out you quickly write a Google Maps review on your phone.

[How to write]
- Don't try to write well. Write the way you'd text a friend.
- You don't need to use every detail. Mention only 1–2 things that stuck with you.
- If the customer's own comment is given, it is the heart of the review. Match its tone and energy (casual, joking, polite) across the whole review, keep it nearly as-is, and make it flow.
- Follow the requested length. No line breaks for short reviews.
- Use only the facts given. Don't invent services or events.
- Avoid stock phrases: "highly recommend", "top-notch", "exceeded my expectations", "hidden gem", "look no further", "a must-visit".
- If you name the shop, never put it in quotes or brackets. You don't have to name it.
- Output only the review body.`,

  ko: `당신은 교토의 이용실에서 방금 머리를 자른 손님입니다. 돌아가는 길에 휴대폰으로 구글 지도 리뷰를 빠르게 씁니다.

【쓰는 법】
- 잘 쓰려고 하지 말고, 친구에게 말하듯 편하게 쓴다
- 받은 정보를 다 쓸 필요 없다. 기억에 남은 것 1~2개만
- 손님 본인의 한마디가 있으면 그것이 중심. 말투와 텐션을 한마디에 맞추고, 거의 그대로 살려 자연스럽게 잇는다
- 지정된 길이를 따른다. 짧으면 줄바꿈 없이
- 제공된 정보만으로 쓴다. 없던 시술이나 일을 지어내지 않는다
- "강력 추천", "최고의 경험", "기대 이상" 같은 상투적 표현 금지
- 가게 이름을 쓸 때 따옴표나 괄호로 감싸지 않는다. 가게 이름은 안 써도 된다
- 리뷰 본문만 출력`,

  zh_cn: `你刚在京都一家理发店剪完头发，回去的路上用手机在 Google 地图上随手写个评价。

【写法】
- 不用刻意写好，像跟朋友聊天一样随意
- 不需要用上所有信息，只写印象最深的1–2点
- 如果有顾客自己的话，那就是重点。整篇的语气和情绪要跟那句话一致，基本原样保留并自然衔接
- 按指定长度写，短的不要换行
- 只根据提供的信息写，不要编造
- 不要用"强烈推荐""超出预期""宝藏店"之类的套话
- 写店名时不加引号或括号，也可以不写店名
- 只输出评价正文`,

  zh_tw: `你剛在京都一家理髮店剪完頭髮，回去的路上用手機在 Google 地圖上隨手寫個評論。

【寫法】
- 不用刻意寫好，像跟朋友聊天一樣隨意
- 不需要用上所有資訊，只寫印象最深的1–2點
- 如果有顧客自己的話，那就是重點。整篇的語氣和情緒要跟那句話一致，基本原樣保留並自然銜接
- 按指定長度寫，短的不要換行
- 只根據提供的資訊寫，不要編造
- 不要用「強烈推薦」「超出預期」「寶藏店」之類的套話
- 寫店名時不加引號或括號，也可以不寫店名
- 只輸出評論本文`,
};

// ===== 小さな道具 =====
const pickLabel = (entry, lang) => {
  if (!entry) return null;
  const v = entry[lang];
  if (Array.isArray(v)) return v[Math.floor(Math.random() * v.length)];
  return v || null;
};

const unique = (arr) => [...new Set(arr.filter(Boolean))];

const MAX_ATTEMPTS = 3; // 最初の1回＋書き直し最大2回

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const pickLength = (lang) => {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < LENGTH_WEIGHTS.length; i++) {
    acc += LENGTH_WEIGHTS[i];
    if (r < acc) return LENGTHS[lang][i];
  }
  return LENGTHS[lang][0];
};

// 使ってはいけない言い回しが入っていないか
const bannedFound = (text, lang) => {
  const t = text.toLowerCase();
  const found = (BANNED[lang] || []).filter((w) => t.includes(w.toLowerCase()));
  // 日本語は「！」の多用もはねる（ノリが軽くなりすぎるため）
  if (lang === "ja" && (text.match(/[！!]/g) || []).length > 1) found.push("！を2回以上");
  return found;
};

// かぎ括弧・引用符を外す（お客様の一言を「」で囲むなど、普通の口コミでは不自然なため）
function stripQuotes(text) {
  return text
    .replace(/[「『]([^「」『』\n]{1,60})[」』]/g, "$1")
    .replace(/[“"]([^“”"\n]{1,60})[”"]/g, "$1");
}

// 本文に入っていない「必ず入れる言葉」を返す（英語は大文字・小文字を区別しない）
const missingWords = (text, words) => {
  const t = text.toLowerCase();
  return words.filter((w) => !t.includes(w.toLowerCase()));
};

// 店名のまわりの括弧を消す（AIが勝手につけた場合の保険）
function stripShopBrackets(text) {
  const names = ["BAR BER SHOP 髪座", "BAR BER SHOP Kamiza", "BAR BER SHOP 카미자", "髪座", "Kamiza", "카미자"];
  let out = text;
  for (const n of names) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`[「『【〈《“"']\\s*${esc}\\s*[」』】〉》”"']`, "g"), n);
  }
  return out;
}

// ===== User Prompt ビルダ =====
// 材料は「使ってもいい情報」として渡し、全部を盛り込ませない
function buildUserPrompt(lang, d) {
  const L = {
    ja: { head: "口コミを1つ書いてください。", len: "長さ", menu: "受けたメニュー（この言葉は必ず自然に入れる）", visit: "来店回数", occ: "きっかけ", pts: "印象に残ったこと", area: "お店の場所（話の流れに合うときだけ触れる）", free: "お客様の一言（文章の中心にする。かぎ括弧で囲まない）", tail: "口コミ本文のみを出力してください。", sep: "、", areaText: "京都の二条駅・大宮駅の近く" },
    en: { head: "Write one review.", len: "Length", menu: "Services received (these words must appear naturally)", visit: "Visits", occ: "Why I came", pts: "What stuck with me", area: "Location (mention only if it fits)", free: "Customer's own comment (the heart of the review — match its tone)", tail: "Output only the review body.", sep: ", ", areaText: "near Nijo and Omiya stations in Kyoto" },
    ko: { head: "리뷰를 하나 써 주세요.", len: "길이", menu: "받은 시술(이 단어는 반드시 자연스럽게 포함)", visit: "방문 횟수", occ: "계기", pts: "기억에 남은 것", area: "가게 위치(흐름에 맞을 때만)", free: "손님 본인의 한마디(중심. 말투를 맞출 것)", tail: "리뷰 본문만 출력하세요.", sep: ", ", areaText: "교토 니조역·오미야역 근처" },
    zh_cn: { head: "请写一则评价。", len: "长度", menu: "做的项目（这些词必须自然出现）", visit: "来店次数", occ: "来的原因", pts: "印象深的地方", area: "店的位置（顺口时才提）", free: "顾客自己的话（重点，语气要一致）", tail: "只输出评价正文。", sep: "、", areaText: "京都二条站、大宫站附近" },
    zh_tw: { head: "請寫一則評論。", len: "長度", menu: "做的項目（這些詞必須自然出現）", visit: "來店次數", occ: "來的原因", pts: "印象深的地方", area: "店的位置（順口時才提）", free: "顧客自己的話（重點，語氣要一致）", tail: "只輸出評論本文。", sep: "、", areaText: "京都二條站、大宮站附近" },
  }[lang];

  const shopLabel = { ja: "お店", en: "Shop", ko: "가게", zh_cn: "店名", zh_tw: "店名" }[lang];
  const lines = [L.head, "", `- ${shopLabel}: ${SHOP[lang].name}`, `- ${L.len}: ${d.length}`, `- ${L.menu}: ${d.mustWords.join(L.sep)}`];
  if (d.visit) lines.push(`- ${L.visit}: ${d.visit}`);
  if (d.occasion) lines.push(`- ${L.occ}: ${d.occasion}`);
  if (d.points.length) lines.push(`- ${L.pts}: ${d.points.join(L.sep)}`);
  if (d.showArea) lines.push(`- ${L.area}: ${L.areaText}`);
  if (d.freeText) lines.push(`- ${L.free}: ${d.freeText}`);
  if (d.retryNote) lines.push("", d.retryNote);
  lines.push("", L.tail);
  return lines.join("\n");
}

// ===== ハンドラ本体（Vercel形式）=====
module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "Invalid JSON" }); }
  }
  body = body || {};

  const lang = LANGS.includes(body.language) ? body.language : "ja";
  const menuIds = Array.isArray(body.menus)
    ? unique(body.menus.map((id) => MASTER.legacyMenus[id] || id).filter((id) => MASTER.menus[id]))
    : [];
  const pointIds = Array.isArray(body.points) ? body.points.filter((id) => MASTER.points[id]) : [];

  if (menuIds.length === 0) {
    return res.status(400).json({ error: "menus is required" });
  }

  const freeText = typeof body.freeText === "string"
    ? body.freeText.replace(/[\r\n]+/g, " ").replace(/[<>]/g, "").trim().slice(0, MAX_FREETEXT_LENGTH)
    : "";

  // 良かった点は最大2つだけ（全部盛り込むとチェックリストの読み上げになるため）
  const chosenPoints = shuffle(pointIds).slice(0, 2);
  // 地名は「駅から近い」を選んだ人か、4割くらいの確率でだけ渡す（毎回入ると不自然なため）
  const showArea = !chosenPoints.includes("p5") && (pointIds.includes("p5") || Math.random() < 0.4);

  const data = {
    length: pickLength(lang),
    // 来店回数・きっかけは半分くらいの確率で渡す（毎回書くと型にはまるため）
    visit: Math.random() < 0.5 ? pickLabel(MASTER.visits[body.visit], lang) : null,
    occasion: Math.random() < 0.5 ? pickLabel(MASTER.occasions[MASTER.legacyOccasions[body.occasion] || body.occasion], lang) : null,
    points: unique(chosenPoints.map((id) => pickLabel(MASTER.points[id], lang))),
    showArea,
    mustWords: unique(menuIds.map((id) => pickLabel(MASTER.mustWords[id], lang))),
    freeText,
    retryNote: "",
  };

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set");
    return res.status(500).json({ error: "Server is not configured" });
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // AIが「必ず入れる言葉」を落とすことがあるので、
    // 書き上がった文章を確認し、抜けていたら最大2回まで書き直させる
    let review = "";
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPTS[lang] },
          { role: "user", content: buildUserPrompt(lang, data) },
        ],
        temperature: 0.9,
        top_p: 0.95,
        presence_penalty: 0.6,
        frequency_penalty: 0.3,
        max_tokens: 600,
      });

      const text = stripQuotes(stripShopBrackets((completion.choices[0]?.message?.content || "").trim()));
      if (!text) continue;
      review = text;
      const missing = missingWords(review, data.mustWords);
      const banned = bannedFound(review, lang);
      if (missing.length === 0 && banned.length === 0) break;
      // 次の書き直しで、何がだめだったかを伝える
      data.retryNote = lang === "ja"
        ? `前回の文章は使えませんでした。${missing.length ? `「${missing.join("」「")}」が入っていませんでした。` : ""}${banned.length ? `「${banned.join("」「")}」は使わないでください。` : ""}`
        : `The previous draft was rejected.${missing.length ? ` Missing words: ${missing.join(", ")}.` : ""}${banned.length ? ` Do not use: ${banned.join(", ")}.` : ""}`;
    }

    if (!review) throw new Error("Empty completion");

    return res.status(200).json({ review });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(500).json({ error: "Generation failed" });
  }
};
