/**
 * KALKULATOR MODERN - SCRIPT.JS
 * Fitur: Real-time calculation, Input validation, History, Light/Dark mode
 */

(() => {
  'use strict';

  // ============================================================
  // STATE
  // ============================================================
  let expression = '';          // Current expression string (display symbols: ×, ÷)
  let history    = [];          // Array of { expr, result }
  let isDark     = false;       // Current theme

  // ============================================================
  // DOM REFERENCES
  // ============================================================
  const body          = document.body;
  const calculator    = document.getElementById('calculator');
  const equationEl    = document.getElementById('equation');
  const resultEl      = document.getElementById('result');
  const clockEl       = document.getElementById('clock');
  const historyOverlay = document.getElementById('history-overlay');
  const historyList    = document.getElementById('history-list');
  const btnTheme       = document.getElementById('btn-theme');
  const btnHistory     = document.getElementById('btn-history');
  const btnHistoryClose = document.getElementById('history-close');
  const btnHistoryClear = document.getElementById('history-clear');

  // ============================================================
  // LIVE CLOCK
  // ============================================================
  function updateClock() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${h}:${m}`;
  }
  updateClock();
  setInterval(updateClock, 15000);

  // ============================================================
  // THEME TOGGLE
  // ============================================================
  function applyTheme(dark) {
    isDark = dark;
    body.classList.toggle('light-mode', !dark);
    body.classList.toggle('dark-mode',  dark);
    try { localStorage.setItem('kalk-theme', dark ? 'dark' : 'light'); } catch(e) {}
  }

  // Load saved theme
  try {
    const saved = localStorage.getItem('kalk-theme');
    if (saved === 'dark') applyTheme(true);
  } catch(e) {}

  btnTheme.addEventListener('click', () => applyTheme(!isDark));

  // ============================================================
  // DISPLAY UPDATE
  // ============================================================
  function updateDisplay(showExpr, showResult) {
    equationEl.textContent = showExpr === '' ? '0' : showExpr;
    adjustFontSize(equationEl, showExpr || '0');

    if (showResult !== undefined && showResult !== '') {
      resultEl.textContent = showResult;
      resultEl.classList.add('has-value');
      resultEl.classList.remove('animate');
      // Trigger reflow then re-add
      void resultEl.offsetWidth;
      resultEl.classList.add('animate');
    } else {
      resultEl.textContent = '';
      resultEl.classList.remove('has-value', 'animate');
    }
  }

  function adjustFontSize(el, text) {
    const len = text.length;
    if (len <= 8)       el.style.fontSize = '';
    else if (len <= 12) el.style.fontSize = 'clamp(1.5rem, 7vw, 2.5rem)';
    else if (len <= 18) el.style.fontSize = 'clamp(1.1rem, 5vw, 1.8rem)';
    else                el.style.fontSize = 'clamp(0.85rem, 3.5vw, 1.3rem)';
  }

  // ============================================================
  // EXPRESSION UTILITIES
  // ============================================================
  // Symbols used in display: ×, ÷
  // Symbols used for eval: *, /
  const OPERATORS    = ['+', '-', '×', '÷', '*', '/'];
  const EVAL_SYMBOLS = { '×': '*', '÷': '/' };
  const DISP_SYMBOLS = { '*': '×', '/': '÷' };

  function toEvalStr(expr) {
    return expr
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/%/g, '/100');
  }

  function isOperator(ch) {
    return ['+', '-', '×', '÷'].includes(ch);
  }

  function lastChar(expr) {
    return expr.length > 0 ? expr[expr.length - 1] : '';
  }

  function safeEval(expr) {
    try {
      const evalStr = toEvalStr(expr);
      // Only allow safe characters
      if (!/^[\d\s\+\-\*\/\.\(\)%]+$/.test(evalStr)) return null;
      // eslint-disable-next-line no-new-func
      const result = Function('"use strict"; return (' + evalStr + ')')();
      if (!isFinite(result)) return null;
      // Round to avoid floating point precision issues
      return parseFloat(result.toPrecision(12)).toString();
    } catch (e) {
      return null;
    }
  }

  // ============================================================
  // INPUT HANDLER (core logic)
  // ============================================================
  function handleInput(value) {
    const lc = lastChar(expression);

    switch (value) {

      /* ---- AC: Reset ---- */
      case 'AC':
        expression = '';
        updateDisplay('', '');
        return;

      /* ---- = : Evaluate ---- */
      case '=': {
        if (expression === '') return;
        const res = safeEval(expression);
        if (res !== null) {
          // Save to history
          history.unshift({ expr: expression, result: res });
          if (history.length > 50) history.pop();
          // Move result to main display
          expression = res;
          updateDisplay(expression, '');
        } else {
          resultEl.textContent = 'Error';
          resultEl.classList.add('has-value');
        }
        return;
      }

      /* ---- +/- : Toggle sign ---- */
      case '+/-': {
        if (expression === '' || expression === '0') return;
        // Find the start of the last number segment
        const match = expression.match(/(^|[+×÷])(-?)(\d+\.?\d*)$/);
        if (match) {
          const prefix    = match[1];
          const sign      = match[2];
          const number    = match[3];
          const newSign   = sign === '-' ? '' : '-';
          const before    = expression.slice(0, expression.length - match[0].length);
          expression      = before + prefix + newSign + number;
        }
        break;
      }

      /* ---- () : Smart Parenthesis ---- */
      case '()': {
        const openCount  = (expression.match(/\(/g) || []).length;
        const closeCount = (expression.match(/\)/g) || []).length;
        // If no unclosed parens, or last char is operator / opening paren -> open
        if (openCount === closeCount || lc === '(' || isOperator(lc) || expression === '') {
          expression += '(';
        } else {
          expression += ')';
        }
        break;
      }

      /* ---- % ---- */
      case '%': {
        if (expression === '' || isOperator(lc) || lc === '(') return;
        // Avoid double %
        if (lc === '%') return;
        expression += '%';
        break;
      }

      /* ---- Operators: +, -, ×, ÷ ---- */
      case '+':
      case '-':
      case '×':
      case '÷': {
        if (expression === '') {
          // Allow leading minus for negative numbers
          if (value === '-') {
            expression = '-';
          }
          break;
        }
        if (isOperator(lc)) {
          // Replace last operator (except: allow minus after another operator for unary minus)
          if (value === '-' && lc !== '-') {
            // Append unary minus
            expression += value;
          } else {
            // Remove the last operator(s) except any unary minus at end
            expression = expression.replace(/[+\-×÷]+$/, '') + value;
          }
        } else if (lc === '(' ) {
          // Don't place operator right after opening paren (except minus)
          if (value === '-') expression += value;
        } else {
          expression += value;
        }
        break;
      }

      /* ---- Decimal point ---- */
      case '.': {
        if (expression === '' || isOperator(lc) || lc === '(') {
          expression += '0.';
          break;
        }
        // Check if current number segment already has a dot
        const segments   = expression.split(/[+\-×÷\(]/);
        const lastSeg    = segments[segments.length - 1];
        if (lastSeg.includes('.')) return; // Already has decimal
        expression += '.';
        break;
      }

      /* ---- Digits 0-9 ---- */
      default: {
        if (!/^\d$/.test(value)) return; // Ignore non-digit
        // Prevent leading zeros: "0X" -> replace "0" with digit
        if (expression === '0') {
          expression = value;
          break;
        }
        // After an operator, closing paren or %, just append
        expression += value;
        break;
      }
    }

    // Real-time result
    const res = safeEval(expression);
    const displayRes = (res !== null && res !== expression) ? '= ' + formatNumber(res) : '';
    updateDisplay(expression, displayRes);
  }

  // Format long numbers nicely
  function formatNumber(str) {
    const n = parseFloat(str);
    if (isNaN(n)) return str;
    if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) {
      return n.toExponential(4);
    }
    return str;
  }

  // ============================================================
  // BUTTON CLICK EVENTS (delegated)
  // ============================================================
  function addPressAnim(btn) {
    btn.classList.remove('btn-press-anim');
    void btn.offsetWidth;
    btn.classList.add('btn-press-anim');
    btn.addEventListener('animationend', () => btn.classList.remove('btn-press-anim'), { once: true });
  }

  document.querySelectorAll('.btn[data-value]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      addPressAnim(btn);
      handleInput(btn.dataset.value);
    });
  });

  // ============================================================
  // KEYBOARD SUPPORT
  // ============================================================
  const KEY_MAP = {
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
    '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
    '+': '+', '-': '-', '*': '×', '/': '÷',
    'x': '×', 'X': '×',
    '.': '.', ',': '.',
    '%': '%',
    'Enter': '=', '=': '=',
    'Backspace': '__BACKSPACE__',
    'Delete': 'AC', 'Escape': 'AC',
    '(': '()', ')': '()',
  };

  document.addEventListener('keydown', (e) => {
    // Don't intercept when history modal is open
    if (historyOverlay.classList.contains('open')) return;

    const mapped = KEY_MAP[e.key];
    if (!mapped) return;
    e.preventDefault();

    if (mapped === '__BACKSPACE__') {
      // Backspace: remove last character
      if (expression.length > 0) {
        expression = expression.slice(0, -1);
        const res = safeEval(expression);
        const displayRes = (res !== null && res !== expression) ? '= ' + formatNumber(res) : '';
        updateDisplay(expression, displayRes);
      }
      return;
    }

    // Animate corresponding button
    const btn = document.querySelector(`.btn[data-value="${mapped}"]`);
    if (btn) addPressAnim(btn);

    handleInput(mapped);
  });

  // ============================================================
  // HISTORY PANEL
  // ============================================================
  function renderHistory() {
    if (history.length === 0) {
      historyList.innerHTML = '<p class="history-empty">Belum ada riwayat perhitungan.</p>';
      return;
    }
    historyList.innerHTML = history.map((item, i) =>
      `<div class="history-item" data-index="${i}" title="Klik untuk menggunakan hasil ini" role="button" tabindex="0">
         <div class="hi-expression">${escapeHtml(item.expr)}</div>
         <div class="hi-result">= ${escapeHtml(item.result)}</div>
       </div>`
    ).join('');

    historyList.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.index);
        expression = history[idx].result;
        updateDisplay(expression, '');
        closeHistory();
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') el.click();
      });
    });
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function openHistory() {
    renderHistory();
    historyOverlay.classList.add('open');
    historyOverlay.setAttribute('aria-hidden', 'false');
    btnHistoryClose.focus();
  }

  function closeHistory() {
    historyOverlay.classList.remove('open');
    historyOverlay.setAttribute('aria-hidden', 'true');
    btnHistory.focus();
  }

  btnHistory.addEventListener('click', openHistory);
  btnHistoryClose.addEventListener('click', closeHistory);
  historyOverlay.addEventListener('click', (e) => {
    if (e.target === historyOverlay) closeHistory();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && historyOverlay.classList.contains('open')) closeHistory();
  });

  btnHistoryClear.addEventListener('click', () => {
    history = [];
    renderHistory();
  });

  // ============================================================
  // CONTROL ROW BUTTONS (non-calculator)
  // ============================================================

  // Btn Minus (quick insert minus)
  document.getElementById('btn-minus').addEventListener('click', () => {
    handleInput('-');
    addPressAnim(document.getElementById('btn-minus'));
  });

  // Btn Window (placeholder / fullscreen toggle)
  document.getElementById('btn-window').addEventListener('click', () => {
    addPressAnim(document.getElementById('btn-window'));
    // Toggle a "focus" aesthetic – subtle pulse on calculator
    calculator.style.transition = 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)';
    calculator.style.transform  = 'scale(1.015)';
    setTimeout(() => { calculator.style.transform = ''; }, 250);
  });

  // ============================================================
  // INIT
  // ============================================================
  updateDisplay('', '');

})();
