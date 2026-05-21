export const SUPPORT_EMAIL = 'info@edu-shift.com';

const supportSubject = encodeURIComponent('Taskal AI 不具合・お問い合わせ');
const supportBody = encodeURIComponent(
  [
    '不具合やお問い合わせ内容をこちらにご記入ください。',
    '',
    '発生した画面:',
    '発生した操作:',
    '表示されたエラー:',
  ].join('\n')
);

export const SUPPORT_MAILTO_HREF = `mailto:${SUPPORT_EMAIL}?subject=${supportSubject}&body=${supportBody}`;
