// Word lists for Amateur and Expert levels
// Each word MUST include: word (string), chunks (for Round 2), partOfSpeech ("noun" | "verb" | "adjective").
// Nouns may include nounType ("person" | "place" | "thing" | "idea") for correct sentence frames.
// partOfSpeech is required for Round 3; words are only inserted into pre-written frames.

const DEFAULT_WORD_LISTS = {
    amateur: [
        { word: "beautiful", chunks: ["beau", "ti", "ful"], partOfSpeech: "adjective" },
        { word: "wonderful", chunks: ["won", "der", "ful"], partOfSpeech: "adjective" },
        { word: "careful", chunks: ["care", "ful"], partOfSpeech: "adjective" },
        { word: "helpful", chunks: ["help", "ful"], partOfSpeech: "adjective" },
        { word: "peaceful", chunks: ["peace", "ful"], partOfSpeech: "adjective" },
        { word: "colorful", chunks: ["color", "ful"], partOfSpeech: "adjective" },
        { word: "powerful", chunks: ["power", "ful"], partOfSpeech: "adjective" },
        { word: "thankful", chunks: ["thank", "ful"], partOfSpeech: "adjective" },
        { word: "hopeful", chunks: ["hope", "ful"], partOfSpeech: "adjective" },
        { word: "playful", chunks: ["play", "ful"], partOfSpeech: "adjective" },
        { word: "joyful", chunks: ["joy", "ful"], partOfSpeech: "adjective" },
        { word: "grateful", chunks: ["grate", "ful"], partOfSpeech: "adjective" },
        { word: "success", chunks: ["suc", "cess"], partOfSpeech: "noun", nounType: "idea" },
        { word: "happiness", chunks: ["hap", "pi", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "kindness", chunks: ["kind", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "darkness", chunks: ["dark", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "goodness", chunks: ["good", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "softness", chunks: ["soft", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "brightness", chunks: ["bright", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "sweetness", chunks: ["sweet", "ness"], partOfSpeech: "noun", nounType: "idea" },
        { word: "teacher", chunks: ["teach", "er"], partOfSpeech: "noun", nounType: "person" },
        { word: "helper", chunks: ["help", "er"], partOfSpeech: "noun", nounType: "person" },
        { word: "runner", chunks: ["run", "ner"], partOfSpeech: "noun", nounType: "person" },
        { word: "writer", chunks: ["writ", "er"], partOfSpeech: "noun", nounType: "person" },
        { word: "reader", chunks: ["read", "er"], partOfSpeech: "noun", nounType: "person" }
    ],
    expert: [
        { word: "extraordinary", chunks: ["extra", "or", "din", "ary"], partOfSpeech: "adjective" },
        { word: "responsibility", chunks: ["re", "spon", "si", "bil", "ity"], partOfSpeech: "noun", nounType: "idea" },
        { word: "understanding", chunks: ["un", "der", "stand", "ing"], partOfSpeech: "noun", nounType: "idea" },
        { word: "celebration", chunks: ["cel", "e", "bra", "tion"], partOfSpeech: "noun", nounType: "idea" },
        { word: "imagination", chunks: ["im", "ag", "i", "na", "tion"], partOfSpeech: "noun", nounType: "idea" },
        { word: "adventure", chunks: ["ad", "ven", "ture"], partOfSpeech: "noun", nounType: "idea" },
        { word: "challenge", chunks: ["chal", "lenge"], partOfSpeech: "noun", nounType: "idea" },
        { word: "knowledge", chunks: ["know", "ledge"], partOfSpeech: "noun", nounType: "idea" },
        { word: "encourage", chunks: ["en", "cour", "age"], partOfSpeech: "verb" },
        { word: "discover", chunks: ["dis", "cov", "er"], partOfSpeech: "verb" },
        { word: "beautifully", chunks: ["beau", "ti", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "wonderfully", chunks: ["won", "der", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "carefully", chunks: ["care", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "successfully", chunks: ["suc", "cess", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "peacefully", chunks: ["peace", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "powerfully", chunks: ["power", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "gratefully", chunks: ["grate", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "hopefully", chunks: ["hope", "ful", "ly"], partOfSpeech: "adjective" },
        { word: "thoughtful", chunks: ["thought", "ful"], partOfSpeech: "adjective" },
        { word: "meaningful", chunks: ["mean", "ing", "ful"], partOfSpeech: "adjective" },
        { word: "wonderful", chunks: ["won", "der", "ful"], partOfSpeech: "adjective" },
        { word: "respectful", chunks: ["re", "spect", "ful"], partOfSpeech: "adjective" },
        { word: "doubtful", chunks: ["doubt", "ful"], partOfSpeech: "adjective" },
        { word: "fearful", chunks: ["fear", "ful"], partOfSpeech: "adjective" },
        { word: "cheerful", chunks: ["cheer", "ful"], partOfSpeech: "adjective" },
        { word: "skillful", chunks: ["skill", "ful"], partOfSpeech: "adjective" },
        { word: "harmful", chunks: ["harm", "ful"], partOfSpeech: "adjective" },
        { word: "useful", chunks: ["use", "ful"], partOfSpeech: "adjective" },
        { word: "awful", chunks: ["aw", "ful"], partOfSpeech: "adjective" },
        { word: "lawful", chunks: ["law", "ful"], partOfSpeech: "adjective" }
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
// Always returns amateur and expert arrays with at least default words so homepage options show
export function getWordListsForSet(setId) {
    const freshData = loadSets();
    const set = freshData.sets.find(s => s.id === setId);
    if (!set || !set.wordLists) return DEFAULT_WORD_LISTS;
    const wl = set.wordLists;
    return {
        amateur: Array.isArray(wl.amateur) && wl.amateur.length > 0 ? wl.amateur : DEFAULT_WORD_LISTS.amateur,
        expert: Array.isArray(wl.expert) && wl.expert.length > 0 ? wl.expert : DEFAULT_WORD_LISTS.expert
    };
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
