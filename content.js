/*
autoguemos adds a panel to conjuguemos where you can select a vocabulary or conjugation assignment and choose the number of attempts, correct answers, and reported time. it reads the assignment’s question data to build a simulated answer history, which you can review before submitting. when you submit, it sends that history and the assignment details in a post request to conjuguemos using your browser’s signed-in session, and the site determines whether to save the result. - FUCK HACKEMOS
*/
(() => {
  const storageKey = 'qa_list_raw_v1';
  const hostId = 'conjuguemos-helper';
  if (document.getElementById(hostId)) return;

  const normalize = value =>
      (value || '').normalize('NFC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const plain = value => normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pronouns = {
    yo: 'yo',
    tu: 'tu',
    vos: 'tu',
    el: 'el',
    ella: 'el',
    usted: 'el',
    ud: 'el',
    nosotros: 'nosotros',
    nosotras: 'nosotros',
    vosotros: 'vosotros',
    vosotras: 'vosotros',
    ellos: 'ellos',
    ellas: 'ellos',
    ustedes: 'ellos',
    uds: 'ellos'
  };
  const rowPattern =
      /(?:^|\s)(yo|tú|tu|él|el|ella|usted|ud\.?|nosotros|nosotras|vosotros|vosotras|ellos|ellas|ustedes|uds\.?)(?=\s)/giu;

  function parseCharts(raw) {
    const forms = [];
    let verb = '';
    for (const line of (raw || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean)) {
      if (/^[a-záéíóúüñ]+(?:ar|er|ir)(?:se)?$/iu.test(line)) {
        verb = line;
        continue;
      }
      if (!verb) continue;
      const matches = [...line.matchAll(rowPattern)];
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const start = match.index + match[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
        const answer = line.slice(start, end).trim();
        if (answer) forms.push({verb, subject: match[1], answer});
      }
    }
    return forms;
  }

  function parsePairs(raw) {
    const lines = (raw || '')
                      .split(/\r?\n/)
                      .map(line => line.replace(/^\s*\d+\.\s*/, '').trim())
                      .filter(Boolean);
    const pairs = [];
    for (let i = 0; i + 1 < lines.length; i += 2) {
      const answer = lines[i + 1].split(/[\/;,]/)[0].trim();
      if (lines[i] && answer) pairs.push({prompt: lines[i], answer});
    }
    return pairs;
  }

  function subjectKey(value) {
    const subject = plain(value).replace(/[¿?¡!().]/g, ' ').replace(/\s+/g, ' ').trim();
    if (pronouns[subject]) return pronouns[subject];
    if (!subject || !/[a-z]/.test(subject)) return '';
    const words = subject.match(/[a-z]+/g) || [];
    const group = /(?:\s+y\s+|\s+e\s+|[,;&+])/.test(subject);
    if (words.includes('yo') || words.includes('conmigo')) return group ? 'nosotros' : '';
    if (words.some(word => ['nosotros', 'nosotras'].includes(word))) return 'nosotros';
    if (words.some(word => ['vosotros', 'vosotras'].includes(word))) return 'vosotros';
    if (words.some(word => ['ellos', 'ellas', 'ustedes', 'uds'].includes(word))) return 'ellos';
    if (group && words.some(word => ['tu', 'vos'].includes(word))) return '';
    if (group) return 'ellos';
    if (/^(los|las|unos|unas|mis|tus|sus|nuestros|nuestras|estos|estas|esos|esas|muchos|muchas|todos|todas)\b/
            .test(subject))
      return 'ellos';
    if (/^[\p{L}]+(?:[ '\u2019-][\p{L}]+)*$/u.test(value.trim()) && /^\p{Lu}/u.test(value.trim()))
      return 'el';
    return '';
  }

  function getQuestion() {
    const read = id => {
      const element = document.getElementById(id);
      return element ? (element.innerText || element.value || element.textContent || '').trim() :
                       '';
    };
    const verb = read('verb-input');
    const subject = read('pronoun-input');
    return {
      verb: verb === '-' ? '' : verb,
      subject: subject === '-' ? '' : subject,
      text: verb && subject && verb !== '-' && subject !== '-' ? `${subject} ${verb}` :
                                                                 read('question-input')
    };
  }

  function loadList() {
    try {
      return localStorage.getItem(storageKey) || '';
    } catch {
      return '';
    }
  }

  function saveList(value) {
    try {
      localStorage.setItem(storageKey, value);
      return true;
    } catch {
      return false;
    }
  }

  const host = document.createElement('div');
  host.id = hostId;
  const root = host.attachShadow({mode: 'open'});
  root.innerHTML = `<style>
    :host { all:initial; font:14px system-ui,sans-serif; color:#14252d; --bg:#fff; --surface:#f5f7f6; --text:#14252d; --muted:#647378; --border:#dce5e4; --accent:#15303a; --error:#b52942; }
    * { box-sizing:border-box; } button,input,textarea { font:inherit; } button { cursor:pointer; border:1px solid var(--border); background:#fff; color:var(--text); padding:9px 15px; border-radius:9px; font-weight:700; } button:hover { background:#e9f0ef; } button:focus-visible,input:focus-visible,textarea:focus-visible { outline:2px solid #489b85; outline-offset:2px; } button:disabled { opacity:.5; cursor:not-allowed; }
    .primary { background:#15303a; color:#fff; border-color:#15303a; } .primary:hover { background:#284a50; } .widget { position:fixed; left:20px; bottom:20px; z-index:2147483646; width:min(320px,calc(100vw - 24px)); padding:16px; background:#fff; color:var(--text); border:1px solid #dce5e4; border-radius:14px; box-shadow:0 6px 25px #14252d1a; }
    .brand { display:flex; align-items:center; gap:9px; min-width:0; } .brand-logo { width:26px; height:26px; object-fit:contain; border-radius:4px; } .widget { transition:transform 220ms ease, opacity 180ms ease; } .widget.absorbing { transform:translateX(calc(-100% - 24px)); opacity:0; pointer-events:none; } .mini { transition:background-color 150ms ease, transform 150ms ease; } button { transition:background-color 150ms ease, color 150ms ease, border-color 150ms ease; } .dialog { animation:dialog-enter 160ms ease-out; } @keyframes dialog-enter { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } } @media (prefers-reduced-motion:reduce) { .widget, .mini, button { transition:none; } .dialog { animation:none; } }
    .header-buttons { display:flex; align-items:center; gap:3px; flex-shrink:0; } .header-buttons .manual-toggle { padding:6px 9px; font-size:12px; border-radius:7px; margin-right:3px; } .header-buttons .settings, .header-buttons .minimize, .header-buttons .close-helper { width:28px; height:28px; padding:0; border:0; border-radius:7px; display:grid; place-items:center; background:transparent; color:#667879; font-size:18px; line-height:1; } .header-buttons .settings { font-size:16px; } .header-buttons .close-helper { font-size:19px; font-weight:400; } .header-buttons .settings:hover, .header-buttons .minimize:hover, .header-buttons .close-helper:hover { background:#eef3f1; color:#14252d; } .toggle { position:relative; display:inline-block; width:42px; height:24px; } .toggle input { position:absolute; opacity:0; width:1px; height:1px; } .toggle-track { position:absolute; inset:0; border-radius:999px; background:#a9b8b6; transition:background .15s; } .toggle-track:after { content:""; position:absolute; width:18px; height:18px; top:3px; left:3px; border-radius:50%; background:white; transition:transform .15s; } .toggle input:checked + .toggle-track { background:#328d75; } .toggle input:checked + .toggle-track:after { transform:translateX(18px); } .toggle input:focus-visible + .toggle-track { outline:2px solid #489b85; outline-offset:2px; }
    header { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:14px; cursor:move; touch-action:none; } header strong { font-size:16px; } .minimize { border:0; padding:2px 5px; background:transparent; color:var(--muted); font-size:20px; } .actions { display:flex; gap:8px; flex-wrap:wrap; } .actions button { flex:1; } .details { margin-top:10px; padding:9px; background:var(--surface); border-radius:8px; line-height:1.6; overflow-wrap:anywhere; } .status { min-height:1em; margin-top:8px; color:var(--muted); font-size:12px; } .status:empty { display:none; } .status.error { color:var(--error); } .mini { position:fixed; top:45%; left:0; z-index:2147483646; border-radius:0 10px 10px 0; padding:12px 7px; writing-mode:vertical-rl; } .selection-ring { position:fixed; pointer-events:none; z-index:2147483645; border:4px solid #00a878; background:#34e2aa30; border-radius:12px; box-shadow:0 0 0 3px #fff9; }
    .backdrop { position:fixed; inset:0; z-index:2147483644; background:#14252d88; display:flex; justify-content:center; align-items:center; padding:16px; } .dialog { width:min(680px,100%); max-height:85vh; overflow:auto; display:flex; flex-direction:column; gap:14px; padding:24px; border:1px solid var(--border); border-radius:16px; background:#fff; color:var(--text); box-shadow:0 14px 40px #14252d26; } h2,p { margin:0; } h2 { font-size:20px; } p { color:var(--muted); line-height:1.5; } textarea { width:100%; min-height:260px; resize:vertical; padding:10px; color:var(--text); background:var(--surface); border:1px solid var(--border); border-radius:8px; } .dialog-actions { display:flex; gap:8px; justify-content:flex-end; } .options { display:flex; flex-wrap:wrap; gap:8px; overflow:auto; } [hidden] { display:none !important; }
  </style><section class="widget" aria-label="Autoguemos"><header><div class="brand"><img class="brand-logo" alt=""><strong>Autoguemos</strong></div><div class="header-buttons"><button class="manual-toggle" type="button">Manual</button><button class="settings" type="button" aria-label="Settings" title="Settings">⚙</button><button class="close-helper" type="button" aria-label="Close Autoguemos" title="Close Autoguemos">×</button></div></header><div class="auto-panel"><p class="intro">Choose an assignment to get started.</p><div class="actions" style="margin-top:12px"><button class="primary choose" type="button">Choose assignment</button></div></div><div class="manual-panel" hidden><p>Manual tools</p><div class="actions" style="margin-top:12px"><button class="answer" type="button">Answer</button><button class="list" type="button">List</button><button class="run" type="button">Timed run</button></div><div class="details"><div class="question">Q: (none yet)</div><div class="result">A: (none yet)</div></div></div><div class="status" aria-live="polite"></div></section><button class="mini primary" type="button" aria-label="Open Autoguemos" hidden>Autoguemos ›</button><div class="selection-ring" hidden></div><div class="modal"></div>`;
  document.body.append(host);
  root.querySelector('.brand-logo').src = chrome.runtime.getURL('icon128.png');

  const $ = selector => root.querySelector(selector);
  const widget = $('.widget');
  const status = $('.status');
  const modal = $('.modal');
  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle('error', error);
  };
  const setResult = (question, answer) => {
    $('.question').textContent = `Q: ${question || '(none)'}`;
    $('.result').textContent = `A: ${answer || '(none)'}`;
  };
  const lifetime = new AbortController();
  const originalTitles = new Map();
  let selectedCard = null;
  const ring = $('.selection-ring');
  function updateSelectionRing() {
    if (!selectedCard || !selectedCard.isConnected) {
      ring.hidden = true;
      return;
    }
    const rect = selectedCard.getBoundingClientRect();
    Object.assign(ring.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    ring.hidden = false;
  }
  window.addEventListener(
      'scroll', updateSelectionRing, {signal: lifetime.signal, capture: true, passive: true});
  window.addEventListener('resize', updateSelectionRing, {signal: lifetime.signal, passive: true});
  const clearSelection = () => {
    selectedCard = null;
    ring.hidden = true;
  };
  let refreshOnResultClose = false;
  let cancelPendingAlert = null;
  const closeModal = () => {
    if (cancelPendingAlert) cancelPendingAlert();
    modal.replaceChildren();
    clearSelection();
    if (refreshOnResultClose) {
      refreshOnResultClose = false;
      location.reload();
    }
  };

  function showResult(title, text, success, refresh = false) {
    const dialog = makeDialog(title, text);
    refreshOnResultClose = refresh;
    const marker = document.createElement('div');
    marker.textContent = success ? '✓' : '!';
    marker.style.cssText =
        `width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:24px;font-weight:700;color:${
            success ? '#18795f' : '#9b5924'};background:${success ? '#dcf2e9' : '#fff0df'}`;
    dialog.prepend(marker);
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    actions.append(button('Done', closeModal, true));
    dialog.append(actions);
  }

  function interpretSubmission(status, ok, text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        title: 'Could not confirm submission',
        text: `HTTP ${
            status}. The server returned an unexpected response. Check your gradebook before trying again.`
      };
    }
    const message = typeof data.message === 'string' ? data.message : '';
    if (!ok || data.success === false || (data.status != null && Number(data.status) >= 400) ||
        data.errors || data.error)
      return {
        success: false,
        title: 'Submission not confirmed',
        text: message || `The server returned HTTP ${status}. Check the assignment and try again.`
      };
    if (/already saved/i.test(message))
      return {
        success: false,
        title: 'Already saved',
        refresh: true,
        text:
            'Conjuguemos says this activity was already saved. Check your gradebook to see the recorded result.'
      };
    if ((data.success === true || Number(data.status) === 200) &&
        /(?:score|activity|result|resolution).{0,35}(?:saved|submitted)|(?:saved|submitted).{0,35}(?:score|activity|result|resolution)/i
            .test(message))
      return {
        success: true,
        title: 'Assignment submitted',
        refresh: true,
        text: 'Conjuguemos confirmed the result was saved. Check Grades to see the recorded score.'
      };
    return {
      success: false,
      title: 'Could not confirm submission',
      text: message ||
          'The response did not confirm that the result was saved. Check your gradebook before trying again.'
    };
  }


  function makeDialog(title, description) {
    closeModal();
    const backdrop = document.createElement('div');
    backdrop.className = 'backdrop';
    const dialog = document.createElement('section');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    const heading = document.createElement('h2');
    heading.textContent = title;
    const text = document.createElement('p');
    text.textContent = description;
    dialog.append(heading, text);
    backdrop.append(dialog);
    modal.append(backdrop);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) closeModal();
    });
    return dialog;
  }

  function button(label, action, primary = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (primary) element.className = 'primary';
    element.addEventListener('click', action);
    return element;
  }

  function openList() {
    const dialog = makeDialog(
        'Answer list',
        'Paste one conjugation chart for a single tense, or a list with each question and answer on alternating lines.');
    const textarea = document.createElement('textarea');
    textarea.value = loadList();
    textarea.placeholder = 'Paste your list here';
    const message = document.createElement('div');
    message.className = 'status';
    message.setAttribute('aria-live', 'polite');
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    actions.append(button('Close', closeModal), button('Save list', () => {
                     const raw = textarea.value;
                     const forms = parseCharts(raw);
                     const pairs = forms.length ? [] : parsePairs(raw);
                     if (!forms.length && !pairs.length) {
                       message.textContent = 'No valid forms or question-and-answer pairs found.';
                       message.className = 'status error';
                       return;
                     }
                     if (!saveList(raw)) {
                       message.textContent = 'Could not save the list in this browser.';
                       message.className = 'status error';
                       return;
                     }
                     message.className = 'status';
                     message.textContent = forms.length ? `Saved ${forms.length} forms.` :
                                                          `Saved ${pairs.length} pairs.`;
                   }, true));
    dialog.append(textarea, actions, message);
    textarea.focus();
  }

  function submit(answer, question) {
    if (getQuestion().text !== question) {
      setStatus('The question changed. Click Answer again.', true);
      return false;
    }
    const input = document.getElementById('assignment-answer-input') ||
        document.getElementById('answer-input');
    if (!input || input.disabled || input.readOnly) {
      setStatus('Answer field is unavailable.', true);
      return false;
    }
    input.focus();
    input.value = answer;
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new KeyboardEvent(
        'keypress',
        {key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13, which: 13, bubbles: true}));
    setResult(question, answer);
    setStatus(`Sent ${answer}. Check the activity for the result.`);
    return true;
  }

  function chooseForm(verb, question, forms) {
    const dialog = makeDialog(
        `Choose a form of ${verb}`,
        `Select the form for “${question}”. It will be submitted immediately.`);
    const options = document.createElement('div');
    options.className = 'options';
    const seen = new Set();
    for (const form of forms) {
      const label = `${form.subject} — ${form.answer}`;
      if (seen.has(label)) continue;
      seen.add(label);
      options.append(button(label, () => {
        closeModal();
        submit(form.answer, question);
      }));
    }
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    actions.append(button('Cancel', closeModal));
    dialog.append(options, actions);
  }

  function resolveQuestion(raw, question) {
    const forms = parseCharts(raw);
    const pairs = forms.length ? [] : parsePairs(raw);
    if (!forms.length && !pairs.length) return {error: 'Add a valid list first.'};
    if (!question.text) return {error: 'No active question found.'};
    if (!forms.length) {
      const exact = pairs.filter(pair => normalize(pair.prompt) === normalize(question.text));
      const partial = exact.length ?
          exact :
          pairs.filter(
              pair => normalize(question.text).includes(normalize(pair.prompt)) ||
                  normalize(pair.prompt).includes(normalize(question.text)));
      const answers = [...new Set(partial.map(pair => pair.answer))];
      if (answers.length !== 1)
        return {
          error: answers.length ? 'Multiple answers match this question.' :
                                  'No matching question found.'
        };
      return {answer: answers[0], alternatives: pairs.map(pair => pair.answer), kind: 'vocabulary'};
    }
    let verb = question.verb;
    let subject = question.subject;
    if (!verb || !subject) {
      const words = question.text.match(/[\p{L}]+/gu) || [];
      verb = words.find(word => forms.some(form => normalize(form.verb) === normalize(word))) || '';
      const at = verb ? normalize(question.text).lastIndexOf(normalize(verb)) : -1;
      subject = at < 0 ?
          '' :
          (question.text.slice(0, at) + ' ' + question.text.slice(at + verb.length)).trim();
    }
    const candidates = forms.filter(form => normalize(form.verb) === normalize(verb));
    if (!candidates.length) return {error: 'Verb not found in your chart.'};
    const key = subjectKey(subject);
    const matches = key ? candidates.filter(form => subjectKey(form.subject) === key) : [];
    const answers = [...new Set(matches.map(form => form.answer))];
    if (answers.length === 1)
      return {
        answer: answers[0],
        alternatives: candidates.map(form => form.answer),
        kind: 'conjugation'
      };
    return {error: 'Choose the matching form.', candidates, verb};
  }

  function answer() {
    if (run) {
      setStatus('Stop the timed run before answering manually.', true);
      return;
    }
    const question = getQuestion();
    const result = resolveQuestion(loadList(), question);
    setResult(question.text, '');
    if (result.answer) {
      submit(result.answer, question.text);
      return;
    }
    setStatus(result.error, true);
    if (result.candidates) chooseForm(result.verb, question.text, result.candidates);
  }

  let run = null;
  const runButton = $('.run');

  function stopRun(message, error = false) {
    if (run && run.timer) clearTimeout(run.timer);
    run = null;
    runButton.textContent = 'Timed run';
    setStatus(message, error);
  }

  function scheduleNext() {
    if (!run) return;
    const wait =
        Math.max(0, run.started + run.duration * (run.completed + 1) / run.total - Date.now());
    run.timer = setTimeout(timedStep, wait);
  }

  function timedStep() {
    if (!run) return;
    const currentRun = run;
    const question = getQuestion();
    const result = resolveQuestion(currentRun.raw, question);
    if (!result.answer) {
      stopRun(`Stopped at ${currentRun.completed}/${currentRun.total}: ${result.error}`, true);
      return;
    }
    let value = result.answer;
    const makeWrong = currentRun.wrongPositions.has(currentRun.completed);
    if (makeWrong) {
      const possible = [...new Set(result.alternatives)].filter(
          option => plain(option) !== plain(result.answer));
      if (!possible.length) {
        stopRun('Stopped: no different answer is available in the list.', true);
        return;
      }
      value = possible[Math.floor(Math.random() * possible.length)];
    }
    const input = document.getElementById('assignment-answer-input') ||
        document.getElementById('answer-input');
    if (!input || !submit(value, question.text)) {
      stopRun('Stopped: answer field is unavailable.', true);
      return;
    }
    const sentAt = Date.now();
    const confirm = () => {
      if (run !== currentRun) return;
      const next = getQuestion();
      if ((next.text && next.text !== question.text) ||
          (input.value === '' && Date.now() - sentAt >= 250)) {
        currentRun.completed++;
        if (currentRun.completed >= currentRun.total) {
          stopRun(`Run finished: ${currentRun.completed} answers sent. Check the activity score.`);
          return;
        }
        setStatus(`Timed run: ${currentRun.completed}/${currentRun.total} answers sent.`);
        scheduleNext();
        return;
      }
      if (Date.now() - sentAt > 8000) {
        stopRun('Stopped: the activity did not advance after submitting.', true);
        return;
      }
      currentRun.timer = setTimeout(confirm, 250);
    };
    currentRun.timer = setTimeout(confirm, 250);
  }

  function openRunSettings() {
    if (run) {
      stopRun('Timed run stopped.');
      return;
    }
    const dialog = makeDialog(
        'Timed run',
        'Schedule answers across the selected time. Incorrect answers are chosen from other entries in your list; the activity determines the actual score.');
    const fields = document.createElement('div');
    fields.style.cssText = 'display:grid;gap:10px';
    function field(label, value, min, max, step) {
      const wrapper = document.createElement('label');
      wrapper.textContent = label;
      wrapper.style.cssText =
          'display:flex;justify-content:space-between;align-items:center;gap:12px';
      const input = document.createElement('input');
      input.type = 'number';
      input.value = value;
      input.min = min;
      input.max = max;
      input.step = step;
      input.style.cssText =
          'width:100px;padding:6px;color:var(--text);background:var(--surface);border:1px solid var(--border)';
      wrapper.append(input);
      fields.append(wrapper);
      return input;
    }
    const minutes = field('Duration (minutes)', 10, 0.1, 180, 0.1);
    const total = field('Number of answers', 100, 1, 1000, 1);
    const correct = field('Target correct answers', 97, 0, 1000, 1);
    const message = document.createElement('div');
    message.className = 'status';
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    actions.append(button('Cancel', closeModal), button('Start', () => {
                     const duration = Number(minutes.value), count = Number(total.value),
                           right = Number(correct.value);
                     if (!Number.isFinite(duration) || duration < 0.1 || duration > 180 ||
                         !Number.isInteger(count) || count < 1 || count > 1000 ||
                         !Number.isInteger(right) || right < 0 || right > count) {
                       message.textContent = 'Enter a valid duration, answer count, and target.';
                       message.className = 'status error';
                       return;
                     }
                     const raw = loadList();
                     const result = resolveQuestion(raw, getQuestion());
                     if (!result.answer) {
                       message.textContent = result.error;
                       message.className = 'status error';
                       return;
                     }
                     const positions = Array.from({length: count}, (_, i) => i);
                     for (let i = positions.length - 1; i > 0; i--) {
                       const j = Math.floor(Math.random() * (i + 1));
                       [positions[i], positions[j]] = [positions[j], positions[i]];
                     }
                     run = {
                       raw,
                       started: Date.now(),
                       duration: duration * 60000,
                       total: count,
                       completed: 0,
                       wrongPositions: new Set(positions.slice(0, count - right)),
                       timer: null
                     };
                     runButton.textContent = 'Stop';
                     closeModal();
                     setStatus(`Timed run started: 0/${count} answers sent.`);
                     scheduleNext();
                   }, true));
    dialog.append(fields, message, actions);
  }

  const alertSettingKey = 'submitAlertEnabled';
  async function submitAlertEnabled() {
    try {
      return (await chrome.storage.local.get({[alertSettingKey]: true}))[alertSettingKey] !== false;
    } catch {
      return true;
    }
  }

  async function openSettings() {
    const dialog =
        makeDialog('Settings', 'Control the checks shown before an assignment is submitted.');
    const row = document.createElement('label');
    row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px;background:var(--surface);border-radius:9px';
    const text = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = 'Submit Alert';
    const detail = document.createElement('span');
    detail.style.cssText =
        'display:block;color:var(--muted);font-size:12px;margin-top:4px;line-height:1.4';
    detail.textContent = 'Warn if the selected duration overlaps your latest gradebook result.';
    text.append(strong, detail);
    const toggle = document.createElement('span');
    toggle.className = 'toggle';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('role', 'switch');
    input.setAttribute('aria-label', 'Submit Alert');
    input.checked = await submitAlertEnabled();
    const track = document.createElement('span');
    track.className = 'toggle-track';
    toggle.append(input, track);
    row.append(text, toggle);
    const note = document.createElement('p');
    note.style.fontSize = '12px';
    input.addEventListener('change', async () => {
      try {
        await chrome.storage.local.set({[alertSettingKey]: input.checked});
      } catch {
        input.checked = !input.checked;
        note.textContent = 'Could not save the setting.';
      }
    });
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    actions.append(button('Done', closeModal, true));
    dialog.append(row, note, actions);
  }

  function parseGradeDate(text) {
    const match =
        text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)$/i);
    if (!match) return null;
    let [, month, day, year, hour, minute, meridiem] = match;
    year = Number(year);
    if (year < 100) year += 2000;
    if (Number(hour) < 1 || Number(hour) > 12 || Number(minute) > 59) return null;
    hour = Number(hour) % 12 + (meridiem.toUpperCase() === 'PM' ? 12 : 0);
    const date = new Date(year, Number(month) - 1, Number(day), hour, Number(minute));
    if (date.getFullYear() !== year || date.getMonth() !== Number(month) - 1 ||
        date.getDate() !== Number(day) || Number(minute) > 59)
      return null;
    return date;
  }

  async function getLatestGrade() {
    const response =
        await fetch('/student/grades', {credentials: 'same-origin', cache: 'no-store'});
    if (!response.ok || !new URL(response.url).pathname.startsWith('/student/grades'))
      throw new Error('Could not load your gradebook.');
    const html = await response.text();
    const documentCopy = new DOMParser().parseFromString(html, 'text/html');
    for (const table of documentCopy.querySelectorAll('table')) {
      const header = [...table.querySelectorAll('tr')].find(
          row => [...row.querySelectorAll('th,td')].some(
              cell => cell.textContent.trim().toLowerCase() === 'date'));
      if (!header) continue;
      const names =
          [...header.querySelectorAll('th,td')].map(cell => cell.textContent.trim().toLowerCase());
      const dateIndex = names.indexOf('date'), titleIndex = names.indexOf('activity');
      const results =
          [...table.querySelectorAll('tr')]
              .filter(row => row !== header)
              .map(row => {
                const cells = [...row.querySelectorAll('td')];
                return {
                  date: cells[dateIndex] ? parseGradeDate(cells[dateIndex].textContent) : null,
                  title: cells[titleIndex]?.textContent.trim() || 'Previous assignment'
                };
              })
              .filter(item => item.date);
      if (!results.length) throw new Error('No dated gradebook results were found.');
      results.sort((a, b) => b.date - a.date);
      return results[0];
    }
    throw new Error('Could not find a Date column in your gradebook.');
  }

  function requestSubmitAcknowledgement(area, text) {
    return new Promise(resolve => {
      let settled = false;
      const finish = value => {
        if (settled) return;
        settled = true;
        cancelPendingAlert = null;
        box.remove();
        resolve(value);
      };
      const box = document.createElement('div');
      box.style.cssText =
          'padding:14px;border:1px solid #dfaa56;background:#fff8e8;border-radius:9px;display:grid;gap:10px';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-label', 'Submit time alert');
      const heading = document.createElement('strong');
      heading.textContent = 'Submit Alert';
      const detail = document.createElement('p');
      detail.textContent = text;
      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      label.append(check, document.createTextNode(' I understand and want to submit anyway.'));
      const buttons = document.createElement('div');
      buttons.className = 'dialog-actions';
      cancelPendingAlert = () => finish(false);
      const no = button('Cancel', () => finish(false));
      const yes = button('Yes, submit', () => finish(true), true);
      yes.disabled = true;
      check.addEventListener('change', () => {
        yes.disabled = !check.checked;
      });
      buttons.append(no, yes);
      box.append(heading, detail, label, buttons);
      area.append(box);
      check.focus();
    });
  }

  const submissionsInProgress = new Set();

  function openAssignment(assignmentId, assignmentTitle) {
    const dialog = makeDialog(
        'Assignment submission',
        'Load a vocabulary or conjugation assignment, select its question pool and review the generated attempt history before sending.');
    const id = document.createElement('input');
    id.type = 'hidden';
    id.value = String(assignmentId);
    const area = document.createElement('div');
    area.style.cssText = 'display:grid;gap:8px';
    const message = document.createElement('div');
    message.className = 'status';
    const actions = document.createElement('div');
    actions.className = 'dialog-actions';
    actions.append(button('Close', closeModal));
    const load = button('Load assignment', async () => {
      const match =
          id.value.trim().match(/^(?:https:\/\/conjuguemos\.com\/assignment\/)?(\d+)(?:[/?#].*)?$/);
      if (!match) {
        message.textContent = 'Enter an assignment ID or Conjuguemos assignment URL.';
        return;
      }
      message.textContent = 'Loading assignment…';
      area.replaceChildren();
      try {
        const response = await fetch('/assignment/' + match[1], {credentials: 'same-origin'});
        if (!response.ok || !response.url.includes('/assignment/'))
          throw new Error('Assignment unavailable. Check your sign-in and assignment access.');
        const html = await response.text();
        const raw = html.match(/\bvar\s+ANSWERS\s*=\s*(\{[^\n]*\})\s*;/);
        const encoded = html.match(/\bvar\s+ANSWERS\s*=\s*("(?:\\.|[^"\\])*")\s*;/);
        let data, vocab = false;
        if (raw) {
          data = JSON.parse(raw[1]);
          if (!Array.isArray(data.conjugations) || !data.conjugations.length)
            throw new Error('No conjugation questions were found.');
        } else if (encoded) {
          vocab = true;
          const input = JSON.parse(encoded[1]);
          const bytes = atob(input.slice(6));
          const key = CryptoJS.MD5(input.slice(0, 6)).toString();
          const iv = CryptoJS.enc.Latin1.parse(bytes.slice(0, 16));
          const words = JSON.parse(
              CryptoJS.AES.decrypt(btoa(bytes.slice(16)), CryptoJS.enc.Utf8.parse(key), {iv})
                  .toString(CryptoJS.enc.Utf8));
          if (!Array.isArray(words) || !words.length)
            throw new Error('No vocabulary questions were found.');
          const title = html.match(/activity_title:\s*\{\s*value:\s*("(?:\\.|[^"\\])*")/)?.[1];
          data = {
            id: html.match(/activity_id:\s*\{\s*value:\s*(\d+)/)?.[1],
            title: title ? JSON.parse(title) : 'Vocabulary',
            language_id: html.match(/language_id:\s*\{\s*value:\s*["']?(\d+)/)?.[1],
            conjugations: words.filter(w => w.id && w.translations?.length)
          };
          if (!data.id || !data.language_id || !data.conjugations.length)
            throw new Error('The vocabulary activity metadata is incomplete.');
        } else
          throw new Error(
              'This assignment type is not supported or its activity data is unavailable.');
        const token =
            html.match(/token:\s*\{\s*get:\s*function\s*\(\)\s*\{\s*return\s*["']([^"']+)["']/)
                ?.[1] ||
            '';
        const info = document.createElement('p');
        info.textContent = `${data.title || 'Assignment'} · ${
            data.conjugations.length} possible questions · Assignment ${match[1]}`;
        area.append(info);
        const fields = document.createElement('div');
        fields.style.cssText = 'display:grid;gap:8px';
        const field = (name, value) => {
          const label = document.createElement('label');
          label.textContent = name + ' ';
          const n = document.createElement('input');
          n.type = 'number';
          n.value = value;
          n.min = '0';
          n.style.cssText = 'width:90px;padding:5px';
          label.append(n);
          fields.append(label);
          return n;
        };
        const total = field('Attempts', 100), correct = field('Correct', 95),
              minutes = field('Minutes', 10);
        area.append(fields);
        const list = document.createElement('div');
        list.style.cssText =
            'max-height:180px;overflow:auto;border:1px solid var(--border);padding:8px;display:grid;gap:4px';
        const verbs = new Map((data.infinitives || []).map(v => [String(v.id), v]));
        const pronouns = new Map((data.pronouns || []).map(v => [String(v.id), v]));
        for (const [index, row] of data.conjugations.entries()) {
          const label = document.createElement('label'), box = document.createElement('input');
          box.type = 'checkbox';
          box.checked = true;
          box.dataset.row = String(index);
          const verb = verbs.get(String(row.infinitive_id)),
                pronoun = pronouns.get(String(row.pronoun_id));
          const text = vocab ?
              `${row.text} → ${row.translations.join(' / ')}` :
              `${pronoun?.text || row.pronoun_id} · ${verb?.translation || row.infinitive_id} → ${
                  (row.answers || []).join(' / ')}`;
          label.append(box, document.createTextNode(` ${text}`));
          list.append(label);
        }
        area.append(list);
        const preview = document.createElement('pre');
        preview.style.cssText =
            'white-space:pre-wrap;max-height:130px;overflow:auto;font-size:11px';
        area.append(preview);
        let previewRevision = 0;
        const prepare = button('Prepare preview', () => {
          if (submissionsInProgress.has(match[1])) {
            message.textContent = 'A submission for this assignment is already in progress.';
            return;
          }
          const count = Number(total.value), right = Number(correct.value),
                duration = Number(minutes.value),
                selected =
                    [...list.querySelectorAll('input:checked')]
                        .map(c => data.conjugations[Number(c.dataset.row)])
                        .filter(row => vocab ? row.translations?.length : row.answers?.length);
          if (!Number.isInteger(count) || count < 1 || count > 1000 || !Number.isInteger(right) ||
              right < 0 || right > count || !Number.isFinite(duration) || duration <= 0 ||
              duration > 180 || !selected.length) {
            message.textContent = 'Check attempts, correct count, duration and selected questions.';
            return;
          }
          const rows = Array.from({length: count}, (_, i) => {
            const q = selected[Math.floor(Math.random() * selected.length)];
            let answer = (vocab ? q.translations : q.answers)[0];
            const ok = i < right;
            if (!ok) answer = answer + 'x';
            return vocab ? [answer, ok ? 1 : 0, q.id, Number(data.language_id)] : [
              answer, ok ? 1 : 0, q.infinitive_id, q.translation_id, String(data.language_id),
              q.tense_id, q.pronoun_id
            ];
          });
          for (let i = rows.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rows[i], rows[j]] = [rows[j], rows[i]];
          }
          preview.textContent = JSON.stringify(rows, null, 2);
          send.disabled = false;
          const preparedRevision = previewRevision;
          send.onclick = async () => {
            if (submissionsInProgress.has(match[1]) || preparedRevision !== previewRevision || !dialog.isConnected) return;
            submissionsInProgress.add(match[1]);
            send.disabled = true;
            prepare.disabled = true;
            const seconds = Math.round(duration * 60);

            if (await submitAlertEnabled()) {
              let warning = '';
              try {
                const latest = await getLatestGrade();
                const start = new Date(Date.now() - seconds * 1000);
                if (start.getTime() < latest.date.getTime() + 60000) {
                  warning = `Your proposed start (${
                      start.toLocaleString()}) is before your latest recorded result, ${
                      latest.title} (${
                      latest.date.toLocaleString()}). Are you sure you want to submit?`;
                }
              } catch (error) {
                warning = `${
                    error
                        .message} The time overlap could not be checked. Are you sure you want to submit?`;
              }
              if (!dialog.isConnected || preparedRevision !== previewRevision) {
                submissionsInProgress.delete(match[1]);
                prepare.disabled = false;
                return;
              }
              if (warning && !(await requestSubmitAcknowledgement(area, warning))) {
                submissionsInProgress.delete(match[1]);
                prepare.disabled = false;
                send.disabled = false;
                return;
              }
            }

            if (!dialog.isConnected || preparedRevision !== previewRevision) {
              submissionsInProgress.delete(match[1]);
              prepare.disabled = false;
              message.textContent = 'Selection changed. Prepare a new preview.';
              return;
            }
            const end = Math.floor(Date.now() / 1000);
            const payload = new URLSearchParams({
              token,
              activity_id: String(data.id),
              assignment_id: match[1],
              title: data.title || '',
              mode: 'assignment',
              activity_start: String(end - seconds),
              activity_end: String(end),
              time: `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${
                  String(seconds % 60).padStart(2, '0')}`,
              'data[attempts]': JSON.stringify(rows),
              'data[total_attempts]': String(count),
              'data[valid_attempts]': String(right)
            });

            try {
              // is this really worth 10$?
              const result = await fetch(vocab ? '/vocabulary/submit' : '/verb/submit', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
                  'X-Requested-With': 'XMLHttpRequest'
                },
                body: payload
              });
              const outcome = interpretSubmission(result.status, result.ok, await result.text());
              showResult(outcome.title, outcome.text, outcome.success, outcome.refresh);
            } catch (error) {
              message.textContent = 'Request failed: ' + error.message + '. Check Grades before retrying.';
            } finally {
              submissionsInProgress.delete(match[1]);
              prepare.disabled = false;
            }
          };
          message.textContent = `Preview: ${right}/${count} correct, ${duration} minutes.`;
        });
        const send = button('Submit preview', () => {}, true);
        send.disabled = true;
        for (const input of [total, correct, minutes, list])
          input.addEventListener('input', () => {
            previewRevision++;
            send.disabled = true;
            message.textContent = 'Selection changed. Prepare a new preview.';
          });
        area.append(prepare, send);
        message.textContent =
            token ? 'Assignment loaded.' : 'Loaded; token not found. Submission may fail.';
      } catch (error) {
        message.textContent = error.message;
      }
    }, true);
    dialog.append(id, area, message, actions);
    load.click();
  }
  const selectAssignment = (assignmentId, title, card) => {
    openAssignment(assignmentId, title);
    clearSelection();
  };
  function addAssignmentButtons() {
    for (const card of document.querySelectorAll('.landing-activities__item')) {
      if (card.querySelector('[data-autoguemos-select]')) continue;
      const link = card.querySelector('a[href^="/assignment/"]');
      const match = link?.getAttribute('href')?.match(/^\/assignment\/(\d+)(?:[/?#]|$)/);
      if (!match) continue;
      const showHover = () => {
        if (modal.childElementCount) return;
        selectedCard = card;
        updateSelectionRing();
      };
      const hideHover = () => {
        if (selectedCard === card) clearSelection();
      };
      card.addEventListener('click', event => {
        if (event.button !== 0 || event.defaultPrevented || event.target.closest('a, button, input, select, textarea, form')) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        selectAssignment(match[1], card.querySelector('h4')?.textContent.trim(), card);
      }, {capture: true, signal: lifetime.signal});
      card.addEventListener('pointerenter', showHover, {signal: lifetime.signal});
      card.addEventListener('pointerleave', hideHover, {signal: lifetime.signal});
      card.addEventListener('focusin', showHover, {signal: lifetime.signal});
      card.addEventListener('focusout', event => {
        if (!card.contains(event.relatedTarget)) hideHover();
      }, {signal: lifetime.signal});
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'btn line';
      pick.dataset.autoguemosSelect = '1';
      pick.textContent = 'Autoguemos';
      pick.style.marginLeft = '8px';
      pick.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        selectAssignment(match[1], card.querySelector('h4')?.textContent.trim(), card);
      });
      link.parentElement.append(pick);
      const title = card.querySelector('h4');
      if (title) {
        originalTitles.set(title, {
          role: title.getAttribute('role'),
          tabindex: title.getAttribute('tabindex'),
          cursor: title.style.cursor
        });
        title.setAttribute('role', 'button');
        title.tabIndex = 0;
        title.style.cursor = 'pointer';
        const choose = event => {
          event.preventDefault();
          event.stopPropagation();
          selectAssignment(match[1], title.textContent.trim(), card);
        };
        title.addEventListener('click', choose, {signal: lifetime.signal});
        title.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') choose(event);
        }, {signal: lifetime.signal});
      }
    }
  }
  addAssignmentButtons();
  const cardsObserver = new MutationObserver(addAssignmentButtons);
  cardsObserver.observe(document.body, {childList: true, subtree: true});
  $('.choose').addEventListener('click', () => {
    const match = location.pathname.match(/^\/assignment\/(\d+)/);
    if (match) return selectAssignment(match[1], document.title);
    const card = document.querySelector('.landing-activities__item [data-autoguemos-select]');
    if (card) {
      setStatus('Choose Autoguemos on an assignment card.');
      card.scrollIntoView({block: 'center', behavior: 'smooth'});
      return;
    }
    setStatus('Open Assignments to choose one.');
  });
  $('.settings').addEventListener('click', openSettings);
  $('.manual-toggle').addEventListener('click', () => {
    const manual = $('.manual-panel'), automatic = $('.auto-panel');
    manual.hidden = !manual.hidden;
    automatic.hidden = !manual.hidden;
    $('.manual-toggle').textContent = manual.hidden ? 'Manual' : 'Auto';
  });

  runButton.addEventListener('click', openRunSettings);
  $('.answer').addEventListener('click', answer);
  $('.list').addEventListener('click', openList);
  let collapseTimer;
  const collapse = () => {
    closeModal();
    widget.classList.add('absorbing');
    collapseTimer = setTimeout(() => {
      widget.hidden = true;
      $('.mini').hidden = false;
    }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  };
  $('.close-helper').addEventListener('click', () => {
    clearTimeout(collapseTimer);
    if (run) stopRun('');
    closeModal();
    cardsObserver.disconnect();
    lifetime.abort();
    clearSelection();
    for (const pick of document.querySelectorAll('[data-autoguemos-select]')) pick.remove();
    for (const [title, previous] of originalTitles) {
      if (previous.role === null)
        title.removeAttribute('role');
      else
        title.setAttribute('role', previous.role);
      if (previous.tabindex === null)
        title.removeAttribute('tabindex');
      else
        title.setAttribute('tabindex', previous.tabindex);
      title.style.cursor = previous.cursor;
    }
    host.remove();
  });
  $('.mini').addEventListener('click', () => {
    clearTimeout(collapseTimer);
    $('.mini').hidden = true;
    widget.hidden = false;
    requestAnimationFrame(() => widget.classList.remove('absorbing'));
  });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });
  const header = $('header');
  header.addEventListener('pointerdown', event => {
    if (event.target.closest('button') || event.button !== 0) return;
    event.preventDefault();

    const rect = widget.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    let moved = false;
    let left = rect.left;

    const move = current => {
      if (current.pointerId !== pointerId) return;
      const dx = current.clientX - startX;
      const dy = current.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) < 3 && !moved) return;
      moved = true;
      left = Math.max(0, Math.min(window.innerWidth - rect.width, rect.left + dx));
      const top = Math.max(0, Math.min(window.innerHeight - rect.height, rect.top + dy));
      widget.style.right = 'auto';
      widget.style.bottom = 'auto';
      widget.style.left = `${left}px`;
      widget.style.top = `${top}px`;
    };

    const stop = current => {
      if (current.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', stop, true);
      window.removeEventListener('pointercancel', stop, true);
      if (current.type === 'pointerup' && moved && left <= 12 && current.clientX < startX - 30) {
        collapse();
      }
    };

    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', stop, true);
    window.addEventListener('pointercancel', stop, true);
  });
})();
