export type SignUpStatus =
  | 'confirmation_sent'
  | 'existing_or_confirmation_resent'
  | 'signed_in';

export interface SignUpResult {
  error: Error | null;
  status?: SignUpStatus;
}

export function validateSignupPasswords(password: string, confirmation: string): string | null {
  if (password.length < 6) {
    return 'パスワードは6文字以上で入力してください。';
  }
  if (password !== confirmation) {
    return 'パスワードが一致しません。';
  }
  return null;
}

/** Supabase GoTrue の英語エラーメッセージを日本語に変換する。 */
export function normalizeAuthError(message: string): string {
  const translations: Array<[string, string]> = [
    ['Error sending confirmation email', '確認メールの送信に失敗しました。しばらくしてからお試しください。'],
    ['Unable to validate email address: invalid format', 'メールアドレスの形式が正しくありません。'],
    ['User already registered', 'このメールアドレスは既に登録されています。'],
    ['Invalid login credentials', 'メールアドレスまたはパスワードが正しくありません。'],
    ['Email rate limit exceeded', 'メール送信の制限に達しました。しばらくしてからお試しください。'],
    ['Password should be at least 6 characters', 'パスワードは6文字以上で入力してください。'],
    ['Signups not allowed for this instance', '現在新規登録を受け付けていません。'],
    ['User not found', 'このメールアドレスのアカウントが見つかりません。先に新規登録してください。'],
    ['Signup requires a valid password', '先に新規登録してください。'],
    ['Email link is invalid or has expired', 'メールリンクが無効または期限切れです。再度お試しください。'],
    ['For security purposes, you can only request this after 60 seconds', 'セキュリティのため、60秒後に再度お試しください。'],
  ];

  return translations.find(([source]) => message.includes(source))?.[1] ?? message;
}

export function signupSuccessMessage(status: SignUpStatus): string {
  if (status === 'confirmation_sent') {
    return '確認メールを送信しました。メールをご確認ください。';
  }
  if (status === 'existing_or_confirmation_resent') {
    return '登録状況をご確認ください。未確認の場合に限り、確認メールが届きます。確認済みの場合はログインしてください。';
  }
  return '登録が完了しました。';
}
