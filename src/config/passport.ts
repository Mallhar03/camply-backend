import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./prisma";

const ADJECTIVES = [
  "ancient", "blazing", "bold", "bright", "calm", "cosmic", "crimson", "dark",
  "electric", "ember", "fierce", "frozen", "ghost", "glowing", "golden", "hidden",
  "hollow", "iron", "jade", "lunar", "misty", "phantom", "sharp", "silent", "silver",
  "solar", "stormy", "swift", "wild", "quiet", "arctic", "amber", "ashen", "atomic",
  "azure", "barren", "black", "blaze", "bleak", "blessed", "blind", "blunt", "brave",
  "broken", "bronze", "burning", "buried", "cedar", "chrome", "cinder", "cloud",
  "cobalt", "cold", "comet", "cool", "copper", "coral", "crystal", "cursed", "cyan",
  "deadly", "deep", "delta", "dense", "desert", "dim", "dire", "distant", "divine",
  "drifting", "dusk", "dusty", "dying", "eager", "early", "east", "eerie", "endless",
  "epic", "eternal", "faded", "faint", "fallen", "feral", "flame", "flash", "flinty",
  "flint", "floating", "flaming", "foggy", "forest", "fossil", "free", "frost",
  "frosty", "furious", "gentle", "giant", "grim", "gritty", "gravel", "gray",
  "green", "grim", "hard", "harsh", "haunted", "heavy", "high", "hollow", "huge",
  "hungry", "icy", "immense", "immortal", "infinite", "inner", "ivory", "jagged",
  "keen", "lava", "lean", "light", "limitless", "lofty", "lone", "lonely", "long",
  "lost", "loud", "low", "lucky", "mad", "marble", "mighty", "mint", "molten", "mystic",
  "mythic", "narrow", "neon", "night", "noble", "north", "obsidian", "ocean", "odd",
  "olive", "onyx", "open", "outer", "pale", "petrified", "primal", "proud", "pure",
  "purple", "radiant", "rapid", "raw", "reckless", "red", "remote", "restless",
  "rigid", "rising", "rocky", "rouge", "rough", "royal", "rugged", "runic", "sacred",
  "savage", "scarlet", "scorched", "sealed", "serene", "shaded", "shallow", "shining",
  "shrouded", "skeletal", "sleek", "slim", "slow", "small", "smoky", "soaring", "soft",
  "solid", "somber", "spectral", "spinning", "steel", "stone", "strange", "strong",
  "stubborn", "sunken", "sure", "tall", "tangled", "teal", "tempest", "thick", "thin",
  "thorned", "thunder", "tidal", "timeless", "tiny", "titan", "toxic", "tranquil",
  "turquoise", "twilight", "twisted", "ultra", "unbroken", "undying", "unknown",
  "unnamed", "untamed", "upper", "vast", "velvet", "venomous", "vibrant", "violent",
  "violet", "vivid", "volcanic", "wandering", "warped", "weeping", "western", "white",
  "wicked", "winged", "winter", "wise", "withered", "worn", "woven", "wraith", "yellow",
  "zenith", "zephyr", "ashen", "blazing", "charged", "daring", "ebon", "fleeting",
  "glinting", "hallowed", "ironed", "jutting", "knotted", "lurking", "muted",
  "nordic", "ominous", "peaked", "quaking", "rimmed", "solemn", "tarnished",
  "umbral", "veiled", "waning", "xeric", "yearning", "zealous", "abyssal", "brazen",
  "crackling", "dreadful", "effulgent", "frostbitten", "gnarly", "howling",
  "inky", "jagged", "kinetic", "looming", "monstrous", "nimble", "oblique",
  "prowling", "quarried", "ravaged", "scorching", "thunderous", "unyielding",
  "vaporous", "weathered", "xerophytic", "yonder", "zigzag", "arid", "boundless",
  "crumbling", "daunting", "errant", "flared", "graveled", "hardened", "immovable",
  "jinxed", "kestrel", "lurching", "mired", "nebulous", "otherworldly", "plunging",
  "quelled", "roiling", "scathed", "torrid", "unflinching", "vapid", "windswept",
  "xtreme", "yielding", "zonal"
];

const ANIMALS = [
  "fox", "panda", "wolf", "hawk", "bear", "owl", "lion", "tiger", "eagle", "raven",
  "cobra", "lynx", "deer", "crane", "viper", "moose", "bison", "falcon", "otter",
  "badger", "heron", "gecko", "robin", "finch", "hyena", "dingo", "kite", "mole",
  "tapir", "ibis", "bison", "jaguar", "puma", "cheetah", "leopard", "panther",
  "rhino", "hippo", "gator", "croc", "python", "mamba", "adder", "asp", "boa",
  "condor", "osprey", "kestrel", "merlin", "harrier", "buzzard", "vulture", "stork",
  "egret", "bittern", "plover", "snipe", "dunlin", "turnstone", "godwit", "curlew",
  "whimbrel", "knot", "stint", "sandpiper", "avocet", "oystercatcher", "lapwing",
  "redshank", "greenshank", "dotterel", "teal", "wigeon", "gadwall", "pintail",
  "shoveler", "pochard", "scaup", "eider", "scoter", "merganser", "smew", "goosander",
  "grebe", "diver", "gannet", "booby", "frigatebird", "tropicbird", "petrel",
  "shearwater", "albatross", "fulmar", "tern", "skimmer", "noddy", "puffin",
  "guillemot", "razorbill", "murre", "auklet", "murrelet", "kittiwake", "gull",
  "skua", "jaeger", "pheasant", "partridge", "grouse", "ptarmigan", "capercaillie",
  "quail", "turkey", "peacock", "hornbill", "toucan", "macaw", "parrot", "cockatoo",
  "lorikeet", "lory", "conure", "caique", "amazon", "eclectus", "lovebird",
  "budgerigar", "cockatiel", "corella", "galah", "kea", "kakapo", "kiwi", "cassowary",
  "emu", "rhea", "ostrich", "tinamou", "manakin", "cotinga", "tanager", "bunting",
  "warbler", "sparrow", "thrush", "blackbird", "starling", "myna", "oriole",
  "grosbeak", "crossbill", "siskin", "goldfinch", "linnet", "twite", "redpoll",
  "bullfinch", "hawfinch", "waxwing", "dipper", "wren", "treecreeper", "nuthatch",
  "tit", "martin", "swallow", "swift", "nightjar", "frogmouth", "potoo", "oilbird",
  "mousebird", "hoopoe", "roller", "kingfisher", "motmot", "trogon", "cuckoo",
  "roadrunner", "turaco", "bustard", "sunbird", "spiderhunter", "flowerpecker",
  "white-eye", "vireo", "pipit", "wagtail", "accentor", "babblers", "laughingthrush",
  "fulvetta", "yuhina", "wren-babbler", "scimitar-babbler", "ground-babbler",
  "timalia", "stachyris", "spelaeornis", "ptilocichla", "kenopia", "malacopteron"
];

function generatePseudoUsername(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const number = Math.floor(Math.random() * 90) + 10;
  return `${adjective}${animal}${number}`;
}

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || "mock_client_id_for_testing",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock_client_secret_for_testing",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "/api/v1/auth/google/callback",
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails?.[0].value;
        const name = profile.displayName || "Camply User";
        const avatar = profile.photos?.[0].value;

        if (!email) {
          return done(new Error("No email provided by Google"), false);
        }

        // Check if user with googleId exists
        let user = await prisma.user.findUnique({ where: { googleId } });

        if (user) {
          return done(null, user as any);
        }

        // Check if user with email exists
        user = await prisma.user.findUnique({ where: { email } });

        if (user) {
          // Link googleId to existing account
          user = await prisma.user.update({
            where: { id: user.id },
            data: { googleId },
          });
          return done(null, user as any);
        }

        // Generate a pseudo-anonymous username
        let username = generatePseudoUsername();
        let usernameExists = await prisma.user.findUnique({ where: { username } });
        let attempts = 1;

        while (usernameExists && attempts < 10) {
          username = generatePseudoUsername();
          usernameExists = await prisma.user.findUnique({ where: { username } });
          attempts++;
        }

        if (usernameExists) {
          username = `${username}${googleId.substring(0, 4)}`;
        }

        // Create new user
        user = await prisma.user.create({
          data: {
            name,
            email,
            username,
            googleId,
            avatar,
            passwordHash: null, // No password for OAuth users
          },
        });

        return done(null, user as any);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport;
