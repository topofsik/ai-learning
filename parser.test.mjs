import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKakaoChat, isAttachmentOrLink } from './parser.js';

test('Android 형식과 여러 줄 메시지를 파싱한다', () => {
  const { messages } = parseKakaoChat(`2026년 9월 3일 오전 10:12, 행님 : 과제제출\n추가 설명입니다\n2026년 9월 3일 오후 1:01, 철수 : 사진`);
  assert.equal(messages.length, 2);
  assert.equal(messages[0].sender, '행님');
  assert.equal(messages[0].text, '과제제출\n추가 설명입니다');
  assert.equal(messages[1].date.getHours(), 13);
});

test('iOS 형식을 파싱한다', () => {
  const { messages } = parseKakaoChat('2026. 9. 3. 오전 10:12, 영희 : 제출 완료');
  assert.deepEqual([messages[0].sender, messages[0].dateKey], ['영희', '2026-09-03']);
});

test('PC 날짜 구분선과 첨부 파일 메시지를 파싱한다', () => {
  const { messages } = parseKakaoChat('--------------- 2026년 9월 3일 목요일 ---------------\n[민수] [오전 10:12] 파일: report.pdf');
  assert.equal(messages[0].text, '파일: report.pdf');
  assert.equal(isAttachmentOrLink(messages[0].text), true);
});

test('형식이 맞지 않으면 위치를 포함한 오류를 낸다', () => {
  assert.throws(() => parseKakaoChat('알 수 없는 형식'), /1행/);
});
