# Bethany's Spelling Game

A complete, browser-based educational spelling game designed for 6th grade students. The game is fun, engaging, and classroom-safe, working on iPads, Chromebooks, and laptops with no installations required.

## Features

- **Three Rounds of Fun**:
  - Round 1: Watch & Repeat - Students hear the word and unscramble letters
  - Round 2: Build the Word - Students arrange word-part chunks in order
  - Round 3: Spell It Solo - Students type the full spelling with no hints

- **Two Difficulty Levels**: Amateur and Expert, each with customizable word lists

- **Scoring System**: 
  - 3 points for no errors
  - 2 points for 1 error
  - 1 point for 2 or more errors

- **Admin Panel**: 
  - Password-protected admin access
  - Manage multiple word list sets
  - Activate/deactivate word lists for players
  - Visual word division tool for Round 2 chunks
  - Import/export functionality for backup

- **Fully Responsive**: Works on iPads, Chromebooks, and desktop browsers

- **Touch & Keyboard Friendly**: Optimized for both touch screens and keyboards

- **Audio Feedback**: Uses Web Speech API for word pronunciation and feedback

## How to Use

1. Open `index.html` in any modern web browser
2. Select a word list and difficulty level (Amateur or Expert)
3. Complete all three rounds to finish the game
4. Your score is tracked throughout the game

## Admin Access

- Click the "Admin" button in the lower left corner
- Password: `Foxview2025`
- Manage word lists, create sets, and configure game options

## Technical Details

- Pure HTML, CSS, and JavaScript (no external dependencies)
- Uses ES6 modules
- LocalStorage for data persistence
- Web Speech API for audio
- Fully state-driven architecture for reliability

## Browser Compatibility

- Chrome/Edge (recommended)
- Safari (including iPad)
- Firefox
- Works when embedded in Google Sites

## File Structure

```
spelling-game/
├── index.html      # Main game interface
├── style.css       # All styling and responsive design
├── game.js         # Core game logic and state management
├── data.js         # Word list management and localStorage
├── admin.js        # Admin panel functionality
└── README.md       # This file
```

## License

Educational use - Created for classroom use.
