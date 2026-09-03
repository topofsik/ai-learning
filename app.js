import { parseKakaoChat, isAttachmentOrLink, dateKey } from './parser.js';

const DEFAULT_KEYWORDS = ['과제제출', '과제 제출', '제출완료', '제출 완료', '제출합니다', '완료', '제출'];
const STORAGE_KEY = 'kakao-assignment-members-v1';
const $ = (id) => document.getElementById(id);
let messages = [];
let members = loadMembers();
let currentResults = [];

function runParserSelfTests() {
  const cases = [
    ['Android + 여러 줄', () => { const m = parseKakaoChat('2026년 9월 3일 오전 10:12, 행님 : 과제제출\n추가 설명').messages[0]; return m.sender === '행님' && m.text === '과제제출\n추가 설명'; }],
    ['iOS', () => parseKakaoChat('2026. 9. 3. 오전 10:12, 영희 : 제출 완료').messages[0].dateKey === '2026-09-03'],
    ['PC + 파일 첨부', () => { const m = parseKakaoChat('--------------- 2026년 9월 3일 목요일 ---------------\n[민수] [오전 10:12] 파일: report.pdf').messages[0]; return m.sender === '민수' && isAttachmentOrLink(m.text); }],
    ['잘못된 형식 오류 위치', () => { try { parseKakaoChat('알 수 없는 형식'); return false; } catch (e) { return e.message.includes('1행'); } }]
  ];
  const results = cases.map(([name, test]) => { try { return { name, pass: Boolean(test()) }; } catch { return { name, pass: false }; } });
  const passed = results.filter(result => result.pass).length;
  $('testSummary').textContent = `${passed}/${results.length} 통과`;
  $('testSummary').className = passed === results.length ? 'test-pass' : 'test-fail';
  $('testResults').innerHTML = results.map(result => `<span class="test-chip ${result.pass ? 'pass' : 'fail'}">${result.pass ? '✓' : '✕'} ${result.name}</span>`).join('');
}

function loadMembers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveMembers() { localStorage.setItem(STORAGE_KEY, JSON.stringify(members)); }
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
function aliasesOf(member) { return [member.name, ...member.aliases].map(v => v.trim()).filter(Boolean); }
function memberForSender(sender) { return members.find(member => aliasesOf(member).includes(sender)); }
function formatTime(date) { return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date); }
function showNotice(text, type = 'error') { $('notice').textContent = text; $('notice').className = `notice ${type}`; }
function clearNotice() { $('notice').className = 'notice hidden'; }
function parseKeywords() { return $('keywords').value.split(',').map(v => v.trim()).filter(Boolean); }
function qualifies(message) {
  return parseKeywords().some(keyword => message.text.includes(keyword))
    || ($('attachmentOption').checked && isAttachmentOrLink(message.text));
}

function calculateForDate(day) {
  const dayMessages = messages.filter(message => message.dateKey === day);
  return members.map(member => {
    const submission = dayMessages
      .filter(message => aliasesOf(member).includes(message.sender) && qualifies(message))
      .sort((a, b) => a.date - b.date)[0];
    return { member, submission };
  });
}

function renderDaily() {
  const day = $('targetDate').value;
  currentResults = calculateForDate(day);
  const submitted = currentResults.filter(result => result.submission).length;
  const total = members.length;
  const rate = total ? Math.round(submitted / total * 100) : 0;
  $('totalCount').textContent = total; $('submittedCount').textContent = submitted;
  $('missingCount').textContent = total - submitted; $('rateText').textContent = `${rate}%`;
  $('progressBar').style.width = `${rate}%`;
  const dayCount = messages.filter(message => message.dateKey === day).length;
  $('dailyDescription').textContent = dayCount ? `${day} 메시지 ${dayCount}개를 기준으로 판정했습니다.` : `${day || '선택한 날짜'}에 해당하는 메시지가 없습니다.`;
  if (!members.length) {
    $('resultBody').innerHTML = '<tr><td colspan="4" class="empty">멤버 관리에서 명단을 먼저 추가해 주세요.</td></tr>';
    return;
  }
  $('resultBody').innerHTML = currentResults.map(({ member, submission }) => `<tr>
    <td><strong>${escapeHtml(member.name)}</strong></td>
    <td><span class="badge ${submission ? 'done' : 'miss'}">${submission ? '제출완료' : '미제출'}</span></td>
    <td>${submission ? formatTime(submission.date) : '—'}</td>
    <td class="evidence" title="${escapeHtml(submission?.text || '')}">${submission ? escapeHtml(submission.text.replace(/\n/g, ' ').slice(0, 90)) : '—'}</td>
  </tr>`).join('');
}

function renderMembers() {
  const list = $('memberList');
  list.innerHTML = '';
  if (!members.length) list.innerHTML = '<p class="empty-box">아직 등록된 멤버가 없습니다. 멤버를 추가해 주세요.</p>';
  members.forEach(member => {
    const row = $('memberTemplate').content.firstElementChild.cloneNode(true);
    row.dataset.id = member.id;
    row.querySelector('.member-name').value = member.name;
    row.querySelector('.member-aliases').value = member.aliases.join(', ');
    list.appendChild(row);
  });
  renderUnknowns();
}

function commitMemberInputs() {
  document.querySelectorAll('.member-row').forEach(row => {
    const member = members.find(item => item.id === row.dataset.id);
    if (!member) return;
    member.name = row.querySelector('.member-name').value.trim();
    member.aliases = row.querySelector('.member-aliases').value.split(',').map(v => v.trim()).filter(Boolean);
  });
  saveMembers(); renderDaily();
}

function renderUnknowns() {
  const senders = [...new Set(messages.map(message => message.sender))].filter(sender => !memberForSender(sender));
  $('unknownPanel').classList.toggle('hidden', !senders.length);
  $('unknownList').innerHTML = senders.map(sender => `<div class="unknown-row"><strong>${escapeHtml(sender)}</strong><div><button class="secondary add-unknown" data-sender="${escapeHtml(sender)}">새 멤버로 추가</button><select class="link-unknown" data-sender="${escapeHtml(sender)}"><option value="">기존 멤버 별칭으로 연결…</option>${members.map(m => `<option value="${m.id}">${escapeHtml(m.name)}</option>`).join('')}</select></div></div>`).join('');
}

function renderStats() {
  const start = $('startDate').value, end = $('endDate').value;
  if (!start || !end || start > end) { $('statsDescription').textContent = '올바른 시작일과 종료일을 선택해 주세요.'; return; }
  const activeDays = [...new Set(messages.map(m => m.dateKey).filter(day => day >= start && day <= end))].sort();
  $('statsDescription').textContent = activeDays.length ? `${start} ~ ${end}, 대화가 있는 ${activeDays.length}일 기준` : '선택한 기간에 해당하는 메시지가 없습니다.';
  $('statsBody').innerHTML = members.length ? members.map(member => {
    const count = activeDays.filter(day => calculateForDate(day).find(r => r.member.id === member.id)?.submission).length;
    const perfect = activeDays.length > 0 && count === activeDays.length;
    return `<tr><td><strong>${escapeHtml(member.name)}</strong></td><td>${count}회</td><td>${activeDays.length}일</td><td><span class="badge ${perfect ? 'done' : 'miss'}">${perfect ? '개근' : '미달'}</span></td></tr>`;
  }).join('') : '<tr><td colspan="4" class="empty">등록된 멤버가 없습니다.</td></tr>';
}

async function analyze() {
  clearNotice();
  try {
    const result = parseKakaoChat($('chatText').value);
    messages = result.messages;
    const days = [...new Set(messages.map(m => m.dateKey))].sort();
    $('targetDate').value = days.at(-1);
    $('startDate').value = days[0]; $('endDate').value = days.at(-1);
    $('parseMeta').textContent = `${messages.length}개 메시지 · ${days.length}일 · ${new Set(messages.map(m => m.sender)).size}명 감지`;
    showNotice(result.warnings.length ? `분석 완료. 참고: ${result.warnings.slice(0, 2).join(' ')}` : '대화록 분석을 완료했습니다.', 'success');
    renderMembers(); renderDaily();
  } catch (error) { showNotice(error.message); }
}

$('keywords').value = DEFAULT_KEYWORDS.join(', ');
runParserSelfTests();
renderMembers(); renderDaily();

document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active-view', view.id === tab.dataset.tab));
  if (tab.dataset.tab === 'stats') renderStats();
}));
$('dropZone').addEventListener('click', () => $('fileInput').click());
$('dropZone').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') $('fileInput').click(); });
['dragenter', 'dragover'].forEach(name => $('dropZone').addEventListener(name, e => { e.preventDefault(); $('dropZone').classList.add('dragging'); }));
['dragleave', 'drop'].forEach(name => $('dropZone').addEventListener(name, e => { e.preventDefault(); $('dropZone').classList.remove('dragging'); }));
$('dropZone').addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
$('fileInput').addEventListener('change', e => loadFile(e.target.files[0]));
async function loadFile(file) {
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.txt')) { showNotice('.txt 파일만 업로드할 수 있습니다.'); return; }
  $('chatText').value = await file.text(); $('parseMeta').textContent = file.name; await analyze();
}
$('parseBtn').addEventListener('click', analyze);
['targetDate', 'keywords', 'attachmentOption'].forEach(id => $(id).addEventListener('change', renderDaily));
$('addMemberBtn').addEventListener('click', () => { members.push({ id: crypto.randomUUID(), name: '새 멤버', aliases: [] }); saveMembers(); renderMembers(); });
$('memberList').addEventListener('input', commitMemberInputs);
$('memberList').addEventListener('click', e => { if (!e.target.classList.contains('remove-member')) return; members = members.filter(m => m.id !== e.target.closest('.member-row').dataset.id); saveMembers(); renderMembers(); renderDaily(); });
$('unknownList').addEventListener('click', e => { if (!e.target.classList.contains('add-unknown')) return; const sender = e.target.dataset.sender; members.push({ id: crypto.randomUUID(), name: sender, aliases: [] }); saveMembers(); renderMembers(); renderDaily(); });
$('unknownList').addEventListener('change', e => { if (!e.target.classList.contains('link-unknown') || !e.target.value) return; const member = members.find(m => m.id === e.target.value); if (member && !member.aliases.includes(e.target.dataset.sender)) member.aliases.push(e.target.dataset.sender); saveMembers(); renderMembers(); renderDaily(); });
$('statsBtn').addEventListener('click', renderStats);
$('copyBtn').addEventListener('click', async () => {
  const missing = currentResults.filter(r => !r.submission).map(r => r.member.name);
  const day = $('targetDate').value; const [, month, date] = day.split('-');
  const text = `[${Number(month)}/${Number(date)} 과제 미제출] ${missing.join(', ')} — 확인 부탁드립니다`;
  try { await navigator.clipboard.writeText(text); showNotice('미제출자 명단을 클립보드에 복사했습니다.', 'success'); } catch { showNotice('클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.'); }
});
$('csvBtn').addEventListener('click', () => {
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const rows = [['이름', '상태', '제출시각', '근거 메시지'], ...currentResults.map(r => [r.member.name, r.submission ? '제출완료' : '미제출', r.submission ? formatTime(r.submission.date) : '', r.submission?.text || ''])];
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `제출현황_${$('targetDate').value}.csv`; link.click(); URL.revokeObjectURL(link.href);
});
