import { SETS_DATA, saveSets, getDefaultSet, getDefaultWordLists, getActiveSets } from './data.js';

// Admin state
let setsData = JSON.parse(JSON.stringify(SETS_DATA));
let currentSetId = null;
let editingIndex = null;
let editingLevel = null;

// DOM elements
const passwordModal = document.getElementById('passwordModal');
const passwordInput = document.getElementById('passwordInput');
const submitPasswordBtn = document.getElementById('submitPasswordBtn');
const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
const passwordError = document.getElementById('passwordError');
const adminScreen = document.getElementById('adminScreen');
const startScreen = document.getElementById('startScreen');
const adminBtn = document.getElementById('adminBtn');
const backToStartBtn = document.getElementById('backToStartBtn');
const tabButtons = document.querySelectorAll('.tab-btn');
const setsTab = document.getElementById('setsTab');
const wordsTab = document.getElementById('wordsTab');
const setsList = document.getElementById('setsList');
const addSetBtn = document.getElementById('addSetBtn');
const setSelector = document.getElementById('setSelector');
const wordEditSection = document.getElementById('wordEditSection');
const wordTabButtons = document.querySelectorAll('.word-tab-btn');
const amateurWordEdit = document.getElementById('amateurWordEdit');
const expertWordEdit = document.getElementById('expertWordEdit');
const amateurWordList = document.getElementById('amateurWordList');
const expertWordList = document.getElementById('expertWordList');
const addAmateurWordBtn = document.getElementById('addAmateurWordBtn');
const addExpertWordBtn = document.getElementById('addExpertWordBtn');
const saveWordsBtn = document.getElementById('saveWordsBtn');
const resetWordsBtn = document.getElementById('resetWordsBtn');
const exportWordsBtn = document.getElementById('exportWordsBtn');
const importWordsBtn = document.getElementById('importWordsBtn');
const importFileInput = document.getElementById('importFileInput');

// Initialize admin
function initAdmin() {
    // Navigation
    adminBtn.addEventListener('click', () => {
        showPasswordModal();
    });

    // Password modal handlers
    submitPasswordBtn.addEventListener('click', checkPassword);
    cancelPasswordBtn.addEventListener('click', hidePasswordModal);
    
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            checkPassword();
        }
    });

    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            hidePasswordModal();
        }
    });

    backToStartBtn.addEventListener('click', () => {
        adminScreen.classList.remove('active');
        startScreen.classList.add('active');
        // Reload active sets when returning to start screen
        if (window.loadActiveSets) {
            window.loadActiveSets();
        }
    });

    // Tab switching
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });

    // Word edit tab switching
    wordTabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.wordTab;
            switchWordTab(tab);
        });
    });

    // Sets management
    addSetBtn.addEventListener('click', addNewSet);
    setSelector.addEventListener('change', onSetSelect);

    // Word management
    addAmateurWordBtn.addEventListener('click', () => addWord('amateur'));
    addExpertWordBtn.addEventListener('click', () => addWord('expert'));

    // Action buttons
    saveWordsBtn.addEventListener('click', saveAll);
    resetWordsBtn.addEventListener('click', resetToDefault);
    exportWordsBtn.addEventListener('click', exportSets);
    importWordsBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importSets);
}

// Show password modal
function showPasswordModal() {
    passwordModal.classList.add('active');
    passwordInput.value = '';
    passwordError.textContent = '';
    passwordInput.focus();
}

// Hide password modal
function hidePasswordModal() {
    passwordModal.classList.remove('active');
    passwordInput.value = '';
    passwordError.textContent = '';
}

// Check password
function checkPassword() {
    const ADMIN_PASSWORD = 'Foxview2025';
    const enteredPassword = passwordInput.value.trim();
    
    if (enteredPassword === ADMIN_PASSWORD) {
        hidePasswordModal();
        startScreen.classList.remove('active');
        adminScreen.classList.add('active');
        loadAll();
    } else {
        passwordError.textContent = 'Incorrect password. Please try again.';
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// Switch tabs
function switchTab(tab) {
    tabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    setsTab.classList.toggle('active', tab === 'sets');
    wordsTab.classList.toggle('active', tab === 'words');
}

// Switch word edit tabs
function switchWordTab(tab) {
    wordTabButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.wordTab === tab);
    });
    amateurWordEdit.classList.toggle('active', tab === 'amateur');
    expertWordEdit.classList.toggle('active', tab === 'expert');
}

// Load all data
function loadAll() {
    setsData = JSON.parse(JSON.stringify(SETS_DATA));
    renderSetsList();
    updateSetSelector();
}

// Render sets list
function renderSetsList() {
    setsList.innerHTML = '';

    if (setsData.sets.length === 0) {
        setsList.innerHTML = '<p class="empty-message">No sets created yet. Click "Create New Set" to get started.</p>';
        return;
    }

    setsData.sets.forEach((set, index) => {
        const setCard = createSetCard(set, index);
        setsList.appendChild(setCard);
    });
}

// Create set card
function createSetCard(set, index) {
    const card = document.createElement('div');
    card.className = 'set-card';
    
    const isEditing = editingIndex === index && editingLevel === 'set';
    
    if (isEditing) {
        card.innerHTML = `
            <div class="set-card-edit">
                <div class="edit-field">
                    <label>Set Name:</label>
                    <input type="text" class="edit-set-name-input" value="${set.name}" placeholder="Enter set name">
                </div>
                <div class="edit-actions">
                    <button class="save-set-edit-btn" data-index="${index}">Save</button>
                    <button class="cancel-set-edit-btn">Cancel</button>
                </div>
            </div>
        `;

        const saveBtn = card.querySelector('.save-set-edit-btn');
        const cancelBtn = card.querySelector('.cancel-set-edit-btn');
        
        saveBtn.addEventListener('click', () => saveSetEdit(index));
        cancelBtn.addEventListener('click', () => cancelSetEdit());
    } else {
        card.innerHTML = `
            <div class="set-card-display">
                <div class="set-info">
                    <span class="set-name">${set.name}</span>
                    <span class="set-stats">${set.wordLists.amateur.length} Amateur, ${set.wordLists.expert.length} Expert words</span>
                </div>
                <div class="set-controls">
                    <label class="toggle-switch">
                        <input type="checkbox" class="set-active-toggle" data-index="${index}" ${set.active ? 'checked' : ''}>
                        <span class="toggle-label">${set.active ? 'Active' : 'Inactive'}</span>
                    </label>
                    <button class="edit-set-btn" data-index="${index}">Edit Name</button>
                    <button class="delete-set-btn" data-index="${index}">Delete</button>
                </div>
            </div>
        `;

        const toggle = card.querySelector('.set-active-toggle');
        const editBtn = card.querySelector('.edit-set-btn');
        const deleteBtn = card.querySelector('.delete-set-btn');
        
        toggle.addEventListener('change', () => toggleSetActive(index));
        editBtn.addEventListener('click', () => editSet(index));
        deleteBtn.addEventListener('click', () => deleteSet(index));
    }

    return card;
}

// Add new set
function addNewSet() {
    const newSet = {
        id: 'set_' + Date.now(),
        name: 'New Set ' + (setsData.sets.length + 1),
        active: false,
        wordLists: JSON.parse(JSON.stringify(getDefaultWordLists()))
    };
    
    setsData.sets.push(newSet);
    editingIndex = setsData.sets.length - 1;
    editingLevel = 'set';
    renderSetsList();
    
    setTimeout(() => {
        const input = document.querySelector('.edit-set-name-input');
        if (input) input.focus();
    }, 100);
}

// Edit set
function editSet(index) {
    editingIndex = index;
    editingLevel = 'set';
    renderSetsList();
}

// Save set edit
function saveSetEdit(index) {
    const card = document.querySelector(`.set-card:nth-child(${index + 1})`);
    const nameInput = card.querySelector('.edit-set-name-input');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Please enter a set name.');
        return;
    }
    
    setsData.sets[index].name = name;
    editingIndex = null;
    editingLevel = null;
    renderSetsList();
    updateSetSelector();
}

// Cancel set edit
function cancelSetEdit() {
    if (editingIndex === setsData.sets.length - 1 && 
        setsData.sets[editingIndex].name.startsWith('New Set')) {
        setsData.sets.pop();
    }
    editingIndex = null;
    editingLevel = null;
    renderSetsList();
}

// Toggle set active status
function toggleSetActive(index) {
    setsData.sets[index].active = !setsData.sets[index].active;
    renderSetsList();
}

// Delete set
function deleteSet(index) {
    if (setsData.sets.length === 1) {
        alert('You must have at least one set. Cannot delete the last set.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete "${setsData.sets[index].name}"?`)) {
        setsData.sets.splice(index, 1);
        if (currentSetId === setsData.sets[index]?.id) {
            currentSetId = null;
            wordEditSection.classList.add('hidden');
        }
        renderSetsList();
        updateSetSelector();
    }
}

// Update set selector
function updateSetSelector() {
    setSelector.innerHTML = '<option value="">-- Select a Set --</option>';
    setsData.sets.forEach(set => {
        const option = document.createElement('option');
        option.value = set.id;
        option.textContent = set.name + (set.active ? ' (Active)' : '');
        setSelector.appendChild(option);
    });
    
    if (currentSetId) {
        setSelector.value = currentSetId;
    }
}

// On set select
function onSetSelect() {
    const setId = setSelector.value;
    if (!setId) {
        currentSetId = null;
        wordEditSection.classList.add('hidden');
        return;
    }
    
    currentSetId = setId;
    wordEditSection.classList.remove('hidden');
    loadWordListsForSet(setId);
}

// Load word lists for selected set
function loadWordListsForSet(setId) {
    const set = setsData.sets.find(s => s.id === setId);
    if (!set) return;
    
    currentWordLists = JSON.parse(JSON.stringify(set.wordLists));
    editingIndex = null;
    editingLevel = null;
    renderWordList('amateur', currentWordLists.amateur);
    renderWordList('expert', currentWordLists.expert);
}

// Current word lists being edited
let currentWordLists = { amateur: [], expert: [] };

// Render word list
function renderWordList(level, words) {
    const container = level === 'amateur' ? amateurWordList : expertWordList;
    container.innerHTML = '';

    if (words.length === 0) {
        container.innerHTML = '<p class="empty-message">No words added yet. Click "Add Word" to get started.</p>';
        return;
    }

    words.forEach((wordData, index) => {
        const wordCard = createWordCard(level, wordData, index);
        container.appendChild(wordCard);
    });
}

// Create word card
function createWordCard(level, wordData, index) {
    const card = document.createElement('div');
    card.className = 'word-card';
    
    if (editingIndex === index && editingLevel === level) {
        // Edit mode
        const word = wordData.word || '';
        const chunks = wordData.chunks || [];
        
        card.innerHTML = `
            <div class="word-card-edit">
                <div class="edit-field">
                    <label>Word:</label>
                    <input type="text" class="edit-word-input" value="${word}" placeholder="Enter word">
                </div>
                <div class="edit-field">
                    <label>Divide Word for Round 2:</label>
                    <div class="word-divider-container">
                        <div id="wordDivider-${level}-${index}" class="word-divider" data-level="${level}" data-index="${index}"></div>
                        <div class="divider-controls">
                            <button type="button" class="divider-btn clear-divider" data-level="${level}" data-index="${index}">Clear</button>
                            <button type="button" class="divider-btn auto-divide" data-level="${level}" data-index="${index}">Auto-Divide</button>
                        </div>
                    </div>
                    <div class="chunks-preview">
                        <label>Word Parts (for Round 2):</label>
                        <div id="chunksPreview-${level}-${index}" class="chunks-display"></div>
                        <input type="text" class="edit-chunks-input" value="${chunks.join(', ')}" placeholder="Or enter manually: beau, ti, ful" style="margin-top: 0.5rem;">
                    </div>
                </div>
                <div class="edit-actions">
                    <button class="save-edit-btn" data-level="${level}" data-index="${index}">Save</button>
                    <button class="cancel-edit-btn" data-level="${level}">Cancel</button>
                </div>
            </div>
        `;

        const saveBtn = card.querySelector('.save-edit-btn');
        const cancelBtn = card.querySelector('.cancel-edit-btn');
        const wordInput = card.querySelector('.edit-word-input');
        const chunksInput = card.querySelector('.edit-chunks-input');
        const clearBtn = card.querySelector('.clear-divider');
        const autoBtn = card.querySelector('.auto-divide');
        
        // Initialize word divider
        initWordDivider(level, index, word, chunks);
        
        // Update divider when word changes
        wordInput.addEventListener('input', () => {
            const newWord = wordInput.value.trim().toLowerCase();
            initWordDivider(level, index, newWord, []);
        });
        
        // Update chunks when manual input changes
        chunksInput.addEventListener('input', () => {
            const manualChunks = chunksInput.value.split(',').map(c => c.trim()).filter(c => c.length > 0);
            updateChunksPreview(level, index, manualChunks);
        });
        
        clearBtn.addEventListener('click', () => {
            initWordDivider(level, index, wordInput.value.trim().toLowerCase(), []);
        });
        
        autoBtn.addEventListener('click', () => {
            autoDivideWord(level, index, wordInput.value.trim().toLowerCase());
        });
        
        saveBtn.addEventListener('click', () => saveEdit(level, index));
        cancelBtn.addEventListener('click', () => cancelEdit(level));
    } else {
        // Display mode
        card.innerHTML = `
            <div class="word-card-display">
                <div class="word-info">
                    <span class="word-text">${wordData.word}</span>
                    <span class="word-chunks">${wordData.chunks.join(' + ')}</span>
                </div>
                <div class="word-actions">
                    <button class="edit-word-btn" data-level="${level}" data-index="${index}">Edit</button>
                    <button class="delete-word-btn" data-level="${level}" data-index="${index}">Delete</button>
                </div>
            </div>
        `;

        const editBtn = card.querySelector('.edit-word-btn');
        const deleteBtn = card.querySelector('.delete-word-btn');
        
        editBtn.addEventListener('click', () => editWord(level, index));
        deleteBtn.addEventListener('click', () => deleteWord(level, index));
    }

    return card;
}

// Add new word
function addWord(level) {
    if (!currentSetId) {
        alert('Please select a set first.');
        return;
    }
    
    const newWord = {
        word: '',
        chunks: []
    };
    
    currentWordLists[level].push(newWord);
    editingIndex = currentWordLists[level].length - 1;
    editingLevel = level;
    
    renderWordList(level, currentWordLists[level]);
    
    setTimeout(() => {
        const input = document.querySelector(`#${level}WordEdit .edit-word-input`);
        if (input) input.focus();
    }, 100);
}

// Edit word
function editWord(level, index) {
    editingIndex = index;
    editingLevel = level;
    renderWordList(level, currentWordLists[level]);
}

// Initialize word divider
function initWordDivider(level, index, word, chunks) {
    const divider = document.getElementById(`wordDivider-${level}-${index}`);
    const preview = document.getElementById(`chunksPreview-${level}-${index}`);
    const chunksInput = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1}) .edit-chunks-input`);
    
    if (!divider) return;
    
    if (!word) {
        divider.innerHTML = '<p style="text-align: center; color: var(--text-light);">Enter a word above to divide it</p>';
        if (preview) preview.innerHTML = '';
        if (chunksInput) chunksInput.value = '';
        return;
    }
    
    // Render word with clickable letters
    divider.innerHTML = '';
    const wordContainer = document.createElement('div');
    wordContainer.className = 'word-letters';
    
    // Determine division points from chunks
    const divisions = chunks.length > 0 ? chunks : [word];
    let accumulatedLength = 0;
    const divisionPoints = [];
    
    for (let i = 0; i < divisions.length - 1; i++) {
        accumulatedLength += divisions[i].length;
        divisionPoints.push(accumulatedLength - 1);
    }
    
    word.split('').forEach((letter, letterIndex) => {
        const letterSpan = document.createElement('span');
        letterSpan.className = 'word-letter';
        letterSpan.textContent = letter;
        letterSpan.dataset.index = letterIndex;
        
        // Mark division point
        if (divisionPoints.includes(letterIndex)) {
            letterSpan.classList.add('division-point');
        }
        
        letterSpan.addEventListener('click', () => {
            toggleDivision(level, index, letterIndex);
        });
        
        wordContainer.appendChild(letterSpan);
    });
    
    divider.appendChild(wordContainer);
    
    // Update chunks preview and input
    updateChunksFromDivisions(level, index);
}

// Toggle division at a letter position
function toggleDivision(level, index, letterIndex) {
    const divider = document.getElementById(`wordDivider-${level}-${index}`);
    const wordInput = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1}) .edit-word-input`);
    const word = wordInput.value.trim().toLowerCase();
    
    if (!word || letterIndex >= word.length - 1) return; // Can't divide after last letter
    
    const letter = divider.querySelector(`.word-letter[data-index="${letterIndex}"]`);
    if (!letter) return;
    
    // Toggle division point
    letter.classList.toggle('division-point');
    
    // Update chunks
    updateChunksFromDivisions(level, index);
}

// Update chunks from visual divisions
function updateChunksFromDivisions(level, index) {
    const divider = document.getElementById(`wordDivider-${level}-${index}`);
    const preview = document.getElementById(`chunksPreview-${level}-${index}`);
    const chunksInput = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1}) .edit-chunks-input`);
    const wordInput = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1}) .edit-word-input`);
    const word = wordInput.value.trim().toLowerCase();
    
    if (!word || !divider) return;
    
    const letters = divider.querySelectorAll('.word-letter');
    const divisions = [];
    let currentChunk = '';
    
    letters.forEach((letter, i) => {
        currentChunk += letter.textContent;
        
        if (letter.classList.contains('division-point') || i === letters.length - 1) {
            if (currentChunk) {
                divisions.push(currentChunk);
                currentChunk = '';
            }
        }
    });
    
    // Update preview
    if (preview) {
        preview.innerHTML = '';
        divisions.forEach((chunk, i) => {
            const chunkSpan = document.createElement('span');
            chunkSpan.className = 'chunk-badge';
            chunkSpan.textContent = chunk;
            preview.appendChild(chunkSpan);
        });
    }
    
    // Update input
    if (chunksInput) {
        chunksInput.value = divisions.join(', ');
    }
}

// Update chunks preview display
function updateChunksPreview(level, index, chunks) {
    const preview = document.getElementById(`chunksPreview-${level}-${index}`);
    if (!preview) return;
    
    preview.innerHTML = '';
    chunks.forEach((chunk, i) => {
        const chunkSpan = document.createElement('span');
        chunkSpan.className = 'chunk-badge';
        chunkSpan.textContent = chunk;
        preview.appendChild(chunkSpan);
    });
    
    // Update visual divider if word matches
    const wordInput = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1}) .edit-word-input`);
    const word = wordInput.value.trim().toLowerCase();
    const combined = chunks.join('').toLowerCase();
    
    if (combined === word) {
        // Re-render divider with these chunks
        initWordDivider(level, index, word, chunks);
    }
}

// Auto-divide word (simple heuristic)
function autoDivideWord(level, index, word) {
    if (!word) return;
    
    // Simple auto-divide: try to split at common patterns
    const chunks = [];
    let current = '';
    
    // Try to identify common prefixes, roots, suffixes
    const commonPrefixes = ['un', 're', 'pre', 'dis', 'mis', 'in', 'im', 'en', 'ex', 'de', 'be', 'co', 'over', 'out', 'sub', 'inter'];
    const commonSuffixes = ['ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'ful', 'less', 'able', 'ible', 'ous', 'ious'];
    
    let remaining = word;
    let prefix = '';
    let suffix = '';
    
    // Check for prefix
    for (const pref of commonPrefixes) {
        if (remaining.startsWith(pref) && remaining.length > pref.length) {
            prefix = pref;
            remaining = remaining.substring(pref.length);
            break;
        }
    }
    
    // Check for suffix
    for (const suff of commonSuffixes) {
        if (remaining.endsWith(suff) && remaining.length > suff.length) {
            suffix = suff;
            remaining = remaining.substring(0, remaining.length - suff.length);
            break;
        }
    }
    
    // Build chunks
    if (prefix) chunks.push(prefix);
    if (remaining) chunks.push(remaining);
    if (suffix) chunks.push(suffix);
    
    // If no patterns found, split roughly in half or thirds
    if (chunks.length === 0) {
        if (word.length <= 4) {
            chunks.push(word);
        } else if (word.length <= 7) {
            const mid = Math.floor(word.length / 2);
            chunks.push(word.substring(0, mid));
            chunks.push(word.substring(mid));
        } else {
            const third = Math.floor(word.length / 3);
            chunks.push(word.substring(0, third));
            chunks.push(word.substring(third, third * 2));
            chunks.push(word.substring(third * 2));
        }
    }
    
    // Update the interface
    const chunksInput = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1}) .edit-chunks-input`);
    if (chunksInput) {
        chunksInput.value = chunks.join(', ');
    }
    initWordDivider(level, index, word, chunks);
}

// Save edit
function saveEdit(level, index) {
    const card = document.querySelector(`#${level}WordEdit .word-card:nth-child(${index + 1})`);
    const wordInput = card.querySelector('.edit-word-input');
    const chunksInput = card.querySelector('.edit-chunks-input');
    
    const word = wordInput.value.trim().toLowerCase();
    const chunks = chunksInput.value.split(',').map(c => c.trim()).filter(c => c.length > 0);
    
    if (!word) {
        alert('Please enter a word.');
        return;
    }
    
    if (chunks.length === 0) {
        alert('Please enter at least one word part.');
        return;
    }
    
    const combined = chunks.join('').toLowerCase();
    if (combined !== word) {
        if (!confirm(`Warning: The word parts "${chunks.join(' + ')}" don't exactly match "${word}". Continue anyway?`)) {
            return;
        }
    }
    
    currentWordLists[level][index] = {
        word: word,
        chunks: chunks
    };
    
    editingIndex = null;
    editingLevel = null;
    
    renderWordList(level, currentWordLists[level]);
}

// Cancel edit
function cancelEdit(level) {
    if (editingIndex === currentWordLists[level].length - 1 && 
        (!currentWordLists[level][editingIndex].word || currentWordLists[level][editingIndex].word === '')) {
        currentWordLists[level].pop();
    }
    
    editingIndex = null;
    editingLevel = null;
    
    renderWordList(level, currentWordLists[level]);
}

// Delete word
function deleteWord(level, index) {
    if (confirm(`Are you sure you want to delete "${currentWordLists[level][index].word}"?`)) {
        currentWordLists[level].splice(index, 1);
        renderWordList(level, currentWordLists[level]);
    }
}

// Save all
function saveAll() {
    // Update current set's word lists if editing
    if (currentSetId) {
        const set = setsData.sets.find(s => s.id === currentSetId);
        if (set) {
            set.wordLists = JSON.parse(JSON.stringify(currentWordLists));
        }
    }
    
    if (saveSets(setsData)) {
        alert('Changes saved successfully! The game will reload.');
        setTimeout(() => {
            location.reload();
        }, 500);
    } else {
        alert('Error saving changes. Please try again.');
    }
}

// Reset to default
function resetToDefault() {
    if (confirm('Are you sure you want to reset to default? This will delete all custom sets and words.')) {
        const defaultSet = getDefaultSet();
        setsData = {
            sets: [defaultSet]
        };
        saveSets(setsData);
        loadAll();
        setTimeout(() => {
            location.reload();
        }, 500);
    }
}

// Export sets
function exportSets() {
    const dataStr = JSON.stringify(setsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'spelling-game-sets.json';
    link.click();
    URL.revokeObjectURL(url);
}

// Import sets
function importSets(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            
            if (!imported.sets || !Array.isArray(imported.sets)) {
                alert('Invalid file format. Expected object with "sets" array.');
                return;
            }
            
            // Validate each set
            for (const set of imported.sets) {
                if (!set.id || !set.name || !set.wordLists || 
                    !set.wordLists.amateur || !set.wordLists.expert) {
                    alert('Invalid set format in file.');
                    return;
                }
            }
            
            if (confirm('Import sets? This will replace your current sets.')) {
                setsData = imported;
                saveSets(setsData);
                loadAll();
                setTimeout(() => {
                    location.reload();
                }, 500);
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// Initialize on load
initAdmin();
