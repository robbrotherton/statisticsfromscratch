(function () {
  const STORAGE_KEYS = {
    latestResponses: "statisticsfromscratch.quizResponses",
    events: "statisticsfromscratch.quizEvents",
  };

  const QUESTION_TYPES = {
    freeResponse: "free-response",
    multipleChoice: "multiple-choice",
    trueFalse: "true-false",
    numeric: "numeric",
  };

  const EVENTS = {
    checkAnswer: "check_answer",
    checkDiagnostic: "check_diagnostic",
    submitResponse: "submit_response",
    showExplanation: "show_explanation",
    showDiagnosticExplanation: "show_diagnostic_explanation",
    showDiagnostics: "show_diagnostics",
    showHint: "show_hint",
    hideHint: "hide_hint",
    hideExplanation: "hide_explanation",
  };

  const LATEST_RESPONSE_EVENTS = new Set([
    EVENTS.checkAnswer,
    EVENTS.checkDiagnostic,
    EVENTS.submitResponse,
  ]);

  function questionType(question) {
    return question.type === "free" ? QUESTION_TYPES.freeResponse : question.type;
  }

  function loadJson(key, fallback) {
    try {
      return JSON.parse(window.localStorage.getItem(key)) || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function saveLatestResponse(id, payload) {
    const responses = loadJson(STORAGE_KEYS.latestResponses, {});
    responses[id] = payload;
    window.localStorage.setItem(STORAGE_KEYS.latestResponses, JSON.stringify(responses));
  }

  function loadLatestResponse(id) {
    const responses = loadJson(STORAGE_KEYS.latestResponses, {});
    return responses[id] || null;
  }

  function clearLatestResponse(id) {
    const responses = loadJson(STORAGE_KEYS.latestResponses, {});
    delete responses[id];
    window.localStorage.setItem(STORAGE_KEYS.latestResponses, JSON.stringify(responses));
  }

  function saveEvent(payload) {
    const events = loadJson(STORAGE_KEYS.events, []);
    events.push(payload);
    window.localStorage.setItem(STORAGE_KEYS.events, JSON.stringify(events.slice(-500)));
  }

  function backendUrl() {
    return document.documentElement.dataset.quizBackendUrl || window.quizBackendUrl || "";
  }

  function track(payload) {
    const event = {
      ...payload,
      page: window.location.pathname,
      happenedAt: new Date().toISOString(),
    };

    saveEvent(event);

    if (LATEST_RESPONSE_EVENTS.has(event.event)) {
      saveLatestResponse(`${event.quizId}:${event.questionId}`, event);
    }

    const url = backendUrl();
    if (!url) return;

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      // Local storage remains the proof-of-concept fallback if the backend is unavailable.
    });
  }

  function normalizeText(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
  }

  function parseNumber(value) {
    const cleaned = String(value ?? "").trim().replace(/,/g, "");
    if (!cleaned) return NaN;
    return Number(cleaned);
  }

  function typeset(element) {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([element]).catch(() => {});
    }
  }

  function exposeRichContent(element) {
    if (window.interactiveRuntime &&
        typeof window.interactiveRuntime.mountWithin === "function") {
      window.interactiveRuntime.mountWithin(element);
    }
    typeset(element);
  }

  function mergeQuizCrossrefLabel(section) {
    if (section.dataset.quizCrossrefMerged === "true") return;

    const figure = section.closest("figure.quarto-float-quiz");
    if (!figure) return;

    const caption = Array.from(figure.children).find(
      (child) => child.matches("figcaption.quarto-float-caption")
    );
    const titleContainer = section.querySelector(
      ":scope > .callout-header .callout-caption-container"
    );
    if (!caption || !titleContainer) return;

    const captionText = normalizeText(caption.textContent);
    const titleText = normalizeText(titleContainer.textContent);
    if (!captionText) return;

    // An explicitly captioned wrapper may repeat the YAML title after the
    // generated label. Keep the YAML title as the single source of truth and
    // take only the numbered prefix from Quarto's caption.
    let label = captionText;
    if (titleText && label.endsWith(titleText)) {
      label = label.slice(0, -titleText.length).replace(/[\s:;,.\-–—]+$/, "");
    } else {
      const delimiter = label.indexOf(":");
      if (delimiter >= 0) label = label.slice(0, delimiter);
    }
    label = normalizeText(label);
    if (!label) return;

    const title = titleContainer.firstElementChild || titleContainer;
    const prefix = document.createElement("span");
    prefix.className = "quiz-crossref-label";
    prefix.textContent = `${label}:`;
    title.prepend(document.createTextNode(" "));
    title.prepend(prefix);

    // Keep the real figcaption in the accessibility tree and as the target of
    // Quarto's aria-describedby, but remove the duplicate visual caption.
    caption.classList.add("visually-hidden");
    section.setAttribute("aria-label", titleText ? `${label}: ${titleText}` : label);
    section.dataset.quizCrossrefMerged = "true";
  }

  // A question may name a value published by an interactive figure on the page
  // instead of carrying a fixed answer, so that a reader working from their own
  // numbers is graded against their own numbers. The path is the same
  // figureId.path addressing that interactive-value and $value refs use.
  function expectedAnswer(question) {
    const path = normalizeText(question.answerFrom);
    if (!path) return question.answer;

    const runtime = window.interactiveRuntime;
    return runtime && typeof runtime.getValue === "function"
      ? runtime.getValue(path)
      : undefined;
  }

  function plainAnswer(question) {
    const answer = expectedAnswer(question);
    if (answer === undefined || answer === null) return "";
    return String(answer);
  }

  function gradeQuestion(question, response) {
    const type = questionType(question);

    if (type === QUESTION_TYPES.freeResponse) return null;

    if (type === QUESTION_TYPES.multipleChoice) {
      const option = question.options && question.options[Number(response)];
      return option ? option.correct === true : false;
    }

    if (type === QUESTION_TYPES.trueFalse) {
      return normalizeText(response) === normalizeText(question.answer);
    }

    if (type === QUESTION_TYPES.numeric) {
      // A numeric question with no answer to compare against — none was given,
      // or the figure it reads from has no value yet — is a way of collecting a
      // number rather than grading one, so it is saved the way a free response
      // is.
      const expected = parseNumber(expectedAnswer(question));
      if (!Number.isFinite(expected)) return null;
      const observed = parseNumber(response);
      const tolerance = parseNumber(question.tolerance || 0);
      return Number.isFinite(observed) && Math.abs(observed - expected) <= tolerance;
    }

    return null;
  }

  function numericBound(question, key) {
    const value = parseNumber(question[key]);
    return Number.isFinite(value) ? value : null;
  }

  // Numeric questions may name the range they accept. A response outside it is
  // a mis-entry rather than a wrong answer, so it is refused before grading.
  function outOfRangeMessage(question, response) {
    if (questionType(question) !== QUESTION_TYPES.numeric) return "";
    const min = numericBound(question, "min");
    const max = numericBound(question, "max");
    if (min === null && max === null) return "";

    const observed = parseNumber(response);
    const within = Number.isFinite(observed) &&
      (min === null || observed >= min) &&
      (max === null || observed <= max);
    if (within) return "";

    if (min !== null && max !== null) return `Enter a number between ${min} and ${max}.`;
    if (min !== null) return `Enter a number of ${min} or more.`;
    return `Enter a number of ${max} or less.`;
  }

  function findInputByValue(wrapper, value) {
    return Array.from(wrapper.querySelectorAll("input")).find(
      (input) => input.value === String(value)
    ) || null;
  }

  function choiceControl(wrapper) {
    wrapper.querySelectorAll(".quiz-choice").forEach((choice) => {
      choice.addEventListener("click", (event) => {
        if (event.target.closest(
          "input, a, button, textarea, select, [role='button'], [data-interactive-figure]"
        )) return;
        const input = choice.querySelector("input[type='radio']");
        if (!input || input.disabled) return;
        input.checked = true;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });

    return {
      element: wrapper,
      getValue: () => {
        const selected = wrapper.querySelector("input:checked");
        return selected ? selected.value : "";
      },
      setValue: (value) => {
        const input = findInputByValue(wrapper, value);
        if (input) input.checked = true;
      },
      clear: () => {
        wrapper.querySelectorAll("input").forEach((input) => {
          input.checked = false;
        });
      },
      markTried: (value) => {
        const input = findInputByValue(wrapper, value);
        if (!input) return;
        input.checked = false;
        input.disabled = true;
        input.closest(".quiz-choice").classList.add("is-tried");
      },
      clearTried: () => {
        wrapper.querySelectorAll("input").forEach((input) => {
          input.disabled = false;
        });
        wrapper.querySelectorAll(".quiz-choice.is-tried").forEach((choice) => {
          choice.classList.remove("is-tried");
        });
      },
    };
  }

  function questionControl(item, question) {
    const wrapper = item.querySelector(":scope > .quiz-control");
    const type = questionType(question);
    if (!wrapper) throw new Error(`Missing control for question ${question.id}`);

    if (type === QUESTION_TYPES.multipleChoice || type === QUESTION_TYPES.trueFalse) {
      return choiceControl(wrapper);
    }

    const input = wrapper.querySelector(type === QUESTION_TYPES.numeric ? "input" : "textarea");
    if (!input) throw new Error(`Missing input for question ${question.id}`);

    if (type === QUESTION_TYPES.numeric) {
      const status = wrapper.querySelector(".quiz-input-status");
      return {
        element: wrapper,
        getValue: () => input.value,
        setValue: (value) => {
          input.value = value === undefined || value === null ? "" : String(value);
        },
        setStatus: (correct) => {
          if (!status) return;
          status.textContent = correct === true
            ? "Correct ✓"
            : correct === false ? "Incorrect ×" : "";
        },
        clear: () => {
          input.value = "";
        },
      };
    }

    return {
      element: wrapper,
      getValue: () => input.value,
      setValue: (value) => {
        input.value = value === undefined || value === null ? "" : String(value);
      },
      clear: () => {
        input.value = "";
      },
    };
  }

  function stateLabel(isCorrect) {
    if (isCorrect === true) return "Correct.";
    if (isCorrect === false) return "Incorrect.";
    return "Response saved.";
  }

  function stateFromCorrect(correct) {
    if (correct === true) return "correct";
    if (correct === false) return "incorrect";
    return "neutral";
  }

  function directQuestion(container, questionId) {
    return Array.from(container.children).find(
      (child) => child.classList.contains("quiz-question") &&
        child.dataset.questionId === questionId
    ) || null;
  }

  function hydrateQuestion({ quiz, question, item, diagnostic = false }) {
    if (!item || item.dataset.quizHydrated === "true") return item;
    item.dataset.quizHydrated = "true";

    const control = questionControl(item, question);
    const actions = item.querySelector(":scope > .quiz-actions");
    const feedback = item.querySelector(":scope > .quiz-feedback");
    const feedbackLabel = feedback.querySelector("[data-quiz-feedback-label]");
    const hintsPanel = item.querySelector(":scope > .quiz-hints-panel");
    const explanationPanel = item.querySelector(":scope > .quiz-explanation-panel");
    const diagnosticsPanel = item.querySelector(":scope > .quiz-diagnostics");
    const check = actions.querySelector("[data-quiz-action='check']");
    const hint = actions.querySelector("[data-quiz-action='hint']");
    const reveal = actions.querySelector("[data-quiz-action='reveal']");
    const diagnosticsBtn = actions.querySelector("[data-quiz-action='diagnostics']");
    const clear = actions.querySelector("[data-quiz-action='clear']");
    const hintItems = Array.from(hintsPanel.querySelectorAll(":scope > .quiz-hint"));
    const checkLabel = normalizeText(question.checkLabel) || "Check answer";
    const hasExplanation = Boolean(
      explanationPanel.querySelector(".quiz-explanation-rendered")
    );
    const hasModelAnswer = Boolean(
      explanationPanel.querySelector(".quiz-model-answer")
    );
    const hasAnswerOrExplanation = explanationPanel.children.length > 0;
    const hasDiagnostics = Array.isArray(question.diagnostics) &&
      question.diagnostics.length > 0;
    const responseKey = `${quiz.id}:${question.id}`;
    let lastGraded = null;
    let hintsRevealed = 0;

    actions.hidden = false;
    check.textContent = checkLabel;
    hint.hidden = hintItems.length === 0;
    hint.setAttribute("aria-expanded", "false");
    reveal.hidden = true;
    reveal.setAttribute("aria-expanded", "false");
    if (diagnosticsBtn) diagnosticsBtn.hidden = true;
    clear.hidden = true;

    function notifyStateChange() {
      item.dispatchEvent(new CustomEvent("quiz-state-change", { bubbles: true }));
    }

    function setPrimary(mode) {
      if (mode === "hidden") {
        check.hidden = true;
        return;
      }
      check.hidden = false;
      check.textContent = mode === "retry" ? "Try again" : checkLabel;
      check.classList.toggle("quiz-retry", mode === "retry");
    }

    function updateRevealButton() {
      const state = item.dataset.quizState;
      if (!state) {
        reveal.hidden = true;
        reveal.setAttribute("aria-expanded", "false");
        return;
      }

      if (!explanationPanel.hidden) {
        reveal.hidden = false;
        reveal.textContent = state === "correct" || !hasModelAnswer
          ? "Hide explanation"
          : "Hide answer";
        reveal.setAttribute("aria-expanded", "true");
        return;
      }

      reveal.setAttribute("aria-expanded", "false");
      if (state === "correct") {
        reveal.hidden = !hasExplanation;
        reveal.textContent = "Show explanation";
      } else {
        reveal.hidden = !hasAnswerOrExplanation;
        reveal.textContent = hasModelAnswer ? "Show answer" : "Show explanation";
      }
    }

    function openExplanation() {
      explanationPanel.hidden = false;
      exposeRichContent(explanationPanel);
      updateRevealButton();
    }

    function closeExplanation() {
      explanationPanel.hidden = true;
      updateRevealButton();
    }

    function renderHints() {
      hintItems.forEach((entry, index) => {
        entry.hidden = index >= hintsRevealed;
      });
      hintsPanel.hidden = hintsRevealed === 0;
      if (!hintsPanel.hidden) exposeRichContent(hintsPanel);
    }

    function updateHintButton() {
      if (!hintItems.length) return;
      const plural = hintItems.length > 1;
      if (!hintsPanel.hidden) {
        hint.textContent = hintsRevealed < hintItems.length
          ? "Another hint"
          : plural ? "Hide hints" : "Hide hint";
      } else {
        hint.textContent = hintsRevealed > 0 && plural ? "Show hints" : "Show hint";
      }
      hint.setAttribute("aria-expanded", String(!hintsPanel.hidden));
    }

    function resetHintsState() {
      hintsRevealed = 0;
      hintsPanel.hidden = true;
      hintItems.forEach((entry) => {
        entry.hidden = true;
      });
      updateHintButton();
    }

    function showDiagnostics() {
      if (!hasDiagnostics) return;
      diagnosticsPanel.hidden = false;
      exposeRichContent(diagnosticsPanel);
      track({
        event: EVENTS.showDiagnostics,
        quizId: quiz.id,
        questionId: question.id,
      });
    }

    function applyState(correct, { autoReveal = false } = {}) {
      const state = stateFromCorrect(correct);
      item.dataset.quizState = state;
      feedback.className = `quiz-feedback is-${state}`;
      feedbackLabel.textContent = stateLabel(correct);
      feedback.hidden = false;
      if (control.setStatus) control.setStatus(correct);
      setPrimary(correct === false ? "retry" : "hidden");
      clear.hidden = false;

      if (diagnosticsBtn) {
        diagnosticsBtn.hidden = !(correct === false && hasDiagnostics);
      }
      if (correct !== false) {
        diagnosticsPanel.hidden = true;
      }

      if (autoReveal && hasAnswerOrExplanation) {
        openExplanation();
      } else {
        updateRevealButton();
      }
      notifyStateChange();
    }

    function clearQuestionState({ markTried = true } = {}) {
      if (markTried && lastGraded && lastGraded.correct === false &&
          control.markTried && normalizeText(lastGraded.response) !== "") {
        control.markTried(lastGraded.response);
      }
      lastGraded = null;
      feedbackLabel.textContent = "";
      feedback.className = "quiz-feedback";
      feedback.hidden = true;
      if (control.setStatus) control.setStatus(null);
      setPrimary("ready");
      clear.hidden = true;
      diagnosticsPanel.hidden = true;
      if (diagnosticsBtn) diagnosticsBtn.hidden = true;
      delete item.dataset.quizState;
      closeExplanation();
      notifyStateChange();
    }

    function restoreSavedResponse() {
      const saved = loadLatestResponse(responseKey);
      if (!saved) return;

      control.setValue(saved.response);
      lastGraded = { response: saved.response, correct: saved.correct };
      applyState(saved.correct);
    }

    function handleResponseChange() {
      if (!item.dataset.quizState) return;
      if (lastGraded && control.getValue() === lastGraded.response) return;
      clearQuestionState();
      clearLatestResponse(responseKey);
    }

    control.element.addEventListener("input", handleResponseChange);
    control.element.addEventListener("change", handleResponseChange);

    control.element.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      if (event.target.tagName === "TEXTAREA" && !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      if (!check.hidden) check.click();
    });

    check.addEventListener("click", () => {
      if (item.dataset.quizState === "incorrect") {
        clearQuestionState();
        const input = control.element.querySelector("input[type='text'], textarea");
        if (input) input.focus();
        return;
      }

      const response = control.getValue();
      const refusal = normalizeText(response) === ""
        ? "Enter a response first."
        : outOfRangeMessage(question, response);
      if (refusal) {
        feedbackLabel.textContent = refusal;
        feedback.hidden = false;
        const input = control.element.querySelector("input[type='text'], textarea");
        if (input) input.focus();
        return;
      }

      const isCorrect = gradeQuestion(question, response);
      lastGraded = { response, correct: isCorrect };
      applyState(isCorrect, { autoReveal: isCorrect === null });

      track({
        event: diagnostic
          ? EVENTS.checkDiagnostic
          : isCorrect === null ? EVENTS.submitResponse : EVENTS.checkAnswer,
        quizId: quiz.id,
        questionId: question.id,
        type: questionType(question),
        response,
        correct: isCorrect,
        answer: plainAnswer(question),
      });
    });

    clear.addEventListener("click", () => {
      control.clear();
      if (control.clearTried) control.clearTried();
      clearQuestionState({ markTried: false });
      resetHintsState();
      clearLatestResponse(responseKey);
    });

    hint.addEventListener("click", () => {
      if (!hintsPanel.hidden && hintsRevealed >= hintItems.length) {
        hintsPanel.hidden = true;
        updateHintButton();
        track({ event: EVENTS.hideHint, quizId: quiz.id, questionId: question.id });
        return;
      }

      if (hintsPanel.hidden && hintsRevealed > 0) {
        hintsPanel.hidden = false;
        exposeRichContent(hintsPanel);
      } else {
        hintsRevealed = Math.min(hintsRevealed + 1, hintItems.length);
        renderHints();
      }
      updateHintButton();
      track({
        event: EVENTS.showHint,
        quizId: quiz.id,
        questionId: question.id,
        hintsRevealed,
      });
    });

    reveal.addEventListener("click", () => {
      const wasHidden = explanationPanel.hidden;
      if (wasHidden) {
        openExplanation();
      } else {
        closeExplanation();
      }

      track({
        event: wasHidden
          ? (diagnostic ? EVENTS.showDiagnosticExplanation : EVENTS.showExplanation)
          : EVENTS.hideExplanation,
        quizId: quiz.id,
        questionId: question.id,
      });
    });

    if (diagnosticsBtn) {
      diagnosticsBtn.addEventListener("click", () => {
        diagnosticsBtn.hidden = true;
        showDiagnostics();
      });
    }

    if (hasDiagnostics) {
      question.diagnostics.forEach((diagnosticQuestion) => {
        const diagnosticItem = directQuestion(diagnosticsPanel, diagnosticQuestion.id);
        hydrateQuestion({
          quiz,
          question: diagnosticQuestion,
          item: diagnosticItem,
          diagnostic: true,
        });
      });
    }

    restoreSavedResponse();
    return item;
  }

  function hydrateQuiz(section, quiz) {
    if (section.dataset.quizEnhanced === "true") return;

    const body = section.querySelector(":scope > .callout-body");
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
    if (!body) throw new Error(`Missing quiz body for ${quiz.id}`);

    questions.forEach((question) => {
      hydrateQuestion({
        quiz,
        question,
        item: directQuestion(body, question.id),
      });
    });

    const progress = section.querySelector(":scope > .callout-header .quiz-progress");
    if (progress) {
      const progressLabel = progress.querySelector("[data-quiz-progress-label]");
      const progressIcon = progress.querySelector(".bi");
      progress.hidden = false;

      function updateProgress() {
        const items = Array.from(body.children).filter(
          (child) => child.classList.contains("quiz-question")
        );
        const done = items.filter((entry) =>
          entry.dataset.quizState === "correct" ||
          entry.dataset.quizState === "neutral"
        ).length;
        const complete = done === items.length;
        progress.classList.toggle("is-complete", complete);
        progressIcon.hidden = !complete;
        progressLabel.textContent = `${done} of ${items.length}`;
        progress.setAttribute(
          "aria-label",
          `${done} of ${items.length} questions answered`
        );
      }

      section.addEventListener("quiz-state-change", updateProgress);
      updateProgress();
    }

    section.dataset.quizEnhanced = "true";
    exposeRichContent(section);
  }

  function hydrateQuizData(script) {
    const section = script.closest(".quiz");
    if (!section) return;

    mergeQuizCrossrefLabel(section);

    try {
      hydrateQuiz(section, JSON.parse(script.textContent));
    } catch (error) {
      section.classList.add("quiz-error");
      console.error(error);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("script.quiz-data[type='application/json']")
      .forEach(hydrateQuizData);
  });
})();
