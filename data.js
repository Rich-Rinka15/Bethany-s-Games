// Word lists for Amateur and Expert levels
// Each word includes the full word and an array of word-part chunks for Round 2

const DEFAULT_WORD_LISTS = {
    amateur: [
        {
            word: "beautiful",
            chunks: ["beau", "ti", "ful"]
        },
        {
            word: "wonderful",
            chunks: ["won", "der", "ful"]
        },
        {
            word: "careful",
            chunks: ["care", "ful"]
        },
        {
            word: "helpful",
            chunks: ["help", "ful"]
        },
        {
            word: "peaceful",
            chunks: ["peace", "ful"]
        },
        {
            word: "colorful",
            chunks: ["color", "ful"]
        },
        {
            word: "powerful",
            chunks: ["power", "ful"]
        },
        {
            word: "thankful",
            chunks: ["thank", "ful"]
        },
        {
            word: "hopeful",
            chunks: ["hope", "ful"]
        },
        {
            word: "playful",
            chunks: ["play", "ful"]
        },
        {
            word: "joyful",
            chunks: ["joy", "ful"]
        },
        {
            word: "grateful",
            chunks: ["grate", "ful"]
        },
        {
            word: "success",
            chunks: ["suc", "cess"]
        },
        {
            word: "happiness",
            chunks: ["hap", "pi", "ness"]
        },
        {
            word: "kindness",
            chunks: ["kind", "ness"]
        },
        {
            word: "darkness",
            chunks: ["dark", "ness"]
        },
        {
            word: "goodness",
            chunks: ["good", "ness"]
        },
        {
            word: "softness",
            chunks: ["soft", "ness"]
        },
        {
            word: "brightness",
            chunks: ["bright", "ness"]
        },
        {
            word: "sweetness",
            chunks: ["sweet", "ness"]
        },
        {
            word: "teacher",
            chunks: ["teach", "er"]
        },
        {
            word: "helper",
            chunks: ["help", "er"]
        },
        {
            word: "runner",
            chunks: ["run", "ner"]
        },
        {
            word: "writer",
            chunks: ["writ", "er"]
        },
        {
            word: "reader",
            chunks: ["read", "er"]
        }
    ],
    expert: [
        {
            word: "extraordinary",
            chunks: ["extra", "or", "din", "ary"]
        },
        {
            word: "responsibility",
            chunks: ["re", "spon", "si", "bil", "ity"]
        },
        {
            word: "understanding",
            chunks: ["un", "der", "stand", "ing"]
        },
        {
            word: "celebration",
            chunks: ["cel", "e", "bra", "tion"]
        },
        {
            word: "imagination",
            chunks: ["im", "ag", "i", "na", "tion"]
        },
        {
            word: "adventure",
            chunks: ["ad", "ven", "ture"]
        },
        {
            word: "challenge",
            chunks: ["chal", "lenge"]
        },
        {
            word: "knowledge",
            chunks: ["know", "ledge"]
        },
        {
            word: "encourage",
            chunks: ["en", "cour", "age"]
        },
        {
            word: "discover",
            chunks: ["dis", "cov", "er"]
        },
        {
            word: "beautifully",
            chunks: ["beau", "ti", "ful", "ly"]
        },
        {
            word: "wonderfully",
            chunks: ["won", "der", "ful", "ly"]
        },
        {
            word: "carefully",
            chunks: ["care", "ful", "ly"]
        },
        {
            word: "successfully",
            chunks: ["suc", "cess", "ful", "ly"]
        },
        {
            word: "peacefully",
            chunks: ["peace", "ful", "ly"]
        },
        {
            word: "powerfully",
            chunks: ["power", "ful", "ly"]
        },
        {
            word: "gratefully",
            chunks: ["grate", "ful", "ly"]
        },
        {
            word: "hopefully",
            chunks: ["hope", "ful", "ly"]
        },
        {
            word: "thoughtful",
            chunks: ["thought", "ful"]
        },
        {
            word: "meaningful",
            chunks: ["mean", "ing", "ful"]
        },
        {
            word: "wonderful",
            chunks: ["won", "der", "ful"]
        },
        {
            word: "respectful",
            chunks: ["re", "spect", "ful"]
        },
        {
            word: "doubtful",
            chunks: ["doubt", "ful"]
        },
        {
            word: "fearful",
            chunks: ["fear", "ful"]
        },
        {
            word: "cheerful",
            chunks: ["cheer", "ful"]
        },
        {
            word: "skillful",
            chunks: ["skill", "ful"]
        },
        {
            word: "harmful",
            chunks: ["harm", "ful"]
        },
        {
            word: "useful",
            chunks: ["use", "ful"]
        },
        {
            word: "awful",
            chunks: ["aw", "ful"]
        },
        {
            word: "lawful",
            chunks: ["law", "ful"]
        }
    ]
};

// Default set structure
const DEFAULT_SET = {
    id: 'default',
    name: 'Default Set',
    active: true,
    wordLists: DEFAULT_WORD_LISTS
};

// Load sets from localStorage or use default
function loadSets() {
    const stored = localStorage.getItem('spellingGameSets');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            // Validate structure
            if (parsed.sets && Array.isArray(parsed.sets) && parsed.sets.length > 0) {
                return parsed;
            }
        } catch (e) {
            console.error('Error loading sets from localStorage:', e);
        }
    }
    // Return default structure
    return {
        sets: [JSON.parse(JSON.stringify(DEFAULT_SET))]
    };
}

// Save sets to localStorage
export function saveSets(setsData) {
    try {
        localStorage.setItem('spellingGameSets', JSON.stringify(setsData));
        return true;
    } catch (e) {
        console.error('Error saving sets to localStorage:', e);
        return false;
    }
}

// Get sets (from localStorage or default)
export const SETS_DATA = loadSets();

// Get active sets for players (reads fresh from localStorage)
export function getActiveSets() {
    const freshData = loadSets();
    return freshData.sets.filter(set => set.active);
}

// Get word lists for a specific set (reads fresh from localStorage)
export function getWordListsForSet(setId) {
    const freshData = loadSets();
    const set = freshData.sets.find(s => s.id === setId);
    return set ? set.wordLists : DEFAULT_WORD_LISTS;
}

// Legacy: Get word lists (for backward compatibility, uses first active set or default)
export const WORD_LISTS = (() => {
    const activeSets = getActiveSets();
    if (activeSets.length > 0) {
        return activeSets[0].wordLists;
    }
    return DEFAULT_WORD_LISTS;
})();

// Get default word lists (for reset functionality)
export function getDefaultWordLists() {
    return JSON.parse(JSON.stringify(DEFAULT_WORD_LISTS));
}

// Get default set structure
export function getDefaultSet() {
    return JSON.parse(JSON.stringify(DEFAULT_SET));
}
