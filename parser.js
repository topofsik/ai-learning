const DATE_PATTERNS = {
  android: /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s?(.*)$/,
  ios: /^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s?(.*)$/,
  pcDate: /^-+\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s+\S요일)?\s*-+$/,
  pcMessage: /^\[(.+?)\]\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s?(.*)$/
};

function localDate(year, month, day, period, hour, minute) {
  let hours = Number(hour) % 12;
  if (period === '오후') hours += 12;
  return new Date(Number(year), Number(month) - 1, Number(day), hours, Number(minute));
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 카카오톡 Android/iOS/PC 내보내기 텍스트를 공통 메시지 배열로 변환한다. */
export function parseKakaoChat(input) {
  const lines = String(input ?? '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const messages = [];
  const warnings = [];
  let pcDate = null;
  let recognizedLines = 0;

  lines.forEach((line, index) => {
    let match = line.match(DATE_PATTERNS.android) || line.match(DATE_PATTERNS.ios);
    if (match) {
      const [, year, month, day, period, hour, minute, sender, text] = match;
      const date = localDate(year, month, day, period, hour, minute);
      messages.push({ sender: sender.trim(), text, date, dateKey: dateKey(date), line: index + 1 });
      recognizedLines++;
      return;
    }

    match = line.match(DATE_PATTERNS.pcDate);
    if (match) {
      pcDate = { year: match[1], month: match[2], day: match[3] };
      recognizedLines++;
      return;
    }

    match = line.match(DATE_PATTERNS.pcMessage);
    if (match) {
      if (!pcDate) {
        warnings.push(`${index + 1}행: PC 메시지 앞에 날짜 구분선이 없습니다.`);
        return;
      }
      const [, sender, period, hour, minute, text] = match;
      const date = localDate(pcDate.year, pcDate.month, pcDate.day, period, hour, minute);
      messages.push({ sender: sender.trim(), text, date, dateKey: dateKey(date), line: index + 1 });
      recognizedLines++;
      return;
    }

    if (line.trim() && messages.length) {
      messages[messages.length - 1].text += `\n${line}`;
    } else if (line.trim()) {
      // 카카오톡 저장 헤더는 흔하므로 오류가 아닌 미인식 행으로만 기록한다.
      if (!/님과 카카오톡 대화|저장한 날짜/.test(line)) {
        warnings.push(`${index + 1}행: 메시지 형식을 인식하지 못했습니다. “${line.slice(0, 60)}”`);
      }
    }
  });

  if (!messages.length) {
    const detail = warnings[0] || '지원하는 날짜/메시지 패턴을 찾지 못했습니다.';
    throw new Error(`대화 내용을 파싱하지 못했습니다. ${detail}`);
  }
  return { messages, warnings, recognizedLines };
}

export function isAttachmentOrLink(text) {
  const value = text.trim();
  return /^(사진|동영상|이모티콘|파일)(?:\s*:\s*.*)?$/i.test(value)
    || /https?:\/\/[^\s]+/i.test(value);
}
