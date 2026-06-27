const PASS_THRESHOLD = 0.70;
const EXAM_SIZE = 150;
const QUESTION_POOL_SIZE = EXAM_QUESTIONS.length;
let TOTAL_QUESTIONS = EXAM_SIZE;

let currentIndex = 0;
let answers = [];
let shuffledQuestions = [];

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

/** Shuffle options but keep "all of the above" (and variants) last */
function shuffleOptions(options) {
  const pinned = options.filter(isAllOfTheAboveOption);
  const rest = options.filter((opt) => !isAllOfTheAboveOption(opt));
  return [...shuffleArray(rest), ...pinned];
}

/** Pick EXAM_SIZE questions from pool, shuffle order AND option order each attempt */
function prepareShuffledExam() {
  const pool = shuffleArray(EXAM_QUESTIONS);
  const selected = pool.slice(0, Math.min(EXAM_SIZE, pool.length));
  return selected.map((q) => {
    const correctText = q.options[q.correctIndex];
    const options = shuffleOptions(q.options);
    return {
      ...q,
      options,
      correctIndex: options.indexOf(correctText),
      correctText,
    };
  });
}

function startExam() {
  shuffledQuestions = prepareShuffledExam();
  TOTAL_QUESTIONS = shuffledQuestions.length;
  currentIndex = 0;
  answers = new Array(TOTAL_QUESTIONS).fill(null);
  showScreen("exam");
  renderQuestion();
}

function getQuestionDetail(q, userAnswer) {
  const isCorrect = userAnswer === q.correctIndex;
  const wrongOptions = q.options
    .map((opt, idx) => ({ opt, idx }))
    .filter(({ idx }) => idx !== q.correctIndex)
    .map(({ opt }) => opt);
  return {
    question: q,
    userAnswer,
    isCorrect,
    userText:
      userAnswer !== null ? q.options[userAnswer] : "Not answered",
    correctText: q.correctText || q.options[q.correctIndex],
    wrongOptions,
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

function getDistractorsExplanation(q, correctText) {
  if (q.distractorsExplanation) {
    return q.distractorsExplanation;
  }
  if (q.wrongExplanations && typeof q.wrongExplanations === "object") {
    const parts = Object.values(q.wrongExplanations).filter(Boolean);
    if (parts.length) return parts.join(" ");
  }
  return `The other options do not apply — ${correctText} is the keyed answer.`;
}

function buildDistractorsHtml(q, correctText) {
  const expl = getDistractorsExplanation(q, correctText);
  if (!expl) return "";
  return `<div class="wrong-options"><strong>Why the other options are incorrect:</strong><p class="wrong-options-text">${expl}</p></div>`;
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

  if (d.wrongOptions.length) {
    html += buildDistractorsHtml(q, d.correctText);
  }

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
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

function nextQuestion() {
  if (answers[currentIndex] === null) {
    if (!confirm("You haven't answered this question. Continue anyway?")) return;
  }
  if (currentIndex < TOTAL_QUESTIONS - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    submitExam();
  }
}

function submitExam() {
  const unanswered = answers.filter((a) => a === null).length;
  if (unanswered > 0) {
    if (
      !confirm(
        `You have ${unanswered} unanswered question(s). Submit anyway?`
      )
    )
      return;
  }
  showResults();
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

function showResults() {
  const { correct, total, percent, details } = calculateScore();
  const passed = percent >= PASS_THRESHOLD;
  const required = Math.ceil(total * PASS_THRESHOLD);

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

  document.getElementById("result-summary").textContent = passed
    ? `Congratulations! You scored ${Math.round(percent * 100)}%, exceeding the NCSF passing threshold of 70%.`
    : `You scored ${Math.round(percent * 100)}%. You needed ${required} correct answers (70%). Review the detailed explanations below.`;

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

  if (d.wrongOptions.length) {
    html += buildDistractorsHtml(q, d.correctText);
  }

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
  showScreen("start");
});
document.getElementById("back-results-btn").addEventListener("click", () => {
  showScreen("results");
});

document.querySelectorAll(".filter-tab").forEach((tab) => {
  tab.addEventListener("click", () => showReview(tab.dataset.filter));
});

document.querySelectorAll("[data-pool-size]").forEach((el) => {
  el.textContent = String(QUESTION_POOL_SIZE);
});