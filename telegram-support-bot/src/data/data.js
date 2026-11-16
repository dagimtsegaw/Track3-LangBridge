/**
 * Verified ALX FAQ content for the Telegram assistant.
 *
 * Facts come from the official ALX website. Native speakers should review
 * the Amharic, Afaan Oromo, Tigrinya, Somali, and Arabic text before production.
 *
 * This file does not state tuition, scholarship amounts, eligibility rules,
 * admission outcomes, jobs, income, or opening dates. Those belong on the
 * official programme page linked from each entry.
 */

const URLS = {
  about: 'https://www.alxafrica.com/about/',
  programmes: 'https://www.alxafrica.com/programmes/',
  website: 'https://www.alxafrica.com/',
  support: 'https://ehub.alxafrica.com/',
  dataAnalytics: 'https://www.alxafrica.com/programme/data-analytics/',
  dataScience: 'https://www.alxafrica.com/programme/data-science/',
  aiCareer: 'https://www.alxafrica.com/programme/career-ready-skills-training/',
  content: 'https://www.alxafrica.com/programme/content-creation/',
  graphic: 'https://www.alxafrica.com/programme/graphic-design/',
  founder: 'https://www.alxafrica.com/programme/founder-academy/',
  freelancer: 'https://www.alxafrica.com/programme/freelancer-academy/',
};

const LANGS = ['en', 'am', 'om', 'ti', 'so', 'ar'];

const CHECK_PAGE = {
  en: 'Check the official programme page for eligibility, opening dates, and current availability. This bot does not promise admission, a job, or income.',
  am: 'ብቃት፣ የመክፈቻ ቀን እና ወቅታዊ ተገኝነትን በይፋዊው የፕሮግራም ገጽ ይመልከቱ። ይህ ቦት ቅበላ፣ ሥራ ወይም ገቢ ቃል አይገባም።',
  om: 'Ulaagaa, guyyaa baninsaa fi argama ammaa fuula sagantaa ifaajaa irratti ilaali. Botiin kun fudhatama, hojii ykn galii waada hin seenu.',
  ti: 'ብቕዓት፣ መዓልቲ ምኽፋትን ሕጂ ምህላውን ኣብ ወግዓዊ ገጽ ናይቲ መደብ ርአ። እዚ ቦት ተቐባልነት፣ ስራሕ ወይ ኣታዊ ቃል ኣይኣቱን እዩ።',
  so: 'Ka eeg shuruudaha, taariikhaha furitaanka, iyo helitaanka hadda ee bogga rasmiga ah ee barnaamijka. Botkani ma ballanqaado aqbalid, shaqo, ama dakhli.',
  ar: 'راجع صفحة البرنامج الرسمية لمعرفة الأهلية وتواريخ الفتح والتوفر الحالي. هذا البوت لا يعد بالقبول أو بوظيفة أو بدخل.',
};

function keywords(perLanguage, shared = []) {
  const result = {};
  for (const code of LANGS) {
    result[code] = [...new Set([...(perLanguage[code] || []), ...shared])];
  }
  return result;
}

function withPageReminder(answers) {
  const result = {};
  for (const code of LANGS) {
    result[code] = `${answers[code]} ${CHECK_PAGE[code]}`;
  }
  return result;
}

function entry(fields) {
  return fields;
}

export const CATEGORIES = [
  { id: 'about' },
  { id: 'programmes' },
  { id: 'admission' },
  { id: 'learning' },
  { id: 'career' },
  { id: 'support' },
  { id: 'other' },
];

export const faqEntries = [
  entry({
    id: 'what_is_alx',
    category: 'about',
    sourceUrl: URLS.about,
    question: {
      en: 'What is ALX?',
      am: 'ALX ምንድን ነው?',
      om: 'ALX maali?',
      ti: 'ALX እንታይ እዩ?',
      so: 'Waa maxay ALX?',
      ar: 'ما هي ALX؟',
    },
    keywords: keywords(
      {
        en: ['what is alx', 'about alx', 'who is alx', 'alx africa'],
        am: ['alx ምንድን ነው', 'ስለ alx', 'alx ማለት ምን ማለት ነው'],
        om: ['alx maali', "waa'ee alx", 'alx jechuun maal'],
        ti: ['alx እንታይ እዩ', 'ብዛዕባ alx'],
        so: ['waa maxay alx', 'alx waa maxay', 'ku saabsan alx'],
        ar: ['ما هي alx', 'ما هو alx', 'عن منظمة alx', 'تعريف alx'],
      },
      ['what is alx', 'about alx'],
    ),
    answer: {
      en: 'ALX equips young Africans through programmes it describes as rigorous and affordable, and through a community built on shared proof. The aim is to help them launch careers, build ventures, and create income on their own terms.',
      am: 'ALX ወጣት አፍሪካውያንን በምትገልጻቸው ጥብቅ እና ተመጣጣኝ ዋጋ ባላቸው ፕሮግራሞች እና በጋራ ማስረጃ በተገነባ ማህበረሰብ ታስታጥቃለች። ዓላማው ሙያ እንዲጀምሩ፣ ሥራ እንዲገነቡ እና በራሳቸው ውሳኔ ገቢ እንዲፈጥሩ መርዳት ነው።',
      om: 'ALX dargaggoota Afrikaa sagantaalee cimaa fi gatii mijaawaa jedhamaniin akkasumas hawaasa ragaa waliin qoodamuun ijaarrameen ni leenjifti. Kaayyoon isaa hojii akka jalqaban, dhaabbata akka ijaaran fi galii akka mataa isaaniitti akka uuman gargaaruudha.',
      ti: 'ALX መንእሰያት ኣፍሪቃ ብመደባት ጥንኩርን ብዝተመጣጠነ ዋጋን እትብሎምን ብሓባራዊ መርትዖ ዝተሰርሐ ማሕበረሰብን የዳልው። ዕላማኡ ሞያ ክጅምሩ፣ ስራሕ ክሰርሑን ብናይ ነብሶም ውሳነ ኣታዊ ክፈጥሩን ምሕጋዝ እዩ።',
      so: 'ALX waxay dhalinyarada Afrika ku qalabaysaa barnaamijyo ay ku tilmaanto kuwo adag oo la awoodi karo, iyo bulsho ku dhisan caddeyn wadaag ah. Ujeeddadu waa inay ka caawiso inay bilaabaan xirfado, dhisaan ganacsiyo, oo ay ku abuuraan dakhli si u gaar ah.',
      ar: 'تزوّد ALX الشباب الأفارقة ببرامج تصفها بأنها صارمة وميسورة التكلفة، وبمجتمع قائم على إثبات مشترك. الهدف هو مساعدتهم على بدء مسارات مهنية وبناء مشاريع وتحقيق دخل وفق شروطهم.',
    },
  }),
  entry({
    id: 'what_alx_does',
    category: 'about',
    sourceUrl: URLS.about,
    question: {
      en: 'What does ALX do?',
      am: 'ALX ምን ያደርጋል?',
      om: 'ALX maal hojjeta?',
      ti: 'ALX እንታይ ይሰርሕ?',
      so: 'Maxay ALX qabataa?',
      ar: 'ماذا تفعل ALX؟',
    },
    keywords: keywords(
      {
        en: ['what does alx do', 'what alx does', 'alx effect'],
        am: ['alx ምን ያደርጋል', 'alx ስራ ምንድን ነው'],
        om: ['alx maal hojjeta', 'hojii alx'],
        ti: ['alx እንታይ ይሰርሕ', 'ስራሕ alx'],
        so: ['maxay alx qabataa', 'shaqada alx'],
        ar: ['ماذا تفعل alx', 'عمل alx', 'دور alx'],
      },
      ['what does alx do'],
    ),
    answer: {
      en: 'ALX says it turns ambition into outcomes at scale. It offers career and entrepreneurship programmes and a community where visible progress, such as graduates mentoring applicants and alumni hiring graduates, makes transformation more believable for other young Africans.',
      am: 'ALX ምኞትን በስፋት ወደ ውጤት እንደምትቀይር ትላለች። የሙያ እና የሥራ ፈጠራ ፕሮግራሞችን እና ማህበረሰብ ታቀርባለች። በዚህ ማህበረሰብ ውስጥ ተመራቂዎች አመልካቾችን መምራት እና የቀድሞ ተማሪዎች ተመራቂዎችን መቅጠር ያሉ የሚታዩ እድገቶች ለሌሎች ወጣት አፍሪካውያን ለውጥን የበለጠ የሚታመን ያደርጉታል።',
      om: 'ALX hawwii gara bu’aatti bal’inaan akka jijjiirtu ni himti. Sagantaalee hojii fi daldalaa fi hawaasa ni kenna. Hawaasa kana keessatti guddina ifa ta’e, akka eebbifamtoonni iyyattoota gorsuu fi barattoonni durii eebbifamtoota qacarun, jijjiirama dargaggoota Afrikaa biroof amanamsiisa.',
      ti: 'ALX ተስፋ ናብ ውጽኢት ብሰፊሕ መጠን ከም እትቅይር ትብል። ናይ ሞያን ናይ ስራሕ ፈጠራን መደባትን ማሕበረሰብን ትህብ። ኣብዚ ማሕበረሰብ ዝረኣይ ምዕባለ፣ ከም ተመረቕቲ ነመልከቲ ምምራሕን ነባር ተመሃሮ ተመረቕቲ ምቕጻርን፣ ለውጢ ንኻልኦት መንእሰያት ኣፍሪቃ ዝያዳ የእምን።',
      so: 'ALX waxay sheegtaa inay himilada u beddesho natiijo baaxad leh. Waxay bixisaa barnaamijyo xirfadeed iyo ganacsi iyo bulsho ay horumarka la arki karo, sida qalinjabiyayaasha oo la taliya codsadayaasha iyo alumni-ga oo shaqaaleeya qalinjabiyayaasha, ka dhigto isbeddelka mid la aaminsan karo dhalinyarada kale ee Afrika.',
      ar: 'تقول ALX إنها تحوّل الطموح إلى نتائج على نطاق واسع. تقدّم برامج للمسار المهني وريادة الأعمال ومجتمعاً يجعل التقدّم المرئي، مثل توجيه الخريجين للمتقدمين وتوظيف الخريجين من قِبل الخريجين السابقين، التحول أكثر قابلية للتصديق لدى شباب أفارقة آخرين.',
    },
  }),
  entry({
    id: 'alx_mission',
    category: 'about',
    sourceUrl: URLS.about,
    question: {
      en: 'What is the mission of ALX?',
      am: 'የALX ተልዕኮ ምንድን ነው?',
      om: 'Ergama ALX maali?',
      ti: 'ተልእኾ ALX እንታይ እዩ?',
      so: 'Waa maxay himilada ALX?',
      ar: 'ما رسالة ALX؟',
    },
    keywords: keywords(
      {
        en: ['mission of alx', 'alx mission', 'alx vision', 'vision of alx'],
        am: ['የalx ተልዕኮ', 'alx ተልዕኮ', 'ራዕይ alx'],
        om: ['ergama alx', 'mul’ata alx', 'kaayyoo alx'],
        ti: ['ተልእኾ alx', 'ራእይ alx'],
        so: ['himilada alx', 'aragtida alx', 'ujeeddada alx'],
        ar: ['رسالة alx', 'رؤية alx', 'مهمة alx'],
      },
      ['mission of alx', 'alx mission'],
    ),
    answer: {
      en: 'ALX states its mission as expanding career and entrepreneurial opportunity for young Africans by turning real outcomes into visible proof that transformation is possible. Its stated vision is a future where career transformation in Africa is no longer questioned, because millions of young Africans have already proven it is possible.',
      am: 'ALX ተልዕኮዋን ለወጣት አፍሪካውያን የሙያ እና የሥራ ፈጠራ እድልን ማስፋት ብላ ትገልጸዋለች። ይህን የምታደርገው እውነተኛ ውጤቶችን ለውጥ እንደሚቻል ወደሚታይ ማስረጃ በመቀየር ነው። የተገለጸው ራዕይ በአፍሪካ የሙያ ለውጥ ከእንግዲህ ጥያቄ የማይሆንበት ወደፊት ነው፤ ምክንያቱም በሚሊዮን የሚቆጠሩ ወጣት አፍሪካውያን ይህ እንደሚቻል አስቀድመው አረጋግጠዋል።',
      om: 'ALX ergamni ishee carraa hojii fi daldalaa dargaggoota Afrikaa bal’isuu akka ta’e himti. Kana kan gootu bu’aa dhugaa jijjiiramni akka danda’amu ragaa mul’atuutti jijjiiruudhaan. Mul’anni ishee gara fuulduraa jijjiiramni hojii Afrikaa keessatti gaaffii hin taaneedha, sababni isaas dargaggoonni Afrikaa miliyoonotaan lakkaa’aman dursee akka danda’amu mirkaneessaniiru.',
      ti: 'ALX ተልእኮኣ ንመንእሰያት ኣፍሪቃ ዕድል ሞያን ስራሕ ፈጠራን ምስፋሕ ምዃኑ ትገልጽ። እዚ ብምግባር ናይ ሓቂ ውጽኢታት ለውጢ ከም ዝከኣል ናብ ዝረአ መርትዖ ትቅይሮ። እቲ ዝተገልጸ ራእይ፣ ኣብ ኣፍሪቃ ለውጢ ሞያ ድሕሪ ሕጂ ሕቶ ዘይኮነሉ መጻኢ እዩ፣ ምኽንያቱ ብሚልዮናት ዝቑጸሩ መንእሰያት ኣፍሪቃ ከም ዝከኣል ቅድሚ ሕጂ ኣረጋጊጾም እዮም።',
      so: 'ALX waxay himiladeeda ku sheegtaa ballaarinta fursadda xirfadeed iyo ganacsiga ee dhalinyarada Afrika, iyadoo natiijooyinka dhabta ah u beddelaysa caddeyn la arki karo oo muujinaysa in isbeddelku suurtagal yahay. Aragtida ay sheegtay waa mustaqbal aan isbeddelka xirfadeed ee Afrika mar dambe la su’aalin, sababtoo ah malaayiin dhalinyaro Afrika ah ayaa horay u caddeeyay inuu suurtagal yahay.',
      ar: 'تصف ALX رسالتها بأنها توسيع فرص المسار المهني وريادة الأعمال للشباب الأفارقة، بتحويل النتائج الحقيقية إلى دليل مرئي على أن التحول ممكن. الرؤية التي تذكرها هي مستقبل لا يعود فيه التحول المهني في أفريقيا موضع سؤال، لأن ملايين الشباب الأفارقة أثبتوا بالفعل أنه ممكن.',
    },
  }),
  entry({
    id: 'who_alx_serves',
    category: 'about',
    sourceUrl: URLS.about,
    question: {
      en: 'Who does ALX serve?',
      am: 'ALX ማንን ያገለግላል?',
      om: 'ALX eenyuuf tajaajila?',
      ti: 'ALX መን ትግልግል?',
      so: 'Yaa ay ALX u adeegtaa?',
      ar: 'من تخدم ALX؟',
    },
    keywords: keywords(
      {
        en: ['who does alx serve', 'who is alx for', 'young africans'],
        am: ['alx ማንን ያገለግላል', 'alx ለማን ነው'],
        om: ['alx eenyuuf tajaajila', 'alx eenyuuf'],
        ti: ['alx መን ትግልግል', 'alx ንመን እያ'],
        so: ['yaa ay alx u adeegtaa', 'alx yaa loogu talagalay'],
        ar: ['من تخدم alx', 'لمن alx', 'الشباب الأفارقة'],
      },
      ['who does alx serve', 'who is alx for'],
    ),
    answer: {
      en: 'ALX serves young Africans who want career and entrepreneurial opportunity. Its programmes and community are for people who want to build skills, launch careers, start ventures, or create income.',
      am: 'ALX የሙያ እና የሥራ ፈጠራ እድል የሚፈልጉ ወጣት አፍሪካውያንን ታገለግላለች። ፕሮግራሞቿ እና ማህበረሰቧ ክህሎት መገንባት፣ ሙያ መጀመር፣ ሥራ ማስጀመር ወይም ገቢ መፍጠር ለሚፈልጉ ሰዎች ናቸው።',
      om: 'ALX dargaggoota Afrikaa carraa hojii fi daldalaa barbaadan tajaajilti. Sagantaaleen fi hawaasni ishee dandeettii ijaaruu, hojii jalqabuu, dhaabbata jalqabuu ykn galii uumuu barbaadaniif.',
      ti: 'ALX መንእሰያት ኣፍሪቃ ዕድል ሞያን ስራሕ ፈጠራን ዝደልዩ ትግልግል። መደባታን ማሕበረሰባን ንሰባት ክእለት ዝደልዩ፣ ሞያ ክጅምሩ፣ ስራሕ ክጅምሩ ወይ ኣታዊ ክፈጥሩ እዮም።',
      so: 'ALX waxay u adeegtaa dhalinyarada Afrika ee raadinaysa fursad xirfadeed iyo ganacsi. Barnaamijyadeeda iyo bulshadeedu waxay u yihiin dadka doonaya inay dhistaan xirfado, bilaabaan xirfad, bilaabaan ganacsi, ama abuuraan dakhli.',
      ar: 'تخدم ALX الشباب الأفارقة الذين يسعون إلى فرصة مهنية أو ريادية. برامجها ومجتمعها موجهان لمن يريد بناء المهارات أو بدء مسار مهني أو إطلاق مشروع أو تحقيق دخل.',
    },
  }),
  entry({
    id: 'alx_community',
    category: 'about',
    alsoIn: ['learning'],
    sourceUrl: URLS.about,
    question: {
      en: 'What is the ALX community?',
      am: 'የALX ማህበረሰብ ምንድን ነው?',
      om: 'Hawaasni ALX maali?',
      ti: 'ማሕበረሰብ ALX እንታይ እዩ?',
      so: 'Waa maxay bulshada ALX?',
      ar: 'ما هو مجتمع ALX؟',
    },
    keywords: keywords(
      {
        en: ['alx community', 'what is the alx community', '300000', '300,000'],
        am: ['የalx ማህበረሰብ', 'alx ማህበረሰብ ምንድን ነው'],
        om: ['hawaasa alx', 'hawaasni alx maali'],
        ti: ['ማሕበረሰብ alx', 'ማሕበረሰብ alx እንታይ እዩ'],
        so: ['bulshada alx', 'waa maxay bulshada alx'],
        ar: ['مجتمع alx', 'ما هو مجتمع alx'],
      },
      ['alx community'],
    ),
    answer: {
      en: 'ALX describes its community as built on shared proof. It describes graduates mentoring applicants, alumni hiring graduates, and communities seeing someone succeed and deciding they can too. ALX states that 300,000 people have built something that compounds.',
      am: 'ALX ማህበረሰቧን በጋራ ማስረጃ ላይ እንደተገነባ ትገልጸዋለች። ተመራቂዎች አመልካቾችን እንደሚመሩ፣ የቀድሞ ተማሪዎች ተመራቂዎችን እንደሚቀጥሩ እና ማህበረሰቦች አንድ ሰው ሲሳካ አይተው እነሱም እንደሚችሉ እንደሚወስኑ ትገልጻለች። ALX 300,000 ሰዎች የሚጨምር ነገር እንደገነቡ ትናገራለች።',
      om: 'ALX hawaasa ishee ragaa waliin qoodamuun akka ijaarame ibsiti. Eebbifamtoonni iyyattoota akka gorsan, barattoonni durii eebbifamtoota akka qacaran, hawaasni immoo nama tokko milkaa’e arguun isaanis akka danda’an akka murteessan ibsiti. ALX namoonni 300,000 waan dachaan guddatu ijaaranii akka jiran himti.',
      ti: 'ALX ማሕበረሰባ ብሓባራዊ መርትዖ ከም ዝተሰርሐ ትገልጽ። ተመረቕቲ ነመልከቲ ከም ዝመርሑ፣ ነባር ተመሃሮ ተመረቕቲ ከም ዝቕጽሩ፣ ማሕበረሰባት ድማ ሰብ ሓደ ምስ ረኣዩ ይኽእሉ ከም ዝብሉ ትገልጽ። ALX 300,000 ሰባት ዝውስኽ ነገር ከም ዝሰርሑ ትብል።',
      so: 'ALX waxay bulshadeeda ku tilmaamtaa mid ku dhisan caddeyn wadaag ah. Waxay sheegtaa in qalinjabiyayaashu la taliyaan codsadayaasha, alumni-gu shaqaalaysiiyo qalinjabiyayaasha, bulshoyinkuna ay arkaan qof guuleysta oo ay go’aansadaan inay iyaguna awoodaan. ALX waxay sheegtaa in 300,000 qof ay dhisteen wax isku dara.',
      ar: 'تصف ALX مجتمعها بأنه مبني على إثبات مشترك. تصف خريجين يوجّهون المتقدمين، وخريجين سابقين يوظّفون الخريجين، ومجتمعات ترى نجاح أحد الأشخاص فتقرر أنها تستطيع ذلك أيضاً. تذكر ALX أن 300,000 شخص بنوا شيئاً يتراكم أثره.',
    },
  }),
  entry({
    id: 'programmes_overview',
    category: 'programmes',
    sourceUrl: URLS.programmes,
    question: {
      en: 'Which programmes does ALX offer?',
      am: 'ALX የትኞቹን ፕሮግራሞች ታቀርባለች?',
      om: 'ALX sagantaalee kam kenna?',
      ti: 'ALX ኣየኖት መደባት ትህብ?',
      so: 'Barnaamijyo noocee ah ayay ALX bixisaa?',
      ar: 'ما البرامج التي تقدمها ALX؟',
    },
    keywords: keywords(
      {
        en: ['which programmes does alx offer', 'list of alx programmes', 'alx programmes list', 'what programmes'],
        am: ['alx ፕሮግራሞች', 'የalx ፕሮግራሞች ዝርዝር'],
        om: ['sagantaalee alx', 'tarree sagantaa alx'],
        ti: ['መደባት alx', 'ዝርዝር መደባት alx'],
        so: ['barnaamijyada alx', 'liiska barnaamijyada alx'],
        ar: ['برامج alx', 'قائمة برامج alx', 'ما البرامج التي تقدمها alx'],
      },
      ['which programmes does alx offer', 'alx programmes list'],
    ),
    answer: withPageReminder({
      en: 'On its programmes page, ALX groups programmes as AI & Data (Data Analytics, Data Science, and AI & Career Essentials), Creative (Content Creation and Graphic Design), and Entrepreneurship (Founder Academy and Freelancer Academy). That page is the source of the current list.',
      am: 'በፕሮግራሞች ገጿ ላይ ALX ፕሮግራሞችን እንደ AI እና ዳታ (Data Analytics፣ Data Science እና AI & Career Essentials)፣ ፈጠራ (Content Creation እና Graphic Design) እና ሥራ ፈጠራ (Founder Academy እና Freelancer Academy) ትመድባለች። ያ ገጽ የአሁኑ ዝርዝር ምንጭ ነው።',
      om: 'Fuula sagantaalee irratti ALX sagantaalee akka AI fi Data (Data Analytics, Data Science fi AI & Career Essentials), Uumama (Content Creation fi Graphic Design) fi Daldala (Founder Academy fi Freelancer Academy) ramadi. Fuulli sun madda tarree ammaati.',
      ti: 'ኣብ ገጽ መደባት ALX መደባት ከም AIን ዳታን (Data Analytics፣ Data Scienceን AI & Career Essentialsን)፣ ፈጠራ (Content Creationን Graphic Designን) ከምኡውን ስራሕ ፈጠራ (Founder Academyን Freelancer Academyን) ትመድብ። እቲ ገጽ ምንጪ ናይ ሕጂ ዝርዝር እዩ።',
      so: 'Bogga barnaamijyadeeda, ALX waxay barnaamijyada u qaybisaa AI & Data (Data Analytics, Data Science, iyo AI & Career Essentials), Hal-abuur (Content Creation iyo Graphic Design), iyo Ganacsi (Founder Academy iyo Freelancer Academy). Boggaas waa isha liiska hadda.',
      ar: 'في صفحة البرامج، تجمع ALX البرامج في الذكاء الاصطناعي والبيانات (تحليل البيانات، وعلم البيانات، وأساسيات الذكاء الاصطناعي والمسار المهني)، والإبداع (إنشاء المحتوى والتصميم الجرافيكي)، وريادة الأعمال (أكاديمية المؤسسين وأكاديمية العمل الحر). تلك الصفحة هي مصدر القائمة الحالية.',
    }),
  }),
  entry({
    id: 'programme_data_analytics',
    category: 'programmes',
    sourceUrl: URLS.dataAnalytics,
    question: {
      en: 'What is ALX Data Analytics?',
      am: 'የALX Data Analytics ምንድን ነው?',
      om: 'Data Analytics ALX maali?',
      ti: 'Data Analytics ALX እንታይ እዩ?',
      so: 'Waa maxay Data Analytics ee ALX?',
      ar: 'ما هو تحليل البيانات في ALX؟',
    },
    keywords: keywords(
      {
        en: ['data analytics', 'alx data analytics', 'power bi', 'spreadsheet analytics'],
        am: ['ዳታ አናሊቲክስ', 'data analytics'],
        om: ['xiinxala dataa', 'data analytics'],
        ti: ['ዳታ ኣናሊቲክስ', 'data analytics'],
        so: ['falanqaynta xogta', 'data analytics'],
        ar: ['تحليل البيانات', 'data analytics'],
      },
      ['data analytics', 'alx data analytics'],
    ),
    answer: withPageReminder({
      en: 'ALX describes Data Analytics as preparation for data roles by learning to turn data into decisions. The programme page describes data and AI literacy, spreadsheet analytics, SQL, and Power BI.',
      am: 'ALX Data Analytics ን መረጃን ወደ ውሳኔ ለመቀየር በመማር ለዳታ ሚናዎች ዝግጅት ብላ ትገልጸዋለች። የፕሮግራሙ ገጽ የዳታ እና AI መሠረት፣ የሰንጠረዥ ትንተና፣ SQL እና Power BI ይገልጻል።',
      om: 'ALX Data Analytics akka qophii hojii dataa, dataa gara murtoo jijjiiruu baruudhaan, ibsiti. Fuulli sagantichaa beekumsa dataa fi AI, xiinxala ispriidshiitii, SQL fi Power BI ibsa.',
      ti: 'ALX Data Analytics ንዳታ ናብ ውሳነ ንምቕያር ብምምሃር ንናይ ዳታ ሚናታት ምድላው ከም ዝኾነ ትገልጾ። ገጽ መደብ ናይ ዳታን AIን መሰረት፣ ምትንታን ሰንጠረዥ፣ SQLን Power BIን ይገልጽ።',
      so: 'ALX waxay Data Analytics ku tilmaamtaa diyaarinta doorarka xogta adigoo baranaya sida xogta loogu beddelo go’aamo. Bogga barnaamijka wuxuu qeexaa aqoonta xogta iyo AI, falanqaynta xaashida, SQL, iyo Power BI.',
      ar: 'تصف ALX تحليل البيانات بأنه إعداد لأدوار البيانات عبر تعلّم تحويل البيانات إلى قرارات. تصف صفحة البرنامج أساسيات البيانات والذكاء الاصطناعي، وتحليل جداول البيانات، وSQL، وPower BI.',
    }),
  }),
  entry({
    id: 'programme_data_science',
    category: 'programmes',
    sourceUrl: URLS.dataScience,
    question: {
      en: 'What is ALX Data Science?',
      am: 'የALX Data Science ምንድን ነው?',
      om: 'Data Science ALX maali?',
      ti: 'Data Science ALX እንታይ እዩ?',
      so: 'Waa maxay Data Science ee ALX?',
      ar: 'ما هو علم البيانات في ALX؟',
    },
    keywords: keywords(
      {
        en: ['data science', 'alx data science', 'machine learning programme'],
        am: ['ዳታ ሳይንስ', 'data science'],
        om: ['saayinsii dataa', 'data science'],
        ti: ['ዳታ ሳይንስ', 'data science'],
        so: ['sayniska xogta', 'data science'],
        ar: ['علم البيانات', 'data science'],
      },
      ['data science', 'alx data science'],
    ),
    answer: withPageReminder({
      en: 'ALX describes data scientists as people who collect, organise, and visualise data to uncover trends and support decisions. The Data Science page describes a path that includes data literacy, programming, and machine learning topics. The page itself is the source for the current outline.',
      am: 'ALX የዳታ ሳይንቲስቶችን መረጃን የሚሰበስቡ፣ የሚያደራጁ እና አዝማሚያዎችን ለማየት የሚያሳዩ ሰዎች ብላ ትገልጻለች። የData Science ገጽ የዳታ መሠረት፣ ፕሮግራሚንግ እና የማሽን ለርኒንግ ርዕሶችን የሚጨምር መንገድ ይገልጻል። ለአሁኑ ዝርዝር ምንጩ ገጹ ራሱ ነው።',
      om: 'ALX saayintistoota dataa akka namoota dataa walitti qaban, qindeessan fi mul’isan ibsiti, akkaataa itti adeemsa arguu fi murtoo deeggaraniin. Fuulli Data Science karaa beekumsa dataa, sagantaa fi mata dureewwan machine learning hammate ibsa. Fuulli mataan isaa madda tarree ammaati.',
      ti: 'ALX ሳይንቲስት ዳታ ከም ሰባት ዳታ ዝእክቡ፣ ዘዳልዉን ኣዝማሚያ ንምርኣይ ዘቕርቡን ትገልጾም። ገጽ Data Science መንገዲ መሰረት ዳታ፣ ፕሮግራሚንግን ኣርእስታት ማሽን ለርኒንግን ዝሓዘ ይገልጽ። እቲ ገጽ ባዕሉ ምንጪ ናይ ሕጂ ዝርዝር እዩ።',
      so: 'ALX waxay saynisyahanada xogta ku tilmaamtaa dad ururiya, habeeya, oo muujiya xogta si ay u helaan isbeddellada oo ay u taageeraan go’aamada. Bogga Data Science wuxuu qeexaa waddo ay ku jiraan aqoonta xogta, barnaamijyada, iyo mowduucyada barashada mashiinka. Bogga laftiisa ayaa ah isha qaabka hadda.',
      ar: 'تصف ALX علماء البيانات بأنهم أشخاص يجمعون البيانات وينظمونها ويعرضونها بصرياً لاكتشاف الاتجاهات ودعم القرارات. تصف صفحة علم البيانات مساراً يشمل أساسيات البيانات والبرمجة وموضوعات تعلّم الآلة. الصفحة نفسها هي مصدر المخطط الحالي.',
    }),
  }),
  entry({
    id: 'programme_ai_career',
    category: 'programmes',
    sourceUrl: URLS.aiCareer,
    question: {
      en: 'What is AI & Career Essentials?',
      am: 'AI & Career Essentials ምንድን ነው?',
      om: 'AI & Career Essentials maali?',
      ti: 'AI & Career Essentials እንታይ እዩ?',
      so: 'Waa maxay AI & Career Essentials?',
      ar: 'ما هو AI & Career Essentials؟',
    },
    keywords: keywords(
      {
        en: ['ai career essentials', 'ai and career essentials', 'artificial intelligence essentials'],
        am: ['ai career essentials', 'የai መሠረታዊ'],
        om: ['ai career essentials', 'bu’uura ai'],
        ti: ['ai career essentials', 'መሰረት ai'],
        so: ['ai career essentials', 'aasaaska ai'],
        ar: ['أساسيات الذكاء الاصطناعي', 'ai career essentials'],
      },
      ['ai career essentials', 'ai & career essentials'],
    ),
    answer: withPageReminder({
      en: 'ALX describes AI & Career Essentials as a beginner programme for a working understanding of artificial intelligence and for using AI tools in professional tasks. ALX states that it is not a technical coding programme.',
      am: 'ALX AI & Career Essentials ን ስለ አርቴፊሻል ኢንተለጀንስ የሚሰራ ግንዛቤ እና በሙያዊ ሥራዎች AI መሳሪያዎችን ለመጠቀም የጀማሪ ፕሮግራም ብላ ትገልጸዋለች። የቴክኒክ ኮዲንግ ፕሮግራም እንዳልሆነ ትናገራለች።',
      om: 'ALX AI & Career Essentials akka sagantaa jalqabaa hubannoo hojii intellijinsii namtolchee fi meeshaalee AI hojii ogummaa keessatti fayyadamuuf ibsiti. Sagantaa koodii teeknikaa akka hin taane ni himti.',
      ti: 'ALX AI & Career Essentials ከም መደብ ጀማሪ ንምርዳእ ስራሕ ናይ ኣርቲፊሻል ኢንተለጀንስን ኣብ ስራሕ ሞያ መሳርሒ AI ንምጥቃምን ትገልጾ። ናይ ቴክኒክ ኮዲንግ መደብ ከም ዘይኮነ ትብል።',
      so: 'ALX waxay AI & Career Essentials ku tilmaamtaa barnaamij bilow ah oo lagu fahmo sirdoonka macmalka ah oo lagu isticmaalo qalabka AI hawlo xirfadeed. ALX waxay sheegtaa inuusan ahayn barnaamij koodh farsamo.',
      ar: 'تصف ALX برنامج AI & Career Essentials بأنه برنامج للمبتدئين لفهم عملي للذكاء الاصطناعي واستخدام أدواته في المهام المهنية. تذكر ALX أنه ليس برنامج برمجة تقنياً.',
    }),
  }),
  entry({
    id: 'programme_content_creation',
    category: 'programmes',
    sourceUrl: URLS.content,
    question: {
      en: 'What is ALX Content Creation?',
      am: 'የALX Content Creation ምንድን ነው?',
      om: 'Content Creation ALX maali?',
      ti: 'Content Creation ALX እንታይ እዩ?',
      so: 'Waa maxay Content Creation ee ALX?',
      ar: 'ما هو إنشاء المحتوى في ALX؟',
    },
    keywords: keywords(
      {
        en: ['content creation', 'alx content creation', 'content creator programme'],
        am: ['ኮንተንት ፈጠራ', 'content creation'],
        om: ['uumama qabiyyee', 'content creation'],
        ti: ['ምፍጣር ትሕዝቶ', 'content creation'],
        so: ['abuurista waxyaabaha', 'content creation'],
        ar: ['إنشاء المحتوى', 'content creation'],
      },
      ['content creation', 'alx content creation'],
    ),
    answer: withPageReminder({
      en: 'ALX describes Content Creation as a programme for turning ideas into content and building creative skills. The programme page describes content identity, a production workflow, AI-assisted creation, motion-graphics foundations, and business basics for creators.',
      am: 'ALX Content Creation ን ሀሳቦችን ወደ ይዘት ለመቀየር እና የፈጠራ ክህሎት ለመገንባት ፕሮግራም ብላ ትገልጸዋለች። የፕሮግራሙ ገጽ የይዘት ማንነት፣ የምርት ሂደት፣ በAI የታገዘ ፈጠራ፣ የሞሽን ግራፊክስ መሠረት እና ለፈጣሪዎች የንግድ መሠረት ይገልጻል።',
      om: 'ALX Content Creation akka sagantaa yaada gara qabiyyeetti jijjiiruu fi dandeettii uumamaa ijaaruu ibsiti. Fuulli sagantichaa eenyummaa qabiyyee, adeemsa oomishaa, uumama AI deeggarame, bu’uura mooshin giraafiksii fi bu’uura daldalaa uumtootaaf ibsa.',
      ti: 'ALX Content Creation ከም መደብ ሓሳባት ናብ ትሕዝቶ ንምቕያርን ክእለት ፈጠራ ንምህናጽን ትገልጾ። ገጽ መደብ መንነት ትሕዝቶ፣ መስርሕ ምፍራይ፣ ፈጠራ ብAI ዝተሓገዘ፣ መሰረት ሞሽን ግራፊክስን መሰረት ንግዲ ንፈጠርቲን ይገልጽ።',
      so: 'ALX waxay Content Creation ku tilmaamtaa barnaamij lagu beddelo fikradaha wax la daabaco laguna dhiso xirfad hal-abuur leh. Bogga barnaamijka wuxuu qeexaa aqoonsiga waxyaabaha, habka wax soo saarka, abuurista AI ka caawiso, aasaaska dhaqdhaqaaqa, iyo aasaaska ganacsiga ee abuurayaasha.',
      ar: 'تصف ALX إنشاء المحتوى بأنه برنامج لتحويل الأفكار إلى محتوى وبناء مهارات إبداعية. تصف صفحة البرنامج هوية المحتوى، وسير الإنتاج، والإبداع بمساعدة الذكاء الاصطناعي، وأساسيات الرسوم المتحركة، وأساسيات العمل للمبدعين.',
    }),
  }),
  entry({
    id: 'programme_graphic_design',
    category: 'programmes',
    sourceUrl: URLS.graphic,
    question: {
      en: 'What is ALX Graphic Design?',
      am: 'የALX Graphic Design ምንድን ነው?',
      om: 'Graphic Design ALX maali?',
      ti: 'Graphic Design ALX እንታይ እዩ?',
      so: 'Waa maxay Graphic Design ee ALX?',
      ar: 'ما هو التصميم الجرافيكي في ALX؟',
    },
    keywords: keywords(
      {
        en: ['graphic design', 'alx graphic design', 'visual design programme'],
        am: ['ግራፊክ ዲዛይን', 'graphic design'],
        om: ['dizaayinii giraafikii', 'graphic design'],
        ti: ['ግራፊክ ዲዛይን', 'graphic design'],
        so: ['naqshadeynta garaafka', 'graphic design'],
        ar: ['التصميم الجرافيكي', 'graphic design'],
      },
      ['graphic design', 'alx graphic design'],
    ),
    answer: withPageReminder({
      en: 'ALX describes Graphic Design as training for visual communication and a creative career. The programme page describes design software, visual language, composition, and preparation for freelance or junior design work.',
      am: 'ALX Graphic Design ን ለእይታ ግንኙነት እና ለፈጠራ ሙያ ሥልጠና ብላ ትገልጸዋለች። የፕሮግራሙ ገጽ የዲዛይን ሶፍትዌር፣ የእይታ ቋንቋ፣ ውህደት እና ለፍሪላንስ ወይም ለጁኒየር የዲዛይን ሥራ ዝግጅት ይገልጻል።',
      om: 'ALX Graphic Design akka leenjii walqunnamtii mul’ataa fi hojii uumamaa ibsiti. Fuulli sagantichaa sooftiweerii dizaayinii, afaan mul’ataa, qindeessaa fi qophii hojii freelance ykn dizaayinii jalqabaa ibsa.',
      ti: 'ALX Graphic Design ከም ስልጠና ንርእየታዊ ርክብን ንሞያ ፈጠራን ትገልጾ። ገጽ መደብ ሶፍትዌር ዲዛይን፣ ቋንቋ ርእየታዊ፣ ውህደትን ምድላው ንስራሕ ፍሪላንስ ወይ ጁንየር ዲዛይንን ይገልጽ።',
      so: 'ALX waxay Graphic Design ku tilmaamtaa tababar isgaarsiin muuqaal ah iyo xirfad hal-abuur leh. Bogga barnaamijka wuxuu qeexaa softiweerka naqshadeynta, luqadda muuqaalka, qaabeynta, iyo diyaarinta shaqada madaxbannaan ama naqshadaynta heerka hoose.',
      ar: 'تصف ALX التصميم الجرافيكي بأنه تدريب على التواصل البصري ومسار إبداعي. تصف صفحة البرنامج برمجيات التصميم، واللغة البصرية، والتكوين، والاستعداد للعمل الحر أو لعمل تصميمي مبتدئ.',
    }),
  }),
  entry({
    id: 'programme_founder_academy',
    category: 'programmes',
    sourceUrl: URLS.founder,
    question: {
      en: 'What is Founder Academy?',
      am: 'Founder Academy ምንድን ነው?',
      om: 'Founder Academy maali?',
      ti: 'Founder Academy እንታይ እዩ?',
      so: 'Waa maxay Founder Academy?',
      ar: 'ما هي Founder Academy؟',
    },
    keywords: keywords(
      {
        en: ['founder academy', 'alx founder academy', 'start a venture'],
        am: ['ፋውንደር አካዳሚ', 'founder academy'],
        om: ['akaadaamii founder', 'founder academy'],
        ti: ['ፋውንደር ኣካዳሚ', 'founder academy'],
        so: ['akadeemiyada aasaasayaasha', 'founder academy'],
        ar: ['أكاديمية المؤسسين', 'founder academy'],
      },
      ['founder academy', 'alx founder academy'],
    ),
    answer: withPageReminder({
      en: 'ALX describes Founder Academy as a programme for people who want to build a venture, from identifying a real customer problem to shaping a first product and preparing to operate. It does not guarantee funding or business success.',
      am: 'ALX Founder Academy ን ሥራ መገንባት ለሚፈልጉ ሰዎች፣ ከእውነተኛ የደንበኛ ችግር መለየት ጀምሮ እስከ የመጀመሪያ ምርት መቅረጽ እና ለመስራት ዝግጅት፣ ፕሮግራም ብላ ትገልጸዋለች። የገንዘብ ድጋፍ ወይም የንግድ ስኬት አያረጋግጥም።',
      om: 'ALX Founder Academy akka sagantaa namoota dhaabbata ijaaruu barbaadaniif, rakkoo maamila dhugaa adda baasuu irraa hanga oomisha jalqabaa bocuu fi hojjechuuf qophaawuutti, ibsiti. Fandii ykn milkaa’ina daldalaa hin mirkaneessu.',
      ti: 'ALX Founder Academy ከም መደብ ንሰባት ዝደልዩ ስራሕ ክሰርሑ፣ ካብ ሓቀኛ ጸገም ዓማዊል ምልላይ ክሳብ ናይ መጀመርታ ፍርያት ምቕራጽን ንምስራሕ ምድላውን፣ ትገልጾ። ምወላድ ገንዘብ ወይ ዓወት ንግዲ ኣይዋሕስን።',
      so: 'ALX waxay Founder Academy ku tilmaamtaa barnaamij dadka doonaya inay dhistaan ganacsi, laga bilaabo aqoonsiga dhibaatada macmiilka dhabta ah ilaa qaabaynta badeecada koowaad iyo diyaarinta hawlgalka. Ma dammaanad qaaddo maalgelin ama guul ganacsi.',
      ar: 'تصف ALX أكاديمية المؤسسين بأنها برنامج لمن يريد بناء مشروع، من تحديد مشكلة حقيقية لدى العميل إلى تشكيل منتج أول والاستعداد للتشغيل. لا تضمن تمويلاً أو نجاحاً تجارياً.',
    }),
  }),
  entry({
    id: 'programme_freelancer_academy',
    category: 'programmes',
    sourceUrl: URLS.freelancer,
    question: {
      en: 'What is Freelancer Academy?',
      am: 'Freelancer Academy ምንድን ነው?',
      om: 'Freelancer Academy maali?',
      ti: 'Freelancer Academy እንታይ እዩ?',
      so: 'Waa maxay Freelancer Academy?',
      ar: 'ما هي Freelancer Academy؟',
    },
    keywords: keywords(
      {
        en: ['freelancer academy', 'alx freelancer academy', 'freelance programme'],
        am: ['ፍሪላንሰር አካዳሚ', 'freelancer academy'],
        om: ['akaadaamii freelancer', 'freelancer academy'],
        ti: ['ፍሪላንሰር ኣካዳሚ', 'freelancer academy'],
        so: ['akadeemiyada shaqada madaxbannaan', 'freelancer academy'],
        ar: ['أكاديمية العمل الحر', 'freelancer academy'],
      },
      ['freelancer academy', 'alx freelancer academy'],
    ),
    answer: withPageReminder({
      en: 'ALX describes Freelancer Academy as a programme for building a freelance practice: positioning a skill, finding clients, and managing delivery and client relationships. It does not guarantee clients or income.',
      am: 'ALX Freelancer Academy ን የፍሪላንስ ልምምድ ለመገንባት ፕሮግራም ብላ ትገልጸዋለች፦ ክህሎትን ማስቀመጥ፣ ደንበኞችን ማግኘት እና አቅርቦትን ከደንበኛ ግንኙነት ጋር ማስተዳደር። ደንበኞችን ወይም ገቢን አያረጋግጥም።',
      om: 'ALX Freelancer Academy akka sagantaa hojii freelance ijaaruu ibsiti: dandeettii saaguu, maamiltoota argachuu fi kennuu fi walitti dhufeenya maamilaa bulchuu. Maamiltoota ykn galii hin mirkaneessu.',
      ti: 'ALX Freelancer Academy ከም መደብ ንምህናጽ ልምዲ ፍሪላንስ ትገልጾ፦ ክእለት ምቕማጥ፣ ዓማዊል ምርካብን ምሃብን ርክብ ዓማዊልን ምሕደራን። ዓማዊል ወይ ኣታዊ ኣይዋሕስን።',
      so: 'ALX waxay Freelancer Academy ku tilmaamtaa barnaamij lagu dhiso shaqo madaxbannaan: meelaynta xirfadda, helitaanka macaamiisha, iyo maareynta bixinta iyo xiriirka macaamiisha. Ma dammaanad qaaddo macaamiil ama dakhli.',
      ar: 'تصف ALX أكاديمية العمل الحر بأنها برنامج لبناء ممارسة عمل حر: تحديد موضع المهارة، والعثور على العملاء، وإدارة التسليم وعلاقات العملاء. لا تضمن عملاء أو دخلاً.',
    }),
  }),
  entry({
    id: 'find_programmes',
    category: 'admission',
    sourceUrl: URLS.programmes,
    question: {
      en: 'Where can I find ALX programmes?',
      am: 'የALX ፕሮግራሞችን የት ማግኘት እችላለሁ?',
      om: 'Sagantaalee ALX eessaa argadha?',
      ti: 'መደባት ALX ኣበይ ክረክብ እኽእል?',
      so: 'Xaggee ka heli karaa barnaamijyada ALX?',
      ar: 'أين أجد برامج ALX؟',
    },
    keywords: keywords(
      {
        en: ['where can i find alx programmes', 'where are alx programmes', 'find alx programmes'],
        am: ['የalx ፕሮግራሞችን የት', 'ፕሮግራሞችን የት አገኛለሁ'],
        om: ['sagantaalee alx eessaa', 'eessaa argadha sagantaa'],
        ti: ['መደባት alx ኣበይ', 'መደባት ኣበይ ክረክብ'],
        so: ['xaggee ka heli karaa barnaamijyada alx', 'halkee ka heli barnaamijyada'],
        ar: ['أين أجد برامج alx', 'اين اجد برامج alx'],
      },
      ['where can i find alx programmes'],
    ),
    answer: {
      en: 'ALX lists its programmes on the official programmes page: https://www.alxafrica.com/programmes/. Open a programme there to read the description and any steps that page publishes.',
      am: 'ALX ፕሮግራሞቿን በይፋዊው የፕሮግራሞች ገጽ ትዘረዝራለች፦ https://www.alxafrica.com/programmes/። መግለጫውን እና ገጹ የሚያትመውን እርምጃ ለማንበብ ፕሮግራሙን እዚያ ይክፈቱ።',
      om: 'ALX sagantaalee ishee fuula sagantaa ifaajaa irratti tarreessi: https://www.alxafrica.com/programmes/. Ibsa fi tarkaanfii fuulli sun maxxansu dubbisuuf saganticha achitti bani.',
      ti: 'ALX መደባታ ኣብ ወግዓዊ ገጽ መደባት ትዝርዝር፦ https://www.alxafrica.com/programmes/። መግለጺን እቲ ገጽ ዝሕትሞ ስጉምትን ንምንባብ ነቲ መደብ ኣብኡ ክፈት።',
      so: 'ALX waxay barnaamijyadeeda ku taxdaa bogga rasmiga ah ee barnaamijyada: https://www.alxafrica.com/programmes/. Halkaas ka fur barnaamij si aad u akhriso sharaxaadda iyo tallaabooyinka boggaas daabacayo.',
      ar: 'تنشر ALX برامجها في صفحة البرامج الرسمية: https://www.alxafrica.com/programmes/. افتح البرنامج هناك لقراءة الوصف وأي خطوات تنشرها تلك الصفحة.',
    },
  }),
  entry({
    id: 'application_requirements',
    category: 'admission',
    sourceUrl: URLS.programmes,
    question: {
      en: 'How can I learn about application requirements?',
      am: 'ስለ ማመልከቻ መስፈርቶች እንዴት ማወቅ እችላለሁ?',
      om: 'Waa’ee ulaagaa iyyannoo attamitti baradha?',
      ti: 'ብዛዕባ መስርሕ መመልከቲ ብኸመይ ክፈልጥ?',
      so: 'Sideen ku ogaan karaa shuruudaha codsiga?',
      ar: 'كيف أعرف متطلبات التقديم؟',
    },
    keywords: keywords(
      {
        en: ['application requirements', 'eligibility requirements', 'admission requirements', 'how can i learn about application requirements'],
        am: ['የማመልከቻ መስፈርት', 'ብቃት መስፈርት'],
        om: ['ulaagaa iyyannoo', 'ulaagaa fudhatama'],
        ti: ['መስርሕ መመልከቲ', 'መስርሕ ብቕዓት'],
        so: ['shuruudaha codsiga', 'shuruudaha aqbalista'],
        ar: ['متطلبات التقديم', 'شروط القبول', 'شروط الأهلية'],
      },
      ['application requirements', 'eligibility requirements'],
    ),
    answer: {
      en: 'This bot does not store eligibility rules or application requirements. Open the official page for the programme you want and follow the requirements published there. The programmes list is at https://www.alxafrica.com/programmes/.',
      am: 'ይህ ቦት የብቃት ደንቦችን ወይም የማመልከቻ መስፈርቶችን አያስቀምጥም። የሚፈልጉትን ፕሮግራም ይፋዊ ገጽ ይክፈቱ እና እዚያ የታተመውን መስፈርት ይከተሉ። የፕሮግራሞች ዝርዝር በ https://www.alxafrica.com/programmes/ ነው።',
      om: 'Botiin kun seera ulaagaa ykn ulaagaa iyyannoo hin kuusu. Fuula ifaajaa sagantaa barbaadde bani, ulaagaa achitti maxxanfame hordofi. Tarreen sagantaalee https://www.alxafrica.com/programmes/ irratti argama.',
      ti: 'እዚ ቦት ስርዓት ብቕዓት ወይ መስርሕ መመልከቲ ኣይዕቅብን። ነቲ እትደልዮ መደብ ወግዓዊ ገጽ ክፈት፣ ነቲ ኣብኡ ዝተሓትመ መስርሕ ስዓብ። ዝርዝር መደባት ኣብ https://www.alxafrica.com/programmes/ እዩ።',
      so: 'Botkani ma kaydiyo xeerarka u-qalmitaanka ama shuruudaha codsiga. Fur bogga rasmiga ah ee barnaamijka aad rabto oo raac shuruudaha lagu daabacay halkaas. Liiska barnaamijyada waa https://www.alxafrica.com/programmes/.',
      ar: 'لا يخزّن هذا البوت قواعد الأهلية أو متطلبات التقديم. افتح الصفحة الرسمية للبرنامج الذي تريده واتبع المتطلبات المنشورة هناك. قائمة البرامج على https://www.alxafrica.com/programmes/.',
    },
  }),
  entry({
    id: 'programme_availability',
    category: 'admission',
    sourceUrl: URLS.programmes,
    question: {
      en: 'Where can I check programme availability?',
      am: 'የፕሮግራም ተገኝነትን የት ማረጋገጥ እችላለሁ?',
      om: 'Argama sagantaa eessaa mirkaneeffadha?',
      ti: 'ምህላው መደብ ኣበይ ክረጋግጽ?',
      so: 'Xaggee ka hubiyaa helitaanka barnaamijka?',
      ar: 'أين أتحقق من توفر البرنامج؟',
    },
    keywords: keywords(
      {
        en: ['programme availability', 'opening dates', 'is the programme open', 'when does it open'],
        am: ['የፕሮግራም ተገኝነት', 'መቼ ይከፈታል'],
        om: ['argama sagantaa', 'yoom banama'],
        ti: ['ምህላው መደብ', 'መዓስ ይኽፈት'],
        so: ['helitaanka barnaamijka', 'goorma ayaa furmaya'],
        ar: ['توفر البرنامج', 'متى يفتح البرنامج', 'تواريخ الفتح'],
      },
      ['programme availability', 'opening dates'],
    ),
    answer: {
      en: 'Check availability and opening dates on the official programme page. Those details change, and this bot does not confirm whether a programme is open. Start from https://www.alxafrica.com/programmes/.',
      am: 'ተገኝነትን እና የመክፈቻ ቀናትን በይፋዊው የፕሮግራም ገጽ ይመልከቱ። እነዚህ ዝርዝሮች ይቀየራሉ፣ ይህ ቦትም ፕሮግራም ክፍት መሆኑን አያረጋግጥም። ከ https://www.alxafrica.com/programmes/ ይጀምሩ።',
      om: 'Argama fi guyyaa baninsaa fuula sagantaa ifaajaa irratti ilaali. Bal’inni sun ni jijjiirama, botiin kunis sagantichi banamaa akka jiru hin mirkaneessu. https://www.alxafrica.com/programmes/ irraa jalqabi.',
      ti: 'ምህላውን መዓልቲ ምኽፋትን ኣብ ወግዓዊ ገጽ መደብ ርአ። እቲ ዝርዝር ይቕየር፣ እዚ ቦት ድማ መደብ ክፉት ምዃኑ ኣይረጋግጽን። ካብ https://www.alxafrica.com/programmes/ ጀምር።',
      so: 'Ka eeg helitaanka iyo taariikhaha furitaanka bogga rasmiga ah ee barnaamijka. Faahfaahintaas way isbedeshaa, botkanna ma xaqiijiyo in barnaamijku furan yahay. Ka bilow https://www.alxafrica.com/programmes/.',
      ar: 'تحقق من التوفر وتواريخ الفتح في صفحة البرنامج الرسمية. تتغير هذه التفاصيل، ولا يؤكد هذا البوت ما إذا كان البرنامج مفتوحاً. ابدأ من https://www.alxafrica.com/programmes/.',
    },
  }),
  entry({
    id: 'where_to_apply',
    category: 'admission',
    sourceUrl: URLS.programmes,
    question: {
      en: 'Where can I apply?',
      am: 'የት ማመልከት እችላለሁ?',
      om: 'Eessatti iyyachuu danda’a?',
      ti: 'ኣበይ ክመልክት እኽእል?',
      so: 'Xaggee ka codsan karaa?',
      ar: 'أين يمكنني التقديم؟',
    },
    keywords: keywords(
      {
        en: ['where can i apply', 'how do i apply', 'application page', 'apply to alx'],
        am: ['የት ማመልከት', 'እንዴት አመለክታለሁ'],
        om: ['eessatti iyyachuu', 'attamitti iyyadha'],
        ti: ['ኣበይ ክመልክት', 'ከመይ ክመልክት'],
        so: ['xaggee ka codsan karaa', 'sideen u codsadaa'],
        ar: ['أين يمكنني التقديم', 'كيف أقدم', 'صفحة التقديم'],
      },
      ['where can i apply', 'how do i apply'],
    ),
    answer: {
      en: 'Apply on the official ALX page for the programme you choose: https://www.alxafrica.com/programmes/. This bot cannot submit an application or confirm that you will be admitted.',
      am: 'በመረጡት ፕሮግራም ይፋዊ የALX ገጽ ላይ ያመልክቱ፦ https://www.alxafrica.com/programmes/። ይህ ቦት ማመልከቻ ማስገባት ወይም እንደሚቀበሉ ማረጋገጥ አይችልም።',
      om: 'Fuula ALX ifaajaa sagantaa filatte irratti iyyadhu: https://www.alxafrica.com/programmes/. Botiin kun iyyannoo galchuu ykn akka fudhatamtu mirkaneessuu hin danda’u.',
      ti: 'ኣብ ወግዓዊ ገጽ ALX ናይቲ እትመርጽዎ መደብ ኣመልክቱ፦ https://www.alxafrica.com/programmes/። እዚ ቦት መመልከቲ ክሰድድ ወይ ክትቀበሉ ምዃን ክረጋግጽ ኣይክእልን።',
      so: 'Ka codso bogga rasmiga ah ee ALX ee barnaamijka aad doorato: https://www.alxafrica.com/programmes/. Botkani ma gudbin karo codsi mana xaqiijin karo inaad la aqbalayo.',
      ar: 'قدّم عبر الصفحة الرسمية لبرنامج ALX الذي تختاره: https://www.alxafrica.com/programmes/. لا يستطيع هذا البوت إرسال طلب ولا يؤكد أنك ستُقبل.',
    },
  }),
  entry({
    id: 'learning_opportunities',
    category: 'learning',
    sourceUrl: URLS.programmes,
    question: {
      en: 'What learning opportunities does ALX provide?',
      am: 'ALX ምን የመማሪያ እድሎች ታቀርባለች?',
      om: 'ALX carraa barumsaa maal kenna?',
      ti: 'ALX እንታይ ዕድላት ትምህርቲ ትህብ?',
      so: 'Fursado barasho noocee ah ayay ALX bixisaa?',
      ar: 'ما فرص التعلم التي توفرها ALX؟',
    },
    keywords: keywords(
      {
        en: ['learning opportunities', 'what can i learn', 'alx learning'],
        am: ['የመማሪያ እድሎች', 'ምን መማር እችላለሁ'],
        om: ['carraa barumsaa', 'maal barachuu danda’a'],
        ti: ['ዕድላት ትምህርቲ', 'እንታይ ክመሃር'],
        so: ['fursadaha barashada', 'maxaan bari karaa'],
        ar: ['فرص التعلم', 'ماذا يمكنني أن أتعلم'],
      },
      ['learning opportunities', 'what can i learn at alx'],
    ),
    answer: {
      en: 'ALX provides programmes in AI and data, creative work, and entrepreneurship. Each programme is presented as a path toward a career outcome. The official programmes page lists what is currently offered: https://www.alxafrica.com/programmes/.',
      am: 'ALX በAI እና ዳታ፣ በፈጠራ ሥራ እና በሥራ ፈጠራ ፕሮግራሞች ታቀርባለች። እያንዳንዱ ፕሮግራም ወደ የሙያ ውጤት የሚያመራ መንገድ ሆኖ ቀርቧል። ይፋዊው የፕሮግራሞች ገጽ አሁን የሚቀርበውን ይዘረዝራል፦ https://www.alxafrica.com/programmes/።',
      om: 'ALX sagantaalee AI fi dataa, hojii uumamaa fi daldalaa kenna. Sagantaan tokkoon tokkoon akka karaa bu’aa hojiitti dhiyaata. Fuulli sagantaa ifaajaa waan amma kennamu tarreessa: https://www.alxafrica.com/programmes/.',
      ti: 'ALX መደባት ኣብ AIን ዳታን፣ ኣብ ስራሕ ፈጠራዊን ኣብ ስራሕ ፈጣርነትን ትህብ። ነፍሲ ወከፍ መደብ ከም መንገዲ ናብ ውጽኢት ሞያ ይቐርብ። ወግዓዊ ገጽ መደባት ነቲ ሕጂ ዝወሃብ ይዘርዝር፦ https://www.alxafrica.com/programmes/።',
      so: 'ALX waxay bixisaa barnaamijyo AI iyo xog, shaqo hal-abuur leh, iyo ganacsi. Barnaamij kasta waxaa loo soo bandhigaa waddo loogu socdo natiijo xirfadeed. Bogga rasmiga ah wuxuu taxaa waxa hadda la bixiyo: https://www.alxafrica.com/programmes/.',
      ar: 'توفر ALX برامج في الذكاء الاصطناعي والبيانات، والعمل الإبداعي، وريادة الأعمال. يُقدَّم كل برنامج بوصفه مساراً نحو نتيجة مهنية. تسرد صفحة البرامج الرسمية ما هو معروض حالياً: https://www.alxafrica.com/programmes/.',
    },
  }),
  entry({
    id: 'official_updates',
    category: 'learning',
    sourceUrl: URLS.website,
    question: {
      en: 'Where can I find official ALX updates?',
      am: 'ይፋዊ የALX ዜናዎችን የት ማግኘት እችላለሁ?',
      om: 'Odeeffannoo ifaajaa ALX eessaa argadha?',
      ti: 'ወግዓዊ ሓበሬታ ALX ኣበይ ክረክብ?',
      so: 'Xaggee ka heli karaa wararka rasmiga ah ee ALX?',
      ar: 'أين أجد التحديثات الرسمية من ALX؟',
    },
    keywords: keywords(
      {
        en: ['official alx updates', 'alx news', 'official information'],
        am: ['ይፋዊ ዜና', 'የalx ዜና'],
        om: ['odeeffannoo ifaajaa alx', 'oduu alx'],
        ti: ['ወግዓዊ ሓበሬታ alx', 'ዜና alx'],
        so: ['wararka rasmiga ah ee alx', 'macluumaadka rasmiga ah'],
        ar: ['التحديثات الرسمية', 'أخبار alx الرسمية'],
      },
      ['official alx updates', 'alx news'],
    ),
    answer: {
      en: 'Use the official ALX website (https://www.alxafrica.com/) and the eHub support portal (https://ehub.alxafrica.com/) for official information. For programmes, use https://www.alxafrica.com/programmes/. This bot repeats verified FAQ answers and does not replace those sites.',
      am: 'ለይፋዊ መረጃ ይፋዊውን የALX ድረ ገጽ (https://www.alxafrica.com/) እና የeHub ድጋፍ ፖርታል (https://ehub.alxafrica.com/) ይጠቀሙ። ለፕሮግራሞች https://www.alxafrica.com/programmes/ ይጠቀሙ። ይህ ቦት የተረጋገጡ የFAQ መልሶችን ይደግማል እንጂ እነዚህን ጣቢያዎች አይተካም።',
      om: 'Odeeffannoo ifaajaaaf marsariitii ALX ifaajaa (https://www.alxafrica.com/) fi poortaala deeggarsa eHub (https://ehub.alxafrica.com/) fayyadami. Sagantaaf https://www.alxafrica.com/programmes/ fayyadami. Botiin kun deebii FAQ mirkanaa’e irra deebi’a, bakkeewwan sana hin bakka bu’u.',
      ti: 'ንወግዓዊ ሓበሬታ ወግዓዊ መርበብ ALX (https://www.alxafrica.com/)ን ፖርታል ደገፍ eHub (https://ehub.alxafrica.com/)ን ተጠቐም። ንመደባት https://www.alxafrica.com/programmes/ ተጠቐም። እዚ ቦት ዝተረጋገጸ መልሲ FAQ የድግም እምበር ነዞም ገጻት ኣይትክኦምን።',
      so: 'U isticmaal bogga rasmiga ah ee ALX (https://www.alxafrica.com/) iyo bogga taageerada eHub (https://ehub.alxafrica.com/) macluumaad rasmi ah. Barnaamijyada u isticmaal https://www.alxafrica.com/programmes/. Botkani wuxuu ku celiyaa jawaabaha FAQ ee la xaqiijiyay mana beddelayo bogaggaas.',
      ar: 'استخدم موقع ALX الرسمي (https://www.alxafrica.com/) وبوابة دعم eHub (https://ehub.alxafrica.com/) للمعلومات الرسمية. للبرامج استخدم https://www.alxafrica.com/programmes/. يكرر هذا البوت إجابات الأسئلة الموثّقة ولا يحل محل تلك المواقع.',
    },
  }),
  entry({
    id: 'career_support',
    category: 'career',
    sourceUrl: URLS.about,
    question: {
      en: 'Does ALX support career development?',
      am: 'ALX የሙያ እድገትን ትደግፋለች?',
      om: 'ALX guddina hojii ni deeggartii?',
      ti: 'ALX ምዕባለ ሞያ ትድግፍ ድያ?',
      so: 'ALX ma taageertaa horumarinta xirfadda?',
      ar: 'هل تدعم ALX تطوير المسار المهني؟',
    },
    keywords: keywords(
      {
        en: ['career development', 'does alx support career development', 'career support'],
        am: ['የሙያ እድገት', 'alx ሙያ ትደግፋለች'],
        om: ['guddina hojii', 'deeggarsa hojii'],
        ti: ['ምዕባለ ሞያ', 'ደገፍ ሞያ'],
        so: ['horumarinta xirfadda', 'taageerada xirfadda'],
        ar: ['تطوير المسار المهني', 'دعم المسار المهني'],
      },
      ['career development', 'does alx support career development'],
    ),
    answer: {
      en: 'ALX describes its mission as expanding career and entrepreneurial opportunity for young Africans. Its programmes focus on skills for careers, ventures, and freelance work. ALX does not guarantee employment, admission, or income.',
      am: 'ALX ተልዕኮዋን ለወጣት አፍሪካውያን የሙያ እና የሥራ ፈጠራ እድልን ማስፋት ብላ ትገልጸዋለች። ፕሮግራሞቿ በሙያ፣ በሥራ እና በፍሪላንስ ሥራ ክህሎቶች ላይ ያተኩራሉ። ALX ሥራ፣ ቅበላ ወይም ገቢ አታረጋግጥም።',
      om: 'ALX ergamni ishee carraa hojii fi daldalaa dargaggoota Afrikaa bal’isuu akka ta’e ibsiti. Sagantaaleen ishee dandeettii hojii, dhaabbata fi hojii freelance irratti xiyyeeffatu. ALX hojii, fudhatama ykn galii hin mirkaneessu.',
      ti: 'ALX ተልእኮኣ ዕድል ሞያን ስራሕ ፈጠራን ንመንእሰያት ኣፍሪቃ ምስፋሕ ምዃኑ ትገልጽ። መደባታ ኣብ ክእለት ሞያ፣ ስራሕን ፍሪላንስን ይትኩሩ። ALX ስራሕ፣ ተቐባልነት ወይ ኣታዊ ኣይዋሕስን።',
      so: 'ALX waxay himiladeeda ku tilmaamtaa ballaarinta fursadda xirfadeed iyo ganacsiga ee dhalinyarada Afrika. Barnaamijyadeedu waxay diiradda saaraan xirfadaha shaqada, ganacsiga, iyo shaqada madaxbannaan. ALX ma dammaanad qaaddo shaqo, aqbalid, ama dakhli.',
      ar: 'تصف ALX رسالتها بأنها توسيع فرص المسار المهني وريادة الأعمال للشباب الأفارقة. تركز برامجها على مهارات المهن والمشاريع والعمل الحر. لا تضمن ALX توظيفاً أو قبولاً أو دخلاً.',
    },
  }),
  entry({
    id: 'career_opportunities',
    category: 'career',
    sourceUrl: URLS.programmes,
    question: {
      en: 'What career-related opportunities does ALX describe?',
      am: 'ALX ምን ዓይነት ከሙያ ጋር የተያያዙ እድሎች ትገልጻለች?',
      om: 'ALX carraa hojii maal ibsiti?',
      ti: 'ALX እንታይ ዕድላት ሞያ ትገልጽ?',
      so: 'Fursado xirfadeed noocee ah ayay ALX ku tilmaamtaa?',
      ar: 'ما الفرص المهنية التي تصفها ALX؟',
    },
    keywords: keywords(
      {
        en: ['career-related opportunities', 'career opportunities alx describes', 'what careers does alx describe'],
        am: ['ከሙያ ጋር የተያያዙ እድሎች', 'የሙያ እድሎች'],
        om: ['carraa hojii alx', 'carraa hojii maal'],
        ti: ['ዕድላት ሞያ alx', 'ዕድላት ስራሕ'],
        so: ['fursadaha xirfadeed', 'fursadaha shaqada alx'],
        ar: ['الفرص المهنية', 'فرص المسار المهني التي تصفها alx'],
      },
      ['career-related opportunities', 'career opportunities'],
    ),
    answer: {
      en: 'ALX describes learning paths connected to data, artificial intelligence, content creation, graphic design, founding a venture, and freelancing. These are education programmes, not job offers. Completing a programme does not guarantee employment or income.',
      am: 'ALX ከዳታ፣ ከአርቴፊሻል ኢንተለጀንስ፣ ከይዘት ፈጠራ፣ ከግራፊክ ዲዛይን፣ ሥራ ከመገንባት እና ከፍሪላንስ ጋር የተያያዙ የመማሪያ መንገዶች ትገልጻለች። እነዚህ የትምህርት ፕሮግራሞች ናቸው እንጂ የሥራ አቅርቦት አይደሉም። ፕሮግራም መጨረስ ሥራ ወይም ገቢ አያረጋግጥም።',
      om: 'ALX karaalee barumsaa dataa, intellijinsii namtolchee, uumama qabiyyee, dizaayinii giraafikii, dhaabbata ijaaruu fi freelance waliin walqabatan ibsiti. Isaan kun sagantaalee barumsaati, dhiyeessii hojii miti. Sagantaa xumuruun hojii ykn galii hin mirkaneessu.',
      ti: 'ALX መንገድታት ትምህርቲ ምስ ዳታ፣ ኣርቲፊሻል ኢንተለጀንስ፣ ምፍጣር ትሕዝቶ፣ ግራፊክ ዲዛይን፣ ስራሕ ምስራሕን ፍሪላንስን ዝተኣሳሰሩ ትገልጽ። እዚኦም መደባት ትምህርቲ እዮም፣ ናይ ስራሕ ቅድመ-ዓይነት ኣይኮኑን። መደብ ምዝዛም ስራሕ ወይ ኣታዊ ኣይዋሕስን።',
      so: 'ALX waxay ku tilmaamtaa waddooyin barasho oo ku xiran xogta, sirdoonka macmalka ah, abuurista waxyaabaha, naqshadeynta garaafka, dhisidda ganacsi, iyo shaqada madaxbannaan. Kuwani waa barnaamijyo waxbarasho, ma aha ballan shaqo. Dhammaystirka barnaamij ma dammaanad qaado shaqo ama dakhli.',
      ar: 'تصف ALX مسارات تعلّم متصلة بالبيانات، والذكاء الاصطناعي، وإنشاء المحتوى، والتصميم الجرافيكي، وتأسيس مشروع، والعمل الحر. هذه برامج تعليم، وليست عروض وظائف. إكمال برنامج لا يضمن توظيفاً أو دخلاً.',
    },
  }),
  entry({
    id: 'career_programmes',
    category: 'career',
    sourceUrl: URLS.programmes,
    question: {
      en: 'Where can I learn more about ALX career programmes?',
      am: 'ስለ ALX የሙያ ፕሮግራሞች ተጨማሪ የት ማወቅ እችላለሁ?',
      om: 'Waa’ee sagantaa hojii ALX dabalataa eessaa baradha?',
      ti: 'ብዛዕባ መደባት ሞያ ALX ተወሳኺ ኣበይ ክመሃር?',
      so: 'Xaggee ka baran karaa wax badan oo ku saabsan barnaamijyada xirfadda ee ALX?',
      ar: 'أين أتعرّف أكثر على برامج ALX المهنية؟',
    },
    keywords: keywords(
      {
        en: ['learn more about alx career programmes', 'career programmes page', 'where can i learn more about career programmes'],
        am: ['የሙያ ፕሮግራሞች ተጨማሪ', 'ስለ ሙያ ፕሮግራም'],
        om: ['sagantaa hojii dabalataa', 'fuula sagantaa hojii'],
        ti: ['መደባት ሞያ ተወሳኺ', 'ገጽ መደብ ሞያ'],
        so: ['wax badan oo ku saabsan barnaamijyada xirfadda', 'bogga barnaamijyada xirfadda'],
        ar: ['برامج المسار المهني', 'المزيد عن البرامج المهنية'],
      },
      ['alx career programmes', 'learn more about career programmes'],
    ),
    answer: {
      en: 'Read the official programmes page and the page for each programme: https://www.alxafrica.com/programmes/. Those pages are the source for the current description, time commitment, and whether applications are open.',
      am: 'ይፋዊውን የፕሮግራሞች ገጽ እና የእያንዳንዱን ፕሮግራም ገጽ ያንብቡ፦ https://www.alxafrica.com/programmes/። እነዚህ ገጾች ለአሁኑ መግለጫ፣ ለጊዜ ቁርጠኝነት እና ማመልከቻ ክፍት መሆኑ ምንጭ ናቸው።',
      om: 'Fuula sagantaa ifaajaa fi fuula sagantaa tokkoon tokkoon dubbisi: https://www.alxafrica.com/programmes/. Fuulonni sun madda ibsa ammaa, yeroo kennitu fi iyyannoon banamaa ta’uu isaati.',
      ti: 'ነቲ ወግዓዊ ገጽ መደባትን ገጽ ነፍሲ ወከፍ መደብን ኣንብብ፦ https://www.alxafrica.com/programmes/። እቶም ገጻት ምንጪ ናይ ሕጂ መግለጺ፣ ናይ ግዜ ቃል ዝኣተወን መመልከቲ ክፉት ምዃንን እዮም።',
      so: 'Akhri bogga rasmiga ah ee barnaamijyada iyo bogga barnaamij kasta: https://www.alxafrica.com/programmes/. Bogaggaas waa isha sharaxaadda hadda, waqtiga loo baahan yahay, iyo in codsiyadu furan yihiin.',
      ar: 'اقرأ صفحة البرامج الرسمية وصفحة كل برنامج: https://www.alxafrica.com/programmes/. تلك الصفحات هي مصدر الوصف الحالي والالتزام الزمني وما إذا كان التقديم مفتوحاً.',
    },
  }),
  entry({
    id: 'get_support',
    category: 'support',
    sourceUrl: URLS.support,
    question: {
      en: 'Where can I get ALX support?',
      am: 'የALX ድጋፍ የት ማግኘት እችላለሁ?',
      om: 'Deeggarsa ALX eessaa argadha?',
      ti: 'ደገፍ ALX ኣበይ ክረክብ?',
      so: 'Xaggee ka heli karaa taageerada ALX?',
      ar: 'أين أحصل على دعم ALX؟',
    },
    keywords: keywords(
      {
        en: ['alx support', 'ehub', 'where can i get alx support', 'help portal'],
        am: ['የalx ድጋፍ', 'ehub', 'እርዳታ የት'],
        om: ['deeggarsa alx', 'ehub', 'eessaa deeggarsa'],
        ti: ['ደገፍ alx', 'ehub', 'ሓገዝ ኣበይ'],
        so: ['taageerada alx', 'ehub', 'xaggee ka heli taageero'],
        ar: ['دعم alx', 'ehub', 'بوابة الدعم'],
      },
      ['alx support', 'ehub'],
    ),
    answer: {
      en: 'Official ALX support is the eHub portal: https://ehub.alxafrica.com/. This bot can share FAQ answers. If the bot operator has connected a support chat, you can ask the bot to forward a question there. A forward happens only after Telegram accepts the message, and it is separate from eHub.',
      am: 'ይፋዊ የALX ድጋፍ የeHub ፖርታል ነው፦ https://ehub.alxafrica.com/። ይህ ቦት የFAQ መልሶችን ሊያጋራ ይችላል። ኦፐሬተሩ የድጋፍ ውይይት ካገናኘ፣ ጥያቄ እዚያ እንዲላክ መጠየቅ ይችላሉ። መላክ የሚሆነው ቴሌግራም መልዕክቱን ከተቀበለ በኋላ ብቻ ነው፣ ከeHubም የተለየ ነው።',
      om: 'Deeggarsi ALX ifaajaa poortaala eHub dha: https://ehub.alxafrica.com/. Botiin kun deebii FAQ qooduu danda’a. Yoo opireetariin marii deeggarsa qunname, gaaffii achitti akka ergitu gaafachuu dandeessa. Ergamni Telegram ergaa erga fudhateen booda qofa ta’a, eHub irraas adda.',
      ti: 'ወግዓዊ ደገፍ ALX ፖርታል eHub እዩ፦ https://ehub.alxafrica.com/። እዚ ቦት መልሲ FAQ ክካፈል ይኽእል። ኦፐረተር ደገፍ ዕላል እንተ ኣራኺቡ፣ ሕቶ ናብኡ ክስደድ ክትሓቱ ትኽእሉ። ምስዳድ ቴሌግራም ነቲ መልእኽቲ ምስ ተቐበለ ጥራይ እዩ፣ ካብ eHub’ውን ፍሉይ እዩ።',
      so: 'Taageerada rasmiga ah ee ALX waa bogga eHub: https://ehub.alxafrica.com/. Botkani wuxuu wadaagi karaa jawaabaha FAQ. Haddii hawlwadeenka uu xidhay sheeko taageero, waad weydiisan kartaa in su’aal loo diro halkaas. Gudbintu waxay dhacdaa kaliya ka dib marka Telegram aqbalo fariinta, waana ka duwan tahay eHub.',
      ar: 'الدعم الرسمي من ALX هو بوابة eHub: https://ehub.alxafrica.com/. يمكن لهذا البوت مشاركة إجابات الأسئلة الشائعة. إذا ربط مشغّل البوت محادثة دعم، يمكنك أن تطلب تحويل سؤال إليها. يتم التحويل فقط بعد أن يقبل تيليغرام الرسالة، وهو منفصل عن eHub.',
    },
  }),
  entry({
    id: 'official_website',
    category: 'support',
    sourceUrl: URLS.website,
    question: {
      en: 'Where is the official ALX website?',
      am: 'ይፋዊው የALX ድረ ገጽ የት ነው?',
      om: 'Marsariitiin ALX ifaajaa eessa?',
      ti: 'ወግዓዊ መርበብ ALX ኣበይ እዩ?',
      so: 'Xaggee ayuu yahay bogga rasmiga ah ee ALX?',
      ar: 'أين موقع ALX الرسمي؟',
    },
    keywords: keywords(
      {
        en: ['official alx website', 'alx website', 'alxafrica.com'],
        am: ['የalx ድረ ገጽ', 'ይፋዊ ድረ ገጽ'],
        om: ['marsariitii alx', 'marsariitii ifaajaa'],
        ti: ['መርበብ alx', 'ወግዓዊ መርበብ'],
        so: ['bogga rasmiga ah ee alx', 'website ka alx'],
        ar: ['موقع alx الرسمي', 'الموقع الرسمي'],
      },
      ['official alx website', 'alxafrica.com'],
    ),
    answer: {
      en: 'The official ALX website is https://www.alxafrica.com/. Information about the organisation is on the About page: https://www.alxafrica.com/about/.',
      am: 'ይፋዊው የALX ድረ ገጽ https://www.alxafrica.com/ ነው። ስለ ድርጅቱ መረጃ በስለ እኛ ገጽ ላይ ነው፦ https://www.alxafrica.com/about/።',
      om: 'Marsariitiin ALX ifaajaa https://www.alxafrica.com/ dha. Odeeffannoon waa’ee dhaabbatichaa fuula About irratti argama: https://www.alxafrica.com/about/.',
      ti: 'ወግዓዊ መርበብ ALX https://www.alxafrica.com/ እዩ። ሓበሬታ ብዛዕባ ትካል ኣብ ገጽ About እዩ፦ https://www.alxafrica.com/about/።',
      so: 'Bogga rasmiga ah ee ALX waa https://www.alxafrica.com/. Macluumaadka ururka wuxuu ku yaallaa bogga About: https://www.alxafrica.com/about/.',
      ar: 'موقع ALX الرسمي هو https://www.alxafrica.com/. معلومات المنظمة في صفحة About: https://www.alxafrica.com/about/.',
    },
  }),
  entry({
    id: 'find_programme_info',
    category: 'support',
    sourceUrl: URLS.programmes,
    question: {
      en: 'Where can I find programme information?',
      am: 'የፕሮግራም መረጃን የት ማግኘት እችላለሁ?',
      om: 'Odeeffannoo sagantaa eessaa argadha?',
      ti: 'ሓበሬታ መደብ ኣበይ ክረክብ?',
      so: 'Xaggee ka heli karaa macluumaadka barnaamijka?',
      ar: 'أين أجد معلومات البرنامج؟',
    },
    keywords: keywords(
      {
        en: ['programme information', 'where can i find programme information', 'program information'],
        am: ['የፕሮግራም መረጃ', 'መረጃ ፕሮግራም የት'],
        om: ['odeeffannoo sagantaa', 'odeeffannoo sagantaa eessaa'],
        ti: ['ሓበሬታ መደብ', 'ሓበሬታ መደብ ኣበይ'],
        so: ['macluumaadka barnaamijka', 'xaggee ka heli macluumaadka barnaamijka'],
        ar: ['معلومات البرنامج', 'أين أجد معلومات البرنامج'],
      },
      ['programme information', 'program information'],
    ),
    answer: {
      en: 'Programme information is published at https://www.alxafrica.com/programmes/. Select a programme to see its official description and current status. This bot does not replace that page.',
      am: 'የፕሮግራም መረጃ በ https://www.alxafrica.com/programmes/ ታትሟል። ይፋዊ መግለጫውን እና ወቅታዊ ሁኔታውን ለማየት ፕሮግራም ይምረጡ። ይህ ቦት ያንን ገጽ አይተካም።',
      om: 'Odeeffannoon sagantaa https://www.alxafrica.com/programmes/ irratti maxxanfame. Ibsa ifaajaa fi haala ammaa isaa arguuf sagantaa filadhu. Botiin kun fuula sana hin bakka bu’u.',
      ti: 'ሓበሬታ መደብ ኣብ https://www.alxafrica.com/programmes/ ተሓቲሙ ኣሎ። ወግዓዊ መግለጺኡን ኩነታቱ ሕጂን ንምርኣይ መደብ ምረጽ። እዚ ቦት ነቲ ገጽ ኣይትክኦን።',
      so: 'Macluumaadka barnaamijka waxaa lagu daabacay https://www.alxafrica.com/programmes/. Dooro barnaamij si aad u aragto sharaxaaddiisa rasmiga ah iyo xaaladdiisa hadda. Botkani ma beddelayo boggaas.',
      ar: 'تُنشر معلومات البرامج على https://www.alxafrica.com/programmes/. اختر برنامجاً لرؤية وصفه الرسمي وحالته الحالية. لا يحل هذا البوت محل تلك الصفحة.',
    },
  }),
];

const byId = new Map(faqEntries.map((item) => [item.id, item]));

export function getFaqById(id) {
  return byId.get(id) || null;
}

export function getFaqsByCategory(categoryId) {
  return faqEntries.filter(
    (item) => item.category === categoryId || (item.alsoIn || []).includes(categoryId),
  );
}

export { URLS };
