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
  return `<div class="manual-reference"><strong>📖 NCSF Manual:</strong> ${reference.replace(/^NCSF Manual reference:\s*/i, "")}</div>`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
  container.innerHTML = `<p class="question-text">${escapeHtml(q.question)}</p>${buildQuestionImagesHtml(q.imagePaths)}`;
}

function buildImmediateFeedbackHtml(d) {
  if (d.isCorrect) {
    return `<p class="feedback-status correct">✓ Correct!</p>`;
  }

  const q = d.question;
  const { body, reference } = splitExplanationAndReference(q);
  let html = `<p class="feedback-status incorrect">✗ Incorrect</p>`;
  html += `<p class="your-answer"><strong>Your answer:</strong> ${d.userText}</p>`;
  html += `<p class="correct-answer-block"><strong>Correct answer:</strong> ${d.correctText}</p>`;
  html += `<div class="explanation"><strong>Why this is correct:</strong> ${body}</div>`;
  html += buildManualReferenceHtml(reference);

  return html;
}

function showAnswerFeedback(userAnswer) {
  const panel = document.getElementById("feedback-panel");
  const detail = getQuestionDetail(shuffledQuestions[currentIndex], userAnswer);

  applyOptionHighlighting(userAnswer);

  if (detail.isCorrect) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
  } else {
    panel.classList.remove("hidden");
    panel.innerHTML = buildImmediateFeedbackHtml(detail);
  }
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
    label.textContent = `${String.fromCharCode(65 + i)}. ${opt}`;
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

    btn.addEventListener("click", () => selectOption(i));
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
  let html = `<h3>Q${q.id}: ${escapeHtml(q.question)}</h3>`;
  html += buildQuestionImagesHtml(q.imagePaths);

  html += `<p class="correct-answer-block"><strong>Correct answer:</strong> ${d.correctText}</p>`;

  if (!d.isCorrect) {
    html += `<p class="your-answer"><strong>Your answer:</strong> ${d.userText}</p>`;
  } else {
    html += `<p class="your-answer correct-choice"><strong>Your answer:</strong> ${d.userText} ✓</p>`;
  }

  html += `<div class="explanation"><strong>Why this is correct:</strong> ${body}</div>`;
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
document.getElementById("retake-btn").addEventListener("click", () => {
  resetExamClock();
  clearExamSession();
  showScreen("start");
});
document.getElementById("back-results-btn").addEventListener("click", () => {
  showScreen("results");
});

document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => showReview(tab.dataset.filter));
});

function initApp() {
  document.querySelectorAll("[data-pool-size]").forEach((el) => {
    el.textContent = String(QUESTION_POOL_SIZE);
  });
  restoreExamSession();
}

initApp();