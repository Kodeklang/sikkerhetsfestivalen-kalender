// Service worker for the Sikkerhetsfestivalen programme.
//
// The whole site is taken on the way in: every day grid, every talk, every
// photo. It comes to about 5MB, which is a one-time cost and buys a programme
// that works in a basement conference room with no signal at all - including
// talks the visitor never happened to open while they still had it.
//
// The shell is cached at install and the rest once this worker is in charge,
// because activation is what carries an update to a page that is already open.
//
// The cache name carries a hash of the programme *and* every shipped asset, so
// any real change retires the old cache wholesale.

const CACHE = "sf-b36e9f21b083";

const BASE = "/";

// What the app cannot run without. This list is taken atomically: if any of it
// cannot be had, the install fails and the old worker stays in charge, which is
// better than activating a cache that is missing the stylesheet.
//
// Day one's url *is* BASE, so the loop already covers the front page. Listing
// it twice would make cache.addAll reject the whole install on duplicates.
const SHELL = [
  "/",
  "/dag/2/",
  "/dag/3/",
  "/css/style.css?v=b36e9f21b083",
  "/css/fonts.css?v=b36e9f21b083",
  "/js/app.js?v=b36e9f21b083",
  "/js/rum.js?v=b36e9f21b083",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/icon-192.png",
];

// Everything else the site publishes. Deduplicated because two speakers sharing
// a photo share its generated URL - eleventy-img names derivatives after the
// contents of the source, so identical images collapse onto one file.
const REST = [...new Set([
  // The detail pages: the whole point of precaching this much.
  "/program/velkommen-til-sikkerhetsfestivalen-1088221/",
  "/program/threat-modeling-developer-behaviour-the-psychology-of-bad-co-1208433/",
  "/program/sikkerhetsfestivalen-ctf-1214623/",
  "/program/topplederpanel-cybersikkerhet-og-digital-suverenitet-1236749/",
  "/program/ground-control-to-major-tom-your-circuit-s-dead-space-cybers-1169979/",
  "/program/claude-make-me-a-security-engineer-make-no-mistakes-1155989/",
  "/program/key-challenges-in-api-security-1170473/",
  "/program/eu-regelverk-er-egentlig-bare-sunn-fornuft-om-du-gjor-det-re-1313556/",
  "/program/sikkerhet-som-den-ideelle-lagspiller-teamforskning-som-viser-1171307/",
  "/program/zero-infrastructure-intelligence-building-serverless-cti-pip-1203909/",
  "/program/vi-ma-ha-fabrikken-opp-igjen-innen-sondag-1166716/",
  "/program/las-kort-alarm-og-kode-hvorfor-fysiske-systemer-ikke-er-sa-s-1166519/",
  "/program/fra-compliance-til-testet-robusthet-reell-sikring-av-kontrol-1146389/",
  "/program/forretningskontinuitet-i-to-perspektiver-styring-og-beskytte-1145424/",
  "/program/at-the-dna-of-every-company-identity-and-access-management-1167569/",
  "/program/emerging-cyber-forensics-challenges-what-the-c-suite-must-kn-1302446/",
  "/program/nar-mat-blir-geopolitikk-slik-sikrer-vi-norges-matfat-sammen-1092840/",
  "/program/fallgruver-og-suksessfaktorer-i-personellsikkerhetsarbeidet--1168418/",
  "/program/fremtidens-soc-med-telenor-1311726/",
  "/program/sitter-vi-fast-i-skyen-1090795/",
  "/program/the-quantum-countdown-procrastinate-or-migrate-1171105/",
  "/program/krav-til-cybersikkerhet-i-en-usikker-tid-nis2-digitalsikkerh-1155834/",
  "/program/maritime-naering-i-skuddlinjen-erfaringer-fra-dagene-da-usa--1173199/",
  "/program/insecure-vibes-the-risks-of-ai-assisted-coding-1301482/",
  "/program/when-defenders-go-low-we-go-high-level-bypassing-application-1170902/",
  "/program/maverick-riskjockey-en-ai-drevet-ciso-funksjon-1170716/",
  "/program/10-dumme-sporsmal-og-hva-de-avslorer-om-sikkerhetskulturen-1171477/",
  "/program/et-tu-vendor-a-story-of-vendor-ransomware-leaks-and-heartach-1120290/",
  "/program/multi-agent-orchestration-to-catch-bad-guys-1172779/",
  "/program/the-endpoint-that-walks-mobile-devices-as-physical-security--1114608/",
  "/program/a-recipe-for-resilience-using-purdue-and-iec-62443-to-secure-1089501/",
  "/program/ledelse-under-press-den-menneskelige-dimensjon-1315073/",
  "/program/en-felles-iam-virkelighet-for-offentlig-sektor-er-det-mulig-1108992/",
  "/program/ai-i-digital-etterforskning-1173633/",
  "/program/sykt-mange-sikkerhetskrav-i-offentlig-anskaffelse-ma-det-vae-1171342/",
  "/program/innsiderisiko-forskningsperspektiver-og-forelopige-funn-1167428/",
  "/program/agentisk-soc-hos-sto-1311727/",
  "/program/hawaii-pizza-how-dare-you-or-do-i-really-care-1168502/",
  "/program/pqc-migrasjon-for-store-virksomheter-1148467/",
  "/program/sikkerhetskrav-i-randsonen-slik-treffer-sikkerhetskravene-un-1174160/",
  "/program/cyberoperasjoner-som-sikkerhetspolitisk-virkemiddel-1166744/",
  "/program/your-agents-have-trust-issues-securing-ai-in-the-wild-west-o-1167435/",
  "/program/role-confusion-in-dns-1167432/",
  "/program/slutt-a-late-som-du-jobber-risikobasert-1169797/",
  "/program/the-average-employee-doesn-t-exist-measuring-security-cultur-1170561/",
  "/program/nobody-cares-about-your-intel-until-they-do-lessons-from-bui-1195967/",
  "/program/phishing-dekonstruert-hva-virker-og-hva-kan-vi-laere-av-det-1170635/",
  "/program/sertifiseringen-deres-stopper-meg-ikke-i-dora-fysisk-sikkerh-1171230/",
  "/program/ot-sikkerhet-i-matbransjen-noen-erfaringer-1183899/",
  "/program/ai-empowered-digital-twin-based-security-orchestration-autom-1168751/",
  "/program/vet-du-hvor-mange-som-jobber-for-deg-ai-agenter-som-risiko-o-1144579/",
  "/program/cloud-forensics-challenges-and-best-practices-1171283/",
  "/program/fra-kontroll-til-samarbeid-slik-bygger-vi-reell-sikkerhet-i--1170328/",
  "/program/ingunn-nesheim-1167668/",
  "/program/state-of-the-union-ai-in-security-2026-1141927/",
  "/program/security-at-scale-lessons-learned-from-equinor-s-security-co-1129123/",
  "/program/riv-pkiene-1168380/",
  "/program/digitale-spokelser-ki-agenter-uten-kontroll-i-norske-virksom-1170503/",
  "/program/suverenitet-uten-digital-selvskading-1169327/",
  "/program/testing-api-business-logic-with-ai-agents-what-we-got-wrong--1169692/",
  "/program/teamfiltration-goes-brrr-1153096/",
  "/program/a-bygge-sikkerhet-fra-dag-en-styringssystem-og-sikkerhetsorg-1090205/",
  "/program/a-styre-det-usynlige-psykososial-risiko-i-sikkerhetsarbeidet-1166481/",
  "/program/nar-angrepet-er-ekte-nok-laerdom-fra-tiber-no-1153940/",
  "/program/hvorfor-deteksjonene-dine-suger-og-hva-du-kan-gjore-med-det-1090027/",
  "/program/nar-risikoen-er-fysisk-svaret-er-digitalt-navs-nye-verktoy-f-1170683/",
  "/program/safety-is-no-longer-enough-why-modern-ot-risk-assessment-nee-1170647/",
  "/program/endringsevne-i-skyen-fra-risiko-til-robusthet-1166453/",
  "/program/bankid-en-falsk-trygghet-1169838/",
  "/program/analyzing-ransomware-exfiltration-infrastructure-1155095/",
  "/program/hvordan-lykkes-med-tredjeparts-risikostyring-tprm-1170585/",
  "/program/du-ser-det-ikke-for-du-tror-det-1167572/",
  "/program/a-deeper-dive-in-the-mjosa-uh-esa-lake-1171009/",
  "/program/internet-voting-in-estonia-1184194/",
  "/program/fra-kontraktsinngaelse-til-exit-hvordan-tilrettelegge-for-en-1169342/",
  "/program/sikkerhetsloven-neste-compliance-sjokk-for-norsk-naeringsliv-1170384/",
  "/program/sikring-i-sanntid-av-sanntidsteknologi-for-web-1171406/",
  "/program/oidc-in-security-by-obscurity-1167616/",
  "/program/storskala-sikkerhet-hvordan-verdens-storste-selskaper-jobber-1173814/",
  "/program/hva-skjedde-nar-vi-tok-med-adferdspsykologer-inn-i-kultur-ar-1167545/",
  "/program/from-chatbots-to-autonomous-malware-the-evolution-of-ai-powe-1174324/",
  "/program/dataops-on-prem-logg-og-analyse-i-stor-skala-1174051/",
  "/program/kan-vi-stole-blindt-pa-smart-teknologi-1170762/",
  "/program/hva-kan-ga-galt-nar-ferga-ligger-til-kai-1171346/",
  "/program/a-question-of-when-not-if-how-cyber-threats-can-endanger-fin-1167951/",
  "/program/spring-cleaning-how-ai-took-out-a-decade-of-identity-debt-1154722/",
  "/program/linux-under-angrep-hvordan-sikre-kritiske-systemer-i-mote-me-1169511/",
  "/program/leverandorkjedeangrep-sett-fra-trusselaktorens-perspektiv-1141011/",
  "/program/jeg-ble-karet-til-en-av-norges-viktigste-ciso-er-av-en-algor-1168493/",
  "/program/infrastructure-as-code-is-still-infrastructure-1129082/",
  "/program/balancing-security-usability-and-performance-in-real-world-e-1170679/",
  "/program/nar-jussen-moter-teknologien-og-begge-moter-virkeligheten-si-1171226/",
  "/program/last-man-standing-hvordan-sikre-operativ-evne-nar-digitale-t-1170524/",
  "/program/inside-the-npm-supply-chain-attacks-lessons-from-a-worm-on-t-1166559/",
  "/program/no-key-required-bypassing-application-layer-encryption-with--1170264/",
  "/program/beyond-standalone-risk-assessments-making-cyber-risk-relevan-1139447/",
  "/program/hvordan-skape-suksess-med-digitale-kurs-en-aerlig-fortelling-1171218/",
  "/program/lessons-learned-and-laughs-from-incident-response-1144955/",
  "/program/integrert-sikring-i-sykehusprosjekter-fra-idefase-til-drift-1170273/",
  "/program/bridging-the-gap-between-ot-and-it-expert-panel-1173921/",
  "/program/no-organization-is-an-island-hvordan-finne-det-som-betyr-noe-1171018/",
  "/program/passkeys-migration-in-the-enterprise-1173943/",
  "/program/a-closer-look-at-what-we-suspect-is-vibe-coded-ransomware-1166463/",
  "/program/leverandoravhengighet-i-et-beredskapsperspektiv-eu-kravene-s-1169506/",
  "/program/er-konsulenten-din-en-risiko-i-sikkerhetsgraderte-anskaffels-1142788/",
  "/program/no-more-shadow-it-governing-linux-desktops-with-intune-and-c-1166587/",
  "/program/trust-and-democracy-in-the-age-of-ai-1237505/",
  "/program/artikkel-32-i-praksis-slik-ivaretar-vi-den-registrerte-1152705/",
  "/program/offense-is-the-best-defense-the-evolution-of-ukrainian-cyber-1169343/",
  "/program/the-invisible-privileged-user-attack-path-mapping-across-you-1168543/",
  "/program/i-like-big-shares-and-i-cannot-lie-1147782/",
  "/program/governance-theatre-vs-reality-fixing-the-operating-model-beh-1129148/",
  "/program/sikkerhetskultur-erfaringer-fra-en-innenfra-og-ut-tilnaermin-1151961/",
  "/program/when-threats-become-multifaceted-how-the-police-prioritize-i-1169680/",
  "/program/hvem-eier-krisen-nar-sikkerhetshendelsen-treffer-pa-tvers-av-1171339/",
  "/program/nar-fysisk-sikkerhet-blir-shadow-it-hvem-eier-egentlig-kamer-1167370/",
  "/program/how-to-prioritise-within-ot-in-light-of-a-chaotic-time-1174099/",
  "/program/bli-en-del-av-norges-beredskap-1124990/",
  "/program/deepfake-detection-in-the-real-world-1171217/",
  "/program/design-intent-vs-digital-residue-inside-a-forensic-research--1170721/",
  "/program/vare-sarbare-nettverk-1171443/",
  "/program/kartlegging-av-hoyrisikoroller-og-menneskelige-sarbarheter-1148224/",
  "/program/nar-ot-moter-cloud-native-muligheter-og-risikoer-i-skjaering-1170279/",
  "/program/cryptography-and-export-controls-1169428/",
  "/program/ai-agenter-og-personvern-trenger-jeg-en-dpia-1174328/",
  "/program/fra-analyse-til-gjennomforing-effektiv-fysisk-sikring-i-poli-1171401/",
  "/program/when-freedom-is-at-stake-from-ukraine-s-frontline-to-norwegi-1170937/",
  "/program/building-tpt-from-alert-chaos-to-clear-priorities-1128991/",
  "/program/delegating-your-attack-surface-through-oauth-consents-1169263/",
  "/program/steering-the-ai-revolution-building-trust-and-accountability-1169804/",
  "/program/cybersikkerhet-er-ogsa-kultur-empiriske-funn-om-nasjonale-fo-1171069/",
  "/program/hunting-international-cyber-criminals-1169604/",
  "/program/ai-i-soc-en-hva-vi-laerte-av-a-bygge-en-agentisk-triage-assi-1151290/",
  "/program/lykketioringen-som-forsvant-en-leksjon-i-strategisk-blindhet-1168026/",
  "/program/genai-in-the-war-room-crafting-facilitating-and-analyzing-ot-1172376/",
  "/program/minimum-viable-company-nar-alt-star-pa-spill-hva-er-det-vikt-1168867/",
  "/program/virksomhetslommebok-hva-er-det-1169631/",
  "/program/reducing-business-risk-through-proactive-digital-forensics-1173978/",
  "/program/nar-leverandoren-blir-angrepet-hvem-tar-regningen-1170735/",
  "/program/bry-deg-hvorfor-arbeidsmiljo-er-et-av-vare-viktigste-tiltak-1168379/",
  "/program/your-source-code-is-under-attack-who-s-defending-it-1139513/",
  "/program/cryptanalysis-with-claude-code-1171010/",
  "/program/risiko-med-to-briller-fria-og-dpia-i-ki-prosjekter-1169532/",
  "/program/hack-faster-than-you-deploy-integrating-continuous-penetrati-1171475/",
  "/program/wsl-nice-for-developers-even-nicer-for-red-teamers-1169561/",
  "/program/verdivurdering2025-final-v4-endelig-xlsx-1169569/",
  "/program/det-er-ikke-deg-det-er-systemet-hop-som-nokkelen-til-robust--1168637/",
  "/program/exposing-a-cybercrime-network-1166353/",
  "/program/hvordan-overleve-en-pentest-1152135/",
  "/program/fra-styrerom-til-sikkerhetsvakt-den-rode-traden-fra-risikost-1166393/",
  "/program/pirates-of-the-north-sea-1170287/",
  "/program/kriseledelse-i-blindebukk-strategi-og-jus-nar-skjermene-gar--1166313/",
  "/program/hva-gjor-vi-for-de-sma-1169995/",
  "/program/supply-chain-security-protecting-your-business-end-to-end-1171185/",
  "/program/innsidere-og-spionasje-1132176/",
  "/program/ci-cd-the-most-privileged-system-in-your-cloud-1169659/",
  "/program/employer-oversight-meets-neural-insight-business-case-risks--1169723/",
  "/program/upn-gone-wrong-breaking-identity-security-in-azure-entra-id-1170369/",
  "/program/passord-trusselmodell-beskyttelse-og-hvorfor-kompleksitet-be-1140152/",
  // Speaker photos, in both the grid and the detail size.
  "/img/av/_mmpuy7-9u-64.webp", "/img/av/_mmpuy7-9u-128.webp",
  "/img/av/qUMhZGrSmH-64.webp", "/img/av/qUMhZGrSmH-128.webp",
  "/img/av/17XcnoGtDZ-64.webp", "/img/av/17XcnoGtDZ-128.webp",
  "/img/av/h6oSoPHCqg-64.webp", "/img/av/h6oSoPHCqg-128.webp",
  "/img/av/irsZefBZ2I-64.webp", "/img/av/irsZefBZ2I-128.webp",
  "/img/av/QpKO2f7QlV-64.webp", "/img/av/QpKO2f7QlV-128.webp",
  "/img/av/sAyUFAw6IL-64.webp", "/img/av/sAyUFAw6IL-128.webp",
  "/img/av/uIiD9vyrIC-64.webp", "/img/av/uIiD9vyrIC-128.webp",
  "/img/av/vUCu9RpKej-64.webp", "/img/av/vUCu9RpKej-128.webp",
  "/img/av/BbNQiZU3Yy-64.webp", "/img/av/BbNQiZU3Yy-128.webp",
  "/img/av/LO8HKl2u5c-64.webp", "/img/av/LO8HKl2u5c-128.webp",
  "/img/av/sMGKB3LVNA-64.webp", "/img/av/sMGKB3LVNA-128.webp",
  "/img/av/itI_nIHdzE-64.webp", "/img/av/itI_nIHdzE-128.webp",
  "/img/av/dTdYiv3GwH-64.webp", "/img/av/dTdYiv3GwH-128.webp",
  "/img/av/AppI79Sia6-64.webp", "/img/av/AppI79Sia6-128.webp",
  "/img/av/p4pqFbybHG-64.webp", "/img/av/p4pqFbybHG-128.webp",
  "/img/av/gqaQVuV_Kv-64.webp", "/img/av/gqaQVuV_Kv-128.webp",
  "/img/av/_yVXon7cIO-64.webp", "/img/av/_yVXon7cIO-128.webp",
  "/img/av/PlOoeGTMf--64.webp", "/img/av/PlOoeGTMf--128.webp",
  "/img/av/_JN_O8LgAi-64.webp", "/img/av/_JN_O8LgAi-128.webp",
  "/img/av/W6glPr_w_C-64.webp", "/img/av/W6glPr_w_C-128.webp",
  "/img/av/-6vmAwlcT1-64.webp", "/img/av/-6vmAwlcT1-128.webp",
  "/img/av/mqfzWjFiGI-64.webp", "/img/av/mqfzWjFiGI-128.webp",
  "/img/av/aRxZJ60xYG-64.webp", "/img/av/aRxZJ60xYG-128.webp",
  "/img/av/pZUwRY-Gxl-64.webp", "/img/av/pZUwRY-Gxl-128.webp",
  "/img/av/hdLiJ0_TcY-64.webp", "/img/av/hdLiJ0_TcY-128.webp",
  "/img/av/y9B4KMLqIr-64.webp", "/img/av/y9B4KMLqIr-128.webp",
  "/img/av/7_fTeBjUMV-64.webp", "/img/av/7_fTeBjUMV-128.webp",
  "/img/av/Jqu-WK-uWl-64.webp", "/img/av/Jqu-WK-uWl-128.webp",
  "/img/av/cjmqqqGnS0-64.webp", "/img/av/cjmqqqGnS0-128.webp",
  "/img/av/_gySsKVRbN-64.webp", "/img/av/_gySsKVRbN-128.webp",
  "/img/av/wNV_S5Xucu-64.webp", "/img/av/wNV_S5Xucu-128.webp",
  "/img/av/ZjkFORUNZY-64.webp", "/img/av/ZjkFORUNZY-128.webp",
  "/img/av/zMxWFC6-mw-64.webp", "/img/av/zMxWFC6-mw-128.webp",
  "/img/av/XnfmWVdfMF-64.webp", "/img/av/XnfmWVdfMF-128.webp",
  "/img/av/FfsiNz4bxM-64.webp", "/img/av/FfsiNz4bxM-128.webp",
  "/img/av/0gJBNTW0q--64.webp", "/img/av/0gJBNTW0q--128.webp",
  "/img/av/i19Hcy3BO--64.webp", "/img/av/i19Hcy3BO--128.webp",
  "/img/av/kWhKlFwNS3-64.webp", "/img/av/kWhKlFwNS3-128.webp",
  "/img/av/tR6ZOARc1n-64.webp", "/img/av/tR6ZOARc1n-128.webp",
  "/img/av/ylGTEQJ9qB-64.webp", "/img/av/ylGTEQJ9qB-128.webp",
  "/img/av/Oyd7FTREg9-64.webp", "/img/av/Oyd7FTREg9-128.webp",
  "/img/av/CBJhPDmmfO-64.webp", "/img/av/CBJhPDmmfO-128.webp",
  "/img/av/f6s1TE1_UZ-64.webp", "/img/av/f6s1TE1_UZ-128.webp",
  "/img/av/1HHwfCl7RS-64.webp", "/img/av/1HHwfCl7RS-128.webp",
  "/img/av/w0mUXOlfeX-64.webp", "/img/av/w0mUXOlfeX-128.webp",
  "/img/av/lNiS1McA2D-64.webp", "/img/av/lNiS1McA2D-128.webp",
  "/img/av/yRhy0dtpPq-64.webp", "/img/av/yRhy0dtpPq-128.webp",
  "/img/av/4mREW96Xn--64.webp", "/img/av/4mREW96Xn--128.webp",
  "/img/av/sZ7OVdbXZa-64.webp", "/img/av/sZ7OVdbXZa-128.webp",
  "/img/av/QmYQ4SRfI1-64.webp", "/img/av/QmYQ4SRfI1-128.webp",
  "/img/av/H8PDOiOA8I-64.webp", "/img/av/H8PDOiOA8I-128.webp",
  "/img/av/LLDuuSQhkd-64.webp", "/img/av/LLDuuSQhkd-128.webp",
  "/img/av/jlYXqsJDNL-64.webp", "/img/av/jlYXqsJDNL-128.webp",
  "/img/av/s_pQqSxM3G-64.webp", "/img/av/s_pQqSxM3G-128.webp",
  "/img/av/9JstRGs2N4-64.webp", "/img/av/9JstRGs2N4-128.webp",
  "/img/av/EXSoolT5IR-64.webp", "/img/av/EXSoolT5IR-128.webp",
  "/img/av/afZrtos8Lw-64.webp", "/img/av/afZrtos8Lw-128.webp",
  "/img/av/ndyajG18_b-64.webp", "/img/av/ndyajG18_b-128.webp",
  "/img/av/-G30khF7Mm-64.webp", "/img/av/-G30khF7Mm-128.webp",
  "/img/av/QpKqEcXZ5R-64.webp", "/img/av/QpKqEcXZ5R-128.webp",
  "/img/av/SLN6-5azPI-64.webp", "/img/av/SLN6-5azPI-128.webp",
  "/img/av/Z5nwTpCrLk-64.webp", "/img/av/Z5nwTpCrLk-128.webp",
  "/img/av/ZJAYtp_qs6-64.webp", "/img/av/ZJAYtp_qs6-128.webp",
  "/img/av/5O3NPzD9VY-64.webp", "/img/av/5O3NPzD9VY-128.webp",
  "/img/av/NfcizvlJ5Y-64.webp", "/img/av/NfcizvlJ5Y-128.webp",
  "/img/av/2DTDH7vkQB-64.webp", "/img/av/2DTDH7vkQB-128.webp",
  "/img/av/YszVbHdw1W-64.webp", "/img/av/YszVbHdw1W-128.webp",
  "/img/av/mRtETus0j6-64.webp", "/img/av/mRtETus0j6-128.webp",
  "/img/av/9U2RK4-jnN-64.webp", "/img/av/9U2RK4-jnN-128.webp",
  "/img/av/aJu1M-D-eE-64.webp", "/img/av/aJu1M-D-eE-128.webp",
  "/img/av/F_ugbEpK-C-64.webp", "/img/av/F_ugbEpK-C-128.webp",
  "/img/av/c0fs1NtqRG-64.webp", "/img/av/c0fs1NtqRG-128.webp",
  "/img/av/-dGGH38Wae-64.webp", "/img/av/-dGGH38Wae-128.webp",
  "/img/av/dQxi9EKEE6-64.webp", "/img/av/dQxi9EKEE6-128.webp",
  "/img/av/3PoTLJ71Wp-64.webp", "/img/av/3PoTLJ71Wp-128.webp",
  "/img/av/G2XeJcw5ti-64.webp", "/img/av/G2XeJcw5ti-128.webp",
  "/img/av/ojf0ngtymQ-64.webp", "/img/av/ojf0ngtymQ-128.webp",
  "/img/av/duF8-eHfWF-64.webp", "/img/av/duF8-eHfWF-128.webp",
  "/img/av/6WcCg0It1D-64.webp", "/img/av/6WcCg0It1D-128.webp",
  "/img/av/SsvuFEuwq2-64.webp", "/img/av/SsvuFEuwq2-128.webp",
  "/img/av/0pzcRQe_Q--64.webp", "/img/av/0pzcRQe_Q--128.webp",
  "/img/av/OpZVcauiXY-64.webp", "/img/av/OpZVcauiXY-128.webp",
  "/img/av/uqc7HTjklR-64.webp", "/img/av/uqc7HTjklR-128.webp",
  "/img/av/kL_kZ28Jex-64.webp", "/img/av/kL_kZ28Jex-128.webp",
  "/img/av/o_oNXiRsrn-64.webp", "/img/av/o_oNXiRsrn-128.webp",
  "/img/av/7mqFcLYl64-64.webp", "/img/av/7mqFcLYl64-128.webp",
  "/img/av/73iN-sFVvV-64.webp", "/img/av/73iN-sFVvV-128.webp",
  "/img/av/7LJNBZqasV-64.webp", "/img/av/7LJNBZqasV-128.webp",
  "/img/av/H15bW7EgPR-64.webp", "/img/av/H15bW7EgPR-128.webp",
  "/img/av/pAMn2MTbas-64.webp", "/img/av/pAMn2MTbas-128.webp",
  "/img/av/Q2qXUVPROL-64.webp", "/img/av/Q2qXUVPROL-128.webp",
  "/img/av/tGfza7Xb70-64.webp", "/img/av/tGfza7Xb70-128.webp",
  "/img/av/_unp37sU4Z-64.webp", "/img/av/_unp37sU4Z-128.webp",
  "/img/av/qD2G1Aw9nq-64.webp", "/img/av/qD2G1Aw9nq-128.webp",
  "/img/av/Yr_e4SEPpi-64.webp", "/img/av/Yr_e4SEPpi-128.webp",
  "/img/av/r0iuMQ63I9-64.webp", "/img/av/r0iuMQ63I9-128.webp",
  "/img/av/tD9pBJfMm9-64.webp", "/img/av/tD9pBJfMm9-128.webp",
  "/img/av/vPcvRP6efL-64.webp", "/img/av/vPcvRP6efL-128.webp",
  "/img/av/Zd9TzFnuCU-64.webp", "/img/av/Zd9TzFnuCU-128.webp",
  "/img/av/4gpVbzFeVk-64.webp", "/img/av/4gpVbzFeVk-128.webp",
  "/img/av/3O2Pn9xgq9-64.webp", "/img/av/3O2Pn9xgq9-128.webp",
  "/img/av/M2AUk77GdC-64.webp", "/img/av/M2AUk77GdC-128.webp",
  "/img/av/hRWHmUMuFS-64.webp", "/img/av/hRWHmUMuFS-128.webp",
  "/img/av/RQkVGlJGbL-64.webp", "/img/av/RQkVGlJGbL-128.webp",
  "/img/av/6GyhkZDyx7-64.webp", "/img/av/6GyhkZDyx7-128.webp",
  "/img/av/i70VAseUFi-64.webp", "/img/av/i70VAseUFi-128.webp",
  "/img/av/YiEMCYOJ9d-64.webp", "/img/av/YiEMCYOJ9d-128.webp",
  "/img/av/F90_HyUnwX-64.webp", "/img/av/F90_HyUnwX-128.webp",
  "/img/av/MhKw6o7L88-64.webp", "/img/av/MhKw6o7L88-128.webp",
  "/img/av/7dUsejzrY4-64.webp", "/img/av/7dUsejzrY4-128.webp",
  "/img/av/_Br4f77CNj-64.webp", "/img/av/_Br4f77CNj-128.webp",
  "/img/av/5IgTWriJ0d-64.webp", "/img/av/5IgTWriJ0d-128.webp",
  "/img/av/RcT0HnTfpl-64.webp", "/img/av/RcT0HnTfpl-128.webp",
  "/img/av/VaOmaNXr2z-64.webp", "/img/av/VaOmaNXr2z-128.webp",
  "/img/av/AO0rjlO2uc-64.webp", "/img/av/AO0rjlO2uc-128.webp",
  "/img/av/zyqx43SOxX-64.webp", "/img/av/zyqx43SOxX-128.webp",
  "/img/av/h9JnMcl0ma-64.webp", "/img/av/h9JnMcl0ma-128.webp",
  "/img/av/YRqx4jgSU9-64.webp", "/img/av/YRqx4jgSU9-128.webp",
  "/img/av/p58AUjsCbG-64.webp", "/img/av/p58AUjsCbG-128.webp",
  "/img/av/CkrxCrMSQ1-64.webp", "/img/av/CkrxCrMSQ1-128.webp",
  "/img/av/talWjZmlfg-64.webp", "/img/av/talWjZmlfg-128.webp",
  "/img/av/gxbE5t8inR-64.webp", "/img/av/gxbE5t8inR-128.webp",
  "/img/av/3-js6Sp5zH-64.webp", "/img/av/3-js6Sp5zH-128.webp",
  "/img/av/tAVHV_Iu7l-64.webp", "/img/av/tAVHV_Iu7l-128.webp",
  "/img/av/SdM1esehBR-64.webp", "/img/av/SdM1esehBR-128.webp",
  "/img/av/cdX1O4acea-64.webp", "/img/av/cdX1O4acea-128.webp",
  "/img/av/6BT1nwPLPo-64.webp", "/img/av/6BT1nwPLPo-128.webp",
  "/img/av/aeOWYIQM8Z-64.webp", "/img/av/aeOWYIQM8Z-128.webp",
  "/img/av/vHG16Owapz-64.webp", "/img/av/vHG16Owapz-128.webp",
  "/img/av/Pe60vahScg-64.webp", "/img/av/Pe60vahScg-128.webp",
  "/img/av/adP_ZHpsV6-64.webp", "/img/av/adP_ZHpsV6-128.webp",
  "/img/av/BGuiPyKgjw-64.webp", "/img/av/BGuiPyKgjw-128.webp",
  "/img/av/oYl7lVRA6K-64.webp", "/img/av/oYl7lVRA6K-128.webp",
  "/img/av/pPwKgJhblb-64.webp", "/img/av/pPwKgJhblb-128.webp",
  "/img/av/KU_bqNFR_v-64.webp", "/img/av/KU_bqNFR_v-128.webp",
  "/img/av/8jDv1bhOA--64.webp", "/img/av/8jDv1bhOA--128.webp",
  "/img/av/YLtOGt82UH-64.webp", "/img/av/YLtOGt82UH-128.webp",
  "/img/av/aDYNBkL8XM-64.webp", "/img/av/aDYNBkL8XM-128.webp",
  "/img/av/ca2Td_GON6-64.webp", "/img/av/ca2Td_GON6-128.webp",
  "/img/av/vQZY-D3EGh-64.webp", "/img/av/vQZY-D3EGh-128.webp",
  "/img/av/DyDgaatN3b-64.webp", "/img/av/DyDgaatN3b-128.webp",
  "/img/av/UlJbiu1YZ4-64.webp", "/img/av/UlJbiu1YZ4-128.webp",
  "/img/av/FvU9PMB4p_-64.webp", "/img/av/FvU9PMB4p_-128.webp",
  "/img/av/tL2KatsSIY-64.webp", "/img/av/tL2KatsSIY-128.webp",
  "/img/av/7iGCkOVj3f-64.webp", "/img/av/7iGCkOVj3f-128.webp",
  "/img/av/XHH4Ml8tOw-64.webp", "/img/av/XHH4Ml8tOw-128.webp",
  "/img/av/xMf5JNjNQL-64.webp", "/img/av/xMf5JNjNQL-128.webp",
  "/img/av/hWCYnxqSLw-64.webp", "/img/av/hWCYnxqSLw-128.webp",
  "/img/av/2MFOkJts72-64.webp", "/img/av/2MFOkJts72-128.webp",
  "/img/av/caX7oLrGOi-64.webp", "/img/av/caX7oLrGOi-128.webp",
  "/img/av/Ks3g7hpVjl-64.webp", "/img/av/Ks3g7hpVjl-128.webp",
  "/img/av/3XoMruAdIf-64.webp", "/img/av/3XoMruAdIf-128.webp",
  "/img/av/70JJ8kYtTm-64.webp", "/img/av/70JJ8kYtTm-128.webp",
  "/img/av/iIcBZKchhO-64.webp", "/img/av/iIcBZKchhO-128.webp",
  "/img/av/6vFd5MBbtY-64.webp", "/img/av/6vFd5MBbtY-128.webp",
  "/img/av/DRMkXSx0NY-64.webp", "/img/av/DRMkXSx0NY-128.webp",
  "/img/av/R2iXQPLBlc-64.webp", "/img/av/R2iXQPLBlc-128.webp",
  "/img/av/ybOupXOAnn-64.webp", "/img/av/ybOupXOAnn-128.webp",
  "/img/av/zfVYNcUelQ-64.webp", "/img/av/zfVYNcUelQ-128.webp",
  "/img/av/Vzl2UZ_qPH-64.webp", "/img/av/Vzl2UZ_qPH-128.webp",
  "/img/av/GPywaF7sO2-64.webp", "/img/av/GPywaF7sO2-128.webp",
  "/img/av/PXaSBuAtIQ-64.webp", "/img/av/PXaSBuAtIQ-128.webp",
  "/img/av/N2_IVgq6X0-64.webp", "/img/av/N2_IVgq6X0-128.webp",
  "/img/av/9-nhl7L_Nu-64.webp", "/img/av/9-nhl7L_Nu-128.webp",
  "/img/av/7gfF-GXsiq-64.webp", "/img/av/7gfF-GXsiq-128.webp",
  "/img/av/C_Rap_uARL-64.webp", "/img/av/C_Rap_uARL-128.webp",
  "/img/av/yZ75LWw8mk-64.webp", "/img/av/yZ75LWw8mk-128.webp",
  "/img/av/Op36SkdWPs-64.webp", "/img/av/Op36SkdWPs-128.webp",
  "/img/av/3G4cqi1Ghj-64.webp", "/img/av/3G4cqi1Ghj-128.webp",
  "/img/av/RLSkkkA2uV-64.webp", "/img/av/RLSkkkA2uV-128.webp",
  "/img/av/ZQolbMsOEe-64.webp", "/img/av/ZQolbMsOEe-128.webp",
  "/img/av/VltOrAZhOK-64.webp", "/img/av/VltOrAZhOK-128.webp",
  "/img/av/W2JrXS9smB-64.webp", "/img/av/W2JrXS9smB-128.webp",
  "/img/av/teXeTt56eu-64.webp", "/img/av/teXeTt56eu-128.webp",
  "/img/av/We5W0msVjD-64.webp", "/img/av/We5W0msVjD-128.webp",
  "/img/av/Atw6nF3kAs-64.webp", "/img/av/Atw6nF3kAs-128.webp",
  "/img/av/kP49qzcR7o-64.webp", "/img/av/kP49qzcR7o-128.webp",
  "/img/av/V4vZh-XVvI-64.webp", "/img/av/V4vZh-XVvI-128.webp",
  "/img/av/54F2zwwjRp-64.webp", "/img/av/54F2zwwjRp-128.webp",
  "/img/av/ed3l46892w-64.webp", "/img/av/ed3l46892w-128.webp",
  "/img/av/o4yyLYN8NT-64.webp", "/img/av/o4yyLYN8NT-128.webp",
  "/img/av/IPo4GY4-bU-64.webp", "/img/av/IPo4GY4-bU-128.webp",
  "/img/av/kVK3SzwFHk-64.webp", "/img/av/kVK3SzwFHk-128.webp",
  "/img/av/7PzoxZwd6u-64.webp", "/img/av/7PzoxZwd6u-128.webp",
  "/img/av/_LpuI4jBSn-64.webp", "/img/av/_LpuI4jBSn-128.webp",
  "/img/av/SbD4MOKqME-64.webp", "/img/av/SbD4MOKqME-128.webp",
  "/img/av/mucfRsglOk-64.webp", "/img/av/mucfRsglOk-128.webp",
  "/img/av/MaI0YxMvA2-64.webp", "/img/av/MaI0YxMvA2-128.webp",
  "/img/av/4tpeUGBa9e-64.webp", "/img/av/4tpeUGBa9e-128.webp",
  "/img/av/nsTrFU2ycZ-64.webp", "/img/av/nsTrFU2ycZ-128.webp",
  "/img/av/F0pMg-ty-d-64.webp", "/img/av/F0pMg-ty-d-128.webp",
  "/img/av/kHVYZWWh2d-64.webp", "/img/av/kHVYZWWh2d-128.webp",
  "/img/av/P54M-NSwem-64.webp", "/img/av/P54M-NSwem-128.webp",
  "/img/av/3GczJ_QY3h-64.webp", "/img/av/3GczJ_QY3h-128.webp",
  "/img/av/8QVy2Y6ObR-64.webp", "/img/av/8QVy2Y6ObR-128.webp",
  "/img/av/Uand7JBvP1-64.webp", "/img/av/Uand7JBvP1-128.webp",
  // fonts.css is in the shell; the faces it names are not, because
  // font-display: swap means a missing one costs typography and not the page.
  "/css/fonts/ibm-plex-mono-400-latin-ext.woff2",
  "/css/fonts/ibm-plex-mono-400-latin.woff2",
  "/css/fonts/ibm-plex-mono-600-latin-ext.woff2",
  "/css/fonts/ibm-plex-mono-600-latin.woff2",
  "/css/fonts/montserrat-400-latin-ext.woff2",
  "/css/fonts/montserrat-400-latin.woff2",
  "/css/fonts/montserrat-600-latin-ext.woff2",
  "/css/fonts/montserrat-600-latin.woff2",
  "/css/fonts/montserrat-700-latin-ext.woff2",
  "/css/fonts/montserrat-700-latin.woff2",
  // Only ever fetched by an install prompt or the home screen, so they would
  // otherwise be the assets least likely to be cached when they are needed.
  "/icons/icon-180.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/js/datadog/datadog-rum-slim.js",
])];

// cache: "reload" so the precache is filled from the network rather than from
// the browser's HTTP cache. GitHub Pages stamps every asset max-age=600, so a
// worker installing in the ten minutes after a deploy would otherwise store
// pre-deploy files under a cache name asserting they are current - and nothing
// below ever revalidates them.
const fromNetwork = (url) => new Request(url, { cache: "reload" });

/**
 * Fill the cache with everything in REST.
 *
 * Deliberately not cache.addAll: that is all-or-nothing, which is the right
 * trade for ten shell files and the wrong one for five hundred. A single photo
 * 404ing must not cost the visitor every cached page. Whatever is missed here
 * still resolves through the fetch handler on first use.
 *
 * The requests go out a few at a time rather than all at once, because this
 * runs while the visitor is reading the page that triggered it - on a crowded
 * conference network, five hundred parallel fetches would be taken out of the
 * bandwidth they are currently browsing on.
 *
 * Already-stored entries are skipped, so a pass that was cut short - the
 * browser is free to kill a worker mid-task - resumes where it stopped instead
 * of fetching the programme again.
 */
async function warm(cache) {
  let next = 0;
  const worker = async () => {
    while (next < REST.length) {
      const url = REST[next++];
      if (await cache.match(url)) continue;
      try {
        const response = await fetch(fromNetwork(url));
        if (response.ok) await cache.put(url, response);
      } catch {
        /* offline mid-warm: the fetch handler will pick this one up later */
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
}

// One pass at a time. Every navigation asks for the programme to be topped up,
// and without this each would start a competing pass over the same five hundred
// files.
let warming = null;
function warmOnce() {
  warming ??= caches.open(CACHE)
    .then(warm)
    .finally(() => { warming = null; });
  return warming;
}

self.addEventListener("install", (event) => {
  // The shell only. The rest of the programme is fetched after this worker is
  // in charge, deliberately: an install that has to pull 5MB first is an update
  // the visitor cannot see for as long as it takes. The banner would sit there
  // through every reload, because until this worker activates the old one keeps
  // answering with the page it already had.
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL.map(fromNetwork));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // Let the browser start a navigation's network request while this worker is
    // still booting, so the two overlap instead of queueing.
    await self.registration.navigationPreload?.enable();
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
    // Claim before warming, not after: claiming is what reloads a page sitting
    // on the previous version, and that must not wait for the programme.
    await self.clients.claim();
    await warmOnce();
  })());
});

/**
 * Serve the page from the cache and refresh it in the background.
 *
 * Every page is precached at install, so moving around the programme costs a
 * cache read rather than a round trip - which on a crowded conference network
 * is the difference between instant and a wait. Going to the network first
 * meant waiting for it even though the answer was already on disk.
 *
 * Freshness does not depend on this path. A deploy changes CACHE, so the new
 * worker installs a fresh copy of every page and app.js reloads the document on
 * controllerchange; version.json is never served from here, so the update
 * banner still sees the truth.
 */
async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const fresh = (async () => {
    const response = (await event.preloadResponse) || (await fetch(request));
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  })();

  if (cached) {
    // Do not make the visitor wait on the refresh, but keep the worker alive
    // long enough to finish it.
    event.waitUntil(fresh.catch(() => {}));
    return cached;
  }

  try {
    return await fresh;
  } catch {
    return (await cache.match(BASE)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  // Same reason as the precache: a miss is about to be stored under a cache
  // name that stands for a particular deploy, so it must come from the network
  // and not from whatever the HTTP cache kept from the last one.
  const response = await fetch(fromNetwork(request));
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // The update check must always see the truth.
  if (url.pathname === `${BASE}version.json`) return;

  if (request.mode === "navigate") {
    event.respondWith(staleWhileRevalidate(event, request));
    // Top up anything a killed worker left behind, so the offline guarantee
    // repairs itself rather than waiting for the next deploy.
    event.waitUntil(warmOnce());
    return;
  }

  // A request that asks to bypass caches means it. The update button fetches
  // the current page this way, and a fetch() is not a navigation - without
  // this it was answered from the cache with the very page it was trying to
  // replace, and the reload that followed showed it again.
  if (request.cache === "reload" || request.cache === "no-store") {
    event.respondWith(fetch(request));
    return;
  }

  // Fonts, icons, photos, CSS and JS are all retired by the cache name.
  event.respondWith(cacheFirst(request));
});
