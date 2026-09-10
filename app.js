import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { ADMIN_EMAIL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = id => document.getElementById(id);
let members = [];
let submissions = [];
let isAdmin = false;

function newId() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`; }
function dateKey(date = new Date()) { const y = date.getFullYear(); const m = String(date.getMonth() + 1).padStart(2, '0'); const d = String(date.getDate()).padStart(2, '0'); return `${y}-${m}-${d}`; }
function escapeHtml(value) { const el = document.createElement('div'); el.textContent = value ?? ''; return el.innerHTML; }
function formatDateTime(value) { return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); }
function memberName(id) { return members.find(member => member.id === id)?.name || '삭제된 회원'; }
function showNotice(text, type = 'error') {
  ['submitNotice', 'memberNotice', 'adminNotice'].forEach(id => {
    const notice = $(id);
    if (!notice) return;
    notice.textContent = text;
    notice.className = `notice ${type}`;
  });
}
function setConnectionStatus(text, type = '') {
  const status = $('connectionStatus');
  if (status) { status.textContent = text; status.className = `connection-status ${type}`; }
}
function normalizeMember(member) {
  return {
    id: member.id || newId(),
    name: String(member.name || '').trim(),
    aliases: Array.isArray(member.aliases) ? member.aliases.map(alias => String(alias).trim()).filter(Boolean) : []
  };
}
function loadLocalFallback() {
  try {
    const savedMembers = JSON.parse(localStorage.getItem('kakao-assignment-members-v1'));
    const savedSubmissions = JSON.parse(localStorage.getItem('kakao-assignment-submissions-v1'));
    members = Array.isArray(savedMembers) ? savedMembers.map(normalizeMember).filter(member => member.name) : [];
    submissions = Array.isArray(savedSubmissions) ? savedSubmissions : [];
  } catch { members = []; submissions = []; }
}
async function loadSharedData() {
  const [memberResult, submissionResult] = await Promise.all([
    supabase.from('members').select('id,name,aliases').order('name'),
    supabase.from('submissions').select('id,member_id,date,url,note,submitted_at,updated_at').order('submitted_at', { ascending: false })
  ]);
  if (memberResult.error) throw memberResult.error;
  if (submissionResult.error) throw submissionResult.error;
  members = memberResult.data.map(normalizeMember);
  submissions = submissionResult.data.map(item => ({
    id: item.id,
    memberId: item.member_id,
    date: item.date,
    url: item.url,
    note: item.note || '',
    submittedAt: item.submitted_at,
    updatedAt: item.updated_at
  }));
}
async function refreshData() {
  try {
    await loadSharedData();
    setConnectionStatus('온라인 공유 저장소 연결됨', 'online');
  } catch (error) {
    loadLocalFallback();
    setConnectionStatus('공유 저장소 연결 필요', 'offline');
    showNotice(`공유 데이터베이스를 불러오지 못했습니다: ${error.message}`);
  }
  renderMembers();
  renderHistory();
}
function renderSubmitterOptions() {
  const current = $('submitter').value;
  $('submitter').innerHTML = '<option value="">이름을 선택하세요</option>' + members.map(member => `<option value="${escapeHtml(member.id)}">${escapeHtml(member.name)}</option>`).join('');
  if (members.some(member => member.id === current)) $('submitter').value = current;
}
function renderAdminUi() {
  document.querySelectorAll('[data-admin-only]').forEach(element => { element.hidden = !isAdmin; });
  $('adminLoginForm').hidden = isAdmin;
  $('adminLogoutBtn').hidden = !isAdmin;
  $('adminStatus').textContent = isAdmin ? '관리자로 로그인되어 있습니다.' : '회원은 로그인 없이 과제와 제출물을 확인할 수 있습니다.';
  $('adminStatus').className = isAdmin ? 'admin-status logged-in' : 'admin-status';
}
function renderMembers() {
  const list = $('memberList');
  list.innerHTML = '';
  if (!members.length) list.innerHTML = '<p class="empty-box">등록된 회원이 없습니다.</p>';
  members.forEach(member => {
    const row = $('memberTemplate').content.firstElementChild.cloneNode(true);
    row.dataset.id = member.id;
    const nameInput = row.querySelector('.member-name');
    const aliasesInput = row.querySelector('.member-aliases');
    nameInput.value = member.name;
    aliasesInput.value = member.aliases.join('|');
    nameInput.disabled = !isAdmin;
    aliasesInput.disabled = !isAdmin;
    row.querySelector('.remove-member').hidden = !isAdmin;
    list.appendChild(row);
  });
  renderSubmitterOptions();
  renderAdminUi();
}
function renderHistory() {
  const day = $('historyDate').value || dateKey();
  const daySubmissions = submissions.filter(submission => submission.date === day);
  const byMember = members.map(member => ({ member, submission: daySubmissions.find(item => item.memberId === member.id) }));
  const submitted = byMember.filter(item => item.submission).length;
  const total = members.length;
  const rate = total ? Math.round(submitted / total * 100) : 0;
  $('totalCount').textContent = total;
  $('submittedCount').textContent = submitted;
  $('missingCount').textContent = total - submitted;
  $('rateText').textContent = `${rate}%`;
  $('progressBar').style.width = `${rate}%`;
  $('historyTitle').textContent = `${day} 제출 현황`;
  $('historyDescription').textContent = daySubmissions.length ? `${daySubmissions.length}명의 제출 기록이 있습니다.` : '이 날짜에는 제출 기록이 없습니다.';
  $('historyBody').innerHTML = byMember.length
    ? byMember.map(({ member, submission }) => `<tr><td><strong>${escapeHtml(member.name)}</strong></td><td><span class="badge ${submission ? 'done' : 'miss'}">${submission ? '제출완료' : '미제출'}</span></td><td>${submission ? formatDateTime(submission.submittedAt) : '—'}</td><td>${submission ? `<a href="${escapeHtml(submission.url)}" target="_blank" rel="noopener">결과물 열기 ↗</a>` : '—'}</td><td class="evidence">${submission ? escapeHtml(submission.note || '—') : '—'}</td><td>${submission && isAdmin ? `<button class="danger delete-submission" data-id="${escapeHtml(submission.id)}">삭제</button>` : '—'}</td></tr>`).join('')
    : '<tr><td colspan="6" class="empty">등록된 회원이 없습니다.</td></tr>';
  renderRecent();
}
function renderRecent() {
  const recent = [...submissions].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 30);
  $('recentList').innerHTML = recent.length
    ? recent.map(submission => `<div class="recent-row"><span><strong>${escapeHtml(memberName(submission.memberId))}</strong><small>${escapeHtml(submission.date)} · ${formatDateTime(submission.submittedAt)}</small></span><a href="${escapeHtml(submission.url)}" target="_blank" rel="noopener">${escapeHtml(submission.url)}</a></div>`).join('')
    : '<p class="empty-box">아직 제출 기록이 없습니다.</p>';
}
function parseCsvLine(line, delimiter = ',') {
  const fields = []; let field = ''; let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const character = line[i];
    if (character === '"' && line[i + 1] === '"' && quoted) { field += '"'; i++; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { fields.push(field.trim()); field = ''; }
    else field += character;
  }
  fields.push(field.trim());
  return fields;
}
function detectCsvDelimiter(line) { const candidates = [',', '\t', ';']; return candidates.sort((a, b) => line.split(b).length - line.split(a).length)[0]; }
function parseMembersCsv(input) {
  const lines = String(input).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = detectCsvDelimiter(lines[0]);
  const headerPattern = /^(이름|회원명|성명|닉네임|name|member)$/i;
  return lines.map(line => parseCsvLine(line, delimiter))
    .filter(fields => fields[0] && !headerPattern.test(fields[0].replace(/^\uFEFF/, '')))
    .map(fields => ({ name: fields[0], aliases: (fields[1] || '').split(/[|;]/).map(value => value.trim()).filter(Boolean) }));
}
async function readCsvFile(file) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  if (!utf8.includes('\uFFFD')) return utf8;
  try { return new TextDecoder('euc-kr').decode(buffer); } catch { return utf8; }
}
function csvDownload(name, rows) {
  const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(quote).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = name; link.click(); URL.revokeObjectURL(link.href);
}
async function submit(event) {
  event.preventDefault();
  const memberId = $('submitter').value;
  const date = $('submissionDate').value;
  const url = $('resultUrl').value.trim();
  const note = $('submissionNote').value.trim();
  if (!memberId || !date || !url) { showNotice('회원 이름, 제출 날짜, 결과물 링크를 모두 입력해 주세요.'); return; }
  try { new URL(url); } catch { showNotice('결과물 링크는 https:// 또는 http:// 주소로 입력해 주세요.'); return; }
  const old = submissions.find(submission => submission.memberId === memberId && submission.date === date);
  if (old && !isAdmin) { showNotice('이 회원은 해당 날짜에 이미 제출했습니다. 수정이 필요하면 관리자에게 요청해 주세요.'); return; }
  const payload = { member_id: memberId, date, url, note, updated_at: new Date().toISOString() };
  const result = old
    ? await supabase.from('submissions').update(payload).eq('id', old.id).select().single()
    : await supabase.from('submissions').insert(payload).select().single();
  if (result.error) { showNotice(`제출 기록을 저장하지 못했습니다: ${result.error.message}`); return; }
  $('historyDate').value = date;
  $('resultUrl').value = '';
  $('submissionNote').value = '';
  showNotice(old ? '기존 제출 기록을 업데이트했습니다.' : '제출 기록을 남겼습니다.', 'success');
  await refreshData();
}
async function loginAdmin(event) {
  event.preventDefault();
  const password = $('adminPassword').value;
  if (!password) { showNotice('관리자 비밀번호를 입력해 주세요.'); return; }
  const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
  if (error) { showNotice(`관리자 로그인에 실패했습니다: ${error.message}`); return; }
  $('adminPassword').value = '';
  showNotice('관리자로 로그인했습니다.', 'success');
  await refreshData();
}
async function logoutAdmin() { await supabase.auth.signOut(); isAdmin = false; renderMembers(); renderHistory(); showNotice('관리자 로그아웃했습니다.', 'success'); }
async function commitMemberInputs(event) {
  if (!isAdmin) return;
  const row = event.target.closest('.member-row');
  if (!row) return;
  const member = members.find(item => item.id === row.dataset.id);
  if (!member) return;
  const name = row.querySelector('.member-name').value.trim();
  const aliases = row.querySelector('.member-aliases').value.split(/[|,;]/).map(value => value.trim()).filter(Boolean);
  if (!name) { showNotice('회원 이름은 비워둘 수 없습니다.'); renderMembers(); return; }
  const { error } = await supabase.from('members').update({ name, aliases }).eq('id', member.id);
  if (error) { showNotice(`회원 정보를 저장하지 못했습니다: ${error.message}`); return; }
  await refreshData();
}
async function addMember() {
  if (!isAdmin) return;
  const { error } = await supabase.from('members').insert({ name: `새 회원 ${members.length + 1}`, aliases: [] });
  if (error) { showNotice(`회원을 추가하지 못했습니다: ${error.message}`); return; }
  await refreshData();
}
async function removeMember(event) {
  if (!isAdmin || !event.target.classList.contains('remove-member')) return;
  const id = event.target.closest('.member-row').dataset.id;
  if (!confirm('이 회원을 삭제할까요? 제출기록이 있으면 삭제할 수 없습니다.')) return;
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) { showNotice(`회원을 삭제하지 못했습니다: ${error.message}`); return; }
  await refreshData();
}
async function importMembers(event) {
  if (!isAdmin) return;
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = parseMembersCsv(await readCsvFile(file));
    if (!imported.length) { showNotice('가져올 회원이 없습니다. 이름 열이 있는 CSV인지 확인해 주세요.'); return; }
    const { error } = await supabase.from('members').upsert(imported, { onConflict: 'name' });
    if (error) throw error;
    showNotice(`${imported.length}명의 회원을 가져왔습니다.`, 'success');
    await refreshData();
  } catch (error) { showNotice(`CSV를 가져오지 못했습니다: ${error.message}`); }
  finally { event.target.value = ''; }
}
async function deleteSubmission(event) {
  if (!isAdmin || !event.target.classList.contains('delete-submission')) return;
  if (!confirm('이 제출기록을 삭제할까요?')) return;
  const { error } = await supabase.from('submissions').delete().eq('id', event.target.dataset.id);
  if (error) { showNotice(`제출기록을 삭제하지 못했습니다: ${error.message}`); return; }
  showNotice('제출기록을 삭제했습니다.', 'success');
  await refreshData();
}
function bindEvents() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(item => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.view').forEach(view => view.classList.toggle('active-view', view.id === tab.dataset.tab));
    if (tab.dataset.tab === 'history') renderHistory();
    if (tab.dataset.tab === 'members') renderMembers();
  }));
  $('submissionForm').addEventListener('submit', submit);
  $('adminLoginForm').addEventListener('submit', loginAdmin);
  $('adminLogoutBtn').addEventListener('click', logoutAdmin);
  $('historyDate').addEventListener('change', renderHistory);
  $('memberList').addEventListener('change', commitMemberInputs);
  $('memberList').addEventListener('click', removeMember);
  $('addMemberBtn').addEventListener('click', addMember);
  $('importMembersBtn').addEventListener('click', () => $('memberFileInput').click());
  $('memberFileInput').addEventListener('change', importMembers);
  $('historyBody').addEventListener('click', deleteSubmission);
  $('exportMembersBtn').addEventListener('click', () => csvDownload('회원_명단.csv', [['이름', '별칭'], ...members.map(member => [member.name, member.aliases.join('|')])]));
  $('exportSubmissionsBtn').addEventListener('click', () => csvDownload('과제_제출_기록.csv', [['날짜', '회원', '결과물 링크', '메모', '제출시각'], ...submissions.map(submission => [submission.date, memberName(submission.memberId), submission.url, submission.note, formatDateTime(submission.submittedAt)])]));
  $('copyMissingBtn').addEventListener('click', async () => {
    const day = $('historyDate').value;
    const missing = members.filter(member => !submissions.some(submission => submission.memberId === member.id && submission.date === day)).map(member => member.name);
    const [, month, date] = day.split('-');
    const text = `[${Number(month)}/${Number(date)} 과제 미제출] ${missing.join(', ')} — 확인 부탁드립니다`;
    try { await navigator.clipboard.writeText(text); showNotice('미제출자 명단을 복사했습니다.', 'success'); }
    catch { showNotice('클립보드 복사에 실패했습니다.'); }
  });
}
async function initialize() {
  $('todayLabel').textContent = `오늘 ${dateKey()}`;
  $('submissionDate').value = dateKey();
  $('historyDate').value = dateKey();
  bindEvents();
  const { data: { session } } = await supabase.auth.getSession();
  isAdmin = session?.user?.email === ADMIN_EMAIL;
  supabase.auth.onAuthStateChange((_event, nextSession) => { isAdmin = nextSession?.user?.email === ADMIN_EMAIL; renderMembers(); renderHistory(); });
  renderAdminUi();
  await refreshData();
}

initialize();
