/* Smoke test for the Ultraman rescue game logic in index.html (run: node test-rescue.mjs) */
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("./index.html", import.meta.url), "utf-8");
const scriptSrc = html.match(/<script>([\s\S]*)<\/script>/)[1];
const quizData = JSON.parse(fs.readFileSync(new URL("./quiz-data-enjudge.json", import.meta.url), "utf-8"));
quizData.wordJudge.forEach((question) => { question.isMatch = true; });
const rescueQuestionsSource = scriptSrc.match(/const rescueQuestions = (\[[\s\S]*?\]);/)[1];
const rescueQuestions = vm.runInNewContext(rescueQuestionsSource);
const imageChoices = rescueQuestions.flatMap((question) => question.kind === "image" ? question.choices : []);
const imageChoiceLabelsMatch = imageChoices.every((choice) =>
  choice.illustration === choice.text.toLowerCase() && !("img" in choice)
);

/* ---------- minimal DOM stubs ---------- */
const els = new Map();
const makeEl = (id = "") => {
  const el = {
    id, hidden: false, disabled: false, textContent: "", className: "", innerHTML: "",
      src: "", alt: "", value: "", tabIndex: -1, dataset: {}, attrs: {}, children: [], offsetWidth: 100,
    style: { transform: "", display: "", setProperty() {} },
    listeners: {},
    classList: {
      _set: new Set(),
      add(...c) { c.forEach((x) => this._set.add(x)); },
      remove(...c) { c.forEach((x) => this._set.delete(x)); },
      toggle(c, f) { const on = f === undefined ? !this._set.has(c) : f; on ? this._set.add(c) : this._set.delete(c); return on; },
      contains(c) { return this._set.has(c); }
    },
    addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); },
    removeEventListener() {},
    focus() { this.focused = true; },
    appendChild(c) { this.children.push(c); return c; },
    append(...c) { this.children.push(...c); },
    replaceChildren(...c) { this.children = [...c]; },
    querySelectorAll(sel) {
      const cls = sel.replace(/^\./, "");
      return this.children.filter((ch) => String(ch.className).split(/\s+/).includes(cls));
    },
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; },
    getAttribute(k) { return this.attrs[k]; },
    click() { (this.listeners.click || []).forEach((fn) => fn({})); },
    remove() {}
  };
  return el;
};
const $ = (id) => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };

const tabs = ["wordJudge", "sentenceQA", "rescueGame"].map((t) => {
  const el = makeEl(); el.className = "quiz-tab"; el.dataset.quizType = t; return el;
});
const answerButtons = ["true", "false"].map((answer) => {
  const el = makeEl(); el.dataset.answer = answer; return el;
});
const tabOf = (t) => tabs.find((x) => x.dataset.quizType === t);

const document_ = {
  getElementById: $,
  createElement: () => makeEl(),
  querySelectorAll(sel) {
    if (sel === ".quiz-tab") return tabs;
    if (sel === "[data-answer]") return answerButtons;
    return [];
  }
};

const store = new Map();
const localStorage_ = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k)
};

const realSetTimeout = setTimeout;
const spokenTexts = [];
const cantoneseVoice = { name: "Cantonese Test Voice", lang: "yue-HK" };
const sandbox = {
  console,
  Date, Math, JSON, Number, String, Array, Boolean, Object, Promise, Error, isNaN, parseInt, parseFloat,
  SpeechSynthesisUtterance: class {
    constructor(text) { this.text = text; }
  },
  document: document_,
  localStorage: localStorage_,
  fetch: async () => ({ ok: true, status: 200, json: async () => quizData })
};
sandbox.window = {
  // clamp game delays so the test runs fast
  setTimeout: (fn, ms) => realSetTimeout(fn, Math.min(ms || 0, 5)),
  clearTimeout: (t) => clearTimeout(t),
  SpeechSynthesisUtterance: null,
  speechSynthesis: {
    speaking: false,
    getVoices: () => [cantoneseVoice],
    cancel() { this.speaking = false; },
    speak(utterance) { spokenTexts.push(utterance.text); this.speaking = false; }
  },
  alert: () => {}, prompt: () => null,
  location: { reload: () => {} }
  // no speechSynthesis / SpeechSynthesisUtterance → speak() takes the unsupported path
};
sandbox.window.SpeechSynthesisUtterance = sandbox.SpeechSynthesisUtterance;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const sleep = (ms) => new Promise((r) => realSetTimeout(r, ms));
let failures = 0;
let renderedImageChoiceCount = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ✅ ${name}`);
  else { failures += 1; console.log(`  ❌ ${name} ${extra}`); }
};
const progress = () => JSON.parse(store.get("ultramanRescueProgress") || "null");
const todayKey = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const view = () => ["lock", "play", "win"].find((v) => !$(`rescue-game-${v}`).hidden) || "none";

// answer the current question, retrying wrong picks; waits for the advance timer
const answerCurrent = async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const grid = $("game-choice-grid");
    for (const child of [...grid.children]) {
      if (String(child.innerHTML).includes("<svg")) {
        const svg = child.innerHTML.match(/<svg\b[^>]*aria-hidden="true"/);
        const label = child.innerHTML.match(/game-choice-image-tag">([^<]+)</);
        if (svg && label && !String(child.innerHTML).includes("<img")) renderedImageChoiceCount += 1;
      }
      child.click();
      $("game-next-button").click();
      if ($("game-feedback").textContent.startsWith("答對了")) { await sleep(60); return true; }
    }
  }
  return false;
};

const enterRescue = async () => { tabOf("rescueGame").click(); await sleep(30); };

console.log("— boot —");
check("all image-choice labels match their SVG objects", imageChoiceLabelsMatch && imageChoices.length === 45);
vm.runInContext(scriptSrc, sandbox, { filename: "index.html-inline.js" });
await sleep(80);
check("quiz screen shown after load", $("quiz-state").hidden === false);
check("rescue screen hidden initially", $("rescue-game-state").hidden === true);
check("second storybook starts locked with the requested hint",
  $("storybook-book2-button").disabled === true
    && $("storybook-book2-note").textContent === "答对 10 题解锁这本绘本");

console.log("— unlock and read storybook 2 —");
store.set("enJudgeRightCount", "9");
answerButtons.find((button) => button.dataset.answer === "true").click();
await sleep(20);
check("second storybook unlocks after the tenth correct answer",
  store.get("storybookBook2Unlocked") === "true" && $("storybook-book2-button").disabled === false);
$("storybook-book2-button").click();
check("second book opens as a dialog on page 1",
  $("storybook-state").hidden === false
    && $("storybook-state").attrs.role === "dialog"
    && $("storybook-progress").textContent === "第 1 / 5 頁");
check("page 1 image and Cantonese narration are loaded",
  $("storybook-image").src === "asset/storybook/book2-page1.jpeg"
    && $("storybook-narration").textContent === "小熊在公园里，遇见了一只迷路的小狗。"
    && spokenTexts.at(-1) === $("storybook-narration").textContent
    && $("previous-page-button").disabled);
const speechCountBeforeReplay = spokenTexts.length;
$("storybook-image").click();
check("tapping the page illustration replays its narration", spokenTexts.length === speechCountBeforeReplay + 1);
const expectedStoryPages = [
  ["asset/storybook/book2-page2.png", "小熊轻轻地照顾它，给它水和好吃的。"],
  ["asset/storybook/book2-page3.png", "小熊牵着小狗，一起寻找它的主人。"],
  ["asset/storybook/book2-page4.svg", "主人终于来了，小狗高兴地摇尾巴。"],
  ["asset/storybook/book2-page4.png", "从那天起，小熊和小狗成了最好的朋友。"]
];
for (const [imagePath, narration] of expectedStoryPages) {
  $("next-page-button").click();
  check(`story page ${$("storybook-progress").textContent} loads its image and voice`,
    $("storybook-image").src === imagePath
      && $("storybook-narration").textContent === narration
      && spokenTexts.at(-1) === narration);
}
check("page 5 offers an enabled close action",
  $("next-page-button").disabled === false && $("next-page-button").textContent.includes("關閉"));
$("next-page-button").click();
check("closing from page 5 returns to the previous screen",
  $("storybook-state").hidden === true && $("quiz-state").hidden === false);

console.log("— enter rescue game —");
await enterRescue();
check("rescue screen shown", $("rescue-game-state").hidden === false);
check("play view visible", view() === "play");
check("3 choices rendered", $("game-choice-grid").children.length === 3);
check("next button starts disabled", $("game-next-button").disabled === true);
check("HUD shows 0/5", $("game-round-count").textContent === "挑戰 0/5");

console.log("— first correct answer —");
check("answered correctly", await answerCurrent());
let p = progress();
check("progress saved (dayChallenges=1, fragments=1)", p && p.dayChallenges === 1 && p.fragments === 1, JSON.stringify(p));
check("rescue-01 completed", p.completedQuestionIds.includes("rescue-01"));
check("next question rendered", view() === "play" && $("game-round-count").textContent === "挑戰 1/5");

console.log("— finish day 1 (5 challenges) —");
for (let i = 0; i < 4; i += 1) check(`answer ${i + 2} ok`, await answerCurrent());
p = progress();
check("dayChallenges=5, fragments=5", p.dayChallenges === 5 && p.fragments === 5, JSON.stringify(p));
check("lock view after daily limit", view() === "lock");

console.log("— exit back to quiz —");
$("rescue-back-button").click();
await sleep(20);
check("quiz screen shown", $("quiz-state").hidden === false && $("rescue-game-state").hidden === true);
await enterRescue();
check("re-entry shows lock (limit persisted)", view() === "lock");
$("rescue-back-button").click();
await sleep(10);

console.log("— day 2 (date rollover) —");
p = progress(); p.date = "2000-01-01"; store.set("ultramanRescueProgress", JSON.stringify(p));
await enterRescue();
check("play view on new day", view() === "play");
check("dayChallenges reset to 0", $("game-round-count").textContent === "挑戰 0/5");
check("question rescue-06 served", $("game-speech").children.length === 3);
for (let i = 0; i < 5; i += 1) check(`day2 answer ${i + 1} ok`, await answerCurrent());
p = progress();
check("sticker earned (stickers=1, fragments=0)", p.stickers === 1 && p.fragments === 0, JSON.stringify(p));
check("win view shown", view() === "win");
check("win title 拯救成功", $("rescue-win-title").textContent === "拯救成功！");
check("roster has 3 chips", $("rescue-roster").children.length === 3);
check("continue button non-final", $("rescue-continue-button").dataset.final === "0");

console.log("— continue after win with day exhausted → lock —");
$("rescue-continue-button").click();
await sleep(20);
check("lock view", view() === "lock");

console.log("— mid-day sticker: continue must resume play, not lock (bug #2) —");
$("rescue-back-button").click(); await sleep(10);
p = progress(); p.date = todayKey(); p.dayChallenges = 0; p.fragments = 9; store.set("ultramanRescueProgress", JSON.stringify(p));
await enterRescue();
check("play view", view() === "play");
check("answered", await answerCurrent());
p = progress();
check("sticker 2 earned", p.stickers === 2 && p.fragments === 0, JSON.stringify(p));
check("win view", view() === "win");
$("rescue-continue-button").click();
await sleep(30);
check("continue resumes play (dayChallenges=1 < 5)", view() === "play", `view=${view()}`);
check("rendered image choices use inline SVG instead of asset images", renderedImageChoiceCount > 0, `count=${renderedImageChoiceCount}`);

console.log("— entry normalisation: fragments>=target awards sticker (bug #4) —");
$("rescue-back-button").click(); await sleep(10);
p = progress(); p.fragments = 10; store.set("ultramanRescueProgress", JSON.stringify(p));
await enterRescue();
p = progress();
check("sticker 3 awarded on entry", p.stickers === 3 && p.fragments === 0, JSON.stringify(p));
check("final win shown (stickers=RESCUE_TOTAL)", view() === "win" && $("rescue-win-title").textContent === "全部拯救成功！");
check("continue button is replay", $("rescue-continue-button").dataset.final === "1");

console.log("— replay from final win —");
$("rescue-continue-button").click();
await sleep(30);
p = progress();
check("progress reset", p && p.stickers === 0 && p.dayChallenges === 0, JSON.stringify(p));
check("play view with fresh question", view() === "play");

console.log("— storybook round-trip returns to rescue —");
store.set("storybookUnlocked", "true");
$("storybook-button").click();
await sleep(20);
check("storybook shown", $("storybook-state").hidden === false);
$("back-button").click();
await sleep(30);
check("back returns to rescue", $("rescue-game-state").hidden === false && view() === "play");

console.log("— quiz tab still works after rescue —");
$("rescue-back-button").click(); await sleep(10);
tabOf("sentenceQA").click(); await sleep(30);
check("sentenceQA round started", $("quiz-state").hidden === false && $("sentence-quiz-card").hidden === false);

console.log(failures === 0 ? "\n🎉 ALL CHECKS PASSED" : `\n💥 ${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
