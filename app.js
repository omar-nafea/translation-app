// ----------------------------------------------------------------------------------
// IMPORTANT: REPLACE "YOUR_MW_API_KEY_HERE" WITH YOUR ACTUAL MERRIAM-WEBSTER API KEY
// ----------------------------------------------------------------------------------
const MW_API_KEY = "ce783f93-1ba5-4c60-8433-512ac0a0b5ea";
// If you don't have one, get it from: https://dictionaryapi.com/

let flashcardWords = [];
let currentCardIndex = 0;
const mwDataCache = new Map(); // Using Map for caching
let currentLevel = "A1"; // To track the current level globally
let toRememberWords = []; // Array to store words marked to remember
let allWordsCache = new Map(); // Cache for all words from all levels for search

// DOM Elements
const flashcardElement = document.getElementById("flashcard");
const flashcardWordFrontElement = document.getElementById(
  "flashcard-word-front"
);
const flashcardPronunciationTextElement = document.getElementById(
  "flashcard-pronunciation-text"
);
const flashcardPlayAudioBtnElement = document.getElementById(
  "flashcard-play-audio-btn"
);

const flashcardBackContentElement = document.querySelector(
  ".flashcard-back .flashcard-back-content"
);
const flashcardWordBackElement = document.getElementById("flashcard-word-back");
const flashcardHeadwordArabicElement = document.getElementById(
  "flashcard-headword-arabic"
);
const flashcardMwDetailsElement = document.getElementById(
  "flashcard-mw-details"
);
const flashcardFunctionalLabelElement = document.getElementById(
  "flashcard-functional-label"
);
const flashcardDefinitionsListElement = document.getElementById(
  "flashcard-definitions-list"
);
const flashcardSynonymsAreaElement = document.getElementById(
  "flashcard-synonyms-area"
);
const flashcardSynonymsListElement = document.getElementById(
  "flashcard-synonyms-list"
);
const flashcardWordNotFoundAreaElement = document.getElementById(
  "flashcard-word-not-found-area"
);

const prevCardBtnElement = document.getElementById("prev-card-btn");
const nextCardBtnElement = document.getElementById("next-card-btn");
const rememberCardBtnElement = document.getElementById("remember-card-btn");

const searchInputElement = document.getElementById("search-input");
const searchBtnElement = document.getElementById("search-btn");
const searchResultsElement = document.getElementById("search-results");

const loadingMsgElement = document.getElementById("loading-message");
const errorMsgElement = document.getElementById("error-message");

const progressContainer = document.getElementById("progress-container");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");

let globalPronunciationPlayer = null;
let currentPronunciationAudioBasename = null;

// --- Initialization ---
async function initializeApp() {
  console.log("🚀 Initializing Flashcard App...");

  // Initialize remember functionality
  toRememberWords = getRememberWords();
  console.log(`💭 Loaded ${toRememberWords.length} words to remember`);

  setupEventListeners();
  // Load the last used level, or default to A1
  const savedLevel = localStorage.getItem("flashcardApp_currentLevel") || "A1";
  console.log(`📚 Loading ${savedLevel} level...`);
  await loadWords(savedLevel);
  console.log("✅ App initialized successfully!");
}

async function loadWords(level) {
  currentLevel = level;
  localStorage.setItem("flashcardApp_currentLevel", level);
  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach((button) => {
    if (button.dataset.level === level) {
      button.classList.add("selected");
    } else {
      button.classList.remove("selected");
    }
  });

  showLoadingMessage(`Loading ${level} word list...`);
  try {
    let words = [];
    if (level === "remember") {
      // Load words from the remember list
      words = getRememberWords();
    } else if (level === "words") {
      const response = await fetch(`words.json`);
      if (!response.ok) {
        throw new Error(
          `Failed to load words.json: ${response.status} ${response.statusText}`
        );
      }
      words = await response.json();
    } else {
      // Handle all individual levels (A1, A2, B1, B2, B3, C1)
      const response = await fetch(`${level}.json`);
      if (!response.ok) {
        throw new Error(
          `Failed to load ${level}.json: ${response.status} ${response.statusText}`
        );
      }
      words = await response.json();
    }

    if (!Array.isArray(words)) {
      throw new Error(
        "Word data is not in the correct format. Expected an array of words."
      );
    }

    flashcardWords = [
      ...new Set(
        words.filter((word) => typeof word === "string" && word.trim() !== "")
      ),
    ];

    if (flashcardWords.length === 0) {
      showErrorMessage(`No words found for level ${level}.`);
      prevCardBtnElement.disabled = true;
      nextCardBtnElement.disabled = true;
      return;
    }

    currentCardIndex = 0;
    // Load saved index for this level, or default to 0
    const savedIndices =
      JSON.parse(localStorage.getItem("flashcardApp_indices")) || {};
    currentCardIndex = savedIndices[level] || 0;
    // Reset if the saved index is out of bounds for the current word list
    if (currentCardIndex >= flashcardWords.length) {
      currentCardIndex = 0;
    }
    await displayCard(currentCardIndex);
    updateProgress();
    hideLoadingMessage();
  } catch (error) {
    console.error(`Failed to load words for level ${level}:`, error);
    showErrorMessage(`Error loading words: ${error.message}`);
    prevCardBtnElement.disabled = true;
    nextCardBtnElement.disabled = true;
  }
}

function updateProgress() {
  const totalWords = flashcardWords.length;
  // add completed words to local storage and get the value from local storage
  const completedWords = currentCardIndex + 1;
  const progressPercentage = (completedWords / totalWords) * 100;

  progressBar.style.width = `${progressPercentage}%`;
  progressText.textContent = `${completedWords} / ${totalWords} words`;
}

// --- UI Message Helpers ---
function showLoadingMessage(message = "Loading...") {
  loadingMsgElement.textContent = message;
  loadingMsgElement.style.display = "block";
  errorMsgElement.style.display = "none";
}
function hideLoadingMessage() {
  loadingMsgElement.style.display = "none";
}
function showErrorMessage(message) {
  errorMsgElement.textContent = message;
  errorMsgElement.style.display = "block";
  hideLoadingMessage();
  flashcardElement.classList.remove("is-flipped");
  const frontContent = flashcardElement.querySelector(
    ".flashcard-front .flashcard-front-content"
  );
  const backContent = flashcardElement.querySelector(
    ".flashcard-back .flashcard-back-content"
  );
  if (frontContent) frontContent.style.display = "none";
  if (backContent) backContent.style.display = "none";
}

// --- Card Display Logic ---
async function displayCard(index) {
  if (index < 0 || index >= flashcardWords.length) {
    console.warn("Invalid card index:", index);
    return;
  }
  currentCardIndex = index;

  // Save the current index for the current level to localStorage
  const savedIndices =
    JSON.parse(localStorage.getItem("flashcardApp_indices")) || {};
  savedIndices[currentLevel] = index;
  localStorage.setItem("flashcardApp_indices", JSON.stringify(savedIndices));
  const word = flashcardWords[index];

  showLoadingMessage(`Loading data for "${word}"...`);
  resetCardView(word);

  try {
    let processedMwData = mwDataCache.get(word);
    if (!processedMwData) {
      try {
        processedMwData = await fetchAndProcessMwData(word);
        if (processedMwData && !processedMwData.error) {
          mwDataCache.set(word, processedMwData);
        }
      } catch (apiError) {
        console.warn(`API call failed for "${word}":`, apiError);
        // Create a minimal fallback data structure
        processedMwData = {
          error: true,
          errorMessage:
            "Dictionary service temporarily unavailable. Word is still available for study.",
        };
      }
    }
    flashcardHeadwordArabicElement.innerHTML = "<i>Translating word...</i>";
    translateTextToArabic(word)
      .then((translatedWord) => {
        if (translatedWord) {
          flashcardHeadwordArabicElement.innerHTML = `<span dir="rtl" lang="ar">${translatedWord}</span>`;
        } else {
          flashcardHeadwordArabicElement.innerHTML = `<span style="font-style:italic; color: #6c757d;">(No translation found for word)</span>`;
        }
      })
      .catch((error) => {
        console.error(
          `Failed to translate headword "${word}" for back of card:`,
          error
        );
        flashcardHeadwordArabicElement.innerHTML = `<span style="font-style:italic; color:red;">(Word translation failed)</span>`;
      });

    if (processedMwData && !processedMwData.error) {
      populateCardFront(word, processedMwData);
      populateCardBack(word, processedMwData);
      flashcardWordNotFoundAreaElement.style.display = "none";
      flashcardMwDetailsElement.style.display = "block";
    } else {
      const errorMessage = processedMwData
        ? processedMwData.errorMessage
        : `Details for "${word}" not found.`;
      handleWordNotFoundOnCard(word, errorMessage);
    }
  } catch (error) {
    console.error(`Error displaying card for "${word}":`, error);
    showErrorMessage(`Failed to load data for "${word}". ${error.message}`);
    handleWordNotFoundOnCard(word, `Error loading data: ${error.message}`);
  } finally {
    hideLoadingMessage();
    updateNavigationButtons();
    updateRememberButtonState();
    updateProgress();
  }
}

function resetCardView(wordForTitle) {
  flashcardElement.classList.remove("is-flipped");

  const frontContent = flashcardElement.querySelector(
    ".flashcard-front .flashcard-front-content"
  );
  const backContent = flashcardElement.querySelector(
    ".flashcard-back .flashcard-back-content"
  );
  if (frontContent) frontContent.style.display = "block"; // Ensure visible
  if (backContent) backContent.style.display = "block"; // Ensure visible (CSS handles actual show/hide via .is-flipped)

  flashcardWordFrontElement.textContent = wordForTitle || "...";
  flashcardPronunciationTextElement.textContent = "Loading...";
  flashcardPlayAudioBtnElement.style.display = "none";
  currentPronunciationAudioBasename = null;

  flashcardWordBackElement.textContent = wordForTitle || "...";
  flashcardHeadwordArabicElement.innerHTML = "<i>Translating...</i>";
  flashcardFunctionalLabelElement.textContent = "Loading...";
  flashcardDefinitionsListElement.innerHTML = "";
  flashcardSynonymsListElement.innerHTML = "";
  flashcardSynonymsAreaElement.style.display = "none";

  flashcardWordNotFoundAreaElement.style.display = "none";
  flashcardMwDetailsElement.style.display = "block";
}

function populateCardFront(word, processedData) {
  flashcardWordFrontElement.textContent = word;
  if (processedData && processedData.pronunciationText) {
    flashcardPronunciationTextElement.textContent =
      processedData.pronunciationText;
  } else {
    flashcardPronunciationTextElement.textContent = "N/A";
  }

  if (processedData && processedData.pronunciationAudioBasename) {
    currentPronunciationAudioBasename =
      processedData.pronunciationAudioBasename;
    flashcardPlayAudioBtnElement.style.display = "block";
    console.log(
      "[DEBUG] populateCardFront: Audio Basename SET to:",
      currentPronunciationAudioBasename,
      "for word:",
      word
    );
  } else {
    currentPronunciationAudioBasename = null;
    flashcardPlayAudioBtnElement.style.display = "none";
    console.log(
      "[DEBUG] populateCardFront: NO Audio Basename found for word:",
      word,
      "Processed Data:",
      processedData
    );
  }
}

function populateCardBack(word, processedData) {
  flashcardWordBackElement.textContent = word;
  flashcardMwDetailsElement.style.display = "block";
  flashcardWordNotFoundAreaElement.style.display = "none";

  flashcardFunctionalLabelElement.textContent =
    processedData.functionalLabel || "N/A";

  flashcardDefinitionsListElement.innerHTML = "";
  if (processedData.definitions && processedData.definitions.length > 0) {
    processedData.definitions.forEach((defItem) => {
      const dt = document.createElement("dt");
      const senseNumSpanHTML = defItem.senseNumber
        ? `<span class="sense-number">${defItem.senseNumber}</span>`
        : "";

      const defTextSpan = document.createElement("span");
      defTextSpan.innerHTML = senseNumSpanHTML + defItem.text;
      dt.appendChild(defTextSpan);

      const translateDefButton = createTranslateButton(
        defItem.text,
        defTextSpan
      );
      dt.appendChild(translateDefButton);
      flashcardDefinitionsListElement.appendChild(dt);

      // **** RE-ADDING EXAMPLES ****
      if (defItem.examples && defItem.examples.length > 0) {
        const ddExamples = document.createElement("dd");
        const ulExamples = document.createElement("ul");
        defItem.examples.forEach((ex) => {
          const liExample = document.createElement("li");
          const exTextSpan = document.createElement("span");
          exTextSpan.textContent = ex;
          liExample.appendChild(exTextSpan);

          const translateExButton = createTranslateButton(ex, exTextSpan);
          liExample.appendChild(translateExButton);
          ulExamples.appendChild(liExample);
        });
        ddExamples.appendChild(ulExamples);
        flashcardDefinitionsListElement.appendChild(ddExamples);
      }
    });
  } else {
    const p = document.createElement("p");
    p.textContent = "No definitions found by Merriam-Webster.";
    flashcardDefinitionsListElement.appendChild(p);
  }

  flashcardSynonymsListElement.innerHTML = "";
  if (processedData.synonyms && processedData.synonyms.length > 0) {
    flashcardSynonymsAreaElement.style.display = "block";
    processedData.synonyms.forEach((syn) => {
      const li = document.createElement("li");
      li.textContent = syn;
      flashcardSynonymsListElement.appendChild(li);
    });
  } else {
    flashcardSynonymsAreaElement.style.display = "none";
  }
}

function handleWordNotFoundOnCard(word, errorMessage) {
  console.warn(
    `Handling "Word Not Found" or error for "${word}": ${errorMessage}`
  );

  flashcardWordFrontElement.textContent = word;
  flashcardPronunciationTextElement.textContent = "Pronunciation not available";
  flashcardPlayAudioBtnElement.style.display = "none";
  currentPronunciationAudioBasename = null;

  flashcardWordBackElement.textContent = word;
  flashcardMwDetailsElement.style.display = "none";
  flashcardWordNotFoundAreaElement.style.display = "block";

  flashcardWordNotFoundAreaElement.innerHTML = `
    <p><i>${
      errorMessage || `Details for "${word}" were not found in the dictionary.`
    }</i></p>
    <p><em>This word is still available for study. You can look it up manually if needed.</em></p>
  `;
  // Headword translation is initiated in displayCard, its placeholder will show status.
}

// --- Merriam-Webster API Fetching & Processing ---
async function fetchAndProcessMwData(word) {
  if (MW_API_KEY === "YOUR_MW_API_KEY_HERE" || !MW_API_KEY) {
    console.error("MW API Key not configured.");
    return {
      error: true,
      errorMessage:
        "Merriam-Webster API Key not configured. Please update app.js.",
    };
  }

  const url = `https://dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(
    word
  )}?key=${MW_API_KEY}`;

  try {
    const response = await fetch(url, {
      mode: "cors",
      headers: {
        Accept: "application/json",
      },
    });
    const clonedResponseForText = response.clone();

    if (!response.ok) {
      let apiErrorDetails = `HTTP ${response.status}: ${response.statusText}`;
      try {
        apiErrorDetails = await response.text();
      } catch (e) {
        /* ignore */
      }
      console.error(`MW API error for "${word}": ${apiErrorDetails}`);
      return {
        error: true,
        errorMessage: `Dictionary API Error (${response.status}) for "${word}".`,
      };
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonError) {
      let rawText = "Could not read raw response.";
      try {
        rawText = await clonedResponseForText.text();
      } catch (e) {
        /*ignore*/
      }
      console.error(
        `Failed to parse MW JSON for "${word}":`,
        jsonError,
        "\nRaw Response:",
        rawText.substring(0, 500)
      );
      return {
        error: true,
        errorMessage: `Invalid data from Dictionary API for "${word}" (not JSON).`,
      };
    }

    if (
      !Array.isArray(data) ||
      data.length === 0 ||
      typeof data[0] === "string"
    ) {
      let suggestions = "";
      if (Array.isArray(data) && typeof data[0] === "string") {
        suggestions = ` Suggestions: ${data.slice(0, 3).join(", ")}...`;
      }
      console.warn(
        `No direct match or only suggestions from MW for "${word}".${suggestions}`
      );
      return {
        error: true,
        errorMessage: `Word "${word}" not found in dictionary.${suggestions}`,
      };
    }

    const firstResult = data[0];
    if (
      typeof firstResult !== "object" ||
      firstResult === null ||
      !firstResult.meta
    ) {
      console.warn(`Unexpected MW data structure for "${word}":`, firstResult);
      return {
        error: true,
        errorMessage: `Unexpected data structure from Dictionary API for "${word}".`,
      };
    }

    return processMwDataForDisplay(firstResult);
  } catch (networkError) {
    console.error(
      `Network error fetching MW data for "${word}":`,
      networkError
    );
    return {
      error: true,
      errorMessage: `Network error trying to reach dictionary for "${word}": ${networkError.message}`,
    };
  }
}

function processMwDataForDisplay(mwWordData) {
  const displayData = {
    functionalLabel: mwWordData.fl || "",
    pronunciationText: "",
    pronunciationAudioBasename: null,
    definitions: [],
    synonyms: [],
  };
  if (mwWordData.hwi?.prs && mwWordData.hwi.prs[0]) {
    const firstPron = mwWordData.hwi.prs[0];
    displayData.pronunciationText = firstPron.mw || "";
    if (firstPron.sound?.audio) {
      displayData.pronunciationAudioBasename = firstPron.sound.audio;
    }
  }
  if (mwWordData.def) {
    mwWordData.def.forEach((defSection) => {
      if (defSection.sseq) {
        defSection.sseq.forEach((sseqGroup) => {
          sseqGroup.forEach((sseqEntry) => {
            if (sseqEntry[0] === "sense") {
              const sense = sseqEntry[1];
              let currentDefText = "";
              const currentExamples = [];
              let senseNumber = sense.sn
                ? sense.sn.replace(/^\s*\d+\s*/, "")
                  ? sense.sn
                  : sense.sn.match(/^\d+/)
                  ? sense.sn.match(/^\d+/)[0]
                  : sense.sn
                : "";
              if (sense.dt) {
                sense.dt.forEach((dtItem) => {
                  if (dtItem[0] === "text") {
                    currentDefText +=
                      dtItem[1].replace(/{[^}]+}/g, "").trim() + " ";
                  } else if (dtItem[0] === "vis") {
                    // **** CAPTURE EXAMPLES ****
                    dtItem[1].forEach((visItem) => {
                      if (visItem.t) {
                        currentExamples.push(visItem.t.replace(/{[^}]+}/g, ""));
                      }
                    });
                  } else if (dtItem[0] === "sx") {
                    displayData.synonyms.push(
                      dtItem[1].replace(/{[^}]+}/g, "")
                    );
                  }
                });
              }
              if (currentDefText.trim()) {
                displayData.definitions.push({
                  text: currentDefText.trim(),
                  examples: currentExamples, // **** STORE EXAMPLES ****
                  senseNumber: senseNumber,
                });
              }
              if (sense.syns) {
                sense.syns.forEach((synEntry) => {
                  synEntry.pt.forEach((ptItem) => {
                    let synText = "";
                    if (Array.isArray(ptItem) && ptItem[0] === "text") {
                      synText = ptItem[1];
                    } else if (typeof ptItem === "string") {
                      synText = ptItem;
                    } else if (ptItem.wd) {
                      synText = ptItem.wd;
                    }
                    if (synText)
                      displayData.synonyms.push(
                        synText.replace(/{[^}]+}/g, "")
                      );
                  });
                });
              }
            }
          });
        });
      }
    });
  }
  displayData.synonyms = [...new Set(displayData.synonyms)];
  return displayData;
}

// --- MyMemory Translation API Logic ---
async function translateTextToArabic(textToTranslate) {
  if (
    !textToTranslate ||
    typeof textToTranslate !== "string" ||
    textToTranslate.trim() === ""
  ) {
    return null;
  }
  const sourceLang = "en";
  const targetLang = "ar";
  const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    textToTranslate
  )}&langpair=${sourceLang}|${targetLang}`;

  try {
    const response = await fetch(apiUrl, {
      mode: "cors",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      // Try to get more details from MyMemory error if possible
      let errorDetails = await response.text();
      errorDetails = errorDetails.substring(0, 200); // Keep it brief
      throw new Error(
        `MyMemory API error! Status: ${response.status} - ${errorDetails}`
      );
    }
    const data = await response.json();

    if (
      data.responseData &&
      data.responseData.translatedText &&
      data.responseData.translatedText.toLowerCase() !==
        "no translation found" &&
      data.responseData.translatedText.toLowerCase() !==
        "no translation found for this language pair" &&
      data.responseData.translatedText.trim() !== ""
    ) {
      // Check for empty string too
      return data.responseData.translatedText
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    } else if (
      data.responseStatus &&
      data.responseStatus !== 200 &&
      data.responseStatus !== 404
    ) {
      throw new Error(
        `MyMemory translation failed: ${
          data.responseDetails || "MyMemory API issue"
        }`
      );
    } else {
      console.warn(
        "No specific Arabic translation found by MyMemory for:",
        textToTranslate.substring(0, 50)
      );
      return null;
    }
  } catch (error) {
    console.error("MyMemory Translation error:", error);
    throw error;
  }
}

function createTranslateButton(englishText, englishTextSpanElement) {
  const button = document.createElement("button");
  button.className = "translate-btn";
  button.textContent = "Translate";
  button.title = "Translate this text to Arabic";

  englishTextSpanElement.dataset.originalText = englishText; // Store original for re-translation if needed

  button.addEventListener("click", async (event) => {
    event.stopPropagation();

    // Remove any existing translation span or status message for this item
    let nextSibling = englishTextSpanElement.nextElementSibling;
    while (
      nextSibling &&
      (nextSibling.classList.contains("arabic-translation") ||
        nextSibling.classList.contains("translation-status-inline"))
    ) {
      const toRemove = nextSibling;
      nextSibling = nextSibling.nextElementSibling;
      toRemove.remove();
    }

    button.textContent = "Translating...";
    button.disabled = true;

    const textToTranslate = englishTextSpanElement.dataset.originalText; // Use stored original

    try {
      const translatedText = await translateTextToArabic(textToTranslate);

      const translationSpan = document.createElement("span");
      translationSpan.className = "arabic-translation";
      translationSpan.setAttribute("dir", "rtl");
      translationSpan.setAttribute("lang", "ar");

      if (translatedText) {
        translationSpan.textContent = translatedText;
        button.textContent = "Translated";
        button.disabled = true; // Keep disabled once successfully translated
      } else {
        translationSpan.innerHTML = `<em class="translation-status">(No specific translation found)</em>`;
        button.textContent = "No Translation";
        // Allow re-try if no translation found
        setTimeout(() => {
          button.disabled = false;
          button.textContent = "Translate";
        }, 2000);
      }
      englishTextSpanElement.parentNode.insertBefore(
        translationSpan,
        englishTextSpanElement.nextSibling
      );
    } catch (error) {
      console.error("Inline Translation error:", error);
      const errorSpan = document.createElement("span");
      errorSpan.className = "arabic-translation"; // Re-use class for consistent spacing
      errorSpan.innerHTML = `<em class="translation-status" style="color:red;">(Translation failed)</em>`;
      englishTextSpanElement.parentNode.insertBefore(
        errorSpan,
        englishTextSpanElement.nextSibling
      );
      button.textContent = "Failed";
      // Allow re-try on failure
      setTimeout(() => {
        button.disabled = false;
        button.textContent = "Translate";
      }, 2000);
    }
  });
  return button;
}

// --- Audio Helper Functions (buildAudioUrl is essential) ---
function buildAudioUrl(audioBasename) {
  if (
    !audioBasename ||
    typeof audioBasename !== "string" ||
    audioBasename.trim() === ""
  ) {
    console.warn(
      "[DEBUG] buildAudioUrl: Invalid audioBasename provided:",
      audioBasename
    );
    return null;
  }
  let subdirectory;
  if (audioBasename.startsWith("bix")) {
    subdirectory = "bix";
  } else if (audioBasename.startsWith("gg")) {
    subdirectory = "gg";
  } else if (audioBasename.match(/^[a-zA-Z]/)) {
    subdirectory = audioBasename.charAt(0).toLowerCase();
  } else if (audioBasename.match(/^[0-9_]/)) {
    subdirectory = audioBasename.charAt(0);
    console.warn(
      `[DEBUG] buildAudioUrl: Basename "${audioBasename}" starts with non-alpha. Using first char '${subdirectory}' as subdirectory. Verify if this is correct for MW's structure.`
    );
  } else {
    subdirectory = audioBasename.charAt(0).toLowerCase();
    console.warn(
      `[DEBUG] buildAudioUrl: Basename "${audioBasename}" has an unexpected start. Using first char '${subdirectory}' as subdirectory.`
    );
  }
  return `https://media.merriam-webster.com/audio/prons/en/us/mp3/${subdirectory}/${audioBasename}.mp3`;
}

function playCurrentPronunciationAudio() {
  console.log(
    "[DEBUG] playCurrentPronunciationAudio: Called. Current Basename:",
    currentPronunciationAudioBasename
  );
  if (!currentPronunciationAudioBasename) {
    console.warn(
      "[DEBUG] playCurrentPronunciationAudio: No audio basename available to play."
    );
    return;
  }

  const audioUrl = buildAudioUrl(currentPronunciationAudioBasename);
  console.log(
    "[DEBUG] playCurrentPronunciationAudio: Constructed Audio URL:",
    audioUrl
  );

  if (audioUrl) {
    if (!globalPronunciationPlayer) {
      globalPronunciationPlayer = new Audio();
      console.log(
        "[DEBUG] playCurrentPronunciationAudio: New Audio object created."
      );
    }
    globalPronunciationPlayer.src = audioUrl;
    console.log(
      "[DEBUG] playCurrentPronunciationAudio: Attempting to play",
      audioUrl
    );
    globalPronunciationPlayer
      .play()
      .then(() => {
        console.log(
          "[DEBUG] playCurrentPronunciationAudio: Playback started for",
          audioUrl
        );
      })
      .catch((error) => {
        console.error(
          "[DEBUG] playCurrentPronunciationAudio: Error playing audio:",
          error,
          "URL:",
          audioUrl
        );
        // Don't show error message for audio failures as it's not critical
        // showErrorMessage(
        //   "Could not play audio. Check console (e.g., file not found, browser restrictions)."
        // );
      });
  } else {
    console.error(
      "[DEBUG] playCurrentPronunciationAudio: Could not build audio URL for basename:",
      currentPronunciationAudioBasename
    );
    showErrorMessage("Could not construct audio URL for pronunciation.");
  }
}

// --- Navigation and Interaction ---
function flipCard() {
  flashcardElement.classList.toggle("is-flipped");
}

async function nextCard() {
  if (currentCardIndex < flashcardWords.length - 1) {
    await displayCard(currentCardIndex + 1);
    if (currentPronunciationAudioBasename) {
      playCurrentPronunciationAudio();
    }
  }
}

async function prevCard() {
  if (currentCardIndex > 0) {
    await displayCard(currentCardIndex - 1);
  }
}

function updateNavigationButtons() {
  prevCardBtnElement.disabled = currentCardIndex === 0;
  nextCardBtnElement.disabled = currentCardIndex === flashcardWords.length - 1;
}

// --- Remember Functionality ---
function getRememberWords() {
  const saved = localStorage.getItem("flashcardApp_rememberWords");
  return saved ? JSON.parse(saved) : [];
}

function saveRememberWords() {
  localStorage.setItem(
    "flashcardApp_rememberWords",
    JSON.stringify(toRememberWords)
  );
}

function addWordToRemember(word) {
  if (!toRememberWords.includes(word)) {
    toRememberWords.push(word);
    saveRememberWords();
    console.log(`✅ Added "${word}" to remember list`);
    return true;
  }
  console.log(`⚠️ "${word}" is already in remember list`);
  return false;
}

function removeWordFromRemember(word) {
  const index = toRememberWords.indexOf(word);
  if (index > -1) {
    toRememberWords.splice(index, 1);
    saveRememberWords();
    console.log(`❌ Removed "${word}" from remember list`);
    return true;
  }
  return false;
}

function toggleRememberCurrentWord() {
  const currentWord = flashcardWords[currentCardIndex];
  if (!currentWord) return;

  const isInRememberList = toRememberWords.includes(currentWord);

  if (isInRememberList) {
    removeWordFromRemember(currentWord);
    rememberCardBtnElement.textContent = "To remember";
    rememberCardBtnElement.classList.remove("remembered");
  } else {
    addWordToRemember(currentWord);
    rememberCardBtnElement.textContent = "✓ Remembered";
    rememberCardBtnElement.classList.add("remembered");
  }

  updateRememberButtonState();
}

function updateRememberButtonState() {
  const currentWord = flashcardWords[currentCardIndex];
  const isInRememberList = toRememberWords.includes(currentWord);

  if (isInRememberList) {
    rememberCardBtnElement.textContent = "✓ Remembered";
    rememberCardBtnElement.classList.add("remembered");
  } else {
    rememberCardBtnElement.textContent = "To remember";
    rememberCardBtnElement.classList.remove("remembered");
  }
}

// --- Search Functionality ---
async function loadAllWordsForSearch() {
  const levels = ["A1", "A2", "B1", "B2", "B3", "C1", "words"];
  const allWords = new Map();

  for (const level of levels) {
    try {
      const filename = level === "words" ? "words.json" : `${level}.json`;
      const response = await fetch(filename);
      if (response.ok) {
        const words = await response.json();
        if (Array.isArray(words)) {
          words.forEach((word) => {
            if (typeof word === "string" && word.trim() !== "") {
              if (!allWords.has(word.toLowerCase())) {
                allWords.set(word.toLowerCase(), { word: word, level: level });
              }
            }
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to load ${level} for search:`, error);
    }
  }

  allWordsCache = allWords;
  console.log(`📚 Loaded ${allWords.size} words for search`);
  return allWords;
}

async function searchWord(searchTerm) {
  if (!searchTerm || searchTerm.trim() === "") {
    hideSearchResults();
    return;
  }

  searchTerm = searchTerm.trim().toLowerCase();

  if (allWordsCache.size === 0) {
    showLoadingMessage("Loading word database for search...");
    await loadAllWordsForSearch();
    hideLoadingMessage();
  }

  const results = [];

  // Exact match first
  if (allWordsCache.has(searchTerm)) {
    results.push(allWordsCache.get(searchTerm));
  }

  // Partial matches
  for (const [wordKey, wordData] of allWordsCache) {
    if (wordKey !== searchTerm && wordKey.includes(searchTerm)) {
      results.push(wordData);
    }
  }

  displaySearchResults(results, searchTerm);
}

function displaySearchResults(results, searchTerm) {
  if (results.length === 0) {
    searchResultsElement.innerHTML = `<div class="search-no-results">No words found for "${searchTerm}"</div>`;
    searchResultsElement.style.display = "block";
    return;
  }

  let html = `<div class="search-results-header">Found ${results.length} word(s) for "${searchTerm}":</div>`;

  results.slice(0, 10).forEach((result) => {
    // Limit to 10 results
    html += `
      <div class="search-result-item" data-word="${result.word}" data-level="${
      result.level
    }">
        <span class="search-result-word">${result.word}</span>
        <span class="search-result-level">${result.level.toUpperCase()}</span>
      </div>
    `;
  });

  if (results.length > 10) {
    html += `<div class="search-more-results">...and ${
      results.length - 10
    } more results</div>`;
  }

  searchResultsElement.innerHTML = html;
  searchResultsElement.style.display = "block";

  // Add click handlers to search results
  searchResultsElement
    .querySelectorAll(".search-result-item")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const word = item.dataset.word;
        const level = item.dataset.level;
        navigateToWord(word, level);
      });
    });
}

function hideSearchResults() {
  searchResultsElement.style.display = "none";
}

async function navigateToWord(word, level) {
  hideSearchResults();
  searchInputElement.value = "";

  try {
    // Load the level containing the word
    await loadWords(level);

    // Find the word index in the loaded words
    const wordIndex = flashcardWords.findIndex(
      (w) => w.toLowerCase() === word.toLowerCase()
    );

    if (wordIndex !== -1) {
      await displayCard(wordIndex);
      console.log(
        `🎯 Navigated to "${word}" in ${level.toUpperCase()} (position ${
          wordIndex + 1
        })`
      );
    } else {
      showErrorMessage(
        `Word "${word}" not found in ${level.toUpperCase()} level`
      );
    }
  } catch (error) {
    console.error("Error navigating to word:", error);
    showErrorMessage(`Failed to navigate to "${word}": ${error.message}`);
  }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  flashcardPlayAudioBtnElement.addEventListener("click", (event) => {
    event.stopPropagation();
    playCurrentPronunciationAudio();
  });

  flashcardElement.addEventListener("click", (event) => {
    if (event.target.tagName === "BUTTON" || event.target.closest("button")) {
      return;
    }
    flipCard();
  });
  nextCardBtnElement.addEventListener("click", nextCard);
  prevCardBtnElement.addEventListener("click", prevCard);

  // Add event listener for remember button
  if (rememberCardBtnElement) {
    rememberCardBtnElement.addEventListener("click", () => {
      toggleRememberCurrentWord();
    });
  }

  // Add event listeners for search functionality
  if (searchBtnElement) {
    searchBtnElement.addEventListener("click", () => {
      const searchTerm = searchInputElement.value.trim();
      searchWord(searchTerm);
    });
  }

  if (searchInputElement) {
    searchInputElement.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        const searchTerm = searchInputElement.value.trim();
        searchWord(searchTerm);
      }
    });

    // Hide search results when input is cleared
    searchInputElement.addEventListener("input", (event) => {
      if (event.target.value.trim() === "") {
        hideSearchResults();
      }
    });

    // Hide search results when clicking outside
    document.addEventListener("click", (event) => {
      if (!event.target.closest("#search-container")) {
        hideSearchResults();
      }
    });
  }

  const navButtons = document.querySelectorAll(".nav-btn");
  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const level = button.dataset.level;
      loadWords(level);
    });
  });

  // Add keyboard navigation
  document.addEventListener("keydown", (event) => {
    if (
      event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA"
    ) {
      return; // Don't interfere with input fields
    }

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        prevCard();
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        nextCard();
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        flipCard();
        break;
      case "p":
      case "P":
        event.preventDefault();
        if (currentPronunciationAudioBasename) {
          playCurrentPronunciationAudio();
        }
        break;
    }
  });
}

// --- Start the App ---
document.addEventListener("DOMContentLoaded", () => {
  console.log("🌟 DOM loaded, starting flashcard app...");
  initializeApp().catch((error) => {
    console.error("❌ Failed to initialize app:", error);
    showErrorMessage(`Failed to start the app: ${error.message}`);
  });
});
