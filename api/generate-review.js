const OpenAI = require("openai");

const MASTER = {
  menus: {
    m1: { ja: "メンズカット", en: "Men's Cut", ko: "남성 커트", zh_cn: "男士剪发", zh_tw: "男士剪髮" },
    m2: { ja: "スキンフェード", en: "Skin Fade", ko: "스킨 페이드", zh_cn: "渐变理发", zh_tw: "漸層理髮" },
    m3: { ja: "カラー", en: "Color", ko: "컬러", zh_cn: "染发", zh_tw: "染髮" },
    m4: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m5: { ja: "メッシュ", en: "Highlights", ko: "메쉬", zh_cn: "挑染", zh_tw: "挑染" },
    // 濡れパンは口コミでは「パーマ」として書く（AIに「濡れパン」という言葉は渡さない）
    m6: { ja: "パーマ", en: "Perm", ko: "파마", zh_cn: "烫发", zh_tw: "燙髮" },
    m7: { ja: "顔そり", en: "Shave", ko: "면도", zh_cn: "修面", zh_tw: "修面" }
  },
  // 来店回数（文章の書き分けに使う）
  visits: {
    v1: "初めての来店",
    v2: "何度か来店している",
    v3: "いつも通っている常連"
  },
  // 今回のきっかけ（文章の書き分けに使う）
  occasions: {
    o1: "いつものメンテナンス",
    o2: "仕事・就活の前",
    o3: "イベント・結婚式の前",
    o4: "気分を変えたくて",
    o5: "旅行中に立ち寄った"
  },
  points: {
    p1: {
      ja: [
        "カウンセリングが丁寧",
        "ざっくりした注文でも意図を汲み取ってくれた",
        "髪質や骨格に合わせた提案をしてくれた",
        "細かい要望までしっかり聞いてくれた"
      ],
      en: "Careful consultation", ko: "꼼꼼한 상담", zh_cn: "细致的咨询", zh_tw: "仔細的諮詢"
    },
    p2: { ja: "希望通りの仕上がり", en: "Finish as imagined", ko: "원하던 스타일 완성", zh_cn: "符合预期的效果", zh_tw: "符合預期的效果" },
    p3: { ja: "手際が良くスピーディー", en: "Quick and skillful", ko: "빠르고 능숙함", zh_cn: "手法娴熟", zh_tw: "手法俐落" },
    p4: { ja: "落ち着いた接客", en: "Attentive service", ko: "친절한 응대", zh_cn: "周到的服务", zh_tw: "周到的服務" },
    p5: { ja: "駅からの近さ", en: "Close to the station", ko: "역에서 가까움", zh_cn: "离车站近", zh_tw: "離車站近" },
    p6: { ja: "落ち着く内装", en: "Relaxing interior", ko: "편안한 인테리어", zh_cn: "舒适的内饰", zh_tw: "舒適的裝潢" },
    p7: { ja: "シャンプーが快適", en: "Comfortable
