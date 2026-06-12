(() => {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const resultList = document.getElementById('resultList');
  const statusBox = document.getElementById('status');
  const statusText = document.getElementById('statusText');
  const progressFill = document.getElementById('progressFill');
  const downloadZipBtn = document.getElementById('downloadZip');
  const qualitySlider = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const qualityGroup = document.getElementById('qualityGroup');
  const formatRadios = document.querySelectorAll('input[name="format"]');

  const PREF_FORMAT_KEY = 'pref.format';
  const PREF_QUALITY_KEY = 'pref.quality';

  // 변환 결과 보관 (ZIP용)
  let convertedFiles = []; // { name, blob }

  // ---------- 설정 복원 ----------
  function restorePrefs() {
    const savedFormat = localStorage.getItem(PREF_FORMAT_KEY);
    if (savedFormat) {
      const radio = document.querySelector(`input[name="format"][value="${savedFormat}"]`);
      if (radio) radio.checked = true;
    }
    const savedQuality = localStorage.getItem(PREF_QUALITY_KEY);
    if (savedQuality) {
      qualitySlider.value = savedQuality;
    }
    qualityValue.textContent = qualitySlider.value;
    updateQualityState();
  }

  function updateQualityState() {
    const format = getSelectedFormat();
    qualityGroup.classList.toggle('disabled', format === 'png');
  }

  function getSelectedFormat() {
    return document.querySelector('input[name="format"]:checked').value;
  }

  formatRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      localStorage.setItem(PREF_FORMAT_KEY, getSelectedFormat());
      updateQualityState();
    });
  });

  qualitySlider.addEventListener('input', () => {
    qualityValue.textContent = qualitySlider.value;
    localStorage.setItem(PREF_QUALITY_KEY, qualitySlider.value);
  });

  restorePrefs();

  // ---------- 파일 선택 ----------
  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });
  dropzone.setAttribute('tabindex', '0');
  dropzone.setAttribute('role', 'button');

  fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(evt => {
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    handleFiles(files);
  });

  // ---------- 메인 처리 ----------
  function isHeicFile(file) {
    const name = file.name.toLowerCase();
    return name.endsWith('.heic') || name.endsWith('.heif') ||
           file.type === 'image/heic' || file.type === 'image/heif';
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  async function handleFiles(fileListRaw) {
    const allFiles = Array.from(fileListRaw);
    const heicFiles = allFiles.filter(isHeicFile);

    if (heicFiles.length === 0) {
      alert('HEIC 또는 HEIF 파일을 선택해주세요.');
      return;
    }

    convertedFiles = [];
    resultList.innerHTML = '';
    resultList.hidden = false;
    statusBox.hidden = false;
    downloadZipBtn.hidden = true;

    const format = getSelectedFormat();
    const quality = parseFloat(qualitySlider.value);
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    let done = 0;
    const total = heicFiles.length;
    updateProgress(done, total);

    // 결과 아이템 미리 렌더링 (대기 상태)
    const itemEls = heicFiles.map(file => createResultItem(file.name, file.size));
    itemEls.forEach(el => resultList.appendChild(el));

    // 한 장씩 순차 변환 (메모리 보호)
    for (let i = 0; i < heicFiles.length; i++) {
      const file = heicFiles[i];
      const itemEl = itemEls[i];
      setItemStatus(itemEl, 'working', '변환 중');

      try {
        const result = await heic2any({
          blob: file,
          toType: mimeType,
          quality: format === 'png' ? undefined : quality
        });

        // heic2any가 배열을 반환할 수 있음(다중 이미지 HEIC) → 첫 장만 사용
        const blob = Array.isArray(result) ? result[0] : result;

        const baseName = file.name.replace(/\.(heic|heif)$/i, '');
        const outName = `${baseName}.${ext}`;

        convertedFiles.push({ name: outName, blob });

        const url = URL.createObjectURL(blob);
        setItemStatus(itemEl, 'done', '완료', () => {
          const sizeEl = itemEl.querySelector('.result-meta');
          sizeEl.textContent = `${formatBytes(file.size)} → ${formatBytes(blob.size)}`;
        });
        addDownloadLink(itemEl, url, outName);

      } catch (err) {
        console.error('변환 실패:', file.name, err);
        setItemStatus(itemEl, 'error', '실패');
      }

      done++;
      updateProgress(done, total);
    }

    if (convertedFiles.length > 1) {
      downloadZipBtn.hidden = false;
    }
  }

  function createResultItem(name, size) {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.innerHTML = `
      <div class="result-info">
        <span class="result-name">${escapeHtml(name)}</span>
        <span class="result-meta">${formatBytes(size)}</span>
      </div>
      <span class="result-status waiting">대기</span>
    `;
    return li;
  }

  function setItemStatus(itemEl, statusClass, label, onApply) {
    const statusEl = itemEl.querySelector('.result-status');
    statusEl.className = `result-status ${statusClass}`;
    statusEl.textContent = label;
    if (onApply) onApply();
  }

  function addDownloadLink(itemEl, url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.className = 'result-download';
    a.textContent = '다운로드';
    itemEl.appendChild(a);
  }

  function updateProgress(done, total) {
    statusText.textContent = `${done} / ${total} 변환 완료`;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    progressFill.style.width = `${pct}%`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- ZIP 다운로드 ----------
  downloadZipBtn.addEventListener('click', async () => {
    if (convertedFiles.length === 0) return;

    downloadZipBtn.disabled = true;
    downloadZipBtn.textContent = 'ZIP 생성 중…';

    try {
      const zip = new JSZip();
      convertedFiles.forEach(({ name, blob }) => {
        zip.file(name, blob);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'converted_images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('ZIP 생성 실패:', err);
      alert('ZIP 파일 생성 중 오류가 발생했습니다.');
    } finally {
      downloadZipBtn.disabled = false;
      downloadZipBtn.textContent = '전체 ZIP으로 다운로드';
    }
  });
})();
