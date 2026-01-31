import { getActiveSets, getWordListsForSet, getDefaultSet } from './data.js';

if (typeof console !== 'undefined' && console.log) {
    console.log('[Spelling Game] script loaded');
}

// Single source of truth: Game State
const gameState = {
    // Phase: "levelSelect" | "playing" | "complete"
    gamePhase: "levelSelect",
    
    // Level selection (immutable after selection)
    selectedSetId: null,
    selectedLevel: null, // 'amateur' or 'expert'
    wordLists: null, // Full word lists for selected set
    
    // Round progression
    currentRound: 0, // 0 = not started, 1-3 = active round
    currentWordIndex: 0,
    roundWords: [], // Shuffled words for current round
    
    // Game progress
    totalScore: 0,
    roundScores: [0, 0, 0], // points per round (1, 2, 3)
    wordsWithOnePoint: [], // words where student got only 1 point (2+ errors before correct)
    currentWordErrors: 0,
    
    // Audio
    audioEnabled: false
};

// Amateur vs Expert: All gameplay features (confetti, letter announcements, continue on any click/key,
// round scores, keyboard input, etc.) apply to both levels. The only level-specific behavior is:
// word list (state.wordLists[state.selectedLevel]), word playback speed (amateur slower), and
// Round 2 letter-highlight timing (amateur has longer delays between letters).

// State validation functions
function isValidStateTransition(action, currentState) {
    switch (action) {
        case 'SELECT_LEVEL':
            return currentState.gamePhase === 'levelSelect' && 
                   currentState.selectedSetId === null && 
                   currentState.selectedLevel === null;
        
        case 'START_ROUND':
            return currentState.gamePhase === 'playing' && 
                   currentState.currentRound >= 1 && 
                   currentState.currentRound <= 3 &&
                   currentState.currentWordIndex === 0;
        
        case 'NEXT_WORD':
            return currentState.gamePhase === 'playing' && 
                   currentState.currentRound >= 1 && 
                   currentState.currentWordIndex < currentState.roundWords.length;
        
        case 'ADVANCE_ROUND':
            return currentState.gamePhase === 'playing' && 
                   currentState.currentWordIndex >= currentState.roundWords.length &&
                   currentState.currentRound < 3;
        
        case 'COMPLETE_GAME':
            return currentState.gamePhase === 'playing' && 
                   currentState.currentRound === 3 &&
                   currentState.currentWordIndex >= currentState.roundWords.length;
        
        default:
            return false;
    }
}

// State update function (only way to modify state)
function updateGameState(updates) {
    Object.assign(gameState, updates);
    updateUI();
}

// Get current state (read-only)
function getGameState() {
    return { ...gameState };
}

// DOM elements
const startScreen = document.getElementById('startScreen');
const gameScreen = document.getElementById('gameScreen');
const completionScreen = document.getElementById('completionScreen');
const modeContainer = document.getElementById('modeContainer');
const currentRoundDisplay = document.getElementById('currentRound');
const currentWordIndexDisplay = document.getElementById('currentWordIndex');
const totalWordsDisplay = document.getElementById('totalWords');
const progressBar = document.getElementById('progressBar');
const effectsLayer = document.getElementById('effects-layer');
const roundTitle = document.getElementById('roundTitle');
const round1Content = document.getElementById('round1Content');
const round2Content = document.getElementById('round2Content');
const round3Content = document.getElementById('round3Content');
const playWordBtn = document.getElementById('playWordBtn');
const playWordBtn2 = document.getElementById('playWordBtn2');
const playWordBtn3 = document.getElementById('playWordBtn3');
const wordDisplay = document.getElementById('wordDisplay');
const wordDisplay2 = document.getElementById('wordDisplay2');
const keyboardContainer = document.getElementById('keyboardContainer');
const chunksAvailable = document.getElementById('chunksAvailable');
const chunksSelected = document.getElementById('chunksSelected');
const checkChunksBtn = document.getElementById('checkChunksBtn');
const spellingInput = document.getElementById('spellingInput');
const checkSpellingBtn = document.getElementById('checkSpellingBtn');
const round2TextAttemptSection = document.getElementById('round2TextAttemptSection');
const round2SpellingInput = document.getElementById('round2SpellingInput');
const round2CheckSpellingBtn = document.getElementById('round2CheckSpellingBtn');
const round1UnscrambleSection = document.getElementById('round1UnscrambleSection');
const selectedLetters = document.getElementById('selectedLetters');
const checkUnscrambleBtn = document.getElementById('checkUnscrambleBtn');
const exitGameBtn = document.getElementById('exitGameBtn');
const currentScore = document.getElementById('currentScore');
const finalScore = document.getElementById('finalScore');
const roundScoresBreakdown = document.getElementById('roundScoresBreakdown');
const wordsWithOnePointSection = document.getElementById('wordsWithOnePointSection');
const feedbackArea = document.getElementById('feedbackArea');
const nextWordBtn = document.getElementById('nextWordBtn');
const playAgainBtn = document.getElementById('playAgainBtn');
const nextRoundOverlay = document.getElementById('nextRoundOverlay');
const nextRoundTitleEl = document.getElementById('nextRoundTitle');

// Round-specific state
let round1State = {
    letters: [],
    currentLetterIndex: 0,
    keyboardKeys: [], // Array to store all key elements in order
    keyInstances: {}, // Track which key instance to use for each letter position
    selectedLetters: [], // Letters selected by player in order
    scrambledKeys: [], // Scrambled version of keys for clicking
    lastLetterClickKey: null, // Prevent double-fire (touch + click on same tap)
    lastLetterClickTime: 0,
    round2Phase: 'text' // 'text' = type attempt (no tiles), 'tiles' = letter tiles shown after 2 errors
};

let round2State = {
    availableChunks: [],   // correct chunks + 2 distractors (shuffled)
    selectedChunks: [],
    correctChunks: [],
    usedChunks: []         // correct chunks grayed out after word is correct
};

let round3State = {
    userInput: ''
};

// Start game for selected level. Mode selection is privileged; call from mode button handlers only.
function startGame(level) {
    const setId = 'default';
    let wordLists = getWordListsForSet(setId);
    const defaultLists = getDefaultSet().wordLists;
    if (!wordLists || !wordLists[level] || !wordLists[level].length) {
        wordLists = defaultLists;
    }
    updateGameState({
        gamePhase: 'playing',
        selectedSetId: setId,
        selectedLevel: level,
        wordLists: wordLists,
        currentRound: 1,
        currentWordIndex: 0,
        totalScore: 0,
        roundScores: [0, 0, 0],
        wordsWithOnePoint: [],
        currentWordErrors: 0,
        audioEnabled: false
    });
    if (modeContainer) {
        const allBtns = modeContainer.querySelectorAll('button');
        allBtns.forEach(b => { b.disabled = true; b.style.opacity = '0.5'; b.style.cursor = 'not-allowed'; });
    }
    // Defer so DOM updates run after click handling completes
    setTimeout(function() {
        startRound(1);
    }, 0);
}

// Recovery: ensure Amateur and Expert buttons exist and have direct click bindings. No delegation.
function renderModes() {
    if (typeof console !== 'undefined' && console.log) console.log('renderModes called');
    const container = document.getElementById('modeContainer');
    if (!container) return;
    let am = document.getElementById('btnAmateur');
    let ex = document.getElementById('btnExpert');
    if (!am) {
        am = document.createElement('button');
        am.id = 'btnAmateur';
        am.type = 'button';
        am.className = 'level-btn amateur';
        am.setAttribute('data-mode-button', 'true');
        am.dataset.setId = 'default';
        am.dataset.level = 'amateur';
        am.setAttribute('aria-label', 'Select Amateur');
        am.innerHTML = '<span class="level-icon">📚</span><span class="level-name">Amateur</span>';
        container.appendChild(am);
        if (typeof console !== 'undefined' && console.log) console.log('renderModes: Amateur button appended');
    }
    if (!ex) {
        ex = document.createElement('button');
        ex.id = 'btnExpert';
        ex.type = 'button';
        ex.className = 'level-btn expert';
        ex.setAttribute('data-mode-button', 'true');
        ex.dataset.setId = 'default';
        ex.dataset.level = 'expert';
        ex.setAttribute('aria-label', 'Select Expert');
        ex.innerHTML = '<span class="level-icon">⭐</span><span class="level-name">Expert</span>';
        container.appendChild(ex);
        if (typeof console !== 'undefined' && console.log) console.log('renderModes: Expert button appended');
    }
    am.disabled = false;
    am.style.opacity = '1';
    am.style.cursor = '';
    ex.disabled = false;
    ex.style.opacity = '1';
    ex.style.cursor = '';

    function bindModeButton(btn, level, label) {
        if (btn.dataset.modeBound === '1') return;
        btn.dataset.modeBound = '1';
        const handler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof console !== 'undefined' && console.log) console.log(label + ' selected');
            if (btn.disabled) return;
            const state = getGameState();
            if (!isValidStateTransition('SELECT_LEVEL', state)) {
                if (typeof console !== 'undefined' && console.warn) console.warn('Mode click ignored (invalid state)', state);
                return;
            }
            btn.disabled = true;
            btn.style.opacity = '0.7';
            startGame(level);
        };
        const touchHandler = (ev) => { ev.preventDefault(); handler(ev); };
        btn.addEventListener('click', handler, { passive: false, capture: true });
        btn.addEventListener('touchend', touchHandler, { passive: false, capture: true });
    }
    bindModeButton(am, 'amateur', 'Amateur');
    bindModeButton(ex, 'expert', 'Expert');
}

// Initialize game
function init() {
    if (typeof console !== 'undefined' && console.log) console.log('[home] home screen rendering (init)');
    renderModes();

    // Reload sets when start screen becomes visible (e.g., returning from admin); independent of effects
    const startScreenObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.id === 'startScreen' && target.classList.contains('active')) {
                    if (typeof console !== 'undefined' && console.log) console.log('[home] home screen shown, loading modes');
                    renderModes();
                }
            }
        });
    });
    
    if (startScreen) {
        startScreenObserver.observe(startScreen, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    
    // Navigation: any click or key continues when "next word" is shown (button is visible); capture so it runs before round-specific handlers
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('[data-mode-button]')) return;
        if (nextWordBtn && !nextWordBtn.classList.contains('hidden') && !nextWordBtn.disabled) {
            nextWord();
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.closest('[data-mode-button]')) return;
        if (nextWordBtn && !nextWordBtn.classList.contains('hidden') && !nextWordBtn.disabled) {
            nextWord();
            e.preventDefault();
        }
    }, true);
    playAgainBtn.addEventListener('click', () => {
        location.reload();
    });

    // Play word buttons (state-driven)
    playWordBtn.addEventListener('click', () => {
        const state = getGameState();
        if (state.gamePhase === 'playing') {
            updateGameState({ audioEnabled: true });
            playCurrentWord();
        }
    });
    playWordBtn2.addEventListener('click', () => {
        const state = getGameState();
        if (state.gamePhase === 'playing') {
            updateGameState({ audioEnabled: true });
            playCurrentWord();
        }
    });
    playWordBtn3.addEventListener('click', () => {
        const state = getGameState();
        if (state.gamePhase === 'playing') {
            updateGameState({ audioEnabled: true });
            playCurrentWord();
        }
    });

    // Round 2: Chunk selection
    checkChunksBtn.addEventListener('click', checkChunksAnswer);

    // Round 1: Unscramble
    checkUnscrambleBtn.addEventListener('click', checkUnscrambleAnswer);

    // Exit button
    exitGameBtn.addEventListener('click', exitToHome);

    // Round 3: Spelling input
    spellingInput.addEventListener('input', () => {
        // Round 3: sentence dictation – allow spaces
        checkSpellingBtn.disabled = spellingInput.value.trim() === '';
    });
    spellingInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (!checkSpellingBtn.disabled) checkSpellingAnswer();
        }
        // Round 3: do not announce letters as the player types (sentence dictation)
    });
    checkSpellingBtn.addEventListener('click', checkSpellingAnswer);

    // Activate text box on any key: Round 2 text phase – focus Round 2 input when visible and not disabled
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.closest('[data-mode-button]')) return;
        if (e.target && (e.target === round2SpellingInput || e.target === spellingInput || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const state = getGameState();
        if (state.gamePhase !== 'playing') return;
        if (state.currentRound === 2 && round1Content && !round1Content.classList.contains('hidden') &&
            round2TextAttemptSection && !round2TextAttemptSection.classList.contains('hidden') &&
            round2SpellingInput && !round2SpellingInput.disabled) {
            round2SpellingInput.focus();
            const key = e.key;
            if (key === 'Enter') {
                e.preventDefault();
                if (round2CheckSpellingBtn && !round2CheckSpellingBtn.disabled) checkRound2TextAnswer();
                return;
            }
            const isPrintable = key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && key !== ' ' && key !== 'Tab' && key !== 'Escape';
            if (isPrintable) {
                e.preventDefault();
                round2SpellingInput.value += key;
                round2SpellingInput.dispatchEvent(new Event('input', { bubbles: true }));
                if (state.audioEnabled) speakLetter(key);
            }
            return;
        }
        if (state.currentRound === 3 && round3Content && !round3Content.classList.contains('hidden') && spellingInput) {
            spellingInput.focus();
            const key = e.key;
            if (key === 'Enter') {
                e.preventDefault();
                if (!checkSpellingBtn.disabled) checkSpellingAnswer();
                return;
            }
            // Allow letters and space for sentence dictation
            const isPrintable = key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && key !== 'Tab' && key !== 'Escape';
            if (isPrintable) {
                e.preventDefault();
                spellingInput.value += key;
                spellingInput.dispatchEvent(new Event('input', { bubbles: true }));
                // Round 3: do not announce letters
            }
        }
    });

    // Round 2 text phase: input and check
    if (round2SpellingInput) {
        round2SpellingInput.addEventListener('input', () => {
            if (round2CheckSpellingBtn) round2CheckSpellingBtn.disabled = round2SpellingInput.value.trim() === '';
        });
        round2SpellingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (round2CheckSpellingBtn && !round2CheckSpellingBtn.disabled) checkRound2TextAnswer();
            }
        });
    }
    if (round2CheckSpellingBtn) {
        round2CheckSpellingBtn.addEventListener('click', checkRound2TextAnswer);
    }

    // Round 2 (Watch & Repeat) tiles phase: keyboard input – type letters to select tiles, Backspace to remove last, Enter to submit
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.closest('[data-mode-button]')) return;
        const state = getGameState();
        if (state.gamePhase !== 'playing' || state.currentRound !== 2) return;
        if (e.target === round2SpellingInput) return; // text phase uses its own handlers
        if (!round1UnscrambleSection || round1UnscrambleSection.classList.contains('hidden')) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const key = e.key;
        if (key === 'Backspace') {
            e.preventDefault();
            if (round1State.selectedLetters.length > 0) {
                const pos = round1State.selectedLetters.length - 1;
                const originalIndex = round1State.selectedLetters[pos];
                removeSelectedLetter(pos, originalIndex);
            }
            return;
        }
        if (key === 'Enter') {
            e.preventDefault();
            if (round1State.selectedLetters.length === round1State.letters.length && !checkUnscrambleBtn.disabled) {
                checkUnscrambleAnswer();
            }
            return;
        }
        if (key.length === 1 && /[a-zA-Z]/.test(key)) {
            e.preventDefault();
            const letter = key.toUpperCase();
            const selectedSet = new Set(round1State.selectedLetters);
            let bestKey = null;
            let bestOriginalIndex = Infinity;
            round1State.scrambledKeys.forEach((keyEl) => {
                const keyOriginalIndex = parseInt(keyEl.dataset.originalIndex, 10);
                if (keyEl.textContent.toUpperCase() === letter && !selectedSet.has(keyOriginalIndex) && keyOriginalIndex < bestOriginalIndex) {
                    bestKey = keyEl;
                    bestOriginalIndex = keyOriginalIndex;
                }
            });
            if (bestKey) {
                const scrambledIndex = round1State.scrambledKeys.indexOf(bestKey);
                handleLetterClick(scrambledIndex);
            }
        }
    });

    // Navigation: any click or key continues when "next word" is shown (button is visible); capture so it runs before round-specific handlers
    document.addEventListener('click', (e) => {
        if (e.target && e.target.closest('[data-mode-button]')) return;
        if (nextWordBtn && !nextWordBtn.classList.contains('hidden') && !nextWordBtn.disabled) {
            nextWord();
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
    document.addEventListener('keydown', (e) => {
        if (e.target && e.target.closest('[data-mode-button]')) return;
        if (nextWordBtn && !nextWordBtn.classList.contains('hidden') && !nextWordBtn.disabled) {
            nextWord();
            e.preventDefault();
        }
    }, true);
    playAgainBtn.addEventListener('click', () => {
        location.reload();
    });

    // --- TEMPORARY: Skip Round 1 – remove this whole block and the #skipRound1Btn button in index.html to delete ---
    const skipRound1Btn = document.getElementById('skipRound1Btn');
    if (skipRound1Btn) {
        skipRound1Btn.addEventListener('click', () => {
            const state = getGameState();
            if (state.gamePhase !== 'playing' || state.currentRound !== 1) return;
            const allWords = [...state.wordLists[state.selectedLevel]];
            const selectedWords = selectRandomWords(allWords, 6);
            if (selectedWords.length === 0) return;
            updateGameState({
                currentRound: 2,
                currentWordIndex: 0,
                currentWordErrors: 0,
                roundWords: selectedWords
            });
            loadRound(2);
        });
    }
    // --- End Skip Round 1 ---

    // --- TEMPORARY: Skip Round 2 – remove this whole block and the #skipRound2Btn button in index.html to delete ---
    const skipRound2Btn = document.getElementById('skipRound2Btn');
    if (skipRound2Btn) {
        skipRound2Btn.addEventListener('click', () => {
            const state = getGameState();
            if (state.gamePhase !== 'playing' || state.currentRound !== 2) return;
            const allWords = [...state.wordLists[state.selectedLevel]];
            const selectedWords = selectRandomWords(allWords, 6);
            if (selectedWords.length === 0) return;
            updateGameState({
                currentRound: 3,
                currentWordIndex: 0,
                currentWordErrors: 0,
                roundWords: selectedWords
            });
            loadRound(3);
        });
    }
    // --- End Skip Round 2 ---
}

// Load active sets for player selection (robust, browser-safe). Runs independently of balloon/effects.
function loadActiveSets() {
    if (!modeContainer) {
        console.error('modeContainer element not found');
        return;
    }
    
    let activeSets = getActiveSets();
    modeContainer.innerHTML = '';
    if (activeSets.length === 0) {
        const defaultSet = getDefaultSet();
        defaultSet.active = true;
        activeSets = [defaultSet];
    }
    
    let modesCreated = 0;
    activeSets.forEach(set => {
        const wordLists = getWordListsForSet(set.id);
        // Create buttons for both amateur and expert levels (getWordListsForSet guarantees non-empty arrays)
        ['amateur', 'expert'].forEach(level => {
            if (!wordLists[level] || wordLists[level].length === 0) return;
            
            const btn = document.createElement('button');
            btn.className = `level-btn ${level}`;
            btn.dataset.setId = set.id;
            btn.dataset.level = level;
            btn.type = 'button'; // Ensure it's a button, not submit
            btn.setAttribute('aria-label', `Select ${set.name} - ${level === 'amateur' ? 'Amateur' : 'Expert'}`);
            btn.innerHTML = `
                <span class="level-icon">${level === 'amateur' ? '📚' : '⭐'}</span>
                <span class="level-name">${set.name} - ${level === 'amateur' ? 'Amateur' : 'Expert'}</span>
            `;
            
            // Use a closure to capture set.id and level values
            const setId = set.id;
            const setLevel = level;
            
            // CRITICAL: Use addEventListener with proper event handling
            // This ensures it works with ES modules and all browsers (Chrome, Safari, iPad, Google Sites)
            // Using a named function for better debugging
            function handleLevelSelection(e) {
                // Prevent default and stop propagation for safety
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                // Prevent double-clicking and rapid tapping
                if (btn.disabled) {
                    console.log('Button already disabled, ignoring click');
                    return;
                }
                
                // Get current state before making changes
                const currentState = getGameState();
                
                // State validation: Only allow level selection if in levelSelect phase
                if (!isValidStateTransition('SELECT_LEVEL', currentState)) {
                    console.warn('Invalid state transition: SELECT_LEVEL', currentState);
                    return;
                }
                
                // Disable button immediately to prevent rapid clicking
                btn.disabled = true;
                btn.style.opacity = '0.7';
                
                console.log('Level selected:', { setId, setLevel, phase: currentState.gamePhase }); // Debug log
                
                // Load word lists
                const wordLists = getWordListsForSet(setId);
                if (!wordLists || !wordLists[setLevel] || wordLists[setLevel].length === 0) {
                    alert('Error: No words available for this word list.');
                    btn.disabled = false; // Re-enable if error
                    btn.style.opacity = '1';
                    return;
                }
                
                // Update state: Level selection is now immutable
                updateGameState({
                    gamePhase: 'playing',
                    selectedSetId: setId,
                    selectedLevel: setLevel,
                    wordLists: wordLists,
                    currentRound: 1,
                    currentWordIndex: 0,
                    totalScore: 0,
                    roundScores: [0, 0, 0],
                    wordsWithOnePoint: [],
                    currentWordErrors: 0,
                    audioEnabled: false
                });
                
                // Disable all level selection buttons to prevent switching
                const allLevelButtons = modeContainer.querySelectorAll('button');
                allLevelButtons.forEach(b => {
                    b.disabled = true;
                    b.style.opacity = '0.5';
                    b.style.cursor = 'not-allowed';
                });
                
                // Start first round
                startRound(1);
            }
            
            // Attach event listener - works with ES modules and all browsers
            btn.addEventListener('click', handleLevelSelection, { passive: false });
            
            // Also support touch events for iPad/tablets
            btn.addEventListener('touchend', function(e) {
                e.preventDefault();
                handleLevelSelection(e);
            }, { passive: false });
            
            modeContainer.appendChild(btn);
            modesCreated += 1;
        });
    });
    if (typeof console !== 'undefined' && console.log) {
        console.log('[home] modes created', modesCreated);
    }
}

window.loadActiveSets = loadActiveSets;
window.renderModes = renderModes;

// Start a round (state-driven)
// Works for both Amateur and Expert levels - uses state.selectedLevel to get correct word list
function startRound(roundNumber) {
    const state = getGameState();
    
    // Validate round start
    if (state.gamePhase !== 'playing' || state.currentRound !== roundNumber) {
        console.warn('Invalid round start:', { phase: state.gamePhase, currentRound: state.currentRound, requested: roundNumber });
        return;
    }
    
    if (!state.wordLists || !state.wordLists[state.selectedLevel]) {
        console.error('No word lists available');
        return;
    }
    
    // Randomly select 6 words from the word list for this round
    // Works for both Amateur and Expert - uses state.selectedLevel to select from correct list
    const allWords = [...state.wordLists[state.selectedLevel]];
    const selectedWords = selectRandomWords(allWords, 6);
    
    if (selectedWords.length === 0) {
        console.error('No words available for selection');
        return;
    }
    
    // Update state with the randomly selected words
    updateGameState({
        roundWords: selectedWords,
        currentWordIndex: 0,
        currentWordErrors: 0
    });
    
    // Show game screen
    startScreen.classList.remove('active');
    gameScreen.classList.add('active');
    clearEffectsLayer();
    renderScoreBalloonsInEffectsLayer(0);
    
    // Load round UI
    loadRound(roundNumber);
}

// Shuffle array (Fisher-Yates)
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Randomly select N items from an array (for round word selection)
function selectRandomWords(wordList, count = 6) {
    if (!wordList || wordList.length === 0) {
        return [];
    }
    
    // If we have fewer words than requested, return all words
    if (wordList.length <= count) {
        return shuffleArray(wordList);
    }
    
    // Shuffle the entire list first
    const shuffled = shuffleArray(wordList);
    
    // Return the first N words
    return shuffled.slice(0, count);
}

// Exit to home (reset state); balloons explode first, then go home
function exitToHome() {
    if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
        popScoreBalloonsThen(() => {
            updateGameState({
                gamePhase: 'levelSelect',
                selectedSetId: null,
                selectedLevel: null,
                wordLists: null,
                currentRound: 0,
                currentWordIndex: 0,
                roundWords: [],
                totalScore: 0,
                roundScores: [0, 0, 0],
                wordsWithOnePoint: [],
                currentWordErrors: 0,
                audioEnabled: false
            });
            gameScreen.classList.remove('active');
            startScreen.classList.add('active');
            clearEffectsLayer();
            renderModes();
        });
    }
}

// Update UI based on current state
function updateUI() {
    const state = getGameState();
    
    // Ensure homepage game options (Amateur/Expert) always render when start screen is visible; independent of effects
    if (state.gamePhase === 'levelSelect' && startScreen && startScreen.classList.contains('active') && modeContainer) {
        const buttonCount = modeContainer.querySelectorAll('button').length;
        if (buttonCount === 0) {
            if (typeof console !== 'undefined' && console.log) console.log('[home] modes restored (defensive)');
            renderModes();
        }
    }
    
    // Update score
    if (currentScore) {
        currentScore.textContent = state.totalScore;
    }
    
    // Update round display
    if (currentRoundDisplay) {
        currentRoundDisplay.textContent = state.currentRound;
    }
    
    // Update word progress
    if (currentWordIndexDisplay && totalWordsDisplay) {
        currentWordIndexDisplay.textContent = state.currentWordIndex + 1;
        totalWordsDisplay.textContent = state.roundWords.length;
    }
    
    // Update progress bar
    if (progressBar && state.roundWords.length > 0) {
        const progress = ((state.currentWordIndex + 1) / state.roundWords.length) * 100;
        progressBar.style.width = `${progress}%`;
    }
    
    // Balloons are isolated: never updated here; only triggered by awardPoints() into #effects-layer
    
    // Disable/enable buttons based on state
    updateButtonStates();
}

const POINTS_PER_ROUND_MAX = 18; // 6 words × 3 points

// --- ISOLATED BALLOON EFFECTS (visual overlay only; never touch game state or main app DOM) ---
const BALLOON_PASTELS = [
    { bg: 'linear-gradient(165deg, #ffccd4 0%, #f0a0a8 100%)' },
    { bg: 'linear-gradient(165deg, #ffe0b8 0%, #f5c88a 100%)' },
    { bg: 'linear-gradient(165deg, #fff4b8 0%, #f0e090 100%)' },
    { bg: 'linear-gradient(165deg, #c8f0b8 0%, #a8e090 100%)' },
    { bg: 'linear-gradient(165deg, #b8e4f8 0%, #90c8e8 100%)' },
    { bg: 'linear-gradient(165deg, #ffd4e8 0%, #f0b0d0 100%)' },
    { bg: 'linear-gradient(165deg, #e0d4f8 0%, #c8b0e8 100%)' }
];

const EFFECTS_SCORE_BALLOONS_ID = 'effects-score-balloons';

function getEffectsLayer() {
    return document.getElementById('effects-layer');
}

function renderScoreBalloonsInEffectsLayer(totalScore) {
    const layer = getEffectsLayer();
    if (!layer) return;
    let row = document.getElementById(EFFECTS_SCORE_BALLOONS_ID);
    const count = Math.max(0, Number(totalScore) || 0);
    if (!row) {
        row = document.createElement('div');
        row.id = EFFECTS_SCORE_BALLOONS_ID;
        row.className = 'balloons-row';
        row.setAttribute('aria-hidden', 'true');
        layer.appendChild(row);
    }
    const currentCount = row.children.length;
    if (currentCount < count) {
        for (let i = currentCount; i < count; i++) {
            const wrap = document.createElement('div');
            wrap.className = 'balloon-wrap';
            const balloon = document.createElement('div');
            balloon.className = 'balloon balloon-inflate';
            balloon.style.background = BALLOON_PASTELS[i % BALLOON_PASTELS.length].bg;
            wrap.appendChild(balloon);
            row.appendChild(wrap);
        }
    } else if (currentCount > count) {
        while (row.children.length > count) row.removeChild(row.lastChild);
    }
}

function spawnFloatingBalloonsInEffectsLayer(points) {
    if (!points || points < 1) return;
    const layer = getEffectsLayer();
    if (!layer) return;
    const container = document.createElement('div');
    container.className = 'floating-balloons';
    container.setAttribute('aria-hidden', 'true');
    const count = Math.min(points, 3);
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'balloon-float';
        el.style.background = BALLOON_PASTELS[i % BALLOON_PASTELS.length].bg;
        el.style.animationDelay = (i * 0.2) + 's';
        const drift = (Math.random() - 0.5) * 60;
        el.style.setProperty('--drift-x', drift + 'px');
        el.style.left = (48 + (i - count / 2) * 6 + (Math.random() - 0.5) * 4) + '%';
        el.style.marginLeft = '-18px';
        container.appendChild(el);
    }
    layer.appendChild(container);
    setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
    }, 5200);
}

function clearEffectsLayer() {
    const layer = getEffectsLayer();
    if (layer) {
        layer.innerHTML = '';
    }
}

// Pop the score balloons (top row) with animation, then remove and run callback (e.g. before next round).
function popScoreBalloonsThen(callback) {
    const layer = getEffectsLayer();
    if (!layer) {
        if (callback) callback();
        return;
    }
    const row = document.getElementById(EFFECTS_SCORE_BALLOONS_ID);
    if (!row || !row.children.length) {
        if (callback) callback();
        return;
    }
    const balloons = row.querySelectorAll('.balloon');
    balloons.forEach((el, i) => {
        el.classList.add('balloon-pop-out');
        el.style.animationDelay = (i * 0.03) + 's';
    });
    setTimeout(() => {
        if (row.parentNode) row.parentNode.removeChild(row);
        if (callback) callback();
    }, 500);
}

// Short trumpet fanfare (Web Audio API) when advancing to next round.
function playTrumpetSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        const playNote = (freq, startTime, duration) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(freq, startTime);
            osc.frequency.setValueAtTime(freq * 1.01, startTime + duration * 0.5);
            gain.gain.setValueAtTime(0.08, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };
        const t = audioCtx.currentTime;
        playNote(392, t, 0.18);
        playNote(523, t + 0.14, 0.18);
        playNote(659, t + 0.28, 0.22);
        playNote(784, t + 0.48, 0.32);
    } catch (e) {
        if (typeof console !== 'undefined' && console.warn) console.warn('Trumpet sound failed', e);
    }
}

function awardPoints(amount) {
    if (amount == null || amount < 1) return;
    const state = getGameState();
    const currentRoundScore = (state.roundScores || [0, 0, 0])[state.currentRound - 1] || 0;
    renderScoreBalloonsInEffectsLayer(currentRoundScore);
    spawnFloatingBalloonsInEffectsLayer(amount);
    if (typeof console !== 'undefined' && console.log) {
        console.log('[effects] balloons triggered', { amount, currentRoundScore });
    }
}

const ROUND_TITLES = {
    1: 'Round 1: Build the Word',
    2: 'Round 2: Spell the Word',
    3: 'Round 3: Sentence Dictation'
};
const NEXT_ROUND_TITLES = {
    2: ROUND_TITLES[2],
    3: ROUND_TITLES[3]
};
const NEXT_ROUND_DURATION_MS = 2000;

function showNextRoundScreen(roundNumber, callback) {
    if (!nextRoundOverlay || !nextRoundTitleEl) {
        if (callback) callback();
        return;
    }
    const title = NEXT_ROUND_TITLES[roundNumber] || ('Round ' + roundNumber);
    nextRoundTitleEl.textContent = title;
    nextRoundOverlay.classList.remove('hidden');
    setTimeout(() => {
        nextRoundOverlay.classList.add('hidden');
        if (callback) callback();
    }, NEXT_ROUND_DURATION_MS);
}

// Update button states based on game state
function updateButtonStates() {
    const state = getGameState();
    
    // Next word button - ONLY show when word is correctly answered
    // This is controlled by the check answer functions, not by updateButtonStates
    // So we keep it hidden unless explicitly shown after correct answer
    if (nextWordBtn) {
        // Don't automatically show the button - it should only appear after correct answer
        // The check answer functions (checkUnscrambleAnswer, checkChunksAnswer, checkSpellingAnswer)
        // will explicitly show it when the answer is correct
        // We just ensure it's hidden if we're not in a valid state
        if (state.gamePhase !== 'playing') {
            nextWordBtn.classList.add('hidden');
            nextWordBtn.disabled = true;
        }
        // Otherwise, leave the button state as-is (don't auto-show it)
    }
    
    // Disable level selection buttons if game has started
    if (modeContainer && state.gamePhase !== 'levelSelect') {
        const buttons = modeContainer.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
        });
    }
}

// Update score display
function updateScore() {
    updateUI();
}

// Removed - using shuffleArray instead

// Load round (state-driven)
function loadRound(round) {
    const state = getGameState();
    
    // Validate round
    if (state.currentRound !== round || state.gamePhase !== 'playing') {
        console.warn('Invalid round load:', { stateRound: state.currentRound, requested: round });
        return;
    }
    
    // Balloon count starts over each round: show current round's score only (0 for new round)
    const currentRoundScore = (state.roundScores || [0, 0, 0])[round - 1] || 0;
    renderScoreBalloonsInEffectsLayer(currentRoundScore);
    
    // Update UI
    if (currentRoundDisplay) {
        currentRoundDisplay.textContent = round;
    }
    if (totalWordsDisplay) {
        totalWordsDisplay.textContent = state.roundWords.length;
    }
    updateUI();
    
    // Hide all round content
    if (round1Content) round1Content.classList.add('hidden');
    if (round2Content) round2Content.classList.add('hidden');
    if (round3Content) round3Content.classList.add('hidden');
    
    // Show appropriate round content (Round 1 = Build the Word, Round 2 = Spell the Word, Round 3 = Sentence Dictation)
    if (round === 1) {
        if (roundTitle) roundTitle.textContent = ROUND_TITLES[1];
        if (round2Content) round2Content.classList.remove('hidden');
        loadRound2Word();
    } else if (round === 2) {
        if (roundTitle) roundTitle.textContent = ROUND_TITLES[2];
        if (round1Content) round1Content.classList.remove('hidden');
        loadRound1Word();
    } else if (round === 3) {
        if (roundTitle) roundTitle.textContent = ROUND_TITLES[3];
        if (round3Content) round3Content.classList.remove('hidden');
        loadRound3Word();
    }
    
    // Clear feedback
    clearFeedback();
    // Always hide next word button when loading a new word
    if (nextWordBtn) {
        nextWordBtn.classList.add('hidden');
        nextWordBtn.disabled = true;
    }
}

// Toggle compact layout for long words (expert etc.) so letters/chunks fit on screen
function setLongWordClass(wordLength) {
    if (!gameScreen) return;
    if (wordLength > 10) {
        gameScreen.classList.add('long-word');
    } else {
        gameScreen.classList.remove('long-word');
    }
}

// Load Round 1 word (state-driven) — used for Round 2: Watch & Repeat
function loadRound1Word() {
    const state = getGameState();
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    const word = state.roundWords[state.currentWordIndex].word;
    setLongWordClass(word.length);
    if (wordDisplay) {
        wordDisplay.innerHTML = '';
        wordDisplay.classList.remove('letter-row');
    }
    
    // Reset errors for new word
    updateGameState({ currentWordErrors: 0 });
    
    // Reset round-specific state
    round1State.letters = word.toUpperCase().split('');
    round1State.currentLetterIndex = 0;
    round1State.keyboardKeys = [];
    round1State.keyInstances = {};
    round1State.selectedLetters = [];
    round1State.scrambledKeys = [];
    round1State.lastLetterClickKey = null;
    round1State.lastLetterClickTime = 0;
    round1State.round2Phase = 'text';
    
    // Round 2: start with text attempt only (no letter tiles until 2 errors)
    if (round2TextAttemptSection) round2TextAttemptSection.classList.remove('hidden');
    if (round2SpellingInput) {
        round2SpellingInput.value = '';
        round2SpellingInput.disabled = false;
    }
    if (round2CheckSpellingBtn) round2CheckSpellingBtn.disabled = true;
    if (round1UnscrambleSection) round1UnscrambleSection.classList.add('hidden');
    if (selectedLetters) selectedLetters.innerHTML = '';
    if (checkUnscrambleBtn) checkUnscrambleBtn.disabled = true;
    if (keyboardContainer) keyboardContainer.innerHTML = '';
    
    // Clear feedback
    clearFeedback();
}

// Create on-screen keyboard
function createKeyboard(word) {
    keyboardContainer.innerHTML = '';
    const letters = word.toUpperCase().split('');
    round1State.keyboardKeys = [];
    round1State.keyInstances = {};
    
    // Create a key for each letter in the word (including duplicates)
    letters.forEach((letter, index) => {
        const key = document.createElement('div');
        key.className = 'keyboard-key';
        key.textContent = letter;
        key.dataset.letter = letter;
        key.dataset.position = index;
        keyboardContainer.appendChild(key);
        round1State.keyboardKeys.push(key);
        
        // Track which instance of this letter this is
        if (!round1State.keyInstances[letter]) {
            round1State.keyInstances[letter] = [];
        }
        round1State.keyInstances[letter].push(index);
    });
}

// Play word with audio (state-driven)
function playCurrentWord() {
    const state = getGameState();
    
    if (!state.audioEnabled) {
        updateGameState({ audioEnabled: true });
    }
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index for audio');
        return;
    }
    
    const item = state.roundWords[state.currentWordIndex];
    let textToSpeak;
    if (state.currentRound === 3) {
        try {
            textToSpeak = getSentenceForRound3(item, state.currentWordIndex);
        } catch (e) {
            console.warn('Round 3 sentence failed, speaking word:', e.message);
            textToSpeak = item.word || '';
        }
        if (!textToSpeak || !textToSpeak.trim()) textToSpeak = item.word || '';
    } else {
        textToSpeak = item.word;
    }
    if (!textToSpeak || !textToSpeak.trim()) {
        console.warn('Nothing to speak for current word');
        return;
    }
    // Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = state.selectedLevel === 'amateur' ? 0.7 : 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onend = () => {
        const state = getGameState();
        if (state.currentRound === 2) {
            if (round1State.round2Phase === 'tiles' && round1State.keyboardKeys.length > 0 && round1State.currentLetterIndex === 0) {
                setTimeout(() => highlightNextLetter(), 500);
            }
        }
    };
    if (window.speechSynthesis) {
        window.speechSynthesis.speak(utterance);
    }
}

// Round 2: say word then spell each letter; optional onComplete, optional letterContainer to highlight letters in order
function speakWordThenSpellLetters(onComplete, letterContainer) {
    if (!round1State.letters || round1State.letters.length === 0) {
        if (onComplete) onComplete();
        return;
    }
    const state = getGameState();
    const rate = state.selectedLevel === 'amateur' ? 0.75 : 0.9;
    let index = 0;
    function sayNextLetter() {
        if (index >= round1State.letters.length) {
            if (onComplete) onComplete();
            return;
        }
        // Light up this letter before announcing
        if (letterContainer && letterContainer.children[index]) {
            letterContainer.children[index].classList.add('highlight');
        }
        const letter = round1State.letters[index];
        const u = new SpeechSynthesisUtterance(letter.toLowerCase());
        u.rate = rate;
        u.pitch = 1.2;
        u.onend = () => {
            if (letterContainer && letterContainer.children[index]) {
                letterContainer.children[index].classList.remove('highlight');
            }
            index++;
            if (index < round1State.letters.length) {
                const delay = state.selectedLevel === 'amateur' ? 400 : 300;
                setTimeout(sayNextLetter, delay);
            } else {
                if (onComplete) onComplete();
            }
        };
        window.speechSynthesis.speak(u);
    }
    sayNextLetter();
}

// Highlight next letter in Round 1
function highlightNextLetter() {
    if (round1State.currentLetterIndex >= round1State.letters.length) {
        // All letters highlighted - this shouldn't happen, but return safely
        return;
    }
    
    // Get the key at the current position (this handles duplicate letters correctly)
    const key = round1State.keyboardKeys[round1State.currentLetterIndex];
    const letter = round1State.letters[round1State.currentLetterIndex];
    
    if (key) {
        key.classList.add('highlight');
        
        // Announce the letter and wait for it to finish
        const state = getGameState();
        if (state.audioEnabled) {
            // Just say the letter name, not "capital" or anything else
            // Use lowercase for speech to avoid "capital" announcement
            const letterUtterance = new SpeechSynthesisUtterance(letter.toLowerCase());
            letterUtterance.rate = 0.8;
            letterUtterance.pitch = 1.2;
            
            letterUtterance.onend = () => {
                // Remove highlight after letter is announced
                key.classList.remove('highlight');
                key.classList.add('used');
                round1State.currentLetterIndex++;
                
                // Continue to next letter
                const state = getGameState();
                if (round1State.currentLetterIndex < round1State.letters.length) {
                    const delay = state.selectedLevel === 'amateur' ? 400 : 300;
                    setTimeout(() => highlightNextLetter(), delay);
                } else {
                    // All letters done - scramble and show unscramble section
                    setTimeout(() => {
                        if (wordDisplay) {
                            wordDisplay.innerHTML = '';
                            wordDisplay.classList.remove('letter-row');
                        }
                        clearFeedback();
                        scrambleKeyboard();
                        showUnscrambleSection();
                    }, 500);
                }
            };
            
            window.speechSynthesis.speak(letterUtterance);
        } else {
            // If audio not enabled, use timeout as before
            const state = getGameState();
            setTimeout(() => {
                key.classList.remove('highlight');
                key.classList.add('used');
                round1State.currentLetterIndex++;
                
                if (round1State.currentLetterIndex < round1State.letters.length) {
                    const delay = state.selectedLevel === 'amateur' ? 1000 : 700;
                    setTimeout(() => highlightNextLetter(), delay);
                } else {
                    setTimeout(() => {
                        if (wordDisplay) {
                            wordDisplay.innerHTML = '';
                            wordDisplay.classList.remove('letter-row');
                        }
                        clearFeedback();
                        scrambleKeyboard();
                        showUnscrambleSection();
                    }, 500);
                }
            }, state.selectedLevel === 'amateur' ? 1000 : 700);
        }
    }
}

// Get 2 distractor chunks from other words in the round (not from current word)
function getDistractorChunks(currentWordIndex, correctChunks, roundWords) {
    const correctSet = new Set(correctChunks);
    const allOtherChunks = [];
    roundWords.forEach((w, idx) => {
        if (idx === currentWordIndex) return;
        (w.chunks || []).forEach(c => allOtherChunks.push(c));
    });
    const distractors = allOtherChunks.filter(c => !correctSet.has(c));
    const shuffled = shuffleArray(distractors);
    return shuffled.slice(0, 2);
}

// Load Round 2 word (state-driven)
function loadRound2Word() {
    const state = getGameState();
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    const wordData = state.roundWords[state.currentWordIndex];
    setLongWordClass(wordData.word.length);
    if (wordDisplay2) {
        wordDisplay2.innerHTML = '';
        wordDisplay2.classList.remove('letter-row');
    }
    
    // Reset errors for new word
    updateGameState({ currentWordErrors: 0 });
    
    // Correct chunks + 2 distractors, shuffled
    round2State.correctChunks = [...wordData.chunks];
    round2State.selectedChunks = [];
    round2State.usedChunks = [];
    const distractors = getDistractorChunks(state.currentWordIndex, round2State.correctChunks, state.roundWords);
    round2State.availableChunks = shuffleArray([...round2State.correctChunks, ...distractors]);
    
    // Render chunks
    renderChunks();
    
    // Clear feedback
    clearFeedback();
    checkChunksBtn.disabled = true;
    // Always hide next word button when loading a new word
    if (nextWordBtn) {
        nextWordBtn.classList.add('hidden');
        nextWordBtn.disabled = true;
    }
}

// Render chunks for Round 2 (all chunks stay visible in pool; selected ones marked in-build)
function renderChunks() {
    chunksAvailable.innerHTML = '';
    chunksSelected.innerHTML = '';
    
    const usedSet = new Set(round2State.usedChunks);
    
    // All chunks always visible (correct + distractors); used ones grayed after correct
    round2State.availableChunks.forEach((chunk, index) => {
        const chunkEl = document.createElement('div');
        const isUsed = usedSet.has(chunk);
        const inBuild = !isUsed && round2State.selectedChunks.includes(chunk);
        chunkEl.className = 'chunk-item';
        if (isUsed) chunkEl.classList.add('chunk-item-used');
        if (inBuild) chunkEl.classList.add('chunk-item-in-build');
        chunkEl.textContent = chunk;
        chunkEl.dataset.index = index;
        if (!isUsed) {
            chunkEl.addEventListener('click', () => toggleChunkInBuild(index));
        } else {
            chunkEl.setAttribute('aria-disabled', 'true');
        }
        chunksAvailable.appendChild(chunkEl);
    });
    
    // Build row (only show when not yet correct)
    if (round2State.usedChunks.length === 0) {
        round2State.selectedChunks.forEach((chunk, index) => {
            const chunkEl = document.createElement('div');
            chunkEl.className = 'chunk-selected';
            chunkEl.textContent = chunk;
            chunkEl.dataset.index = index;
            chunkEl.addEventListener('click', () => removeChunk(index));
            chunksSelected.appendChild(chunkEl);
        });
    }
    
    checkChunksBtn.disabled = round2State.usedChunks.length > 0 || round2State.selectedChunks.length === 0;
}

// Add chunk to build, or remove from build if already in build (pool chunk stays visible)
function toggleChunkInBuild(index) {
    const chunk = round2State.availableChunks[index];
    const idxInSelected = round2State.selectedChunks.indexOf(chunk);
    if (idxInSelected !== -1) {
        // Remove last occurrence from build
        const lastIdx = round2State.selectedChunks.lastIndexOf(chunk);
        round2State.selectedChunks.splice(lastIdx, 1);
    } else {
        round2State.selectedChunks.push(chunk);
    }
    renderChunks();
}

// Select chunk in Round 2 (add to build; chunk stays visible in pool)
function selectChunk(index) {
    const chunk = round2State.availableChunks[index];
    round2State.selectedChunks.push(chunk);
    renderChunks();
}

// Remove chunk from build (click in selected row)
function removeChunk(index) {
    round2State.selectedChunks.splice(index, 1);
    renderChunks();
}

// Check chunks answer (state-driven)
// Works for both Amateur and Expert levels
function checkChunksAnswer() {
    const state = getGameState();
    
    // Validate we're in the right round (Round 1 = Build the Word / chunks)
    if (state.currentRound !== 1 || state.gamePhase !== 'playing') {
        console.warn('Invalid round for chunks check');
        return;
    }
    
    const isCorrect = JSON.stringify(round2State.selectedChunks) === 
                     JSON.stringify(round2State.correctChunks);
    
    if (isCorrect) {
        const word = state.roundWords[state.currentWordIndex].word;
        // Mark correct chunks as used (grayed out)
        round2State.usedChunks = [...round2State.correctChunks];
        round2State.selectedChunks = [];
        // Display word using letter-tile pattern for consistent layout
        if (wordDisplay2) {
            displayWordAsTiles(wordDisplay2, word.toUpperCase());
        }
        renderChunks(); // Re-render so used chunks are grayed out
        showFeedback('Correct!', 'correct');
        speakFeedback('Correct');
        calculateAndAddScore();
        if (nextWordBtn) {
            nextWordBtn.classList.remove('hidden');
            nextWordBtn.disabled = false;
            updateNextButtonLabel();
        }
    } else {
        updateGameState({ currentWordErrors: state.currentWordErrors + 1 });
        showFeedback('Try again!', 'incorrect');
        const word = state.roundWords[state.currentWordIndex].word;
        speakFeedback('Try again', () => {
            const u = new SpeechSynthesisUtterance(word);
            u.rate = state.selectedLevel === 'amateur' ? 0.7 : 0.9;
            window.speechSynthesis.speak(u);
        });
        round2State.selectedChunks = [];
        renderChunks();
    }
}

// Scramble keyboard for Round 1
function scrambleKeyboard() {
    // Create a copy of keys and scramble them
    round1State.scrambledKeys = [...round1State.keyboardKeys];
    
    // Fisher-Yates shuffle
    for (let i = round1State.scrambledKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [round1State.scrambledKeys[i], round1State.scrambledKeys[j]] = 
        [round1State.scrambledKeys[j], round1State.scrambledKeys[i]];
    }
    
    // Clear and re-render keyboard with scrambled order
    keyboardContainer.innerHTML = '';
    round1State.scrambledKeys.forEach((key, index) => {
        // Reset key styling
        key.classList.remove('used', 'highlight');
        key.classList.add('scrambled-key');
        key.dataset.originalIndex = round1State.keyboardKeys.indexOf(key);
        key.addEventListener('click', () => handleLetterClick(index));
        keyboardContainer.appendChild(key);
    });
}

// Show unscramble section
function showUnscrambleSection() {
    round1UnscrambleSection.classList.remove('hidden');
    round1State.selectedLetters = [];
    round1State.lastLetterClickKey = null;
    round1State.lastLetterClickTime = 0;
    updateSelectedLettersDisplay();
    checkUnscrambleBtn.disabled = true;
}

// Handle letter click in Round 1
function handleLetterClick(scrambledIndex) {
    const key = round1State.scrambledKeys[scrambledIndex];
    const originalIndex = parseInt(key.dataset.originalIndex, 10);
    
    // Prevent double-fire: same key tapped twice (e.g. touch + synthetic click on mobile)
    const now = Date.now();
    if (key === round1State.lastLetterClickKey && (now - round1State.lastLetterClickTime) < 400) {
        return;
    }
    round1State.lastLetterClickKey = key;
    round1State.lastLetterClickTime = now;
    
    // Check if already selected
    if (round1State.selectedLetters.includes(originalIndex)) {
        return; // Already selected
    }
    
    // Add to selected letters
    round1State.selectedLetters.push(originalIndex);
    key.classList.add('selected');
    key.style.pointerEvents = 'none';
    
    updateSelectedLettersDisplay();
    
    // Announce the letter (when audio is enabled)
    speakLetter(round1State.letters[originalIndex]);
    
    // Enable check button if all letters selected
    if (round1State.selectedLetters.length === round1State.letters.length) {
        checkUnscrambleBtn.disabled = false;
    }
}

// Update selected letters display (uses shared letter-tile pattern)
function updateSelectedLettersDisplay() {
    selectedLetters.innerHTML = '';
    
    // Ensure container uses letter-row pattern
    selectedLetters.classList.add('letter-row');
    
    round1State.selectedLetters.forEach((originalIndex, positionInSelected) => {
        const letter = round1State.letters[originalIndex];
        
        // Create letter tile using shared pattern
        const letterTile = document.createElement('div');
        letterTile.className = 'letter-tile removable';
        letterTile.dataset.position = positionInSelected;
        letterTile.dataset.originalIndex = originalIndex;
        letterTile.textContent = letter;
        
        // Create X button to remove letter (overlay badge)
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-letter-btn';
        removeBtn.innerHTML = '×';
        removeBtn.setAttribute('aria-label', 'Remove letter');
        removeBtn.type = 'button';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeSelectedLetter(positionInSelected, originalIndex);
        });
        
        letterTile.appendChild(removeBtn);
        selectedLetters.appendChild(letterTile);
    });
}

// Remove a selected letter and return it to the keyboard
function removeSelectedLetter(positionInSelected, originalIndex) {
    // Remove from selected letters array
    round1State.selectedLetters.splice(positionInSelected, 1);
    
    // Find the corresponding scrambled key and make it available again
    round1State.scrambledKeys.forEach(key => {
        const keyOriginalIndex = parseInt(key.dataset.originalIndex);
        if (keyOriginalIndex === originalIndex && key.classList.contains('selected')) {
            key.classList.remove('selected');
            key.style.pointerEvents = 'auto';
        }
    });
    
    // Update the display (will re-render with correct layout)
    updateSelectedLettersDisplay();
    
    // Update check button state
    if (round1State.selectedLetters.length === round1State.letters.length) {
        checkUnscrambleBtn.disabled = false;
    } else {
        checkUnscrambleBtn.disabled = true;
    }
}

// Round 2 text phase: check typed answer. First error = verbal only; after 2 errors show letter tiles.
function checkRound2TextAnswer() {
    const state = getGameState();
    if (state.currentRound !== 2 || state.gamePhase !== 'playing' || round1State.round2Phase !== 'text') return;
    const raw = (round2SpellingInput && round2SpellingInput.value) ? round2SpellingInput.value.trim() : '';
    const correctWord = state.roundWords[state.currentWordIndex].word.toUpperCase();
    const isCorrect = raw.toUpperCase() === correctWord;

    if (isCorrect) {
        showFeedback('Correct!', 'correct');
        speakFeedback('Correct');
        calculateAndAddScore();
        if (nextWordBtn) {
            nextWordBtn.classList.remove('hidden');
            nextWordBtn.disabled = false;
            updateNextButtonLabel();
        }
        return;
    }

    const newErrorCount = state.currentWordErrors + 1;
    updateGameState({ currentWordErrors: newErrorCount });
    showFeedback('Try again!', 'incorrect');

    if (newErrorCount === 1) {
        // First error: after "Try again" is announced, show spelling and say word then spell each letter
        if (round2SpellingInput) {
            round2SpellingInput.value = '';
            round2SpellingInput.disabled = true; // no typing until letters disappear
        }
        if (round2CheckSpellingBtn) round2CheckSpellingBtn.disabled = true;

        speakFeedback('Try again', () => {
            const stateAgain = getGameState();
            const word = stateAgain.roundWords[stateAgain.currentWordIndex].word;
            const wordUpper = word.toUpperCase();

            // Show the correct spelling (letter tiles style) before announcing
            if (wordDisplay) {
                wordDisplay.classList.add('letter-row');
                wordDisplay.innerHTML = wordUpper.split('').map(l => `<span class="letter-tile">${l}</span>`).join('');
            }

            const hideSpellingAndClear = () => {
                if (wordDisplay) {
                    wordDisplay.innerHTML = '';
                    wordDisplay.classList.remove('letter-row');
                }
                if (round2SpellingInput) {
                    round2SpellingInput.disabled = false;
                    round2SpellingInput.focus();
                }
                if (round2CheckSpellingBtn) round2CheckSpellingBtn.disabled = true;
            };

            const wordUtterance = new SpeechSynthesisUtterance(word);
            wordUtterance.rate = stateAgain.selectedLevel === 'amateur' ? 0.7 : 0.9;
            wordUtterance.onend = () => {
                speakWordThenSpellLetters(() => {
                    setTimeout(hideSpellingAndClear, 600);
                }, wordDisplay);
            };
            window.speechSynthesis.speak(wordUtterance);
        });
    } else {
        // Second error: say "Try again" then repeat the word, then show letter tiles
        const word = state.roundWords[state.currentWordIndex].word;
        showFeedback('Try again!', 'incorrect');
        speakFeedback('Try again', () => {
            const wordUtterance = new SpeechSynthesisUtterance(word);
            wordUtterance.rate = state.selectedLevel === 'amateur' ? 0.7 : 0.9;
            wordUtterance.onend = () => {
                createKeyboard(word);
                scrambleKeyboard();
                showUnscrambleSection();
                round1State.round2Phase = 'tiles';
                if (round2TextAttemptSection) round2TextAttemptSection.classList.add('hidden');
                if (wordDisplay) {
                    wordDisplay.innerHTML = '';
                    wordDisplay.classList.remove('letter-row');
                }
            };
            window.speechSynthesis.speak(wordUtterance);
        });
    }
}

// Check unscramble answer for Round 1 (state-driven)
// Works for both Amateur and Expert levels
// This function checks the answer each time it's called, regardless of previous errors
// After an incorrect answer, the user can try again and a correct answer will be accepted
// For words with duplicate letters, accepts correct spelling regardless of which instance was clicked
function checkUnscrambleAnswer() {
    const state = getGameState();
    
    // Validate we're in the right round (Round 2 = Spell the Word / unscramble)
    if (state.currentRound !== 2 || state.gamePhase !== 'playing') {
        console.warn('Invalid round for unscramble check');
        return;
    }
    
    // Get the correct word
    const correctWord = state.roundWords[state.currentWordIndex].word.toUpperCase();
    
    // Build the word that the user spelled based on their letter selections
    // This handles duplicate letters correctly - it doesn't matter which instance they clicked
    const userSpelledWord = round1State.selectedLetters
        .map(originalIndex => round1State.letters[originalIndex])
        .join('');
    
    // Check if the spelled word matches the correct word (case-insensitive)
    // This allows duplicate letters to be clicked in any order as long as the word is correct
    const isCorrect = userSpelledWord.toUpperCase() === correctWord;
    
    // Debug logging
    console.log('Unscramble check:', {
        correctWord: correctWord,
        userSpelledWord: userSpelledWord,
        selectedLetterIndices: round1State.selectedLetters,
        isCorrect: isCorrect
    });
    
    if (isCorrect) {
        // Correct answer - accept it even if there were previous incorrect attempts
        showFeedback('Correct!', 'correct');
        speakFeedback('Correct');
        calculateAndAddScore();
        if (nextWordBtn) {
            nextWordBtn.classList.remove('hidden');
            nextWordBtn.disabled = false;
            updateNextButtonLabel();
        }
    } else {
        // Incorrect answer - increment error count but allow user to try again
        const newErrorCount = state.currentWordErrors + 1;
        updateGameState({ currentWordErrors: newErrorCount });
        showFeedback('Try again!', 'incorrect');
        // After "Try again" is announced, repeat the word
        const word = state.roundWords[state.currentWordIndex].word;
        speakFeedback('Try again', () => {
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.rate = state.selectedLevel === 'amateur' ? 0.7 : 0.9;
            window.speechSynthesis.speak(utterance);
        });
        // Reset selection so user can try again with a new spelling
        resetUnscrambleSelection();
        // Check button will be enabled again when user selects all letters
    }
}

// Reset unscramble selection (allows user to try again after incorrect answer)
function resetUnscrambleSelection() {
    round1State.selectedLetters = [];
    round1State.scrambledKeys.forEach(key => {
        key.classList.remove('selected');
        key.style.pointerEvents = 'auto';
    });
    updateSelectedLettersDisplay();
    // Disable check button until all letters are selected again
    // This will be re-enabled when user selects all letters
    if (checkUnscrambleBtn) {
        checkUnscrambleBtn.disabled = true;
    }
}

// Calculate and add score (state-driven)
function calculateAndAddScore() {
    const state = getGameState();
    
    let points = 0;
    if (state.currentWordErrors === 0) {
        points = 3;
    } else if (state.currentWordErrors === 1) {
        points = 2;
    } else {
        points = 1;
    }
    
    const roundScores = [...(state.roundScores || [0, 0, 0])];
    const roundIndex = state.currentRound - 1;
    if (roundIndex >= 0 && roundIndex < 3) {
        roundScores[roundIndex] = (roundScores[roundIndex] || 0) + points;
    }
    
    const wordsWithOnePoint = [...(state.wordsWithOnePoint || [])];
    if (points === 1 && state.currentWordIndex < state.roundWords.length) {
        const word = state.roundWords[state.currentWordIndex].word;
        if (word) wordsWithOnePoint.push(word);
    }
    
    updateGameState({
        totalScore: state.totalScore + points,
        roundScores: roundScores,
        wordsWithOnePoint: wordsWithOnePoint
    });
    awardPoints(points);
}

// =============================================================================
// Round 3: Sentence Dictation — PRE-WRITTEN FRAMES ONLY (no dynamic generation)
// =============================================================================
// WHY TEMPLATES ARE REQUIRED:
// - Dynamically built sentences cause grammar errors (wrong tense, wrong
//   part of speech, e.g. "We reconstruction today" or "The class was transport").
// - We do NOT conjugate verbs, add helper verbs, change articles, or infer
//   grammar. The only operation allowed is: insert the word into a frame.
// - Every word MUST have partOfSpeech in data. A word may ONLY be used with
//   frames that match its partOfSpeech. Correctness over variety.
// =============================================================================

/**
 * Sentence frames keyed by partOfSpeech. Each frame:
 * - Is grammatically complete and uses exactly ONE placeholder: {word}
 * - Does not change tense; we never conjugate or add verbs.
 * - A word is inserted as-is (no modification).
 * - Nouns use nounType (person, place, thing, idea) so frames match usage.
 */
const SENTENCE_FRAMES = {
    adjective: [
        'The class was {word} today.',
        'That game was {word}.',
        'The team had a {word} practice.',
        'She had a {word} race today.',
        'The match was {word} today.',
        'We had a {word} game.',
        'The day outside was {word}.',
        'The sky was {word} today.',
        'The garden looked {word} today.',
        'The park was {word} this morning.',
        'We took a {word} walk outside.',
        'That book was {word}.',
        'The story was {word}.',
        'The book ending was {word}.',
        'She thought the tale was {word}.',
        'That chapter was {word}.',
        'The painting was {word}.',
        'She made a {word} piece.',
        'The mural was {word}.',
        'That drawing was {word}.',
        'We saw {word} art today.',
        'The song was {word}.',
        'That concert was {word}.',
        'The melody was {word}.',
        'She played a {word} tune.',
        'We heard a {word} song.',
        'That lesson was {word}.',
        'School was {word} today.',
        'That visit was {word}.',
        'They were {word} at the party.',
        'Our trip was {word}.',
        'The weather was {word} today.',
        'The morning was {word}.',
        'It was a {word} afternoon.'
    ],
    // Nouns: frames by noun type (person, place, thing, idea) so usage is correct.
    nounPerson: [
        'We met the {word} today.',
        'She thanked her {word}.',
        'The {word} helped us today.',
        'Our {word} was kind.',
        'The {word} ran fast.',
        'She asked the {word} for help.',
        'We saw the {word} at school.',
        'The {word} read the book.'
    ],
    nounPlace: [
        'We went to the {word}.',
        'The {word} was nearby.',
        'She left the {word}.',
        'The {word} was big.',
        'We saw the {word} today.',
        'The {word} was open.',
        'We found the {word} at last.',
        'The {word} was very far.'
    ],
    nounThing: [
        'The {word} was on the table.',
        'She found the {word}.',
        'We used the {word}.',
        'The {word} was useful.',
        'She took the {word}.',
        'The {word} was new.',
        'We saw the {word} there.',
        'The {word} was broken.'
    ],
    nounIdea: [
        'She found {word} there.',
        'The day brought {word}.',
        'That was real {word}.',
        'We saw {word} at the show.',
        'The class discussed {word} today.',
        'The story was about {word}.',
        'She showed us her {word}.',
        'They talked about {word}.',
        'The lesson was on {word}.',
        'We learned about {word} today.',
        'We saw {word} in action.',
        'The result was {word}.'
    ],
    verb: [
        'We {word} new things after school.',
        'They {word} together today.',
        'We will {word} new things tomorrow.',
        'We {word} things at the park.',
        'We {word} things in the garden.',
        'They {word} new things every morning.'
    ]
};

/**
 * Round 3 sentence: insert word into a pre-written frame only.
 * - Uses wordObj.partOfSpeech; for nouns, uses nounType (person, place, thing, idea) so
 *   frames match how the noun is used. If missing, looks up in default list. No grammar invented.
 */
function getSentenceForRound3(wordObj, wordIndex) {
    if (!wordObj || !wordObj.word) return '';
    let partOfSpeech = wordObj.partOfSpeech;
    let nounType = wordObj.nounType;
    if (partOfSpeech !== 'noun' && partOfSpeech !== 'verb' && partOfSpeech !== 'adjective') {
        const defaultSet = getDefaultSet();
        const w = wordObj.word.trim().toLowerCase();
        for (const level of ['amateur', 'expert']) {
            const list = defaultSet.wordLists && defaultSet.wordLists[level];
            if (Array.isArray(list)) {
                const found = list.find(item => item && item.word && item.word.trim().toLowerCase() === w);
                if (found && (found.partOfSpeech === 'noun' || found.partOfSpeech === 'verb' || found.partOfSpeech === 'adjective')) {
                    partOfSpeech = found.partOfSpeech;
                    if (found.nounType) nounType = found.nounType;
                    break;
                }
            }
        }
        if (partOfSpeech !== 'noun' && partOfSpeech !== 'verb' && partOfSpeech !== 'adjective') return '';
    }
    if (partOfSpeech === 'noun' && !nounType) {
        const defaultSet = getDefaultSet();
        const w = wordObj.word.trim().toLowerCase();
        for (const level of ['amateur', 'expert']) {
            const list = defaultSet.wordLists && defaultSet.wordLists[level];
            if (Array.isArray(list)) {
                const found = list.find(item => item && item.word && item.word.trim().toLowerCase() === w);
                if (found && found.nounType) {
                    nounType = found.nounType;
                    break;
                }
            }
        }
        if (!nounType || !SENTENCE_FRAMES['noun' + nounType.charAt(0).toUpperCase() + nounType.slice(1)]) nounType = 'idea';
    }
    const frameKey = partOfSpeech === 'noun' ? 'noun' + (nounType || 'idea').charAt(0).toUpperCase() + (nounType || 'idea').slice(1) : partOfSpeech;
    const frames = SENTENCE_FRAMES[frameKey];
    if (!frames || frames.length === 0) return '';
    const word = wordObj.word.trim();
    const i = (wordIndex ?? 0) * 7 + word.length * 31;
    const idx = Math.abs(i) % frames.length;
    const frame = frames[idx];
    let sentence = frame.replace('{word}', word);
    sentence = sentence.replace(/\.\s*$/, '').trim();
    if (sentence.length > 0) {
        sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        if (!sentence.endsWith('.')) sentence += '.';
    }
    return sentence;
}

// Normalize sentence for comparison: trim, collapse spaces, return array of lowercase words (last word without period).
function normalizeSentenceWords(s) {
    if (!s || typeof s !== 'string') return [];
    const t = s.trim().replace(/\s+/g, ' ').replace(/\.\s*$/, '');
    return t ? t.split(' ').map(w => w.toLowerCase().trim()).filter(Boolean) : [];
}

// Check if user sentence is correct: capital at start, period at end, same words (correct spelling).
function isCorrectSentence(userInput, correctSentence) {
    const raw = (userInput && userInput.trim()) || '';
    if (raw.length === 0) return false;
    if (raw[0] !== raw[0].toUpperCase() || raw[0] === raw[0].toLowerCase()) return false;
    if (!raw.endsWith('.')) return false;
    const userWords = normalizeSentenceWords(raw);
    const correctWords = normalizeSentenceWords(correctSentence);
    if (userWords.length !== correctWords.length) return false;
    return userWords.every((w, i) => w === correctWords[i]);
}

// Load Round 3 word (state-driven) – now sentence dictation
function loadRound3Word() {
    const state = getGameState();
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    setLongWordClass(0);
    if (spellingInput) {
        spellingInput.value = '';
        spellingInput.focus();
    }
    if (checkSpellingBtn) checkSpellingBtn.disabled = true;
    
    // Reset errors for new word
    updateGameState({ currentWordErrors: 0 });
    clearFeedback();
    // Always hide next word button when loading a new word
    if (nextWordBtn) {
        nextWordBtn.classList.add('hidden');
        nextWordBtn.disabled = true;
    }
}

// Normalize string for comparison (handles case, whitespace, and unicode normalization)
// For spelling validation, we remove all whitespace since words shouldn't contain spaces
function normalizeWord(word) {
    if (!word) return '';
    return word.toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '') // Remove all whitespace (words shouldn't have spaces)
        .normalize('NFD') // Normalize unicode characters (e.g., é becomes e + combining mark)
        .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks (accents)
}

// Alternative simpler normalization - just lowercase and trim (for debugging)
function simpleNormalize(word) {
    if (!word) return '';
    return word.toString().toLowerCase().trim();
}

// Check Round 3 sentence dictation answer (state-driven)
// Correct: same words (correct spelling), capital at start, period at end
function checkSpellingAnswer() {
    const state = getGameState();
    
    if (state.currentRound !== 3 || state.gamePhase !== 'playing') {
        console.warn('Invalid round for spelling check');
        return;
    }
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    const rawUserInput = spellingInput ? spellingInput.value : '';
    const wordObj = state.roundWords[state.currentWordIndex];
    const correctSentence = getSentenceForRound3(wordObj, state.currentWordIndex);
    const isCorrect = isCorrectSentence(rawUserInput, correctSentence);
    
    if (isCorrect) {
        showFeedback('Correct!', 'correct');
        speakFeedback('Correct');
        calculateAndAddScore();
        if (nextWordBtn) {
            nextWordBtn.classList.remove('hidden');
            nextWordBtn.disabled = false;
            updateNextButtonLabel();
        }
    } else {
        updateGameState({ currentWordErrors: state.currentWordErrors + 1 });
        showFeedback('Try again!', 'incorrect');
        speakFeedback('Try again', () => {
            const utterance = new SpeechSynthesisUtterance(correctSentence);
            utterance.rate = state.selectedLevel === 'amateur' ? 0.7 : 0.9;
            window.speechSynthesis.speak(utterance);
        });
        if (spellingInput) {
            spellingInput.focus();
            // Do not clear or select: leave what they typed so they can correct it
        }
    }
}

// Display word as letter tiles (shared pattern for Round 2 and future use)
function displayWordAsTiles(container, word) {
    if (!container) return;
    
    container.innerHTML = '';
    container.classList.add('letter-row');
    
    const letters = word.split('');
    letters.forEach((letter, index) => {
        const letterTile = document.createElement('div');
        letterTile.className = 'letter-tile';
        letterTile.textContent = letter;
        container.appendChild(letterTile);
    });
}

// Show feedback
function showFeedback(message, type) {
    feedbackArea.innerHTML = '';
    const feedbackEl = document.createElement('div');
    feedbackEl.className = `feedback-message ${type}`;
    feedbackEl.textContent = message;
    feedbackArea.appendChild(feedbackEl);
}

// On-screen confetti; optional points (round or total) scales piece size – more points = bigger burst
function triggerConfetti(points) {
    const colors = ['#667eea', '#764ba2', '#ffd93d', '#4ecdc4', '#f093fb', '#ff6b6b', '#ffffff'];
    const pieceCount = 60;
    const scaleFactor = points != null ? 0.6 + Math.min(points / POINTS_PER_ROUND_MAX, 3) * 0.4 : 1;
    const baseSize = 10;
    const size = Math.round(baseSize * scaleFactor);
    const container = document.createElement('div');
    container.className = 'confetti-container';
    container.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < pieceCount; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.animationDelay = (Math.random() * 0.5) + 's';
        piece.style.animationDuration = (2.5 + Math.random() * 1.5) + 's';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.width = size + 'px';
        piece.style.height = size + 'px';
        if (Math.random() > 0.5) piece.classList.add('confetti-piece-round');
        container.appendChild(piece);
    }

    document.body.appendChild(container);
    setTimeout(() => {
        if (container.parentNode) container.parentNode.removeChild(container);
    }, 4500);
}

// Update the nav button label: "Next Word", "Next Round" (last word of round 1 or 2), or "See Results" (last word of round 3); any click or key also continues
function updateNextButtonLabel() {
    if (!nextWordBtn) return;
    const state = getGameState();
    const isLastWordOfRound = state.currentWordIndex + 1 >= state.roundWords.length;
    const hint = ' — click or press any key';
    if (!isLastWordOfRound) {
        nextWordBtn.textContent = 'Next Word' + hint;
    } else if (state.currentRound === 3) {
        nextWordBtn.textContent = 'See Results' + hint;
    } else {
        nextWordBtn.textContent = 'Next Round' + hint;
    }
}

// Clear feedback
function clearFeedback() {
    feedbackArea.innerHTML = '';
}

// Speak feedback; optional onComplete when announcement finishes
function speakFeedback(text, onComplete) {
    const state = getGameState();
    if (!state.audioEnabled) {
        if (onComplete) onComplete();
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    if (onComplete) utterance.onend = onComplete;
    window.speechSynthesis.speak(utterance);
}

// Speak a single letter (Round 2: when player selects or types a letter); cancel any current speech so the new letter starts immediately
function speakLetter(letter) {
    if (!letter) return;
    const state = getGameState();
    if (!state.audioEnabled) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(letter.toString().toLowerCase());
    utterance.rate = 1;
    utterance.pitch = 1.2;
    window.speechSynthesis.speak(utterance);
}

// Next word (state-driven, click-safe)
function nextWord() {
    const state = getGameState();
    
    // Validate state transition
    if (!isValidStateTransition('NEXT_WORD', state)) {
        console.warn('Invalid state transition: NEXT_WORD', state);
        return;
    }
    
    // Prevent double-clicking
    if (nextWordBtn) {
        nextWordBtn.disabled = true;
    }
    
    const newWordIndex = state.currentWordIndex + 1;
    
    if (newWordIndex >= state.roundWords.length) {
        // Round complete - advance to next round or finish game
        if (state.currentRound < 3) {
            // Score for the round we just completed (bigger confetti = more points)
            const completedRoundScore = (state.roundScores || [0, 0, 0])[state.currentRound - 1] || 0;
            const nextRound = state.currentRound + 1;
            const allWords = [...state.wordLists[state.selectedLevel]];
            const selectedWords = selectRandomWords(allWords, 6);
            if (selectedWords.length === 0) {
                console.error('No words available for next round');
                return;
            }
            // Pop balloons, then trumpet + "next round" screen + confetti together; after 2s advance
            popScoreBalloonsThen(() => {
                playTrumpetSound();
                triggerConfetti(completedRoundScore);
                showNextRoundScreen(nextRound, () => {
                    updateGameState({
                        currentRound: nextRound,
                        currentWordIndex: 0,
                        currentWordErrors: 0
                    });
                    updateGameState({ roundWords: selectedWords });
                    loadRound(nextRound);
                });
            });
        } else {
            // All rounds complete (last word of round 3) – results screen with double confetti
            updateGameState({ gamePhase: 'complete' });
            
            const completeState = getGameState();
            if (finalScore) finalScore.textContent = completeState.totalScore;
            if (roundScoresBreakdown) {
                const scores = completeState.roundScores || [0, 0, 0];
                const t = ROUND_TITLES;
                roundScoresBreakdown.innerHTML = `
                    <p class="round-score-line">${t[1]}: <strong>${scores[0]}</strong> points</p>
                    <p class="round-score-line">${t[2]}: <strong>${scores[1]}</strong> points</p>
                    <p class="round-score-line">${t[3]}: <strong>${scores[2]}</strong> points</p>
                `;
            }
            if (wordsWithOnePointSection) {
                const words = completeState.wordsWithOnePoint || [];
                if (words.length > 0) {
                    wordsWithOnePointSection.classList.remove('hidden');
                    wordsWithOnePointSection.innerHTML = `
                        <p class="words-one-point-title">Words that need practice:</p>
                        <p class="words-one-point-list">${words.map(w => w.trim()).join(', ')}</p>
                    `;
                } else {
                    wordsWithOnePointSection.classList.add('hidden');
                    wordsWithOnePointSection.innerHTML = '';
                }
            }
            if (gameScreen) gameScreen.classList.remove('active');
            if (completionScreen) completionScreen.classList.add('active');
            clearEffectsLayer();
            const totalScore = completeState.totalScore || 0;
            triggerConfetti(totalScore);
            setTimeout(() => triggerConfetti(totalScore), 400);
        }
    } else {
        // Load next word in current round
        updateGameState({
            currentWordIndex: newWordIndex,
            currentWordErrors: 0
        });
        
        updateUI();
        // Hide next word button when loading next word (it will show again only after correct answer)
        if (nextWordBtn) {
            nextWordBtn.classList.add('hidden');
            nextWordBtn.disabled = true;
        }
        
        // Load word for current round (Round 1 = chunks, Round 2 = unscramble, Round 3 = spelling)
        if (state.currentRound === 1) {
            loadRound2Word();
        } else if (state.currentRound === 2) {
            loadRound1Word();
        } else if (state.currentRound === 3) {
            loadRound3Word();
        }
    }
}

// Update progress bar (now handled by updateUI)
function updateProgress() {
    updateUI();
}

// CRITICAL: Wait for DOM to be fully loaded before initializing
// This ensures all elements exist and event listeners work reliably
// Works with ES modules and all browsers (Chrome, Safari, iPad, Google Sites)
document.addEventListener('DOMContentLoaded', function() {
    renderModes();
});
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded, initializing game...');
        init();
    });
} else {
    // DOM is already loaded (e.g., script loaded after page load)
    console.log('DOM already loaded, initializing game...');
    init();
}
