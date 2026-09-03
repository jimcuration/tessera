// The UNREEL catalog. Plain ESM so both the Next app and the generation
// script (scripts/generate-catalog.mjs) can import it.
//
// Every title has:
//   coverPrompt   Nano Banana 2 key art (16:9) with the title typography
//                 rendered INTO the image, streaming-service style.
//   previewPrompt one MiniMax H3 Max Turbo text-to-video clip: the card
//                 hover / billboard trailer, and the cold open when you press
//                 play (the stream chains from its last frame).
//   premise+style what the showrunner LLM writes the live episode from.
//   mode          "story" = continuous chained film that tries to tell a
//                 story; "chaos" = a brainrot channel of escalating hard cuts.

const KEYART =
  "Premium streaming-service key art, 16:9 widescreen, cinematic lighting, photographic detail, rich color grading, composed with clear negative space in the lower third.";
const TITLE_RULES =
  "No other text, no real-world brands or network logos, no watermarks, no borders.";

/** @type {import("../lib/catalog").Title[]} */
export const TITLES = [
  // ---------------------------------------------------------------- STORY
  {
    id: "meridian-drift",
    title: "Meridian Drift",
    tagline: "The distress call is in her own voice.",
    logline:
      "A lone salvage pilot boards a derelict ship drifting past Neptune and finds its log recorded in her own voice, three days from now.",
    genres: ["Sci-Fi", "Mystery"],
    year: 2026,
    rating: "13+",
    mode: "story",
    featured: true,
    style:
      "Grounded hard sci-fi film, cold blue and amber light, drifting dust motes, anamorphic lens flares, handheld tension.",
    premise:
      "Salvage pilot Ines Varga, alone in a cramped tug, boards the dark derelict 'Meridian', where the ship's log plays back her own voice describing events that have not happened yet. She must decide whether to obey the recording or defy it as the derelict wakes up around her.",
    coverPrompt: `${KEYART} A lone astronaut in a scuffed orange salvage suit floats in the dark airlock of a vast derelict spaceship, helmet lamp cutting through drifting dust, the blue limb of Neptune glowing through a torn hull breach behind her. The title "MERIDIAN DRIFT" rendered in slim, wide-tracked futuristic capitals, pale ice-blue with a faint glow, centered in the lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Cinematic hard sci-fi: a small salvage tug's cockpit, a woman pilot in an orange suit watching through the canopy as an immense dark derelict ship slides past, its hull scarred and lightless, Neptune's blue glow behind it; a single cockpit speaker crackles to life and a red 'INCOMING' light blinks. Cold blue and amber light, anamorphic flares, slow drift.",
  },
  {
    id: "neon-vespers",
    title: "Neon Vespers",
    tagline: "Every choir needs a missing voice.",
    logline:
      "In a rain-soaked megacity, a burned-out detective hunts for an android choir singer who vanished mid-hymn, and the cathedral wants her back before dawn.",
    genres: ["Noir", "Cyberpunk"],
    year: 2026,
    rating: "16+",
    mode: "story",
    style:
      "Cyber-noir film, relentless rain, neon reflections in wet streets, deep shadows, magenta and teal palette, slow cinematic camera.",
    premise:
      "Detective Rho Calder, tired and soaked, is hired by a neon-lit cathedral to find Vesper, an android choir singer who vanished mid-hymn. The trail runs through noodle bars, a black-market voice clinic, and a rooftop where Vesper is waiting with a confession that changes who the villain is.",
    coverPrompt: `${KEYART} A trench-coated detective stands under a broken umbrella on a rain-flooded neon street at night, reflections of magenta and teal signs rippling at his feet, a towering cathedral of glowing holographic stained glass at the end of the street. The title "NEON VESPERS" rendered as a glowing magenta neon-tube sign with subtle flicker, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Cyber-noir: rain hammering a neon-lit street at night, a detective in a soaked trench coat looks up at a towering cathedral of glowing holographic stained glass as its doors slowly open, spilling choir light and steam into the rain. Magenta and teal reflections in the puddles, slow push-in.",
  },
  {
    id: "salt-and-sundown",
    title: "Salt & Sundown",
    tagline: "The railroad is coming. So is she.",
    logline:
      "A widowed sheriff with a borrowed badge has until sundown to stop a railroad baron from burning her town off the map.",
    genres: ["Western", "Drama"],
    year: 2026,
    rating: "13+",
    mode: "story",
    style:
      "Classic widescreen western film, golden-hour amber light, red rock, drifting dust, long lenses, still and patient camera.",
    premise:
      "Sheriff Ada Quill, widowed and newly badged, defends the salt-flat town of Sundown against railroad baron Cyrus Vane, who arrives by private train with hired guns and a deed. Standoffs at the water tower, a saloon negotiation, a dynamite-rigged bridge, and a final walk down the main street at sundown.",
    coverPrompt: `${KEYART} A lone woman sheriff in a dust-colored duster stands in the middle of a wide dirt main street at golden hour, a badge glinting, a black locomotive looming at the far end of the street with smoke rolling across the red rock buttes. The title "SALT & SUNDOWN" rendered in worn wooden-slab serif letters, sun-bleached cream with a red ampersand, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Classic widescreen western: golden-hour light across a salt-flat frontier town, a woman sheriff steps out of the jailhouse onto the empty main street as a black locomotive pulls in at the far end, brakes shrieking, dust and steam rolling toward her; she rests a hand on her holster. Long lens, drifting dust.",
  },
  {
    id: "hollow-creek",
    title: "Hollow Creek",
    tagline: "The festival needs one more guest.",
    logline:
      "A journalist returns to the town where she grew up on the eve of its harvest festival and discovers her name is already carved on the effigy.",
    genres: ["Horror", "Folk"],
    year: 2026,
    rating: "16+",
    mode: "story",
    style:
      "Folk horror film, overcast autumn light, wheat fields and corn husks, muted earth tones, unsettling stillness, slow creeping camera.",
    premise:
      "Journalist Mara Voss returns to Hollow Creek for its harvest festival and finds the townsfolk unnervingly welcoming, a wicker effigy in the square with her name carved on it, and a road out that keeps leading back to the church. Dread builds through the festival preparations toward the night the lanterns are lit.",
    coverPrompt: `${KEYART} A woman stands alone at the edge of a vast wheat field under a heavy overcast sky, facing a distant village square where a towering wicker effigy looms above tiny lantern-carrying figures in masks. Muted earth tones, unsettling stillness. The title "HOLLOW CREEK" rendered in gaunt hand-carved letters like marks scratched into wood, bone-white, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Folk horror: overcast autumn light, a woman walks slowly into a small town square where masked villagers stop hanging paper lanterns and turn their heads toward her in perfect unison, a towering wicker effigy looming behind them; the wind moves through the corn husks. Muted earth tones, slow creeping camera.",
  },
  {
    id: "pip-and-the-moon-engine",
    title: "Pip & the Moon Engine",
    tagline: "Somebody has to hang the moon.",
    logline:
      "When the old machine that hangs the moon every night breaks down, a fox cub and a grumpy clockwork owl have until dusk to fix it.",
    genres: ["Animation", "Kids", "Adventure"],
    year: 2026,
    rating: "ALL",
    mode: "story",
    style:
      "Warm hand-painted 2D animation, soft storybook textures, glowing evening palette, expressive rounded characters.",
    premise:
      "Pip, a tiny fox cub in a too-big scarf, discovers that the Moon Engine on the hill has stopped, so the moon will not rise tonight. With Barnaby, a grumpy clockwork owl, Pip gathers gears from the village, dodges the sleepy giant badger, and cranks the engine as the first stars come out.",
    coverPrompt: `${KEYART} Hand-painted storybook animation: a tiny fox cub in an oversized red scarf and a grumpy brass clockwork owl stand on a hilltop beside a huge whimsical machine of gears and lanterns, an enormous pale moon half-hoisted into a twilight sky on a chain. The title "PIP & THE MOON ENGINE" rendered in playful rounded hand-lettered letters, warm cream with a gold glow, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Warm hand-painted 2D animation: a tiny fox cub in an oversized red scarf runs up a grassy hill at twilight toward a huge whimsical machine of brass gears and lanterns, a grumpy clockwork owl flapping after her, as the great chain that hoists the moon slips and the half-risen moon lurches downward in the sky. Storybook textures, glowing evening palette.",
  },
  {
    id: "the-velvet-score",
    title: "The Velvet Score",
    tagline: "One night. One casino. Forty thousand feet.",
    logline:
      "Four thieves board a floating casino airship to steal a diamond that does not exist, and discover the house has been robbing them for years.",
    genres: ["Heist", "Thriller"],
    year: 2026,
    rating: "13+",
    mode: "story",
    style:
      "Glossy heist thriller film, art-deco gold and burgundy interiors, glittering chandeliers, crisp lenses, elegant gliding camera.",
    premise:
      "A crew of four, led by the unflappable Sable Okafor, infiltrate the Velvet, a floating art-deco casino airship, to steal the Halcyon diamond during a masked gala. Disguises, a vault behind the roulette wheel, a double-cross, and an escape by parachute through the casino's glass floor.",
    coverPrompt: `${KEYART} Four elegant thieves in evening wear and half-masks stand on the gilded gallery of an art-deco casino airship at night, chandeliers blazing, clouds and city lights visible far below through a glass floor. Gold and burgundy palette. The title "THE VELVET SCORE" rendered in sleek art-deco gold capitals with thin inline detailing, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Glossy heist thriller: an art-deco casino airship at night, gliding camera through a gala crowd in masks and evening wear, chandeliers blazing, a woman in a burgundy gown checks a pocket watch and exchanges a glance across the roulette table with a masked accomplice as the lights dim for the show. Gold and burgundy, crisp elegant motion.",
  },
  {
    id: "undertow",
    title: "Undertow",
    tagline: "Two lighthouses. One language of light.",
    logline:
      "Two lighthouse keepers on opposite shores of a storm-wracked strait fall in love through the flashes of their lamps, until one light goes dark.",
    genres: ["Romance", "Drama"],
    year: 2026,
    rating: "13+",
    mode: "story",
    style:
      "Intimate romantic drama film, stormy grey-green seas, warm lamplight, weathered textures, soft natural lenses.",
    premise:
      "Keepers Elin and Tomas tend lighthouses on opposite shores of a stormy strait, speaking to each other only through coded lamp flashes across the water each night. A storm damages Tomas's lamp, and Elin must decide whether to cross the strait in a rowboat at night to reach him.",
    coverPrompt: `${KEYART} Two lighthouses face each other across a stormy grey-green strait at dusk, their beams crossing in the rain-streaked sky, a small figure standing on each gallery. Warm lamplight against cold sea. The title "UNDERTOW" rendered in elegant weathered serif letters, sea-foam white with soft edges like worn paint, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Intimate romantic drama: dusk on a stormy strait, a woman keeper on a lighthouse gallery leans on the rail, wind in her hair, as the lighthouse on the far shore begins flashing in a deliberate rhythm; she smiles, turns, and reaches for the great lamp's shutter to answer. Grey-green seas, warm lamplight, soft lenses.",
  },
  {
    id: "planet-verdant",
    title: "Planet Verdant",
    tagline: "Nature. Somewhere else.",
    logline:
      "A prestige nature documentary about the wildlife of an alien world, from the glass-winged cliff grazers to the tide of lantern jellies that lights the night.",
    genres: ["Documentary", "Sci-Fi"],
    year: 2026,
    rating: "ALL",
    mode: "story",
    style:
      "Prestige natural-history documentary, ultra-detailed wildlife cinematography, long lenses, golden light, sweeping aerial establishing shots.",
    premise:
      "A nature documentary on the alien world Verdant, following one day of its wildlife: glass-winged grazers on floating cliffs at dawn, a predator called the mirror stalker hunting in the crystal forest at noon, and the nightly migration of lantern jellies that fills the sky with light. A calm narrator speaks short scripted lines over each sequence.",
    coverPrompt: `${KEYART} Sweeping aerial view of an alien world at golden hour: floating grass-covered cliffs drifting above a turquoise sea, herds of translucent glass-winged creatures grazing on them, two moons in a lavender sky. Prestige natural-history photography. The title "PLANET VERDANT" rendered in clean elegant thin capitals, white with generous letter-spacing, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Prestige nature documentary: a sweeping aerial shot glides over floating grass-covered cliffs drifting above a turquoise alien sea at golden hour, herds of translucent glass-winged creatures lift off the cliffs in unison and catch the light like stained glass, two moons hanging in a lavender sky. Ultra-detailed wildlife cinematography.",
  },
  {
    id: "second-wind",
    title: "Second Wind",
    tagline: "Twelve rounds. One flooded city.",
    logline:
      "An aging boxer agrees to one last fight in a half-drowned city gym to keep the lights on for the kids who train there.",
    genres: ["Sports", "Drama"],
    year: 2026,
    rating: "13+",
    mode: "story",
    style:
      "Gritty sports drama film, sweat and steam, hard tungsten gym light against blue dusk, handheld intimacy, slow-motion impacts.",
    premise:
      "Forty-year-old boxer Dez Okonkwo trains in a gym half-flooded by the rising river, coaching neighborhood kids, and agrees to a final bout against a young champion to pay to keep the gym open. Training in knee-deep water, doubt, the weigh-in, and a fight that goes the distance.",
    coverPrompt: `${KEYART} An aging boxer with grey in his beard sits on a stool in the corner of a ring inside a half-flooded brick gym, water reflecting hard tungsten lights, steam rising, kids watching from the ropes. Gritty, intimate. The title "SECOND WIND" rendered in heavy condensed athletic block capitals, scuffed white with a red underline, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Gritty sports drama: inside a half-flooded brick gym at dusk, an aging boxer wades knee-deep through water toward a heavy bag hanging over the flood and begins to hit it, spray flying in slow motion under hard tungsten lights while kids cheer from a dry balcony. Sweat, steam, handheld intimacy.",
  },
  {
    id: "kingdom-of-ash",
    title: "Kingdom of Ash",
    tagline: "The dragon took her crown. Not her fire.",
    logline:
      "A queen scarred by dragonfire marches on the burning capital that betrayed her, with an army of the dead city's last children.",
    genres: ["Fantasy", "Epic"],
    year: 2026,
    rating: "16+",
    mode: "story",
    style:
      "Dark fantasy epic film, ash-grey skies with ember light, ruined stone, vast scale, sweeping crane shots, painterly grandeur.",
    premise:
      "Queen Iselda, half her face scarred by dragonfire, leads a ragged host of survivors back to the burning capital of Ashenmoor, where her usurper brother rules from a throne beside the chained dragon that scarred her. Marches through ash fields, a siege at the gate, a parley on the walls, and a confrontation with the dragon itself.",
    coverPrompt: `${KEYART} A scarred queen in blackened armor stands on a ridge of grey ash holding a banner, looking down at a vast burning capital city under an ember-lit sky, a colossal dragon coiled around its central spire. Painterly dark fantasy grandeur. The title "KINGDOM OF ASH" rendered in sharp cracked blackletter-inspired capitals, ember-orange glowing through ash-grey, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Dark fantasy epic: a sweeping crane shot rises over a ridge of grey ash where a scarred queen in blackened armor raises a tattered banner, revealing a ragged army behind her and a vast burning city ahead under an ember sky, as a colossal dragon uncoils from the city's central spire and roars. Painterly grandeur, ember light.",
  },
  {
    id: "last-train-to-kemper",
    title: "Last Train to Kemper",
    tagline: "The ticket already has your name on it.",
    logline:
      "On an overnight train, a stranger hands a commuter a ticket printed with his own name and a destination that is not on any map.",
    genres: ["Thriller", "Mystery"],
    year: 2026,
    rating: "13+",
    mode: "story",
    style:
      "Paranoid thriller film, night-train interiors, sodium-orange window light streaking past, green-tinted fluorescents, tight claustrophobic framing.",
    premise:
      "Commuter Owen Reyes dozes on the last overnight train when a stranger in a grey coat hands him a ticket printed with his name and the destination Kemper, a station on no map. Every carriage he walks through is stranger than the last, passengers know him, the conductor will not stop the train, and Kemper is getting closer.",
    coverPrompt: `${KEYART} A man in a rumpled suit stands in the aisle of an empty night-train carriage lit by green-tinted fluorescents, holding up a small paper ticket, streaks of sodium-orange light rushing past the windows, a shadowy figure in a grey coat at the far end of the carriage. Paranoid thriller mood. The title "LAST TRAIN TO KEMPER" rendered like stenciled railway signage in pale amber, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Paranoid thriller: inside an overnight train carriage lit by green fluorescents, a dozing commuter in a rumpled suit jolts awake as a stranger in a grey coat drops a paper ticket onto his lap and walks away down the aisle; the commuter reads the ticket and looks up in alarm as sodium-orange lights streak past the window. Tight claustrophobic framing.",
  },
  {
    id: "bureau-of-small-miracles",
    title: "Bureau of Small Miracles",
    tagline: "Please take a number.",
    logline:
      "In a drab government office, a team of underpaid civil servants processes the world's minor miracles, until a major one lands in the in-tray.",
    genres: ["Comedy", "Fantasy"],
    year: 2026,
    rating: "ALL",
    mode: "story",
    style:
      "Deadpan whimsical comedy film, symmetrical pastel office interiors, warm fluorescent light, precise centered compositions, gentle dolly moves.",
    premise:
      "In the beige Bureau of Small Miracles, clerk Priya Nandakumar stamps forms for minor miracles (lost keys found, buses arriving on time). One morning a Major Miracle form arrives, requiring signatures from the whole office, a bicycle courier who can walk through walls, and the terrifying director on the top floor.",
    coverPrompt: `${KEYART} A perfectly symmetrical pastel-green government office with rows of identical desks, a young woman clerk in a cardigan holding up a glowing golden form in astonishment while her deadpan colleagues stare, a small levitating stapler beside her. Whimsical deadpan comedy. The title "BUREAU OF SMALL MIRACLES" rendered in neat bureaucratic typewriter letters with an official rubber-stamp feel, dark teal, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Deadpan whimsical comedy: a perfectly symmetrical pastel-green government office, slow dolly toward a young clerk in a cardigan as a pneumatic tube spits a glowing golden form onto her desk; the whole office turns to stare in unison and a stapler quietly begins to levitate. Warm fluorescent light, precise centered composition.",
  },
  {
    id: "the-deep-below",
    title: "The Deep Below",
    tagline: "Eleven kilometers down, something knocked.",
    logline:
      "The crew of a research station on the ocean floor has forty minutes of air after something outside begins knocking on the hull in rhythm.",
    genres: ["Disaster", "Thriller"],
    year: 2026,
    rating: "13+",
    mode: "story",
    style:
      "Claustrophobic deep-sea thriller film, submarine interiors of steel and red emergency light, condensation, flickering screens, tense handheld camera.",
    premise:
      "Deep-sea research station Halden, eleven kilometers down, loses main power as something outside begins knocking on the hull in a steady rhythm. Engineer Kaia Brandt and three crew have forty minutes of air to restore power, reach the escape sphere, and learn what is knocking before it finds the airlock.",
    coverPrompt: `${KEYART} Inside a cramped deep-sea research station lit only by red emergency light, a woman engineer presses her hand against a thick porthole, condensation streaming, while an enormous shape passes across the black water outside. Steel, rivets, flickering screens. The title "THE DEEP BELOW" rendered in cold industrial stencil capitals, pale cyan with a submerged glow, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Claustrophobic deep-sea thriller: red emergency light inside a cramped research station eleven kilometers down, a woman engineer freezes as a slow rhythmic knocking echoes through the steel hull, and she turns toward a thick porthole where an enormous shape drifts past in the black water. Condensation, flickering screens, tense handheld camera.",
  },
  {
    id: "the-cartographers-daughter",
    title: "The Cartographer's Daughter",
    tagline: "The map keeps redrawing itself.",
    logline:
      "In 1890s Lisbon, a mapmaker's daughter inherits an atlas whose coastlines move overnight, and sets sail to find the island it keeps adding.",
    genres: ["Adventure", "Period"],
    year: 2026,
    rating: "ALL",
    mode: "story",
    style:
      "Lush period adventure film, 1890s brass and parchment, warm candlelight and Atlantic blues, sweeping romantic score, elegant camera.",
    premise:
      "In 1890s Lisbon, Leonor Castelo inherits her late father's atlas, whose coastlines redraw themselves each night to add an island that does not exist. With a skeptical sea captain and a stolen brass compass, she sails into the Atlantic to find it, pursued by a collector who wants the atlas for himself.",
    coverPrompt: `${KEYART} A young woman in 1890s traveling clothes stands at the bow of a tall ship at dawn holding open a huge leather atlas whose inked coastlines glow and shift, a mysterious island rising from the mist ahead. Brass, parchment, Atlantic blues. The title "THE CARTOGRAPHER'S DAUGHTER" rendered in ornate copperplate-inspired serif capitals, aged gold, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Lush period adventure: 1890s Lisbon at night, candlelight on a cartographer's desk as a young woman opens a huge leather atlas and the inked coastlines begin to move by themselves, a new island drawing itself into the Atlantic in glowing ink while she leans closer in wonder. Brass, parchment, elegant slow camera.",
  },
  // ---------------------------------------------------------------- CHAOS
  {
    id: "capybara-news-network",
    title: "Capybara News Network",
    tagline: "Breaking news. Nothing is happening.",
    logline:
      "Around-the-clock news coverage anchored by capybaras, reporting live on developing stories of absolutely no consequence.",
    genres: ["Live", "Brainrot"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Glossy cable-news broadcast look, studio lighting, lower-third graphics bars, breaking-news red accents, crisp broadcast camera.",
    premise:
      "A 24-hour cable news channel entirely staffed by capybaras: anchors at the desk, field reporters in raincoats, a weather capybara pointing at a map, pundits arguing, all covering absurd developing stories with total gravity.",
    coverPrompt: `${KEYART} A serious capybara in a navy suit and tie sits at a glossy cable-news anchor desk with a world map wall behind it, studio lights blazing, a second capybara in a raincoat on a screen reporting from a rainy street. Broadcast-news polish. All on-set branding, desk plates, screen bugs and microphone flags show only an original invented network logo reading "CBN" or the words CAPYBARA NEWS NETWORK. The title "CAPYBARA NEWS NETWORK" rendered as a bold red-and-white news-channel logo lockup, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Glossy cable news broadcast: a serious capybara in a suit and tie sits at a news anchor desk under studio lights, shuffles papers, and turns gravely to camera as a red BREAKING NEWS banner slides in and the screen behind it cuts to a capybara field reporter in a raincoat standing in a puddle. Crisp broadcast camera.",
  },
  {
    id: "goblin-tax-season",
    title: "Goblin Tax Season",
    tagline: "Every receipt. Every hoard.",
    logline:
      "A cave full of goblins attempts to file their taxes, and the paperwork fights back.",
    genres: ["Live", "Brainrot"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Rich fantasy-comedy look, torchlit cave interiors, piles of gold and parchment, expressive goblin characters, punchy comedic camera.",
    premise:
      "Goblins in a torchlit cave doing their taxes: mountains of receipts, an abacus made of skulls, a goblin accountant with tiny spectacles, audits by a dragon, deductions argued over loudly, and paperwork that is increasingly alive.",
    coverPrompt: `${KEYART} A cave full of frantic green goblins buried in avalanches of parchment receipts and gold coins, one goblin accountant in tiny spectacles at a desk with a skull abacus, torchlight flickering. Fantasy comedy. The title "GOBLIN TAX SEASON" rendered in chunky hand-scrawled letters like ink on parchment, mustard yellow with a green outline, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Fantasy comedy: a torchlit cave, a goblin accountant in tiny spectacles frantically flips through a towering stack of parchment receipts at a desk with a skull abacus while other goblins hurl coins and forms into the air; the stack topples onto him in a slow avalanche of paper. Expressive characters, punchy camera.",
  },
  {
    id: "infinite-staircase",
    title: "Infinite Staircase",
    tagline: "He's still climbing.",
    logline:
      "A man climbs a staircase that never ends. Every landing is worse than the last.",
    genres: ["Live", "Brainrot"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Surreal liminal look, clean concrete stairwells shifting into impossible spaces, flat even light, deadpan wide framing.",
    premise:
      "A man in a grey tracksuit climbs an endless concrete staircase. Every landing opens onto something absurd (an office party, a beach, a courtroom, a supermarket in zero gravity), and he ignores all of it and keeps climbing.",
    coverPrompt: `${KEYART} A tired man in a grey tracksuit climbs a clean concrete staircase that spirals up impossibly far, each landing opening onto a completely different absurd scene (a beach, an office, a supermarket), flat even light, surreal liminal calm. The title "INFINITE STAIRCASE" rendered in plain sans-serif signage capitals stacked like stairs, white on grey, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Surreal liminal comedy: a tired man in a grey tracksuit climbs a clean concrete stairwell, passes a landing where a full office birthday party is in progress, ignores everyone waving at him, and keeps climbing as the next landing reveals a sunlit beach with waves lapping onto the concrete. Flat even light, deadpan wide framing.",
  },
  {
    id: "toaster-court",
    title: "Toaster Court",
    tagline: "All rise for the honorable Blender.",
    logline:
      "A courtroom drama in which every judge, lawyer, and defendant is a kitchen appliance.",
    genres: ["Live", "Brainrot"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Polished courtroom-drama look, wood-paneled courtroom, dramatic lighting, gravely serious tone, glossy appliance characters with tiny expressive features.",
    premise:
      "A wood-paneled courtroom where a blender judge presides over trials of kitchen appliances: a toaster accused of burning, a kettle witness that keeps whistling, a jury of spoons, objections, dramatic evidence reveals, all played with total seriousness.",
    coverPrompt: `${KEYART} A wood-paneled courtroom under dramatic light: a chrome blender wearing a judge's wig presides from the bench, a nervous toaster stands at the defendant's box, a jury of spoons watches, a kettle witness steams. Gravely serious tone. The title "TOASTER COURT" rendered in stately engraved courthouse serif capitals, brass on dark wood, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Polished courtroom drama: a chrome blender wearing a judge's wig bangs a gavel on a wood-paneled bench, a nervous toaster in the defendant's box pops out two burnt slices in shock, a kettle in the witness stand begins to whistle, and a jury of spoons leans forward. Dramatic lighting, gravely serious tone.",
  },
  {
    id: "extreme-ironing-world-cup",
    title: "Extreme Ironing World Cup",
    tagline: "Press. Under. Pressure.",
    logline:
      "The world's finest athletes iron shirts in the most dangerous places imaginable, with full sports-broadcast coverage.",
    genres: ["Live", "Brainrot", "Sports"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Big-budget sports broadcast look, epic wide shots of extreme locations, slow-motion replays, saturated color, dramatic sports cinematography.",
    premise:
      "A world-cup sports broadcast of extreme ironing: competitors in lycra ironing shirts on cliff faces, in white-water rapids, on the wing of a flying plane, underwater, on a volcano rim, with slow-motion replays and a roaring crowd.",
    coverPrompt: `${KEYART} An athlete in lycra calmly irons a crisp white shirt on an ironing board balanced on a narrow cliff ledge above a vast canyon at sunrise, a helicopter filming, spectators tiny on the far rim. Epic sports cinematography. The title "EXTREME IRONING WORLD CUP" rendered in bold italic sports-broadcast capitals with a metallic sheen, white and electric blue, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Epic sports broadcast: slow motion, an athlete in lycra irons a white shirt on an ironing board strapped to a raft plunging through white-water rapids, spray exploding around her as she calmly finishes a sleeve and raises the iron in triumph while a crowd on the riverbank roars. Saturated color, dramatic cinematography.",
  },
  {
    id: "cats-in-business-casual",
    title: "Cats in Business Casual",
    tagline: "Q3 is going to be a lot.",
    logline:
      "A corporate drama set in a glass office tower where every employee is a cat, and the quarterly numbers are down.",
    genres: ["Live", "Brainrot"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Sleek corporate-drama look, glass office tower interiors, cool daylight, shallow depth of field, prestige-TV camera, cats in tailored office wear.",
    premise:
      "A corporate drama in a glass office tower staffed entirely by cats in business casual: tense boardroom meetings, a cat CEO staring out at the skyline, whiteboard strategy sessions, a printer jam crisis, an all-hands meeting where everyone knocks their coffee off the table.",
    coverPrompt: `${KEYART} A boardroom at the top of a glass office tower at dawn, six cats in tailored business-casual attire seated around a long table looking gravely at a falling chart on a screen, a grey cat CEO standing at the window. Prestige corporate-drama look, shallow depth of field. The title "CATS IN BUSINESS CASUAL" rendered in refined modern corporate sans-serif, charcoal and white, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Sleek corporate drama: a glass boardroom at dawn, a grey cat CEO in a blazer paces in front of a screen showing a plunging chart while six cats in business casual sit tensely around the table; one cat slowly pushes a coffee mug off the edge of the table and everyone watches it fall. Cool daylight, prestige-TV camera.",
  },
  {
    id: "the-fridge-dimension",
    title: "The Fridge Dimension",
    tagline: "Every time you open it, somewhere else.",
    logline:
      "A man opens his refrigerator over and over. It is never the inside of a refrigerator.",
    genres: ["Live", "Brainrot"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Ordinary suburban kitchen look colliding with spectacular otherworldly vistas, warm kitchen light against impossible glowing spaces, wide steady framing.",
    premise:
      "A man in a bathrobe in an ordinary suburban kitchen keeps opening his refrigerator, and each time the door reveals a different impossible place: a cathedral, a jungle, deep space, a stadium mid-match, the same kitchen from the other side. He reacts mildly and closes the door each time.",
    coverPrompt: `${KEYART} A man in a bathrobe stands in an ordinary warm-lit suburban kitchen holding open his refrigerator door, but the fridge interior is a blazing cosmic nebula with planets drifting out onto the linoleum, cold light spilling over him. Deadpan wonder. The title "THE FRIDGE DIMENSION" rendered in retro chrome 1950s appliance-badge lettering, mint green and chrome, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Deadpan comedy: a man in a bathrobe shuffles into an ordinary suburban kitchen, opens the refrigerator, and a blazing rainforest with a waterfall and screaming parrots is inside; a toucan flies out past his head, he sighs, closes the door, and opens it again to reveal outer space. Warm kitchen light against impossible glowing spaces.",
  },
  {
    id: "dad-rock-volcano",
    title: "Dad Rock Volcano",
    tagline: "Live. Loud. Lava.",
    logline:
      "A band of middle-aged dads plays an endless rock concert on the rim of an erupting volcano, and the eruption is getting into it.",
    genres: ["Live", "Brainrot", "Music"],
    year: 2026,
    rating: "ALL",
    mode: "chaos",
    style:
      "Epic concert-film look, stadium lighting rigs, lava glow and sparks, sweeping crane shots, high-energy saturated color.",
    premise:
      "Four middle-aged dads in cargo shorts and faded band shirts play a rock concert on a stage built on the rim of an erupting volcano: guitar solos as lava fountains erupt in time, a drum solo that triggers tremors, a crowd of thousands in the ash, pyrotechnics competing with the actual volcano.",
    coverPrompt: `${KEYART} Four middle-aged dads in cargo shorts and faded band t-shirts rock out on a huge concert stage built on the rim of an erupting volcano at night, lava fountains and stadium lights blazing behind them, a vast crowd in the ash below. Epic concert-film energy. The title "DAD ROCK VOLCANO" rendered in flaming heavy-metal chrome letters with lava-orange glow, lower third. ${TITLE_RULES}`,
    previewPrompt:
      "Epic concert film: a sweeping crane shot over a vast crowd toward a stage on the rim of an erupting volcano at night, four middle-aged dads in cargo shorts hit a huge guitar chord and a fountain of lava erupts behind them in perfect time, stadium lights and sparks everywhere, the crowd loses it. High-energy saturated color.",
  },
];

/** Browse-page rows: title ids in display order. */
export const ROWS = [
  {
    id: "trending",
    label: "Trending Now",
    ids: [
      "meridian-drift",
      "capybara-news-network",
      "neon-vespers",
      "hollow-creek",
      "the-velvet-score",
      "dad-rock-volcano",
      "kingdom-of-ash",
      "pip-and-the-moon-engine",
    ],
  },
  {
    id: "chaos",
    label: "Live Channels: Brainrot",
    live: true,
    ids: [
      "capybara-news-network",
      "goblin-tax-season",
      "infinite-staircase",
      "toaster-court",
      "extreme-ironing-world-cup",
      "cats-in-business-casual",
      "the-fridge-dimension",
      "dad-rock-volcano",
    ],
  },
  {
    id: "films",
    label: "Films Written While You Watch",
    ids: [
      "salt-and-sundown",
      "undertow",
      "last-train-to-kemper",
      "the-deep-below",
      "second-wind",
      "the-cartographers-daughter",
      "bureau-of-small-miracles",
      "planet-verdant",
    ],
  },
  {
    id: "thrillers",
    label: "Edge of Your Seat",
    ids: [
      "the-deep-below",
      "last-train-to-kemper",
      "hollow-creek",
      "the-velvet-score",
      "meridian-drift",
      "neon-vespers",
    ],
  },
  {
    id: "family",
    label: "For the Whole Household",
    ids: [
      "pip-and-the-moon-engine",
      "planet-verdant",
      "bureau-of-small-miracles",
      "the-cartographers-daughter",
      "capybara-news-network",
      "the-fridge-dimension",
    ],
  },
];
