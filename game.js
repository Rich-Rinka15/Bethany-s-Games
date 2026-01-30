import { getActiveSets, getWordListsForSet } from './data.js';

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
    currentWordErrors: 0,
    
    // Audio
    audioEnabled: false
};

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
const setsButtons = document.getElementById('setsButtons');
const currentRoundDisplay = document.getElementById('currentRound');
const currentWordIndexDisplay = document.getElementById('currentWordIndex');
const totalWordsDisplay = document.getElementById('totalWords');
const progressBar = document.getElementById('progressBar');
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
const round1UnscrambleSection = document.getElementById('round1UnscrambleSection');
const selectedLetters = document.getElementById('selectedLetters');
const checkUnscrambleBtn = document.getElementById('checkUnscrambleBtn');
const exitGameBtn = document.getElementById('exitGameBtn');
const currentScore = document.getElementById('currentScore');
const finalScore = document.getElementById('finalScore');
const feedbackArea = document.getElementById('feedbackArea');
const nextWordBtn = document.getElementById('nextWordBtn');
const playAgainBtn = document.getElementById('playAgainBtn');

// Round-specific state
let round1State = {
    letters: [],
    currentLetterIndex: 0,
    keyboardKeys: [], // Array to store all key elements in order
    keyInstances: {}, // Track which key instance to use for each letter position
    selectedLetters: [], // Letters selected by player in order
    scrambledKeys: [] // Scrambled version of keys for clicking
};

let round2State = {
    availableChunks: [],
    selectedChunks: [],
    correctChunks: []
};

let round3State = {
    userInput: ''
};

// Initialize game
function init() {
    loadActiveSets();
    
    // Reload sets when start screen becomes visible (e.g., returning from admin)
    const startScreenObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.id === 'startScreen' && target.classList.contains('active')) {
                    // Start screen just became active, reload sets
                    loadActiveSets();
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
    
    // Navigation
    nextWordBtn.addEventListener('click', nextWord);
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
        checkSpellingBtn.disabled = spellingInput.value.trim() === '';
    });
    checkSpellingBtn.addEventListener('click', checkSpellingAnswer);

    // Navigation
    nextWordBtn.addEventListener('click', nextWord);
    playAgainBtn.addEventListener('click', () => {
        location.reload();
    });
}

// Load active sets for player selection (robust, browser-safe)
function loadActiveSets() {
    // Ensure setsButtons exists
    if (!setsButtons) {
        console.error('setsButtons element not found');
        return;
    }
    
    const activeSets = getActiveSets();
    setsButtons.innerHTML = '';
    
    if (activeSets.length === 0) {
        setsButtons.innerHTML = '<p style="color: white; text-align: center;">No active word lists available. Please contact an administrator.</p>';
        return;
    }
    
    activeSets.forEach(set => {
        // Create buttons for both amateur and expert levels
        ['amateur', 'expert'].forEach(level => {
            // Check if this set/level combination has words
            const wordLists = getWordListsForSet(set.id);
            if (!wordLists[level] || wordLists[level].length === 0) {
                // Skip creating button if no words available
                return;
            }
            
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
                    currentWordErrors: 0,
                    audioEnabled: false
                });
                
                // Disable all level selection buttons to prevent switching
                const allLevelButtons = setsButtons.querySelectorAll('button');
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
            
            setsButtons.appendChild(btn);
        });
    });
}

// Make it available globally so admin can call it
window.loadActiveSets = loadActiveSets;

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

// Exit to home (reset state)
function exitToHome() {
    if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
        // Reset to initial state
        updateGameState({
            gamePhase: 'levelSelect',
            selectedSetId: null,
            selectedLevel: null,
            wordLists: null,
            currentRound: 0,
            currentWordIndex: 0,
            roundWords: [],
            totalScore: 0,
            currentWordErrors: 0,
            audioEnabled: false
        });
        
        gameScreen.classList.remove('active');
        startScreen.classList.add('active');
        loadActiveSets();
    }
}

// Update UI based on current state
function updateUI() {
    const state = getGameState();
    
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
    
    // Disable/enable buttons based on state
    updateButtonStates();
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
    if (setsButtons && state.gamePhase !== 'levelSelect') {
        const buttons = setsButtons.querySelectorAll('button');
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
    
    // Show appropriate round content
    if (round === 1) {
        if (roundTitle) roundTitle.textContent = 'Round 1: Watch & Repeat';
        if (round1Content) round1Content.classList.remove('hidden');
        loadRound1Word();
    } else if (round === 2) {
        if (roundTitle) roundTitle.textContent = 'Round 2: Build the Word';
        if (round2Content) round2Content.classList.remove('hidden');
        loadRound2Word();
    } else if (round === 3) {
        if (roundTitle) roundTitle.textContent = 'Round 3: Spell It Solo';
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

// Load Round 1 word (state-driven)
function loadRound1Word() {
    const state = getGameState();
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    const word = state.roundWords[state.currentWordIndex].word;
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
    
    // Hide unscramble section initially
    if (round1UnscrambleSection) round1UnscrambleSection.classList.add('hidden');
    if (selectedLetters) selectedLetters.innerHTML = '';
    if (checkUnscrambleBtn) checkUnscrambleBtn.disabled = true;
    
    // Create keyboard
    createKeyboard(word);
    
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
    
    const word = state.roundWords[state.currentWordIndex].word;
    
    // Use Web Speech API
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.rate = state.selectedLevel === 'amateur' ? 0.7 : 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onend = () => {
        const state = getGameState();
        if (state.currentRound === 1) {
            // Only start highlighting letters if we haven't started yet
            // Check if unscramble section is hidden (meaning we haven't finished letters yet)
            if (round1UnscrambleSection && round1UnscrambleSection.classList.contains('hidden') && round1State.currentLetterIndex === 0) {
                // Start highlighting letters
                setTimeout(() => highlightNextLetter(), 500);
            }
            // If unscramble section is already visible, just played the word for reference
        }
    };
    
    window.speechSynthesis.speak(utterance);
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

// Load Round 2 word (state-driven)
function loadRound2Word() {
    const state = getGameState();
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    const wordData = state.roundWords[state.currentWordIndex];
    if (wordDisplay2) {
        wordDisplay2.innerHTML = '';
        wordDisplay2.classList.remove('letter-row');
    }
    
    // Reset errors for new word
    updateGameState({ currentWordErrors: 0 });
    
    // Reset state
    round2State.correctChunks = [...wordData.chunks];
    round2State.selectedChunks = [];
    
    // Shuffle chunks
    round2State.availableChunks = [...wordData.chunks];
    for (let i = round2State.availableChunks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [round2State.availableChunks[i], round2State.availableChunks[j]] = 
        [round2State.availableChunks[j], round2State.availableChunks[i]];
    }
    
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

// Render chunks for Round 2
function renderChunks() {
    chunksAvailable.innerHTML = '';
    chunksSelected.innerHTML = '';
    
    // Available chunks
    round2State.availableChunks.forEach((chunk, index) => {
        const chunkEl = document.createElement('div');
        chunkEl.className = 'chunk-item';
        chunkEl.textContent = chunk;
        chunkEl.dataset.index = index;
        chunkEl.addEventListener('click', () => selectChunk(index));
        chunksAvailable.appendChild(chunkEl);
    });
    
    // Selected chunks
    round2State.selectedChunks.forEach((chunk, index) => {
        const chunkEl = document.createElement('div');
        chunkEl.className = 'chunk-selected';
        chunkEl.textContent = chunk;
        chunkEl.dataset.index = index;
        chunkEl.addEventListener('click', () => removeChunk(index));
        chunksSelected.appendChild(chunkEl);
    });
    
    checkChunksBtn.disabled = round2State.selectedChunks.length === 0;
}

// Select chunk in Round 2
function selectChunk(index) {
    const chunk = round2State.availableChunks[index];
    round2State.selectedChunks.push(chunk);
    round2State.availableChunks.splice(index, 1);
    renderChunks();
}

// Remove chunk in Round 2
function removeChunk(index) {
    const chunk = round2State.selectedChunks[index];
    round2State.selectedChunks.splice(index, 1);
    round2State.availableChunks.push(chunk);
    
    // Shuffle available chunks
    for (let i = round2State.availableChunks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [round2State.availableChunks[i], round2State.availableChunks[j]] = 
        [round2State.availableChunks[j], round2State.availableChunks[i]];
    }
    
    renderChunks();
}

// Check chunks answer (state-driven)
// Works for both Amateur and Expert levels
function checkChunksAnswer() {
    const state = getGameState();
    
    // Validate we're in the right round
    if (state.currentRound !== 2 || state.gamePhase !== 'playing') {
        console.warn('Invalid round for chunks check');
        return;
    }
    
    const isCorrect = JSON.stringify(round2State.selectedChunks) === 
                     JSON.stringify(round2State.correctChunks);
    
    if (isCorrect) {
        const word = state.roundWords[state.currentWordIndex].word;
        // Display word using letter-tile pattern for consistent layout
        if (wordDisplay2) {
            displayWordAsTiles(wordDisplay2, word.toUpperCase());
        }
        showFeedback('Correct!', 'correct');
        speakFeedback('Correct');
        calculateAndAddScore();
        if (nextWordBtn) {
            nextWordBtn.classList.remove('hidden');
            nextWordBtn.disabled = false;
        }
    } else {
        updateGameState({ currentWordErrors: state.currentWordErrors + 1 });
        showFeedback('Try again!', 'incorrect');
        speakFeedback('Try again');
        // Reset selection
        round2State.availableChunks = [...round2State.availableChunks, ...round2State.selectedChunks];
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
    updateSelectedLettersDisplay();
    checkUnscrambleBtn.disabled = true;
}

// Handle letter click in Round 1
function handleLetterClick(scrambledIndex) {
    const key = round1State.scrambledKeys[scrambledIndex];
    const originalIndex = parseInt(key.dataset.originalIndex);
    
    // Check if already selected
    if (round1State.selectedLetters.includes(originalIndex)) {
        return; // Already selected
    }
    
    // Add to selected letters
    round1State.selectedLetters.push(originalIndex);
    key.classList.add('selected');
    key.style.pointerEvents = 'none';
    
    updateSelectedLettersDisplay();
    
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

// Check unscramble answer for Round 1 (state-driven)
// Works for both Amateur and Expert levels
// This function checks the answer each time it's called, regardless of previous errors
// After an incorrect answer, the user can try again and a correct answer will be accepted
// For words with duplicate letters, accepts correct spelling regardless of which instance was clicked
function checkUnscrambleAnswer() {
    const state = getGameState();
    
    // Validate we're in the right round
    if (state.currentRound !== 1 || state.gamePhase !== 'playing') {
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
        }
    } else {
        // Incorrect answer - increment error count but allow user to try again
        updateGameState({ currentWordErrors: state.currentWordErrors + 1 });
        showFeedback('Try again!', 'incorrect');
        speakFeedback('Try again');
        // Reset selection so user can try again with a new spelling
        // The user can still get it right on the next attempt - this function will be called again
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
    
    updateGameState({
        totalScore: state.totalScore + points
    });
    updateUI();
}

// Load Round 3 word (state-driven)
function loadRound3Word() {
    const state = getGameState();
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
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

// Check spelling answer (state-driven)
// Works for both Amateur and Expert levels
// After an incorrect answer, user can try again and correct answer will be accepted
function checkSpellingAnswer() {
    const state = getGameState();
    
    // Validate we're in the right round
    if (state.currentRound !== 3 || state.gamePhase !== 'playing') {
        console.warn('Invalid round for spelling check');
        return;
    }
    
    if (state.currentWordIndex >= state.roundWords.length) {
        console.warn('Invalid word index');
        return;
    }
    
    // Get raw inputs
    const rawUserInput = spellingInput ? spellingInput.value : '';
    const rawCorrectWord = state.roundWords[state.currentWordIndex].word;
    
    // Try simple normalization first (most common case)
    const userInputSimple = simpleNormalize(rawUserInput);
    const correctWordSimple = simpleNormalize(rawCorrectWord);
    
    // Also try full normalization for edge cases
    const userInputNormalized = normalizeWord(rawUserInput);
    const correctWordNormalized = normalizeWord(rawCorrectWord);
    
    // Check both simple and normalized versions
    const isCorrect = userInputSimple === correctWordSimple || 
                     userInputNormalized === correctWordNormalized;
    
    // Debug logging to help identify issues
    console.log('Spelling check:', {
        rawUserInput: `"${rawUserInput}"`,
        rawCorrectWord: `"${rawCorrectWord}"`,
        userInputSimple: `"${userInputSimple}"`,
        correctWordSimple: `"${correctWordSimple}"`,
        userInputNormalized: `"${userInputNormalized}"`,
        correctWordNormalized: `"${correctWordNormalized}"`,
        simpleMatch: userInputSimple === correctWordSimple,
        normalizedMatch: userInputNormalized === correctWordNormalized,
        finalMatch: isCorrect,
        userInputLength: rawUserInput.length,
        correctWordLength: rawCorrectWord.length
    });
    
    if (isCorrect) {
        showFeedback('Correct!', 'correct');
        speakFeedback('Correct');
        calculateAndAddScore();
        if (nextWordBtn) {
            nextWordBtn.classList.remove('hidden');
            nextWordBtn.disabled = false;
        }
    } else {
        // Increment error count but allow user to try again
        updateGameState({ currentWordErrors: state.currentWordErrors + 1 });
        showFeedback('Try again!', 'incorrect');
        speakFeedback('Try again');
        // Don't clear the input - let user correct their spelling
        // They can still get it right on the next attempt
        if (spellingInput) {
            spellingInput.focus();
            // Select all text so user can easily retype
            spellingInput.select();
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

// Clear feedback
function clearFeedback() {
    feedbackArea.innerHTML = '';
}

// Speak feedback
function speakFeedback(text) {
    const state = getGameState();
    if (!state.audioEnabled) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
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
        // Round complete - check if we can advance to next round
        if (state.currentRound < 3) {
            // Advance to next round
            if (!isValidStateTransition('ADVANCE_ROUND', state)) {
                console.warn('Cannot advance round');
                return;
            }
            
            const nextRound = state.currentRound + 1;
            updateGameState({
                currentRound: nextRound,
                currentWordIndex: 0,
                currentWordErrors: 0
            });
            
            // Randomly select 6 new words for the next round
            // Works for both Amateur and Expert - uses state.selectedLevel to select from correct list
            const allWords = [...state.wordLists[state.selectedLevel]];
            const selectedWords = selectRandomWords(allWords, 6);
            
            if (selectedWords.length === 0) {
                console.error('No words available for next round');
                return;
            }
            
            updateGameState({ roundWords: selectedWords });
            
            loadRound(nextRound);
        } else {
            // All rounds complete
            if (!isValidStateTransition('COMPLETE_GAME', state)) {
                console.warn('Cannot complete game');
                return;
            }
            
            updateGameState({ gamePhase: 'complete' });
            
            if (finalScore) finalScore.textContent = state.totalScore;
            if (gameScreen) gameScreen.classList.remove('active');
            if (completionScreen) completionScreen.classList.add('active');
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
        
        // Load word for current round
        if (state.currentRound === 1) {
            loadRound1Word();
        } else if (state.currentRound === 2) {
            loadRound2Word();
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
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded, initializing game...');
        init();
    });
} else {
    // DOM is already loaded (e.g., script loaded after page load)
    console.log('DOM already loaded, initializing game...');
    init();
}
