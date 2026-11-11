(() => {
  'use strict';
  const FALLBACK = `apple;jabłko\nbook;książka\nwater;woda\nhouse;dom\nfriend;przyjaciel|przyjaciółka\nschool;szkoła\nbeautiful;piękny|piękna\ntravel;podróżować\nfood;jedzenie\nwork;praca`;
  const STORAGE_KEY = 'slowka-en-pl-v1';
  const $ = (selector) => document.querySelector(selector);
  const ui = {
    prompt: $('#prompt-word'), label: $('#prompt-label'), direction: $('#direction-label'), hint: $('#hint'),
    form: $('#answer-form'), answer: $('#answer'), check: $('#check-button'), feedback: $('#feedback'),
    diff: $('#diff'), diffMessage: $('#diff-message'), progress: $('#progress-label'),
    correct: $('#correct-count'), wrong: $('#wrong-count'), streak: $('#streak-count'), accuracy: $('#accuracy-count'),
    reviewCount: $('#review-count'), reviewButton: $('#review-button'), reviewProgress: $('#review-progress'), reviewStatus: $('#review-status'),
    ignore: $('#ignore-diacritics'), loadError: $('#load-error'), dictionaryStatus: $('#dictionary-status'), modeCaption: $('#mode-caption')
  };
  const state = { words: [], deck: [], current: null, mode: 'en-pl', direction: 'en-pl', correct: 0, wrong: 0, streak: 0, bestStreak: 0, review: [], reviewKeys: [], reviewDeck: [], reviewMode: false, liveTimer: null, locked: false };

  function parseDictionary(text) {
    return text.split(/\r?\n/).map(line => line.trim()).filter(line => line && !line.startsWith('#')).map(line => {
      const split = line.indexOf(';');
      if (split < 1) return null;
      const en = line.slice(0, split).trim();
      const translations = line.slice(split + 1).split('|').map(value => value.trim()).filter(Boolean);
      return en && translations.length ? { en, pl: [...new Set(translations)] } : null;
    }).filter(Boolean);
  }
  async function loadDictionary() {
    ui.dictionaryStatus.textContent = 'Wczytuję słownik…';
    ui.loadError.hidden = true;
    try {
      const response = await fetch(`slowa.txt?v=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const words = parseDictionary(await response.text());
      if (!words.length) throw new Error('Pusty słownik');
      state.words = words;
      ui.dictionaryStatus.textContent = `${words.length} słówek w bazie`;
    } catch (error) {
      state.words = parseDictionary(FALLBACK);
      ui.dictionaryStatus.textContent = 'Tryb awaryjny · 10 słówek';
      ui.loadError.hidden = false;
      console.warn('Nie udało się pobrać slowa.txt; uruchomiono słownik awaryjny.', error);
    }
    state.deck = shuffle(state.words);
    state.review = state.reviewKeys.map(key => state.words.find(word => word.en === key)).filter(Boolean);
    nextWord();
    renderReview();
  }
  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function nextWord() {
    if (!state.words.length) return;
    if (state.reviewMode) {
      if (!state.reviewDeck.length) state.reviewDeck = shuffle(state.review);
      if (!state.reviewDeck.length) { state.reviewMode = false; }
    }
    let word;
    if (state.reviewMode) word = state.reviewDeck.pop();
    else {
      if (!state.deck.length) state.deck = shuffle(state.words);
      word = state.deck.pop();
    }
    state.current = word;
    state.direction = state.mode === 'mix' ? (Math.random() < .5 ? 'en-pl' : 'pl-en') : state.mode;
    state.locked = false;
    const isEnglish = state.direction === 'en-pl';
    ui.prompt.textContent = isEnglish ? word.en : word.pl[0];
    ui.label.textContent = isEnglish ? 'PRZETŁUMACZ NA POLSKI' : 'PRZETŁUMACZ NA ANGIELSKI';
    ui.direction.innerHTML = isEnglish ? 'ANGIELSKI <span>→</span> POLSKI' : 'POLSKI <span>→</span> ANGIELSKI';
    ui.hint.textContent = 'Wpisz tłumaczenie i naciśnij Enter';
    ui.progress.textContent = state.reviewMode ? `POWTÓRKI · ${state.reviewDeck.length + 1} POZOSTAŁO` : `${state.words.length} SŁÓWEK W SESJI`;
    ui.answer.value = '';
    ui.diff.replaceChildren();
    ui.diffMessage.textContent = '';
    ui.feedback.textContent = '';
    ui.feedback.className = 'feedback';
    ui.check.textContent = 'Sprawdź ↗';
    ui.answer.disabled = false;
    ui.check.disabled = false;
    ui.answer.focus({ preventScroll: true });
  }
  function normalize(text) {
    let result = text.toLocaleLowerCase('pl-PL').trim();
    if (ui.ignore.checked) result = result.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l');
    return Array.from(result);
  }
  function levenshtein(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0]; row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const old = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = old;
      }
    }
    return row[b.length];
  }
  // Align strings with edit distance so missing middle letters and extra characters retain their positions.
  function align(inputText, targetText) {
    const input = normalize(inputText), target = normalize(targetText);
    const rows = Array.from({ length: input.length + 1 }, () => Array(target.length + 1).fill(0));
    const back = Array.from({ length: input.length + 1 }, () => Array(target.length + 1).fill(''));
    for (let i = 0; i <= input.length; i++) { rows[i][0] = i; if (i) back[i][0] = 'extra'; }
    for (let j = 0; j <= target.length; j++) { rows[0][j] = j; if (j) back[0][j] = 'missing'; }
    for (let i = 1; i <= input.length; i++) for (let j = 1; j <= target.length; j++) {
      const same = input[i - 1] === target[j - 1];
      const choices = [[rows[i - 1][j - 1] + (same ? 0 : 1), same ? 'match' : 'wrong'], [rows[i][j - 1] + 1, 'missing'], [rows[i - 1][j] + 1, 'extra']].sort((a, b) => a[0] - b[0]);
      rows[i][j] = choices[0][0]; back[i][j] = choices[0][1];
    }
    const cells = [];
    let i = input.length, j = target.length;
    while (i || j) {
      const op = back[i][j];
      if (op === 'match' || op === 'wrong') { cells.push({ char: input[i - 1], op, expected: target[j - 1] }); i--; j--; }
      else if (op === 'missing') { cells.push({ char: '', op, expected: target[j - 1] }); j--; }
      else { cells.push({ char: input[i - 1], op: 'extra' }); i--; }
    }
    return { cells: cells.reverse(), distance: rows[input.length][target.length], input, target };
  }
  function bestAlignment(value, answers) {
    return answers.map(answer => ({ answer, result: align(value, answer) })).sort((a, b) => a.result.distance - b.result.distance)[0];
  }
  function paintDiff(result) {
    ui.diff.replaceChildren();
    for (const item of result.cells) {
      const cell = document.createElement('span');
      cell.className = `diff-cell ${item.op === 'match' ? '' : item.op === 'wrong' ? 'error' : item.op === 'missing' ? 'missing' : 'extra'}`;
      cell.textContent = item.char || (item.op === 'missing' ? ' ' : '');
      if (item.op === 'missing') cell.setAttribute('aria-label', `brak ${item.expected}`);
      ui.diff.append(cell);
    }
    if (!result.distance) ui.diffMessage.textContent = 'Wszystkie litery są zgodne.';
    else {
      const index = result.cells.findIndex(item => item.op !== 'match');
      const item = result.cells[index];
      const pos = index + 1;
      if (item.op === 'missing') ui.diffMessage.textContent = `Brakuje litery na pozycji ${pos}: '${item.expected}'`;
      else if (item.op === 'extra') ui.diffMessage.textContent = `Nadmiarowy znak na pozycji ${pos}: '${item.char}'`;
      else ui.diffMessage.textContent = `Błąd na pozycji ${pos}: wpisano '${item.char}', oczekiwano '${item.expected}'`;
    }
  }
  function expectedAnswers() {
    return state.direction === 'en-pl' ? state.current.pl : [state.current.en];
  }
  function checkAnswer() {
    if (state.locked || !state.current) return;
    const value = ui.answer.value.trim();
    if (!value) { ui.feedback.textContent = 'Wpisz odpowiedź, aby kontynuować.'; ui.feedback.className = 'feedback bad'; ui.answer.focus(); return; }
    const candidate = bestAlignment(value, expectedAnswers());
    paintDiff(candidate.result);
    const isCorrect = candidate.result.distance === 0;
    state.locked = true;
    if (isCorrect) {
      state.correct++; state.streak++; state.bestStreak = Math.max(state.bestStreak, state.streak);
      ui.feedback.textContent = 'Świetnie! Odpowiedź jest poprawna.'; ui.feedback.className = 'feedback good';
      state.review = state.review.filter(item => item.en !== state.current.en);
    } else {
      state.wrong++; state.streak = 0;
      if (!state.review.some(item => item.en === state.current.en)) state.review.push(state.current);
      ui.feedback.textContent = `Jeszcze nie — poprawna odpowiedź: ${candidate.answer}`; ui.feedback.className = 'feedback bad';
    }
    persist(); updateStats(); renderReview();
    ui.check.textContent = 'Następne →';
    ui.answer.disabled = true;
  }
  function updateStats() {
    ui.correct.textContent = state.correct;
    ui.wrong.textContent = state.wrong;
    ui.streak.textContent = state.streak;
    const total = state.correct + state.wrong;
    ui.accuracy.textContent = total ? `${Math.round(state.correct / total * 100)}%` : '—';
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ bestStreak: state.bestStreak, review: state.review.map(w => w.en) })); } catch (error) { console.warn('Nie udało się zapisać postępów.', error); }
  }
  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      state.bestStreak = Number(saved.bestStreak) || 0;
      state.reviewKeys = Array.isArray(saved.review) ? saved.review.filter(key => typeof key === 'string') : [];
    } catch { state.bestStreak = 0; state.reviewKeys = []; }
  }
  function renderReview() {
    ui.reviewCount.textContent = state.review.length;
    ui.reviewButton.disabled = state.review.length === 0;
    ui.reviewProgress.style.width = state.review.length ? `${Math.min(100, state.review.length / Math.max(1, state.words.length) * 100)}%` : '0%';
    ui.reviewStatus.textContent = state.review.length ? 'Słówka z błędnymi odpowiedziami czekają na powtórkę.' : 'Twoja kolejka powtórek jest pusta.';
  }
  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode-option').forEach(button => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    ui.modeCaption.textContent = mode === 'en-pl' ? 'Angielski na polski' : mode === 'pl-en' ? 'Polski na angielski' : 'Losowy kierunek';
    state.reviewMode = false;
    if (state.current) nextWord();
  }

  ui.form.addEventListener('submit', event => { event.preventDefault(); if (state.locked) nextWord(); else checkAnswer(); });
  $('#skip-button').addEventListener('click', () => nextWord());
  document.querySelectorAll('.mode-option').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
  ui.reviewButton.addEventListener('click', () => { state.reviewMode = true; state.reviewDeck = shuffle(state.review); nextWord(); });
  $('#retry-button').addEventListener('click', loadDictionary);
  $('#reset-button').addEventListener('click', () => {
    if (!window.confirm('Czy na pewno wyczyścić zapisane najlepsze wyniki i kolejkę powtórek?')) return;
    localStorage.removeItem(STORAGE_KEY); state.review = []; state.reviewKeys = []; state.bestStreak = 0; state.correct = 0; state.wrong = 0; state.streak = 0; state.reviewMode = false; persist(); updateStats(); renderReview(); nextWord();
  });
  const themeButton = $('#theme-toggle');
  function applyTheme(theme) { document.documentElement.dataset.theme = theme; themeButton.textContent = theme === 'dark' ? '☾' : '☼'; themeButton.setAttribute('aria-label', theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'); }
  let theme = localStorage.getItem('slowka-theme');
  if (theme) applyTheme(theme); else { document.documentElement.removeAttribute('data-theme'); }
  themeButton.addEventListener('click', () => { theme = (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark' ? 'light' : 'dark'; applyTheme(theme); localStorage.setItem('slowka-theme', theme); });
  ui.answer.addEventListener('input', () => {
    clearTimeout(state.liveTimer);
    state.liveTimer = setTimeout(() => {
      if (!ui.answer.value || !state.current) { ui.diff.replaceChildren(); ui.diffMessage.textContent = ''; return; }
      paintDiff(bestAlignment(ui.answer.value, expectedAnswers()).result);
    }, 250);
  });
  restore(); updateStats(); loadDictionary();
})();
