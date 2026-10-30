const STORAGE_KEY = "enjudgeSceneFlashcards.v1";
const SCENES = [
  { id: "restaurant", name: "餐廳", description: "點餐、選飲料，練習在餐桌旁會用到的句子。" },
  { id: "airport", name: "機場", description: "從護照到登機門，一起準備開心的旅程。" },
  { id: "campus", name: "校園", description: "在教室和操場上，和同學老師自然地說英文。" },
  { id: "shopping", name: "購物", description: "挑選喜歡的東西，練習詢問尺寸和價錢。" },
  { id: "clinic", name: "就醫", description: "用簡單英文告訴醫生哪裡不舒服。" },
  { id: "feelings", name: "心情與感受", description: "用簡單英文說說自己的心情、感覺和外表。" }
];

const elements = {
  sceneSelect: document.querySelector("#scene-select"),
  sceneTitle: document.querySelector("#scene-title"),
  sceneDescription: document.querySelector("#scene-description"),
  card: document.querySelector("#flashcard"),
  cardScene: document.querySelector("#card-scene-label"),
  cardPosition: document.querySelector("#card-position"),
  cardSentence: document.querySelector("#card-sentence"),
  cardTranslation: document.querySelector("#card-translation"),
  cardKeywords: document.querySelector("#card-keywords"),
  cardExtension: document.querySelector("#card-extension"),
  cardFront: document.querySelector(".card-front"),
  cardBack: document.querySelector(".card-back"),
  masteredCount: document.querySelector("#mastered-count"),
  remainingCount: document.querySelector("#remaining-count"),
  progressCount: document.querySelector("#scene-progress-count"),
  progressBar: document.querySelector(".progress-track"),
  progressValue: document.querySelector(".progress-value"),
  unmasteredOnly: document.querySelector("#unmastered-only"),
  masteryButton: document.querySelector("#mastery-button"),
  masteryLabel: document.querySelector("#mastery-button span"),
  previousButton: document.querySelector("#previous-button"),
  nextButton: document.querySelector("#next-button"),
  speakButton: document.querySelector("#speak-button"),
  shuffleButton: document.querySelector("#shuffle-button"),
  modeButtons: [...document.querySelectorAll("[data-mode]")],
  selfTestPrompt: document.querySelector("#self-test-prompt"),
  feedback: document.querySelector("#feedback"),
  emptyState: document.querySelector("#empty-state"),
  errorMessage: document.querySelector("#error-message"),
  studyHeading: document.querySelector(".study-heading"),
  studyToolbar: document.querySelector(".study-toolbar"),
  cardActions: document.querySelector(".card-actions"),
  cardNavigation: document.querySelector(".card-navigation")
};

let progressReadError = null;
const state = {
  sceneId: SCENES[0].id,
  scene: null,
  cards: [],
  deck: [],
  index: 0,
  masteredByScene: readProgress(),
  mode: "browse",
  isFlipped: false,
  filterUnmastered: false
};

function readProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};
    const progress = JSON.parse(saved);
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) {
      throw new Error("閃卡進度資料格式不正確。");
    }
    return progress;
  } catch (error) {
    progressReadError = `無法讀取學習進度：${error.message}`;
    showError(progressReadError);
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.masteredByScene));
    progressReadError = null;
    elements.errorMessage.hidden = true;
  } catch (error) {
    showError(`無法儲存學習進度：${error.message}`);
  }
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.hidden = false;
}

function getMasteredSet() {
  const saved = state.masteredByScene[state.sceneId];
  return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === "string") : []);
}

function renderSceneOptions() {
  elements.sceneSelect.replaceChildren(...SCENES.map((scene) => {
    const option = document.createElement("option");
    option.value = scene.id;
    option.textContent = scene.name;
    return option;
  }));
}

async function loadScene(sceneId) {
  const scene = SCENES.find((item) => item.id === sceneId);
  if (!scene) {
    showError("找不到這個場景，請重新選擇。");
    return;
  }

  elements.sceneSelect.disabled = true;
  if (!progressReadError) elements.errorMessage.hidden = true;
  try {
    const response = await fetch(new URL(`./scenes/${scene.id}.json`, import.meta.url));
    if (!response.ok) throw new Error(`載入失敗（${response.status}）`);
    const data = await response.json();
    if (data.id !== scene.id || !Array.isArray(data.cards) || data.cards.length === 0) {
      throw new Error("場景詞庫格式不正確或沒有閃卡。");
    }

    state.sceneId = scene.id;
    state.scene = { ...scene, ...data };
    state.cards = data.cards;
    state.index = 0;
    state.isFlipped = false;
    state.filterUnmastered = elements.unmasteredOnly.checked;
    elements.sceneSelect.value = scene.id;
    elements.sceneTitle.textContent = scene.name;
    elements.sceneDescription.textContent = scene.description;
    elements.sceneSelect.disabled = false;
    if (progressReadError) showError(progressReadError);
    render();
  } catch (error) {
    elements.sceneSelect.disabled = false;
    showError(`場景詞庫載入失敗：${error.message}。請確認使用網站網址開啟，並重新整理頁面。`);
  }
}

function getDeck() {
  const mastered = getMasteredSet();
  return state.cards.filter((card) => !state.filterUnmastered || !mastered.has(card.id));
}

function renderProgress() {
  const masteredCount = state.cards.filter((card) => getMasteredSet().has(card.id)).length;
  const remainingCount = state.cards.length - masteredCount;
  const percentage = state.cards.length ? Math.round((masteredCount / state.cards.length) * 100) : 0;
  elements.masteredCount.textContent = String(masteredCount);
  elements.remainingCount.textContent = String(remainingCount);
  elements.progressCount.textContent = `${masteredCount} / ${state.cards.length} 張已掌握`;
  elements.progressValue.style.transform = `scaleX(${percentage / 100})`;
  elements.progressBar.setAttribute("aria-valuenow", String(percentage));
}

function renderCard() {
  const card = state.deck[state.index];
  if (!card) return;
  const isMastered = getMasteredSet().has(card.id);
  elements.cardScene.textContent = state.scene.name;
  elements.cardPosition.textContent = `${state.index + 1} / ${state.deck.length}`;
  elements.cardSentence.textContent = card.sentence;
  elements.cardTranslation.textContent = card.translation;
  elements.cardExtension.textContent = card.extension;
  elements.cardKeywords.replaceChildren(...card.keywords.map((keyword) => {
    const chip = document.createElement("span");
    chip.className = "keyword-chip";
    const word = document.createElement("span");
    word.className = "keyword-word";
    word.textContent = keyword.word;
    const details = document.createElement("span");
    details.className = "keyword-details";
    details.textContent = `${keyword.ipa} · ${keyword.meaning}`;
    chip.append(word, details);
    return chip;
  }));

  elements.cardFront.hidden = state.isFlipped;
  elements.cardBack.hidden = !state.isFlipped;
  elements.card.setAttribute("aria-label", `${state.scene.name}，${card.sentence}，${state.isFlipped ? "答案面" : "英文面"}，按 Enter 或空白鍵翻面`);
  elements.masteryButton.classList.toggle("is-mastered", isMastered);
  elements.masteryButton.setAttribute("aria-pressed", String(isMastered));
  elements.masteryLabel.textContent = isMastered ? "已掌握" : "我已掌握";
  elements.previousButton.disabled = state.index === 0;
  elements.nextButton.disabled = state.index >= state.deck.length - 1;
  elements.feedback.textContent = "";
  elements.selfTestPrompt.hidden = state.mode !== "quiz" || state.isFlipped;
}

function render() {
  state.deck = getDeck();
  if (state.index >= state.deck.length) state.index = Math.max(0, state.deck.length - 1);
  renderProgress();
  const hasCards = state.deck.length > 0;
  elements.emptyState.hidden = hasCards;
  for (const element of [elements.card, elements.cardActions, elements.cardNavigation]) {
    element.hidden = !hasCards;
  }
  if (hasCards) renderCard();
}

function flipCard() {
  if (state.deck.length === 0) return;
  state.isFlipped = !state.isFlipped;
  renderCard();
}

function moveCard(direction) {
  const nextIndex = state.index + direction;
  if (nextIndex < 0 || nextIndex >= state.deck.length) return;
  state.index = nextIndex;
  state.isFlipped = false;
  renderCard();
}

function toggleMastered() {
  const card = state.deck[state.index];
  if (!card) return;
  const mastered = getMasteredSet();
  if (mastered.has(card.id)) {
    mastered.delete(card.id);
    elements.feedback.textContent = "已移回待練習，準備好時再挑戰一次！";
  } else {
    mastered.add(card.id);
    elements.feedback.textContent = "太棒了！這張卡已加入已掌握。";
  }
  state.masteredByScene[state.sceneId] = [...mastered];
  saveProgress();
  const currentId = card.id;
  render();
  elements.feedback.textContent = mastered.has(currentId)
    ? "太棒了！這張卡已加入已掌握。"
    : "已移回待練習，準備好時再挑戰一次！";
  if (state.filterUnmastered && !mastered.has(currentId) && state.deck.length) {
    const currentIndex = state.deck.findIndex((item) => item.id === currentId);
    state.index = currentIndex < 0 ? Math.min(state.index, state.deck.length - 1) : currentIndex;
    renderCard();
  }
}

function shuffleCards() {
  for (let index = state.deck.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [state.deck[index], state.deck[randomIndex]] = [state.deck[randomIndex], state.deck[index]];
  }
  state.index = 0;
  state.isFlipped = false;
  renderCard();
}

function speakSentence() {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
    showError("這個瀏覽器目前不支援英文朗讀，請改用較新的瀏覽器。");
    return;
  }
  const card = state.deck[state.index];
  if (!card) return;
  const utterance = new SpeechSynthesisUtterance(card.sentence);
  utterance.lang = "en-US";
  utterance.rate = 0.88;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function setMode(mode) {
  state.mode = mode;
  state.isFlipped = false;
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderCard();
}

elements.sceneSelect.addEventListener("change", () => loadScene(elements.sceneSelect.value));
elements.card.addEventListener("click", (event) => {
  if (event.target.closest("button")) return;
  flipCard();
});
elements.card.addEventListener("keydown", (event) => {
  if (event.target !== elements.card || (event.key !== "Enter" && event.key !== " ")) return;
  event.preventDefault();
  flipCard();
});
elements.previousButton.addEventListener("click", () => moveCard(-1));
elements.nextButton.addEventListener("click", () => moveCard(1));
elements.masteryButton.addEventListener("click", toggleMastered);
elements.speakButton.addEventListener("click", speakSentence);
elements.shuffleButton.addEventListener("click", shuffleCards);
elements.unmasteredOnly.addEventListener("change", () => {
  state.filterUnmastered = elements.unmasteredOnly.checked;
  state.index = 0;
  state.isFlipped = false;
  render();
});
elements.modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.mode)));

renderSceneOptions();
loadScene(state.sceneId);
