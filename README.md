# Flashcard App Troubleshooting Guide

## Fixed Issues

1. **Fixed HTML comment syntax** - Changed JSX-style comment to HTML comment
2. **Added CORS headers** for API requests to prevent cross-origin issues
3. **Fixed initialization** - Removed duplicate loadWords call
4. **Added missing event listener** for the "To remember" button
5. **Added keyboard navigation**:
   - Arrow keys: Navigate between cards
   - Space/Enter: Flip card
   - P: Play pronunciation audio
6. **Improved error handling** for failed API calls and missing data

## How to Use

1. **Navigation**:
   - Click on level buttons (A1, A2, B1, B2, All, Native) to switch word sets
   - Use Previous/Next buttons or arrow keys to navigate cards
   - Click the card or press Space/Enter to flip it

2. **Audio**:
   - Click the 🔊 Play Sound button or press 'P' to hear pronunciation
   - Audio may not be available for all words (depends on Merriam-Webster API)

3. **Translation**:
   - Arabic translations appear automatically on the back of cards
   - Click "Translate" buttons next to definitions and examples for Arabic translations

## Common Issues & Solutions

### App doesn't load words
- Check browser console for errors (F12 → Console)
- Ensure JSON files (A1.json, A2.json, etc.) are in the same directory
- Try refreshing the page

### API errors (Dictionary/Translation)
- External API calls may fail due to network issues or rate limits
- The app will still work, just without detailed definitions or translations
- Words are still available for basic study

### Audio doesn't play
- Audio depends on Merriam-Webster's audio files
- Not all words have audio available
- Browser may block audio without user interaction

### Translations don't work
- Translation uses MyMemory API which may have rate limits
- Some words may not have direct translations
- Try again later if translation fails

## Features

- **Progress tracking**: Shows current position in word list
- **Level persistence**: Remembers your last selected level and position
- **Keyboard shortcuts**: Full keyboard navigation support
- **Responsive design**: Works on desktop and mobile
- **Offline capability**: Core functionality works without internet (except API features)

## Data Files Required

Make sure these files exist in the same directory:
- `A1.json` - A1 level words
- `A2.json` - A2 level words  
- `B1.json` - B1 level words
- `B2.json` - B2 level words
- `words.json` - Native level words
- `index.html` - Main app file
- `app.js` - Application logic
- `style.css` - Styling

## Browser Compatibility

Tested with:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

For best experience, use a modern browser with JavaScript enabled.