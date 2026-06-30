const PASS_THRESHOLD = 0.70;
const EXAM_SIZE = 150;
const EXAM_TIME_LIMIT_MS = 3 * 60 * 60 * 1000;
const EXAM_SESSION_KEY = "ncsf-exam-session-v1";
const QUESTION_POOL_SIZE = EXAM_QUESTIONS.length;
const questionById = new Map(EXAM_QUESTIONS.map((q) => [q.id, q]));
let TOTAL_QUESTIONS = EXAM_SIZE;

let currentIndex = 0;
let answers = [];
let shuffledQuestions = [];
let examStartTime = null;
let timerIntervalId = null;

const screens = {
  start: document.getElementById("start-screen"),
  exam: document.getElementById("exam-screen"),
  results: document.getElementById("results-screen"),
  review: document.getElementById("review-screen"),
};

function showScreen(name) {
  Object.values(screens).forEach((s) => s.classList.remove("active"));
  screens[name].classList.add("active");
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isAllOfTheAboveOption(text) {
  return /^all\s+(of\s+)?the\s+above/i.test(String(text).trim());
}

/** Shuffle option indices but keep "all of the above" (and variants) last */
function shuffleOptionIndices(options) {
  const pinned = [];
  const rest = [];
  options.forEach((opt, i) => {
    if (isAllOfTheAboveOption(opt)) pinned.push(i);
    else rest.push(i);
  });
  return [...shuffleArray(rest), ...pinned];
}

function applyOptionOrder(q, optionOrder) {
  const options = optionOrder.map((i) => q.options[i]);
  const correctText = q.options[q.correctIndex];
  return {
    ...q,
    options,
    correctIndex: optionOrder.indexOf(q.correctIndex),
    correctText,
  };
}

/** Pick EXAM_SIZE questions from pool, shuffle order AND option order each attempt */
function prepareShuffledExam() {
  const pool = shuffleArray(EXAM_QUESTIONS);
  const selected = pool.slice(0, Math.min(EXAM_SIZE, pool.length));
  return selected.map((q) => {
    const optionOrder = shuffleOptionIndices(q.options);
    return { ...applyOptionOrder(q, optionOrder), optionOrder };
  });
}

function isExamSessionExpired(startTime) {
  return Date.now() - startTime >= EXAM_TIME_LIMIT_MS;
}

function serializeExamSession() {
  return {
    version: 1,
    examStartTime,
    currentIndex,
    answers,
    questions: shuffledQuestions.map((q) => ({
      id: q.id,
      optionOrder: q.optionOrder,
    })),
  };
}

function rebuildQuestionsFromSession(questions) {
  const rebuilt = [];
  for (const entry of questions) {
    const q = questionById.get(entry.id);
    if (!q || !Array.isArray(entry.optionOrder)) return null;
    if (
      entry.optionOrder.length !== q.options.length ||
      new Set(entry.optionOrder).size !== q.options.length
    ) {
      return null;
    }
    rebuilt.push({
      ...applyOptionOrder(q, entry.optionOrder),
      optionOrder: entry.optionOrder,
    });
  }
  return rebuilt;
}

function saveExamSession() {
  if (examStartTime === null || shuffledQuestions.length === 0) return;
  try {
    sessionStorage.setItem(
      EXAM_SESSION_KEY,
      JSON.stringify(serializeExamSession())
    );
  } catch {
    /* private browsing or quota exceeded */
  }
}

function clearExamSession() {
  try {
    sessionStorage.removeItem(EXAM_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function loadExamSession() {
  try {
    const raw = sessionStorage.getItem(EXAM_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (
      session?.version !== 1 ||
      typeof session.examStartTime !== "number" ||
      !Array.isArray(session.answers) ||
      !Array.isArray(session.questions) ||
      session.questions.length === 0
    ) {
      clearExamSession();
      return null;
    }
    return session;
  } catch {
    clearExamSession();
    return null;
  }
}

function applyExamSession(session) {
  const rebuilt = rebuildQuestionsFromSession(session.questions);
  if (!rebuilt) {
    clearExamSession();
    return false;
  }

  shuffledQuestions = rebuilt;
  TOTAL_QUESTIONS = shuffledQuestions.length;
  answers = session.answers.slice(0, TOTAL_QUESTIONS);
  while (answers.length < TOTAL_QUESTIONS) answers.push(null);
  currentIndex = Math.min(
    Math.max(0, session.currentIndex ?? 0),
    TOTAL_QUESTIONS - 1
  );
  examStartTime = session.examStartTime;
  return true;
}

function formatElapsed(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function stopExamTimer() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function resetExamClock() {
  stopExamTimer();
  examStartTime = null;
}

function updateTimerDisplay() {
  const timerEl = document.getElementById("exam-timer");
  if (!timerEl || examStartTime === null) return;

  const elapsed = Date.now() - examStartTime;
  timerEl.textContent = `${formatElapsed(elapsed)} / 03:00:00`;
  timerEl.classList.toggle("timer-warning", elapsed >= EXAM_TIME_LIMIT_MS - 15 * 60 * 1000 && elapsed < EXAM_TIME_LIMIT_MS);
  timerEl.classList.remove("timer-expired");

  if (elapsed >= EXAM_TIME_LIMIT_MS) {
    timerEl.classList.add("timer-expired");
    resetExamClock();
    submitExam({ timedOut: true });
  }
}

function resumeExamTimer(startTime) {
  stopExamTimer();
  examStartTime = startTime;
  updateTimerDisplay();
  timerIntervalId = setInterval(updateTimerDisplay, 1000);
}

function startExamTimer() {
  resumeExamTimer(Date.now());
}

function enterExamScreen() {
  showScreen("exam");
  resumeExamTimer(examStartTime);
  renderQuestion();
}

function startExam() {
  clearExamSession();
  resetExamClock();
  shuffledQuestions = prepareShuffledExam();
  TOTAL_QUESTIONS = shuffledQuestions.length;
  currentIndex = 0;
  answers = new Array(TOTAL_QUESTIONS).fill(null);
  examStartTime = Date.now();
  saveExamSession();
  enterExamScreen();
}

function restartExam({ askConfirm = true } = {}) {
  if (askConfirm) {
    const ok = window.confirm(
      "Restart the exam? Your current answers will be cleared and you'll get a new random set of 150 questions with a fresh 3-hour timer."
    );
    if (!ok) return;
  }

  closeMusclePopover();
  startExam();
}

function restoreExamSession() {
  const session = loadExamSession();
  if (!session) return false;

  if (isExamSessionExpired(session.examStartTime)) {
    if (!applyExamSession(session)) return false;
    resetExamClock();
    clearExamSession();
    showResults({ timedOut: true });
    return true;
  }

  if (!applyExamSession(session)) return false;
  enterExamScreen();
  return true;
}

function getQuestionDetail(q, userAnswer) {
  const isCorrect = userAnswer === q.correctIndex;
  return {
    question: q,
    userAnswer,
    isCorrect,
    userText:
      userAnswer !== null ? q.options[userAnswer] : "Not answered",
    correctText: q.correctText || q.options[q.correctIndex],
  };
}

function updateScoreTracker() {
  let correct = 0;
  let incorrect = 0;
  shuffledQuestions.forEach((q, i) => {
    if (answers[i] === null) return;
    if (answers[i] === q.correctIndex) correct++;
    else incorrect++;
  });
  document.getElementById("correct-count").textContent = correct;
  document.getElementById("incorrect-count").textContent = incorrect;
}

function applyOptionHighlighting(userAnswer) {
  const q = shuffledQuestions[currentIndex];
  const isCorrect = userAnswer === q.correctIndex;

  document.querySelectorAll(".option-btn").forEach((btn, i) => {
    btn.classList.remove("selected", "correct", "incorrect", "correct-answer");
    btn.disabled = true;

    if (isCorrect && i === userAnswer) {
      btn.classList.add("correct");
    } else if (!isCorrect) {
      if (i === q.correctIndex) btn.classList.add("correct-answer");
      if (i === userAnswer) btn.classList.add("incorrect");
    }
  });
}

function splitExplanationAndReference(q) {
  const marker = "NCSF Manual reference:";
  const full = q.explanation || "";
  const idx = full.indexOf(marker);
  const body = idx === -1 ? full : full.slice(0, idx).trim();
  const reference =
    q.manualReference || (idx === -1 ? "" : full.slice(idx).trim());
  return { body, reference };
}

function buildManualReferenceHtml(reference) {
  if (!reference) return "";
  const text = reference.replace(/^NCSF Manual reference:\s*/i, "");
  return `<div class="manual-reference"><strong>📖 NCSF Manual:</strong> ${escapeHtml(text)}</div>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

let muscleNameRegex = null;
let muscleAliasToId = null;
let activeMusclePopover = null;
let activeMuscleTerm = null;

/** Exercise/phrase names that contain muscle words but are not anatomy references */
const MUSCLE_LINK_BLOCKLIST = [
  "nordic hamstring curls",
  "nordic hamstrings",
  "nordic hamstring",
  "hamstring curls",
  "hamstring curl",
  "stability ball leg curls",
  "leg curls",
  "leg curl",
];

function getMuscleLinkBlockedRanges(text) {
  const lower = String(text).toLowerCase();
  const ranges = [];

  for (const phrase of MUSCLE_LINK_BLOCKLIST) {
    let start = 0;
    while (start < lower.length) {
      const idx = lower.indexOf(phrase, start);
      if (idx === -1) break;
      ranges.push([idx, idx + phrase.length]);
      start = idx + phrase.length;
    }
  }

  return ranges;
}

function isMuscleMatchBlocked(start, end, blockedRanges) {
  return blockedRanges.some(([blockStart, blockEnd]) => start < blockEnd && end > blockStart);
}

function initMuscleGlossary() {
  if (typeof MUSCLE_ALIAS_INDEX === "undefined" || !MUSCLE_ALIAS_INDEX.length) {
    return;
  }

  muscleAliasToId = new Map(
    MUSCLE_ALIAS_INDEX.map(({ alias, id }) => [alias.toLowerCase(), id])
  );
  const pattern = MUSCLE_ALIAS_INDEX.map(({ alias }) =>
    alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  ).join("|");
  muscleNameRegex = new RegExp(`\\b(${pattern})\\b`, "gi");
}

function formatTextWithMuscles(text, options = {}) {
  const { linkMuscles = true } = options;
  if (!linkMuscles || !muscleNameRegex || text == null || text === "") {
    return escapeHtml(text);
  }

  const blockedRanges = getMuscleLinkBlockedRanges(text);
  let html = "";
  let lastIndex = 0;
  const regex = new RegExp(muscleNameRegex.source, muscleNameRegex.flags);
  let match;

  while ((match = regex.exec(text)) !== null) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    const matched = match[0];
    const matchStart = match.index;
    const matchEnd = regex.lastIndex;
    const muscleId = muscleAliasToId.get(matched.toLowerCase());
    const entry = muscleId && MUSCLE_GLOSSARY[muscleId];
    const blocked = isMuscleMatchBlocked(matchStart, matchEnd, blockedRanges);

    if (entry?.image && !blocked) {
      html += `<span class="muscle-term" role="button" tabindex="0" data-muscle-id="${escapeHtml(muscleId)}" aria-label="Show ${escapeHtml(entry.label)} anatomy preview" aria-expanded="false">${escapeHtml(matched)}</span>`;
    } else {
      html += escapeHtml(matched);
    }

    lastIndex = matchEnd;
  }

  html += escapeHtml(text.slice(lastIndex));
  return html;
}

function closeMusclePopover() {
  if (activeMusclePopover) {
    activeMusclePopover.remove();
    activeMusclePopover = null;
  }
  if (activeMuscleTerm) {
    activeMuscleTerm.setAttribute("aria-expanded", "false");
    activeMuscleTerm = null;
  }
}

function positionMusclePopover(popover, anchor) {
  const margin = 8;
  const previewWidth = 156;
  const previewHeight = 176;
  const rect = anchor.getBoundingClientRect();
  let left = rect.left + rect.width / 2 - previewWidth / 2;
  let top = rect.top - previewHeight - margin;

  if (top < margin) {
    top = rect.bottom + margin;
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - previewWidth - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - previewHeight - margin));

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function showMusclePopover(muscleId, anchor) {
  const entry = MUSCLE_GLOSSARY[muscleId];
  if (!entry?.image) return;

  if (activeMuscleTerm === anchor && activeMusclePopover) {
    closeMusclePopover();
    return;
  }

  closeMusclePopover();

  const popover = document.createElement("div");
  popover.className = "muscle-preview";
  popover.setAttribute("role", "tooltip");
  popover.innerHTML = `<img src="${escapeHtml(entry.image)}" alt="${escapeHtml(entry.label)} anatomy" class="muscle-preview-image" width="140" height="140" loading="lazy"><span class="muscle-preview-label">${escapeHtml(entry.label)}</span>`;
  document.body.appendChild(popover);
  positionMusclePopover(popover, anchor);

  activeMusclePopover = popover;
  activeMuscleTerm = anchor;
  anchor.setAttribute("aria-expanded", "true");
}

function handleMuscleTermActivation(event) {
  const term = event.target.closest(".muscle-term");
  if (!term) return false;

  event.preventDefault();
  event.stopPropagation();
  showMusclePopover(term.dataset.muscleId, term);
  return true;
}

function buildQuestionImagesHtml(imagePaths) {
  if (!imagePaths?.length) return "";
  return `<div class="question-images">${imagePaths
    .map(
      (src) =>
        `<img src="${escapeHtml(src)}" alt="Question illustration" class="question-image" loading="lazy">`
    )
    .join("")}</div>`;
}

function renderQuestionContent(q) {
  const container = document.getElementById("question-content");
  container.innerHTML = `<p class="question-text">${formatTextWithMuscles(q.question)}</p>${buildQuestionImagesHtml(q.imagePaths)}`;
}

function buildImmediateFeedbackHtml(d) {
  const q = d.question;
  const { body, reference } = splitExplanationAndReference(q);
  let html = d.isCorrect
    ? `<p class="feedback-status correct">✓ Correct!</p>`
    : `<p class="feedback-status incorrect">✗ Incorrect</p>`;

  if (d.isCorrect) {
    html += `<p class="your-answer correct-choice"><strong>Your answer:</strong> ${formatTextWithMuscles(d.userText)} ✓</p>`;
  } else {
    html += `<p class="your-answer"><strong>Your answer:</strong> ${formatTextWithMuscles(d.userText)}</p>`;
    html += `<p class="correct-answer-block"><strong>Correct answer:</strong> ${formatTextWithMuscles(d.correctText)}</p>`;
  }

  html += `<div class="explanation"><strong>Why this is correct:</strong> ${formatTextWithMuscles(body, { linkMuscles: false })}</div>`;
  html += buildManualReferenceHtml(reference);

  return html;
}

function showAnswerFeedback(userAnswer) {
  const panel = document.getElementById("feedback-panel");
  const detail = getQuestionDetail(shuffledQuestions[currentIndex], userAnswer);

  applyOptionHighlighting(userAnswer);
  panel.classList.remove("hidden");
  panel.innerHTML = buildImmediateFeedbackHtml(detail);
}

function clearAnswerFeedback() {
  const panel = document.getElementById("feedback-panel");
  panel.classList.add("hidden");
  panel.innerHTML = "";
}

function renderQuestion() {
  const q = shuffledQuestions[currentIndex];
  const progress = ((currentIndex + 1) / TOTAL_QUESTIONS) * 100;
  const userAnswer = answers[currentIndex];

  document.getElementById("progress-bar").style.width = `${progress}%`;
  document.getElementById("question-counter").textContent =
    `Question ${currentIndex + 1} of ${TOTAL_QUESTIONS}`;
  renderQuestionContent(q);

  const optionsList = document.getElementById("options-list");
  optionsList.innerHTML = "";

  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "option-btn";
    btn.type = "button";

    const label = document.createElement("span");
    label.className = "option-label";
    label.innerHTML = `${String.fromCharCode(65 + i)}. ${formatTextWithMuscles(opt)}`;
    btn.appendChild(label);

    const optImg = q.optionImages?.[opt];
    if (optImg) {
      const img = document.createElement("img");
      img.src = optImg;
      img.alt = `Option ${String.fromCharCode(65 + i)} illustration`;
      img.className = "option-image";
      img.loading = "lazy";
      btn.appendChild(img);
    }

    btn.addEventListener("click", (event) => {
      if (handleMuscleTermActivation(event)) return;
      selectOption(i);
    });
    optionsList.appendChild(btn);
  });

  if (userAnswer !== null) {
    showAnswerFeedback(userAnswer);
  } else {
    clearAnswerFeedback();
  }

  updateScoreTracker();

  document.getElementById("prev-btn").disabled = currentIndex === 0;
  document.getElementById("next-btn").textContent =
    currentIndex === TOTAL_QUESTIONS - 1 ? "Submit Exam" : "Next →";
}

function selectOption(index) {
  answers[currentIndex] = index;
  showAnswerFeedback(index);
  updateScoreTracker();
  saveExamSession();
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
    saveExamSession();
  }
}

function nextQuestion() {
  if (answers[currentIndex] === null) {
    if (!confirm("You haven't answered this question. Continue anyway?")) return;
  }
  if (currentIndex < TOTAL_QUESTIONS - 1) {
    currentIndex++;
    renderQuestion();
    saveExamSession();
  } else {
    submitExam();
  }
}

function submitExam(options = {}) {
  const { timedOut = false } = options;

  if (!timedOut) {
    const unanswered = answers.filter((a) => a === null).length;
    if (unanswered > 0) {
      if (
        !confirm(
          `You have ${unanswered} unanswered question(s). Submit anyway?`
        )
      )
        return;
    }
  }

  resetExamClock();
  clearExamSession();
  showResults({ timedOut });
}

function calculateScore() {
  let correct = 0;
  const details = shuffledQuestions.map((q, i) => {
    const detail = getQuestionDetail(q, answers[i]);
    if (detail.isCorrect) correct++;
    return detail;
  });
  return {
    correct,
    total: TOTAL_QUESTIONS,
    percent: correct / TOTAL_QUESTIONS,
    details,
  };
}

function showResults(options = {}) {
  const { timedOut = false } = options;
  const { correct, total, percent, details } = calculateScore();
  const passed = percent >= PASS_THRESHOLD;
  const required = Math.ceil(total * PASS_THRESHOLD);
  const unanswered = answers.filter((a) => a === null).length;

  showScreen("results");

  const circle = document.getElementById("score-circle");
  circle.className = `score-circle ${passed ? "pass" : "fail"}`;
  document.getElementById("score-percent").textContent =
    `${Math.round(percent * 100)}%`;
  document.getElementById("score-fraction").textContent =
    `${correct} / ${total} correct`;

  const status = document.getElementById("result-status");
  status.className = `result-status ${passed ? "pass" : "fail"}`;
  status.textContent = passed
    ? "PASSED — You met the 70% requirement!"
    : "NOT PASSED — You need 70% to pass.";

  let summary;
  if (timedOut) {
    const unansweredNote =
      unanswered === 0
        ? "You answered every question before time ran out."
        : `You did not answer ${unanswered} question${unanswered === 1 ? "" : "s"}.`;
    summary = `Your 3-hour exam session has ended. ${unansweredNote} `;
    summary += passed
      ? `You scored ${Math.round(percent * 100)}% and met the 70% passing requirement.`
      : `You scored ${Math.round(percent * 100)}%. You needed ${required} correct answers (70%). Review the detailed explanations below.`;
  } else {
    summary = passed
      ? `Congratulations! You scored ${Math.round(percent * 100)}%, exceeding the NCSF passing threshold of 70%.`
      : `You scored ${Math.round(percent * 100)}%. You needed ${required} correct answers (70%). Review the detailed explanations below.`;
  }

  document.getElementById("result-summary").textContent = summary;

  window.examDetails = details;
}

function buildReviewHtml(d) {
  const q = d.question;
  const { body, reference } = splitExplanationAndReference(q);
  let html = `<h3>Q${q.id}: ${formatTextWithMuscles(q.question)}</h3>`;
  html += buildQuestionImagesHtml(q.imagePaths);

  html += `<p class="correct-answer-block"><strong>Correct answer:</strong> ${formatTextWithMuscles(d.correctText)}</p>`;

  if (!d.isCorrect) {
    html += `<p class="your-answer"><strong>Your answer:</strong> ${formatTextWithMuscles(d.userText)}</p>`;
  } else {
    html += `<p class="your-answer correct-choice"><strong>Your answer:</strong> ${formatTextWithMuscles(d.userText)} ✓</p>`;
  }

  html += `<div class="explanation"><strong>Why this is correct:</strong> ${formatTextWithMuscles(body, { linkMuscles: false })}</div>`;
  html += buildManualReferenceHtml(reference);

  return html;
}

function showReview(filter = "wrong") {
  showScreen("review");
  const details = window.examDetails;
  const container = document.getElementById("review-list");
  container.innerHTML = "";

  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === filter);
  });

  const filtered =
    filter === "wrong"
      ? details.filter((d) => !d.isCorrect)
      : filter === "correct"
        ? details.filter((d) => d.isCorrect)
        : details;

  filtered.forEach((d) => {
    const item = document.createElement("div");
    item.className = `review-item ${d.isCorrect ? "correct-item" : "incorrect-item"}`;
    item.innerHTML = buildReviewHtml(d);
    container.appendChild(item);
  });

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="color: var(--text-muted); text-align: center;">No questions match this filter.</p>';
  }
}

document.getElementById("start-btn").addEventListener("click", startExam);
document.getElementById("prev-btn").addEventListener("click", prevQuestion);
document.getElementById("next-btn").addEventListener("click", nextQuestion);
document.getElementById("review-btn").addEventListener("click", () =>
  showReview("wrong")
);
document.getElementById("review-all-btn").addEventListener("click", () =>
  showReview("all")
);
document.getElementById("review-correct-btn").addEventListener("click", () =>
  showReview("correct")
);
document.getElementById("restart-btn").addEventListener("click", () =>
  restartExam({ askConfirm: true })
);
document.getElementById("retake-btn").addEventListener("click", () =>
  restartExam({ askConfirm: false })
);
document.getElementById("back-results-btn").addEventListener("click", () => {
  showScreen("results");
});

document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => showReview(tab.dataset.filter));
});

document.addEventListener("click", (event) => {
  if (handleMuscleTermActivation(event)) return;
  if (!event.target.closest(".muscle-preview")) {
    closeMusclePopover();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMusclePopover();
    return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const term = event.target.closest(".muscle-term");
  if (!term) return;
  event.preventDefault();
  showMusclePopover(term.dataset.muscleId, term);
});

window.addEventListener(
  "resize",
  () => {
    if (activeMusclePopover && activeMuscleTerm) {
      positionMusclePopover(activeMusclePopover, activeMuscleTerm);
    }
  },
  { passive: true }
);

function initApp() {
  initMuscleGlossary();
  document.querySelectorAll("[data-pool-size]").forEach((el) => {
    el.textContent = String(QUESTION_POOL_SIZE);
  });
  restoreExamSession();
}

initApp();