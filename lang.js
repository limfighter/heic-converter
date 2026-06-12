(() => {
  const PREF_KEY = 'pref.lang';
  const path = window.location.pathname;
  const isEn = path.endsWith('index-en.html') || path.endsWith('index-en') || path.endsWith('/en') || path.endsWith('/en/');
  const currentLang = isEn ? 'en' : 'ko';

  // 자동 리다이렉트: 첫 방문(설정 기록 없음)이고, 현재 페이지가 사용자 언어와 안 맞을 때만
  const saved = localStorage.getItem(PREF_KEY);
  if (!saved) {
    const browserLang = (navigator.language || 'ko').toLowerCase();
    const preferKo = browserLang.startsWith('ko');

    if (preferKo && isEn) {
      localStorage.setItem(PREF_KEY, 'ko');
      window.location.replace('index.html');
      return;
    }
    if (!preferKo && !isEn) {
      localStorage.setItem(PREF_KEY, 'en');
      window.location.replace('index-en.html');
      return;
    }
    localStorage.setItem(PREF_KEY, currentLang);
  }

  // 언어 선택 위젯 렌더링
  const wrap = document.createElement('div');
  wrap.className = 'lang-switcher';
  wrap.innerHTML = `
    <div class="lang-menu" id="langMenu" hidden>
      <a href="index.html" class="lang-option${currentLang === 'ko' ? ' active' : ''}" data-lang="ko">한국어</a>
      <a href="index-en.html" class="lang-option${currentLang === 'en' ? ' active' : ''}" data-lang="en">English</a>
    </div>
    <button id="langToggle" class="lang-toggle" aria-label="Language / 언어 선택" aria-expanded="false">
      ${currentLang === 'ko' ? '한국어' : 'English'}
    </button>
  `;
  document.body.appendChild(wrap);

  const toggle = document.getElementById('langToggle');
  const menu = document.getElementById('langMenu');

  toggle.addEventListener('click', () => {
    const open = !menu.hidden;
    menu.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
  });

  document.querySelectorAll('.lang-option').forEach(opt => {
    opt.addEventListener('click', () => {
      localStorage.setItem(PREF_KEY, opt.dataset.lang);
    });
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    }
  });
})();
