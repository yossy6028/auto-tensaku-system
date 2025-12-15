/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GradingReport } from '@/components/GradingReport';
import { FileText, CheckCircle, AlertCircle, Loader2, Sparkles, ArrowRight, BookOpen, PenTool, GraduationCap, Plus, Trash2, CreditCard, LogIn, UserPlus, Edit3, Save, X, User, UserCheck, ImageIcon, Camera } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/components/AuthProvider';
import { UserMenu } from '@/components/UserMenu';
import { AuthModal } from '@/components/AuthModal';
import { UsageStatus } from '@/components/UsageStatus';
import { DeviceLimitModal } from '@/components/DeviceLimitModal';
import Link from 'next/link';
import { compressMultipleImages, formatFileSize, isImageFile } from '@/lib/utils/imageCompressor';

type GradingStrictness = 'lenient' | 'standard' | 'strict';

type DeductionDetail = {
  reason?: string;
  deduction_percentage?: number;
  advice?: string;
};

type FeedbackContent = {
  good_point?: string;
  improvement_advice?: string;
  rewrite_example?: string;
};

type GradingResultPayload = {
  score: number;
  recognized_text?: string;
  recognized_text_full?: string;
  deduction_details?: DeductionDetail[];
  feedback_content: FeedbackContent;
};

type OcrResponseData = {
  ocrResults?: Record<string, { text: string; charCount: number }>;
  ocrResult?: { text: string; charCount: number };
  error?: string;
  message?: string;
  status?: string;
};

type GradingResponseItem = {
  label: string;
  result?: { grading_result?: GradingResultPayload };
  error?: string;
  status?: string;
  strictness?: GradingStrictness;
  regradeToken?: string | null;
  regradeRemaining?: number | null;
  regradeMode?: 'new' | 'free' | 'none';
};

export default function Home() {
  const { 
    user, 
    usageInfo, 
    refreshUsageInfo, 
    isLoading: authLoading, 
    profile, 
    session,
    // デバイス制限関連
    deviceInfo,
    deviceLimitInfo,
    showDeviceLimitModal,
    setShowDeviceLimitModal,
    removeDevice,
    retryDeviceRegistration,
  } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');

  // 問題形式タイプ: 'big-small' = 大問+小問, 'small-only' = 問のみ, 'free' = 自由入力
  const [problemFormat, setProblemFormat] = useState<'big-small' | 'small-only' | 'free'>('big-small');
  // 小問の表記形式: 'number' = 問1, 'paren-number' = (1), 'paren-alpha' = (a), 'number-sub' = 問1-2
  const [smallFormat, setSmallFormat] = useState<'number' | 'paren-number' | 'paren-alpha' | 'number-sub'>('number');

  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [currentBig, setCurrentBig] = useState(1);
  const [currentSmall, setCurrentSmall] = useState(1);
  const [currentSub, setCurrentSub] = useState(1); // サブ番号（問1-2の「2」）
  const [freeInput, setFreeInput] = useState(''); // 自由入力用
  
  // 一括追加モード
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchEndSmall, setBatchEndSmall] = useState(5); // 終了番号（デフォルト5）

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [answerFileIndex, setAnswerFileIndex] = useState<number | null>(null);
  // 各ファイルの役割を管理
  // answer=答案, problem=問題, model=模範解答, problem_model=問題+模範解答, all=全部, other=その他
  type FileRole = 'answer' | 'problem' | 'model' | 'problem_model' | 'answer_problem' | 'all' | 'other';
  const [fileRoles, setFileRoles] = useState<Record<number, FileRole>>({});

  // 採点の厳しさ（3段階）
  const [gradingStrictness, setGradingStrictness] = useState<GradingStrictness>('standard');

  // 無料再採点トークン（labelごと）
  const [regradeByLabel, setRegradeByLabel] = useState<Record<string, { token: string; remaining: number }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<GradingResponseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requirePlan, setRequirePlan] = useState(false);
  
  // 画像圧縮中の状態
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionFileName, setCompressionFileName] = useState('');

  // OCR確認フロー用のステート
  type OcrFlowStep = 'idle' | 'ocr-loading' | 'confirm' | 'grading';
  const [ocrFlowStep, setOcrFlowStep] = useState<OcrFlowStep>('idle');
  const [ocrResults, setOcrResults] = useState<Record<string, { text: string; charCount: number }>>({});
  const [confirmedTexts, setConfirmedTexts] = useState<Record<string, string>>({});
  const [currentOcrLabel, setCurrentOcrLabel] = useState<string>('');

  // PDFページ番号指定（複数ページPDF対応）
  const [pdfPageInfo, setPdfPageInfo] = useState<{
    answerPage: string;      // 答案のあるページ番号
    problemPage: string;     // 問題文のあるページ番号
    modelAnswerPage: string; // 模範解答のあるページ番号
  }>({
    answerPage: '',
    problemPage: '',
    modelAnswerPage: ''
  });

  // 生徒名・添削担当者名
  const [studentName, setStudentName] = useState('');
  const [teacherName, setTeacherName] = useState('');

  // 編集されたフィードバック（インデックスごと）
  const [editedFeedbacks, setEditedFeedbacks] = useState<Record<number, {
    good_point?: string;
    improvement_advice?: string;
    rewrite_example?: string;
  }>>({});

  // 編集モード（インデックスごと、フィールドごと）
  const [editingFields, setEditingFields] = useState<Record<number, {
    good_point?: boolean;
    improvement_advice?: boolean;
    rewrite_example?: boolean;
  }>>({});

  const strictnessLabel = (s: GradingStrictness): string => {
    switch (s) {
      case 'lenient':
        return '甘め';
      case 'strict':
        return '厳しめ';
      case 'standard':
      default:
        return '標準';
    }
  };

  const ingestRegradeInfo = (items: GradingResponseItem[]) => {
    setRegradeByLabel((prev) => {
      const next = { ...prev };
      for (const item of items) {
        if (item.regradeToken && typeof item.regradeRemaining === 'number') {
          next[item.label] = { token: item.regradeToken, remaining: item.regradeRemaining };
        }
      }
      return next;
    });
  };

  const componentRefs = useRef<Map<number, React.RefObject<HTMLDivElement | null>>>(new Map());

  // セッションがなくなった場合、エラーメッセージをクリア
  useEffect(() => {
    if (!session || !user) {
      console.log('[Page] Session or user is null, clearing error message', { hasSession: !!session, hasUser: !!user });
      setError(null);
      setRequirePlan(false);
    }
  }, [session, user]);

  const getComponentRef = (index: number): React.RefObject<HTMLDivElement | null> => {
    if (!componentRefs.current.has(index)) {
      componentRefs.current.set(index, React.createRef<HTMLDivElement>());
    }
    return componentRefs.current.get(index)!;
  };

  // 編集開始
  const startEditing = (index: number, field: 'good_point' | 'improvement_advice' | 'rewrite_example') => {
    setEditingFields(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: true }
    }));

    // 初期値を設定（まだ編集されていない場合）
    if (!editedFeedbacks[index]?.[field] && results?.[index]) {
      const originalValue = results[index].result?.grading_result?.feedback_content?.[field];
      if (originalValue) {
        setEditedFeedbacks(prev => ({
          ...prev,
          [index]: { ...prev[index], [field]: originalValue }
        }));
      }
    }
  };

  // 編集保存
  const saveEditing = (index: number, field: 'good_point' | 'improvement_advice' | 'rewrite_example') => {
    setEditingFields(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: false }
    }));
  };

  // 編集キャンセル
  const cancelEditing = (index: number, field: 'good_point' | 'improvement_advice' | 'rewrite_example') => {
    setEditingFields(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: false }
    }));
    // 元の値に戻す
    const originalValue = results?.[index]?.result?.grading_result?.feedback_content?.[field];
    setEditedFeedbacks(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: originalValue }
    }));
  };

  // 編集値の更新
  const updateEditedFeedback = (index: number, field: 'good_point' | 'improvement_advice' | 'rewrite_example', value: string) => {
    setEditedFeedbacks(prev => ({
      ...prev,
      [index]: { ...prev[index], [field]: value }
    }));
  };

  // 表示するフィードバック値を取得
  const getDisplayFeedback = (index: number, field: 'good_point' | 'improvement_advice' | 'rewrite_example') => {
    return editedFeedbacks[index]?.[field] ?? results?.[index]?.result?.grading_result?.feedback_content?.[field] ?? '';
  };

  // HTMLエスケープ関数（XSS対策）
  const escapeHtml = (text: string): string => {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
  };

  const handlePrint = async (index: number) => {
    const componentRef = getComponentRef(index);
    if (!componentRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // 画像をbase64に変換
    let imageDataUrl = '';
    const answerFile = answerFileIndex !== null ? uploadedFiles[answerFileIndex] : uploadedFiles[0];
    if (answerFile && answerFile.type.startsWith('image/')) {
      const reader = new FileReader();
      imageDataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(answerFile);
      });
    }

    const res = results?.[index];
    const gradingResult = res?.result?.grading_result;
    if (!gradingResult) return;

    const today = new Date().toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const normalizeScore = (score: number): number => {
      if (typeof score !== 'number' || Number.isNaN(score)) return 0;
      if (score <= 10) return Math.min(100, Math.round(score * 10));
      return Math.min(100, Math.round(score));
    };

    const score = normalizeScore(gradingResult.score);
    const deductionDetails = gradingResult.deduction_details ?? [];
    // ユーザー入力をエスケープ（XSS対策）
    const safeStudentName = studentName ? escapeHtml(studentName) : '';
    const safeTeacherName = teacherName ? escapeHtml(teacherName) : '';
    const safeLabel = escapeHtml(res.label);
    
    const feedback = {
      good_point: escapeHtml(editedFeedbacks[index]?.good_point ?? gradingResult.feedback_content.good_point ?? ''),
      improvement_advice: escapeHtml(editedFeedbacks[index]?.improvement_advice ?? gradingResult.feedback_content.improvement_advice ?? ''),
      rewrite_example: escapeHtml(editedFeedbacks[index]?.rewrite_example ?? gradingResult.feedback_content.rewrite_example ?? ''),
    };

    const printStyles = `
      @page {
        size: A4;
        margin: 15mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #1e293b;
        margin: 0;
        padding: 0;
      }
      .report-container {
        max-width: 100%;
        padding: 0;
      }
      .header-label {
        display: inline-block;
        background: #4f46e5;
        color: white;
        padding: 8px 20px;
        border-radius: 8px;
        font-size: 16pt;
        font-weight: bold;
        margin-bottom: 15px;
      }
      .header-section {
        border-bottom: 2px solid #1e293b;
        padding-bottom: 12px;
        margin-bottom: 20px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }
      .header-title {
        font-size: 18pt;
        font-weight: bold;
        margin: 0 0 5px 0;
      }
      .header-info {
        font-size: 10pt;
        color: #64748b;
      }
      .score-feedback-row {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        page-break-inside: avoid;
      }
      .score-box {
        width: 35%;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
      }
      .score-label {
        font-size: 9pt;
        color: #64748b;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 5px;
      }
      .score-value {
        font-size: 48pt;
        font-weight: 900;
        color: #1e293b;
        line-height: 1;
      }
      .score-unit {
        font-size: 18pt;
        color: #94a3b8;
        margin-left: 2px;
      }
      .deduction-list {
        font-size: 9pt;
        color: #64748b;
        margin-top: 10px;
        text-align: left;
        list-style: none;
        padding: 0;
      }
      .deduction-list li {
        margin: 3px 0;
      }
      .feedback-column {
        width: 65%;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .feedback-box {
        padding: 12px 15px;
        border-radius: 10px;
        page-break-inside: avoid;
      }
      .feedback-good {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
      }
      .feedback-improve {
        background: #eef2ff;
        border: 1px solid #c7d2fe;
      }
      .feedback-title {
        font-size: 10pt;
        font-weight: bold;
        margin-bottom: 5px;
      }
      .feedback-good .feedback-title { color: #166534; }
      .feedback-improve .feedback-title { color: #3730a3; }
      .feedback-text {
        font-size: 10pt;
        color: #334155;
        margin: 0;
        white-space: pre-wrap;
      }
      .section {
        margin-bottom: 20px;
        page-break-inside: avoid;
      }
      .section-title {
        font-size: 12pt;
        font-weight: bold;
        padding-left: 12px;
        margin-bottom: 10px;
        display: flex;
        align-items: center;
      }
      .section-title::before {
        content: '';
        display: inline-block;
        width: 4px;
        height: 18px;
        margin-right: 8px;
        border-radius: 2px;
      }
      .section-ai .section-title::before { background: #60a5fa; }
      .section-deduction .section-title::before { background: #f87171; }
      .section-rewrite .section-title::before { background: #fbbf24; }
      .section-answer .section-title::before { background: #94a3b8; }
      .section-content {
        padding: 15px;
        border-radius: 10px;
        border: 1px solid #e2e8f0;
      }
      .section-ai .section-content {
        background: #eff6ff;
        border-color: #bfdbfe;
      }
      .section-rewrite .section-content {
        background: #fefce8;
        border-color: #fef08a;
      }
      .section-answer .section-content {
        background: #f8fafc;
      }
      .mono-text {
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
        font-size: 10pt;
        white-space: pre-wrap;
      }
      .note-text {
        font-size: 8pt;
        color: #64748b;
        text-align: right;
        margin-top: 8px;
      }
      .deduction-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 10pt;
      }
      .deduction-table th {
        background: #f1f5f9;
        padding: 10px;
        text-align: left;
        font-weight: bold;
        border-bottom: 1px solid #e2e8f0;
      }
      .deduction-table td {
        padding: 10px;
        border-bottom: 1px solid #f1f5f9;
      }
      .deduction-table .amount {
        text-align: right;
        color: #dc2626;
        font-weight: bold;
        width: 80px;
      }
      .rewrite-text {
        font-size: 11pt;
        line-height: 1.8;
        color: #1e293b;
        font-family: 'Hiragino Mincho ProN', 'Yu Mincho', serif;
      }
      .answer-image {
        max-width: 100%;
        max-height: 400px;
        object-fit: contain;
        display: block;
        margin: 0 auto;
        background: white;
      }
      .page-break {
        page-break-before: always;
      }
    `;

    const deductionTableRows = deductionDetails.map((item: DeductionDetail) =>
      `<tr><td>${escapeHtml(item.reason ?? '')}</td><td class="amount">-${item.deduction_percentage}%</td></tr>`
    ).join('');

    const deductionListItems = deductionDetails.map((item: DeductionDetail) =>
      `<li>・${escapeHtml(item.reason ?? '')} で -${item.deduction_percentage}%</li>`
    ).join('');

    const safeRecognizedText = gradingResult.recognized_text ? escapeHtml(gradingResult.recognized_text) : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>採点レポート - ${safeLabel}</title>
  <style>${printStyles}</style>
</head>
<body>
  <div class="report-container">
    <div class="header-label">${safeLabel}</div>
    
    <div class="header-section">
      <div>
        <h1 class="header-title">採点レポート</h1>
        ${safeStudentName ? `<div class="header-info">生徒名: ${safeStudentName}</div>` : ''}
      </div>
      <div style="text-align: right;">
        <div class="header-info">実施日: ${today}</div>
        ${safeTeacherName ? `<div class="header-info">添削担当: ${safeTeacherName}</div>` : ''}
      </div>
    </div>

    <div class="score-feedback-row">
      <div class="score-box">
        <div class="score-label">総合スコア (100%満点)</div>
        <div><span class="score-value">${score}</span><span class="score-unit">%</span></div>
        ${deductionDetails.length > 0 ? `<ul class="deduction-list">${deductionListItems}</ul>` : ''}
      </div>
      <div class="feedback-column">
        <div class="feedback-box feedback-good">
          <div class="feedback-title">👍 良かった点</div>
          <p class="feedback-text">${feedback.good_point}</p>
        </div>
        <div class="feedback-box feedback-improve">
          <div class="feedback-title">💡 改善のアドバイス</div>
          <p class="feedback-text">${feedback.improvement_advice}</p>
        </div>
      </div>
    </div>

    ${safeRecognizedText ? `
    <div class="section section-ai">
      <div class="section-title">AI読み取り結果（確認用）</div>
      <div class="section-content">
        <p class="mono-text">${safeRecognizedText}</p>
        <p class="note-text">※文字数判定の基準となります。誤読がある場合は撮影し直してください。</p>
      </div>
    </div>
    ` : ''}

    ${deductionDetails.length > 0 ? `
    <div class="section section-deduction">
      <div class="section-title">減点ポイント</div>
      <table class="deduction-table">
        <thead><tr><th>理由</th><th class="amount">減点幅</th></tr></thead>
        <tbody>${deductionTableRows}</tbody>
      </table>
    </div>
    ` : ''}

    <div class="section section-rewrite">
      <div class="section-title">満点の書き直し例</div>
      <div class="section-content">
        <p class="rewrite-text">${feedback.rewrite_example}</p>
      </div>
    </div>

    <div class="section section-answer">
      <div class="section-title">提出された答案</div>
      <div class="section-content">
        ${imageDataUrl ? `<img src="${imageDataUrl}" alt="提出答案" class="answer-image">` : '<p style="color: #94a3b8; text-align: center;">画像なし</p>'}
      </div>
    </div>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // 画像読み込みを待つ
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const detectAnswerIndex = (files: File[], currentAnswerIndex: number | null): number | null => {
    if (files.length === 0) return null;
    if (currentAnswerIndex !== null && currentAnswerIndex < files.length) return currentAnswerIndex;

    const hintRegex = /(answer|ans|student|解答|答案|生徒)/i;
    const foundIndex = files.findIndex(file => hintRegex.test(file.name));
    return foundIndex >= 0 ? foundIndex : 0;
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      
      // 画像ファイルがある場合は圧縮処理
      const hasImages = files.some(f => isImageFile(f));
      let processedFiles = files;
      
      if (hasImages) {
        setIsCompressing(true);
        setCompressionProgress(0);
        setCompressionFileName('');
        
        try {
          processedFiles = await compressMultipleImages(
            files,
            (progress, fileName) => {
              setCompressionProgress(progress);
              setCompressionFileName(fileName);
            }
          );
        } catch (err) {
          console.error('[Page] Compression error:', err);
          // 圧縮に失敗しても元のファイルで続行
          processedFiles = files;
        } finally {
          setIsCompressing(false);
          setCompressionProgress(0);
          setCompressionFileName('');
        }
      }
      
      setUploadedFiles(prev => {
        const next = [...prev, ...processedFiles];
        setAnswerFileIndex(detectAnswerIndex(next, answerFileIndex));
        
        // 新しいファイルに対して役割を自動推定
        const newRoles: Record<number, FileRole> = { ...fileRoles };
        const startIndex = prev.length;
        processedFiles.forEach((file, i) => {
          const idx = startIndex + i;
          const name = file.name.toLowerCase();
          if (/(answer|ans|student|解答|答案|生徒)/.test(name)) {
            newRoles[idx] = 'answer';
          } else if (/(problem|question|課題|設問|問題|本文)/.test(name)) {
            newRoles[idx] = 'problem';
          } else if (/(model|key|模範|解説|正解|解答例)/.test(name)) {
            newRoles[idx] = 'model';
          } else {
            // デフォルト: 1つ目は答案、2つ目以降は問題+模範解答
            const existingAnswers = Object.values(newRoles).filter(r => r === 'answer' || r === 'answer_problem' || r === 'all').length;
            if (existingAnswers === 0) newRoles[idx] = 'answer';
            else newRoles[idx] = 'problem_model';  // 問題と模範解答が一緒のケースが多い
          }
        });
        setFileRoles(newRoles);
        
        return next;
      });
    }
  }, [answerFileIndex, fileRoles]);

  const removeFile = (index: number) => {
    // 役割情報も更新（インデックスをずらす）
    setFileRoles(prev => {
      const newRoles: Record<number, FileRole> = {};
      Object.entries(prev).forEach(([key, value]) => {
        const oldIdx = parseInt(key);
        if (oldIdx < index) newRoles[oldIdx] = value;
        else if (oldIdx > index) newRoles[oldIdx - 1] = value;
      });
      return newRoles;
    });
    
    setUploadedFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      const nextAnswerIndex =
        answerFileIndex === null
          ? detectAnswerIndex(next, null)
          : answerFileIndex > index
            ? answerFileIndex - 1
            : answerFileIndex === index
              ? detectAnswerIndex(next, null)
              : answerFileIndex;
      setAnswerFileIndex(nextAnswerIndex);
      return next;
    });
  };

  // 小問番号をフォーマットに応じた文字列に変換
  const formatSmallNumber = (num: number, format: string, sub?: number): string => {
    switch (format) {
      case 'paren-number':
        return sub ? `(${num}-${sub})` : `(${num})`;
      case 'paren-alpha':
        const alpha = String.fromCharCode(96 + num); // a=1, b=2, ...
        return sub ? `(${alpha}-${sub})` : `(${alpha})`;
      case 'number-sub':
        return sub ? `問${num}-${sub}` : `問${num}`;
      case 'number':
      default:
        return `問${num}`;
    }
  };

  // 現在の選択から問題ラベルを生成
  const generateProblemLabel = (): string => {
    if (problemFormat === 'free') {
      return freeInput.trim();
    }

    // big-smallで小問が0（なし）の場合は大問のみ
    if (problemFormat === 'big-small' && currentSmall === 0) {
      return `大問${currentBig}`;
    }

    const smallLabel = formatSmallNumber(
      currentSmall,
      smallFormat,
      smallFormat === 'number-sub' ? currentSub : undefined
    );

    if (problemFormat === 'big-small') {
      return `大問${currentBig} ${smallLabel}`;
    } else {
      return smallLabel;
    }
  };

  const addProblem = () => {
    const label = generateProblemLabel();
    if (!label || selectedProblems.includes(label)) {
      return; // 空または重複チェック
    }
    setSelectedProblems([...selectedProblems, label]);
    // 自由入力の場合はクリア
    if (problemFormat === 'free') {
      setFreeInput('');
    }
  };

  // 一括追加: 開始番号から終了番号まで追加
  const addProblemsInBatch = () => {
    if (problemFormat === 'free') {
      // 自由入力モードでは一括追加不可
      return;
    }
    
    const start = currentSmall;
    const end = batchEndSmall;
    
    if (start > end) {
      return; // 開始 > 終了 の場合は何もしない
    }
    
    const newLabels: string[] = [];
    
    for (let i = start; i <= end; i++) {
      const smallLabel = formatSmallNumber(
        i,
        smallFormat,
        smallFormat === 'number-sub' ? currentSub : undefined
      );
      
      let label: string;
      if (problemFormat === 'big-small') {
        label = `大問${currentBig} ${smallLabel}`;
      } else {
        label = smallLabel;
      }
      
      // 重複チェック
      if (!selectedProblems.includes(label) && !newLabels.includes(label)) {
        newLabels.push(label);
      }
    }
    
    if (newLabels.length > 0) {
      setSelectedProblems([...selectedProblems, ...newLabels]);
    }
  };

  // 全クリア
  const clearAllProblems = () => {
    setSelectedProblems([]);
  };

  const removeProblem = (index: number) => {
    const newProblems = [...selectedProblems];
    newProblems.splice(index, 1);
    setSelectedProblems(newProblems);
  };

  const openAuthModal = (mode: 'signin' | 'signup') => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  // OCRのみ実行（確認フロー開始）
  const handleOcrStart = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      openAuthModal('signin');
      return;
    }

    if (!session) {
      openAuthModal('signin');
      return;
    }

    if (uploadedFiles.length === 0) {
      setError('ファイルをアップロードしてください。');
      return;
    }

    let targetLabels = selectedProblems;
    if (targetLabels.length === 0) {
      const currentLabel = generateProblemLabel();
      if (!currentLabel) {
        setError('採点対象の問題を選択または入力してください。');
        return;
      }
      targetLabels = [currentLabel];
    }

    setOcrFlowStep('ocr-loading');
    setError(null);
    setOcrResults({});
    setConfirmedTexts({});

    // 各ラベルに対してOCRを実行
    const newOcrResults: Record<string, { text: string; charCount: number }> = {};

    for (const label of targetLabels) {
      setCurrentOcrLabel(label);
      
      const formData = new FormData();
      formData.append('targetLabel', label);
      
      if (pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage) {
        formData.append('pdfPageInfo', JSON.stringify(pdfPageInfo));
      }
      formData.append('fileRoles', JSON.stringify(fileRoles));
      
      uploadedFiles.forEach((file) => {
        formData.append('files', file);
      });

      try {
        const res = await fetch('/api/ocr', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        const responseText = await res.text();
        let data: OcrResponseData;

        // JSON以外（504など）のレスポンスも安全に扱う
        try {
          data = JSON.parse(responseText || '{}') as OcrResponseData;
        } catch (parseError) {
          console.error('OCR response parse error:', parseError, responseText);
          const fallbackMessage =
            res.status === 504
              ? 'OCRサーバーがタイムアウトしました。時間をおいて再試行してください。'
              : `OCRサーバーの応答が不正です（status ${res.status}）。`;
          setError(fallbackMessage);
          setOcrFlowStep('idle');
          return;
        }

        if (!res.ok) {
          const message =
            data?.message ||
            (res.status === 504
              ? 'OCRサーバーがタイムアウトしました。時間をおいて再試行してください。'
              : `OCRリクエストが失敗しました（status ${res.status}）。`);
          setError(message);
          setOcrFlowStep('idle');
          return;
        }

        if (data.status === 'error') {
          setError(data.message ?? 'OCR処理中にエラーが発生しました');
          setOcrFlowStep('idle');
          return;
        }

        if (!data.ocrResult) {
          setError('OCR結果が取得できませんでした');
          setOcrFlowStep('idle');
          return;
        }

        newOcrResults[label] = {
          text: data.ocrResult.text,
          charCount: data.ocrResult.charCount
        };
        
        // 初期値として確認済みテキストにも設定
        setConfirmedTexts(prev => ({
          ...prev,
          [label]: data.ocrResult!.text
        }));
      } catch (err) {
        console.error('OCR error:', err);
        setError('OCR処理中にエラーが発生しました。');
        setOcrFlowStep('idle');
        return;
      }
    }

    setOcrResults(newOcrResults);
    setOcrFlowStep('confirm');
    setCurrentOcrLabel('');
  };

  // 確認済みテキストで採点を実行
  const handleGradeWithConfirmed = async () => {
    console.log('[Page] handleGradeWithConfirmed called');
    console.log('[Page] user:', !!user, 'session:', !!session);
    console.log('[Page] confirmedTexts:', confirmedTexts);
    console.log('[Page] uploadedFiles:', uploadedFiles.length);

    // 認証チェック
    if (!user || !session) {
      console.log('[Page] No user or session, showing auth modal');
      setError('セッションが切れました。再度ログインしてください。');
      openAuthModal('signin');
      setOcrFlowStep('idle');
      return;
    }

    // 確認済みテキストがない場合
    if (Object.keys(confirmedTexts).length === 0) {
      console.log('[Page] No confirmedTexts');
      setError('読み取り結果がありません。');
      setOcrFlowStep('idle');
      return;
    }

    // ファイルがない場合
    if (uploadedFiles.length === 0) {
      console.log('[Page] No uploadedFiles');
      setError('ファイルがありません。');
      setOcrFlowStep('idle');
      return;
    }

    setOcrFlowStep('grading');
    setIsLoading(true);
    setError(null);
    setResults(null);

    const targetLabels = Object.keys(confirmedTexts);
    console.log('[Page] Starting grading with labels:', targetLabels);

    const formData = new FormData();
    formData.append('targetLabels', JSON.stringify(targetLabels));
    formData.append('confirmedTexts', JSON.stringify(confirmedTexts));
    formData.append('strictness', gradingStrictness);
    if (deviceInfo?.fingerprint) {
      formData.append('deviceFingerprint', deviceInfo.fingerprint);
    }

    if (pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage) {
      formData.append('pdfPageInfo', JSON.stringify(pdfPageInfo));
    }
    formData.append('fileRoles', JSON.stringify(fileRoles));

    uploadedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      console.log('[Page] Sending request to /api/grade...');
      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      console.log('[Page] Response status:', res.status);

      const data = await res.json();
      console.log('[Page] Response data:', data);

      if (data.status === 'error') {
        setError(data.message);
        if (data.requirePlan) {
          setRequirePlan(true);
        }
      } else {
        setResults(data.results);
        if (Array.isArray(data.results)) ingestRegradeInfo(data.results);
        refreshUsageInfo().catch((err) => {
          console.warn('Failed to refresh usage info:', err);
        });
      }
    } catch (err) {
      console.error('[Page] Grading error:', err);
      setError('採点処理中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
      setOcrFlowStep('idle');
    }
  };

  // OCR確認をキャンセル
  const handleOcrCancel = () => {
    setOcrFlowStep('idle');
    setOcrResults({});
    setConfirmedTexts({});
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ログインチェック（念のため）
    if (!user) {
      openAuthModal('signin');
      return;
    }

    // セッションがない場合は何もしない（ログインしていない状態）
    if (!session) {
      setError(null);
      setRequirePlan(false);
      openAuthModal('signin');
      return;
    }

    // usageInfoがまだ取得されていない場合は、利用可否チェックをスキップしてAPIに任せる
    // APIサーバーサイドでも利用可否チェックが行われるため、クライアントチェックはオプショナル
    if (usageInfo) {
      // 利用可否チェック（管理者アカウントは除く）
      const isAdmin = profile?.role === 'admin' || usageInfo.accessType === 'admin';
      if (!usageInfo.canUse && !isAdmin) {
        setError('利用可能なプランがありません。プランを購入してください。');
        setRequirePlan(true);
        return;
      }
    } else {
      console.log('[Page] usageInfo is not yet loaded, proceeding with API call (server will check)');
    }

    if (uploadedFiles.length === 0) {
      setError('ファイルをアップロードしてください。本人の答案、問題がすべてクリアに写っていることを確認してください。');
      return;
    }

    // ファイルサイズチェック（Vercel Serverless Functions: 4.5MBペイロード上限）
    const MAX_TOTAL_SIZE = 4 * 1024 * 1024; // 4MB（Vercelペイロード上限対応）
    const MAX_SINGLE_FILE_SIZE = 4 * 1024 * 1024; // 4MB
    const totalSize = uploadedFiles.reduce((sum, file) => sum + file.size, 0);
    
    const oversizedFile = uploadedFiles.find(file => file.size > MAX_SINGLE_FILE_SIZE);
    if (oversizedFile) {
      setError(`ファイル「${oversizedFile.name}」が大きすぎます（${(oversizedFile.size / 1024 / 1024).toFixed(1)}MB）。4MB以下のファイルをアップロードしてください。PDFを圧縮するか、ページを分割してください。`);
      return;
    }
    
    if (totalSize > MAX_TOTAL_SIZE) {
      setError(`ファイルの合計サイズが大きすぎます（${(totalSize / 1024 / 1024).toFixed(1)}MB）。合計4MB以下になるようにしてください。`);
      return;
    }

    // If no problems are explicitly added to the list, use the currently selected one
    let targetLabels = selectedProblems;
    if (targetLabels.length === 0) {
      const currentLabel = generateProblemLabel();
      if (!currentLabel) {
        setError('採点対象の問題を選択または入力してください。');
        return;
      }
      targetLabels = [currentLabel];
    }

    setIsLoading(true);
    setError(null);
    setRequirePlan(false);
    setResults(null);

    console.log('[Page] Starting grading process...');
    console.log('[Page] Target labels:', targetLabels);
    console.log('[Page] Files count:', uploadedFiles.length);

    const formData = new FormData();
    formData.append('targetLabels', JSON.stringify(targetLabels));
    formData.append('strictness', gradingStrictness);
    if (deviceInfo?.fingerprint) {
      formData.append('deviceFingerprint', deviceInfo.fingerprint);
    }

    // PDFページ番号情報を追加（複数ページPDF対応）
    const hasPdfPageInfo = pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage;
    if (hasPdfPageInfo) {
      formData.append('pdfPageInfo', JSON.stringify(pdfPageInfo));
      console.log('[Page] PDF page info:', pdfPageInfo);
    }

    // ファイルの役割情報を追加
    formData.append('fileRoles', JSON.stringify(fileRoles));
    console.log('[Page] File roles:', fileRoles);

    // すべてのファイルを追加
    uploadedFiles.forEach((file, idx) => {
      formData.append(`files`, file);
      const role = fileRoles[idx] || 'other';
      console.log(`[Page] File ${idx}: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - Role: ${role}`);
    });

    try {
      console.log('[Page] Sending request to /api/grade...');
      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      console.log('[Page] Response status:', res.status);

      // レスポンスをテキストで取得してからJSONパース（エラー時のデバッグ用）
      const responseText = await res.text();
      console.log('[Page] Response text:', responseText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[Page] Failed to parse JSON:', parseError);
        setError(`サーバーエラー: ${responseText.substring(0, 200)}`);
        return;
      }
      console.log('[Page] Response data:', data);

      if (data.status === 'error') {
        setError(data.message);
        if (data.requirePlan) {
          setRequirePlan(true);
        }
      } else {
        console.log('[Page] Grading successful, setting results...');
        console.log('[Page] Results detail:', JSON.stringify(data.results, null, 2));
        // 各結果の構造を確認
        data.results.forEach((r: { label: string; result?: unknown; error?: string }, idx: number) => {
          console.log(`[Page] Result ${idx}:`, {
            label: r.label,
            hasResult: !!r.result,
            resultKeys: r.result ? Object.keys(r.result as object) : [],
            hasGradingResult: !!(r.result as Record<string, unknown>)?.grading_result,
            error: r.error
          });
        });
        setResults(data.results);
        if (Array.isArray(data.results)) ingestRegradeInfo(data.results);
        // 利用情報を更新（エラーが発生しても続行、非同期で実行）
        refreshUsageInfo().catch((err) => {
          console.warn('[Page] Failed to refresh usage info:', err);
        });
      }
    } catch (err: unknown) {
      console.error('[Page] Grading error:', err);
      const message = err instanceof Error ? err.message : '通信エラーが発生しました。';
      setError(message);
    } finally {
      console.log('[Page] Grading process complete, clearing loading state');
      setIsLoading(false);
    }
  };

  const handleRegrade = async (label: string, nextStrictness: GradingStrictness) => {
    // 認証チェック
    if (!user || !session) {
      setError('セッションが切れました。再度ログインしてください。');
      openAuthModal('signin');
      return;
    }
    if (uploadedFiles.length === 0) {
      setError('ファイルがありません。');
      return;
    }

    const tokenInfo = regradeByLabel[label];
    if (!tokenInfo?.token || tokenInfo.remaining <= 0) {
      setError('無料再採点の回数が残っていません。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setRequirePlan(false);

    // 既に結果があるなら、その recognized_text を使ってOCRをスキップ（無料再採点でも速くする）
    const current = results?.find((r) => r.label === label);
    const raw = (current?.result as unknown as { grading_result?: unknown })?.grading_result ?? (current?.result as unknown);
    const recognized =
      (raw && typeof raw === 'object' && raw !== null
        ? ((raw as { recognized_text?: unknown }).recognized_text ?? (raw as { recognized_text_full?: unknown }).recognized_text_full)
        : undefined) ?? '';
    const confirmedTextForRegrade = confirmedTexts[label] || (typeof recognized === 'string' ? recognized : '');

    const formData = new FormData();
    formData.append('targetLabels', JSON.stringify([label]));
    formData.append('strictness', nextStrictness);
    formData.append('regradeTokens', JSON.stringify({ [label]: tokenInfo.token }));
    if (deviceInfo?.fingerprint) {
      formData.append('deviceFingerprint', deviceInfo.fingerprint);
    }
    if (confirmedTextForRegrade) {
      formData.append('confirmedTexts', JSON.stringify({ [label]: confirmedTextForRegrade }));
    }

    const hasPdfPageInfo = pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage;
    if (hasPdfPageInfo) {
      formData.append('pdfPageInfo', JSON.stringify(pdfPageInfo));
    }
    formData.append('fileRoles', JSON.stringify(fileRoles));
    uploadedFiles.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const responseText = await res.text();
      let data: { status?: string; message?: string; requirePlan?: boolean; results?: GradingResponseItem[] };
      try {
        data = JSON.parse(responseText);
      } catch {
        setError(`サーバーエラー: ${responseText.substring(0, 200)}`);
        return;
      }

      if (data.status === 'error') {
        setError(data.message || '採点に失敗しました。');
        if (data.requirePlan) setRequirePlan(true);
        return;
      }

      const newItems = Array.isArray(data.results) ? data.results : [];
      ingestRegradeInfo(newItems);
      setResults((prev) => {
        if (!prev || prev.length === 0) return newItems;
        const byLabel = new Map(prev.map((x) => [x.label, x]));
        for (const item of newItems) byLabel.set(item.label, item);
        return Array.from(byLabel.values());
      });

      refreshUsageInfo().catch((err) => {
        console.warn('[Page] Failed to refresh usage info:', err);
      });
    } catch (err) {
      console.error('[Page] Regrade error:', err);
      setError('再採点中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const normalizeScore = (score: number): number => {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    if (score <= 10) return Math.min(100, Math.round(score * 10));
    return Math.min(100, Math.round(score));
  };

  // ローディング中
  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">読み込み中...</p>
        </div>
      </main>
    );
  }

  // 未ログイン時: ログイン画面を表示
  if (!user) {
    return (
      <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
        {/* Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px] animate-pulse-slow"></div>
          <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px] animate-pulse-slow delay-1000"></div>
          <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-400/20 blur-[100px] animate-pulse-slow delay-2000"></div>
        </div>

        <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10 min-h-screen flex flex-col justify-center">
          {/* Header Section */}
          <div className="text-center mb-12 animate-fade-in relative">
            {/* Floating Icons */}
            <div className="absolute top-10 left-[10%] text-indigo-200/60 hidden lg:block animate-float-slow">
              <BookOpen className="w-16 h-16" />
            </div>
            <div className="absolute bottom-10 right-[10%] text-violet-200/60 hidden lg:block animate-float-slower">
              <PenTool className="w-14 h-14" />
            </div>
            <div className="absolute top-0 right-[15%] text-blue-200/60 hidden lg:block animate-float-slow delay-700">
              <GraduationCap className="w-12 h-12" />
            </div>

            <div className="flex justify-center mb-8 transform hover:scale-105 transition-transform duration-500">
              <div className="relative w-32 h-auto drop-shadow-2xl">
                <img
                  src="/logo.jpg"
                  alt="EduShift Logo"
                  className="w-full h-auto object-contain rounded-2xl"
                />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-slate-800 tracking-tight mb-6 leading-tight">
              中学・高校受験記述問題<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 animate-gradient-x">
                自動添削システム
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium mb-8">
              指導歴20年超のベテラン国語講師のノウハウとAIによる解析で、<br className="md:hidden" />あなたの思考に寄り添うフィードバックを。
            </p>

            {/* Handwritten Answer Support Highlight */}
            <div className="mt-8 mb-12 relative group max-w-4xl mx-auto text-left">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-xl rounded-3xl transform group-hover:scale-105 transition-transform duration-500"></div>
              <div className="relative bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 relative">
                  <div className="absolute inset-0 bg-indigo-400 blur-2xl opacity-20 rounded-full animate-pulse-slow"></div>
                  <div className="relative bg-gradient-to-br from-indigo-500 to-violet-600 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 group-hover:rotate-6 transition-transform duration-300">
                    <Edit3 className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h3 className="text-2xl font-bold text-slate-800 mb-3 flex items-center justify-center md:justify-start gap-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">手書きの答案</span>
                    もそのままOK！
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    スマホで撮影した手書きの答案画像をそのままアップロードしてください。<br className="hidden md:block" />
                    最新のAI文字認識技術が、あなたの文字を正確に読み取り、的確な添削を行います。<br />
                    <span className="text-sm text-slate-500 mt-2 block bg-slate-100/50 inline-block px-3 py-1 rounded-full border border-slate-200/50">
                      ✨ 多少の癖字や乱筆でも高精度に認識します
                    </span>
                  </p>
                </div>
                <div className="hidden md:block flex-shrink-0">
                  <div className="bg-white rounded-xl p-4 transform -rotate-2 group-hover:rotate-0 transition-transform duration-300 border border-slate-100 shadow-md w-48">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 border-b border-slate-100 pb-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      AI認識中...
                    </div>
                    <div className="space-y-2 opacity-60">
                      <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                      <div className="h-2 bg-slate-200 rounded w-full"></div>
                      <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-slate-100">
                      <div className="flex justify-end">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Login Card */}
          <div className="max-w-md mx-auto w-full">
            <div className="bg-white/80 backdrop-blur-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] rounded-3xl overflow-hidden border border-white/60 ring-1 ring-white/50">
              <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-6 text-white text-center">
                <h2 className="text-2xl font-bold">ご利用にはログインが必要です</h2>
                <p className="text-indigo-100 mt-2 text-sm">
                  アカウントをお持ちでない方は新規登録してください
                </p>
              </div>

              <div className="p-8 space-y-4">
                <button
                  onClick={() => openAuthModal('signin')}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  ログイン
                </button>

                <button
                  onClick={() => openAuthModal('signup')}
                  className="w-full py-4 px-6 bg-white text-indigo-600 font-bold rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all flex items-center justify-center"
                >
                  <UserPlus className="w-5 h-5 mr-2" />
                  新規登録（無料）
                </button>

                <div className="pt-4 border-t border-slate-200 space-y-3">
                  <Link
                    href="/usage"
                    className="flex items-center justify-center w-full py-3 px-6 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700 font-bold rounded-xl border-2 border-indigo-200 hover:border-indigo-400 hover:from-indigo-100 hover:to-violet-100 transition-all shadow-sm hover:shadow-md"
                  >
                    <BookOpen className="w-5 h-5 mr-2" />
                    使い方を見る
                  </Link>
                  <Link
                    href="/pricing"
                    className="flex items-center justify-center text-sm text-slate-600 hover:text-indigo-600 transition-colors"
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    料金プランを見る
                  </Link>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="mt-8 grid grid-cols-3 gap-4 text-center">
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                <div className="text-2xl mb-2">📝</div>
                <p className="text-xs text-slate-600 font-medium">AI自動採点</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                <div className="text-2xl mb-2">💡</div>
                <p className="text-xs text-slate-600 font-medium">詳細フィードバック</p>
              </div>
              <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 border border-white/60">
                <div className="text-2xl mb-2">🔒</div>
                <p className="text-xs text-slate-600 font-medium">安全・安心</p>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
        />
      </main>
    );
  }

  // ログイン済み: メイン画面
  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">

      {/* Header with User Menu */}
      <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-20 group-hover:opacity-40 transition-opacity rounded-full"></div>
              <img src="/logo.jpg" alt="EduShift" className="w-10 h-10 rounded-xl relative z-10 shadow-sm group-hover:scale-105 transition-transform duration-300" />
            </div>
            <span className="font-bold text-slate-800 hidden sm:block ml-3 text-lg tracking-tight group-hover:text-indigo-600 transition-colors">EduShift</span>
          </div>

          <div className="flex items-center gap-4">
            {user && session && usageInfo && (
              <UsageStatus compact className="hidden md:flex" />
            )}
            {user && (
              <Link
                href="/usage"
                className="flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-indigo-50/50"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">使い方</span>
              </Link>
            )}
            <Link
              href="/pricing"
              className="flex items-center text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors px-3 py-2 rounded-lg hover:bg-indigo-50/50"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">料金プラン</span>
            </Link>
            <UserMenu onAuthClick={() => openAuthModal('signin')} />
          </div>
        </div>
      </header>

      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]"></div>
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-400/20 blur-[100px] animate-pulse-slow"></div>
        <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-400/20 blur-[100px] animate-pulse-slow delay-1000"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] rounded-full bg-blue-400/20 blur-[100px] animate-pulse-slow delay-2000"></div>
      </div>

      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 relative z-10">

        {/* Header Section */}
        <div className="text-center mb-16 animate-fade-in relative">
          {/* Floating Icons */}
          <div className="absolute top-10 left-[10%] text-indigo-200/60 hidden lg:block animate-float-slow">
            <BookOpen className="w-16 h-16" />
          </div>
          <div className="absolute bottom-10 right-[10%] text-violet-200/60 hidden lg:block animate-float-slower">
            <PenTool className="w-14 h-14" />
          </div>
          <div className="absolute top-0 right-[15%] text-blue-200/60 hidden lg:block animate-float-slow delay-700">
            <GraduationCap className="w-12 h-12" />
          </div>

          <div className="flex justify-center mb-10 transform hover:scale-105 transition-transform duration-700 ease-out">
            <div className="relative w-48 h-auto drop-shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-violet-500 blur-2xl opacity-30 rounded-full animate-pulse-slow"></div>
              <img
                src="/logo.jpg"
                alt="EduShift Logo"
                className="w-full h-auto object-contain rounded-3xl relative z-10 shadow-2xl ring-1 ring-white/20"
              />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-800 tracking-tight mb-8 leading-tight">
            中学・高校受験記述問題<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 animate-gradient-x pb-2">
              自動添削システム
            </span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
            指導歴20年超のベテラン国語講師のノウハウと<br className="hidden sm:block" />
            最新AIによる解析で、あなたの思考に寄り添うフィードバックを。
          </p>

          {/* Handwritten Answer Support Highlight */}
          <div className="mt-12 mb-12 relative group max-w-4xl mx-auto">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-xl rounded-3xl transform group-hover:scale-105 transition-transform duration-500"></div>
            <div className="relative bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 relative">
                <div className="absolute inset-0 bg-indigo-400 blur-2xl opacity-20 rounded-full animate-pulse-slow"></div>
                <div className="relative bg-gradient-to-br from-indigo-500 to-violet-600 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 group-hover:rotate-6 transition-transform duration-300">
                  <Edit3 className="w-10 h-10 text-white" />
                </div>
              </div>
              <div className="text-center md:text-left flex-1">
                <h3 className="text-2xl font-bold text-slate-800 mb-3 flex items-center justify-center md:justify-start gap-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">手書きの答案</span>
                  もそのままOK！
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  スマホで撮影した手書きの答案画像をそのままアップロードしてください。<br className="hidden md:block" />
                  最新のAI文字認識技術が、あなたの文字を正確に読み取り、的確な添削を行います。<br />
                  <span className="text-sm text-slate-500 mt-2 block bg-slate-100/50 inline-block px-3 py-1 rounded-full border border-slate-200/50">
                    ✨ 多少の癖字や乱筆でも高精度に認識します
                  </span>
                </p>
              </div>
              <div className="hidden md:block flex-shrink-0">
                <div className="bg-white rounded-xl p-4 transform -rotate-2 group-hover:rotate-0 transition-transform duration-300 border border-slate-100 shadow-md w-48">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 border-b border-slate-100 pb-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    AI認識中...
                  </div>
                  <div className="space-y-2 opacity-60">
                    <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-2 bg-slate-200 rounded w-full"></div>
                    <div className="h-2 bg-slate-200 rounded w-5/6"></div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-slate-100">
                    <div className="flex justify-end">
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 免責事項とプライバシー情報 */}
          <div className="mt-8 max-w-3xl mx-auto space-y-4">
            <div className="bg-amber-50/80 backdrop-blur-sm border-2 border-amber-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-start">
                <AlertCircle className="w-6 h-6 text-amber-600 mr-3 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-amber-900 mb-2">重要なお知らせ</h3>
                  <p className="text-sm text-amber-800 leading-relaxed">
                    <strong>本システムはAIによる簡易採点ツールです。</strong>あくまで学習支援を目的とした参考情報であり、実際の入試の合否を保証するものではありません。最終的な評価は各学校の採点基準に基づいて行われます。本システムの結果は参考程度にご活用ください。
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50/80 backdrop-blur-sm border-2 border-blue-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-blue-900 mb-2">プライバシーについて</h3>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    <strong>アップロードされた答案画像は、採点処理完了後に自動的に削除されます。</strong>また、これらの画像はAIの学習やモデルの改善には一切利用されません。お客様の個人情報と答案内容は厳重に保護され、第三者に開示されることはありません。<br />
                    <span className="text-blue-700 mt-1 inline-block">※念のため、氏名がわかる部分はアップロードしないことをお勧めします。</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/70 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden border border-white/60 ring-1 ring-white/60 transition-all duration-500 hover:shadow-[0_30px_70px_-15px_rgba(79,70,229,0.15)] relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"></div>
          <div className="p-8 md:p-14">
            <form onSubmit={handleOcrStart} className="space-y-12">

              {/* 生徒名・添削担当者名入力 */}
              <div className="max-w-2xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center">
                      <User className="w-4 h-4 mr-2 text-indigo-500" />
                      生徒名（任意）
                    </label>
                    <input
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="例：山田太郎"
                      className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white/50 hover:bg-white transition-all duration-300 text-slate-700 placeholder-slate-400 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-600 mb-2 flex items-center">
                      <UserCheck className="w-4 h-4 mr-2 text-violet-500" />
                      添削担当者名（任意）
                    </label>
                    <input
                      type="text"
                      value={teacherName}
                      onChange={(e) => setTeacherName(e.target.value)}
                      placeholder="例：田中先生"
                      className="w-full px-5 py-4 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white/50 hover:bg-white transition-all duration-300 text-slate-700 placeholder-slate-400 shadow-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  ※ PDF出力時にレポートに表示されます
                </p>
              </div>

              {/* Problem Selector */}
              <div className="max-w-2xl mx-auto">
                <label className="block text-sm font-bold text-slate-600 mb-3 text-center tracking-wide">
                  採点対象の問題を選択
                </label>

                {/* 問題形式の選択 */}
                <div className="flex flex-wrap gap-2 justify-center mb-4">
                  <button
                    type="button"
                    onClick={() => setProblemFormat('big-small')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${problemFormat === 'big-small'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    大問＋小問
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemFormat('small-only')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${problemFormat === 'small-only'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    問のみ
                  </button>
                  <button
                    type="button"
                    onClick={() => setProblemFormat('free')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${problemFormat === 'free'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    自由入力
                  </button>
                </div>

                {/* 小問の表記形式（自由入力以外で表示） */}
                {problemFormat !== 'free' && (
                  <div className="flex flex-wrap gap-3 justify-center mb-6">
                    <span className="text-xs font-bold text-slate-400 self-center mr-1 uppercase tracking-wider">Format:</span>
                    <button
                      type="button"
                      onClick={() => setSmallFormat('number')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${smallFormat === 'number'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-105'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-violet-300'
                        }`}
                    >
                      問1
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmallFormat('paren-number')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${smallFormat === 'paren-number'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-105'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-violet-300'
                        }`}
                    >
                      (1)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmallFormat('paren-alpha')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${smallFormat === 'paren-alpha'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-105'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-violet-300'
                        }`}
                    >
                      (a)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSmallFormat('number-sub')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 ${smallFormat === 'number-sub'
                        ? 'bg-violet-600 text-white shadow-lg shadow-violet-200 scale-105'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-violet-300'
                        }`}
                    >
                      問1-2
                    </button>
                  </div>
                )}

                {/* 一括追加モード切替（小問なしの場合は非表示） */}
                {problemFormat !== 'free' && !(problemFormat === 'big-small' && currentSmall === 0) && (
                  <div className="flex justify-center mb-3">
                    <button
                      type="button"
                      onClick={() => setIsBatchMode(!isBatchMode)}
                      className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all duration-300 ${
                        isBatchMode
                          ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isBatchMode ? '✨ 一括追加モード ON' : '📋 一括追加モード'}
                    </button>
                  </div>
                )}

                {/* 問題番号入力 */}
                <div className="flex gap-3 items-center justify-center mb-4 flex-wrap">
                  {problemFormat === 'free' ? (
                    <input
                      type="text"
                      value={freeInput}
                      onChange={(e) => setFreeInput(e.target.value)}
                      placeholder="例: 問三、第2問(1)、設問ア など"
                      className="flex-1 min-w-[200px] max-w-[300px] px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 placeholder-slate-400 text-center"
                    />
                  ) : (
                    <>
                      {/* 大問選択（大問＋小問形式のみ） */}
                      {problemFormat === 'big-small' && (
                        <div className="relative">
                          <select
                            value={currentBig}
                            onChange={(e) => setCurrentBig(Number(e.target.value))}
                            className="appearance-none bg-white border border-slate-200 text-slate-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 font-bold"
                          >
                            {[...Array(10)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>大問 {i + 1}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* 小問選択（開始番号） - big-smallでcurrentSmall=0の場合は非表示 */}
                      {!(problemFormat === 'big-small' && currentSmall === 0) && (
                        <div className="relative">
                          <select
                            value={currentSmall}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              setCurrentSmall(value);
                              // 「なし」が選ばれたら一括追加モードをOFF
                              if (value === 0) {
                                setIsBatchMode(false);
                              }
                            }}
                            className="appearance-none bg-white border border-slate-200 text-slate-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 font-bold"
                          >
                            {/* big-small形式の場合のみ「なし」オプションを表示 */}
                            {problemFormat === 'big-small' && (
                              <option key={0} value={0}>なし（大問のみ）</option>
                            )}
                            {smallFormat === 'paren-alpha' ? (
                              // アルファベット (a)〜(z)
                              [...Array(26)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>({String.fromCharCode(97 + i)})</option>
                              ))
                            ) : smallFormat === 'paren-number' ? (
                              // カッコ数字 (1)〜(20)
                              [...Array(20)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>({i + 1})</option>
                              ))
                            ) : (
                              // 数字 問1〜問20
                              [...Array(20)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>問 {i + 1}</option>
                              ))
                            )}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                              <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* 大問のみモード時の表示 */}
                      {problemFormat === 'big-small' && currentSmall === 0 && (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-600 font-bold text-sm bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                            大問のみ
                          </span>
                          <button
                            type="button"
                            onClick={() => setCurrentSmall(1)}
                            className="text-xs text-slate-500 hover:text-indigo-600 underline transition-colors"
                          >
                            小問を追加
                          </button>
                        </div>
                      )}

                      {/* 一括追加モード時の終了番号 */}
                      {isBatchMode && (
                        <>
                          <span className="text-emerald-600 font-bold">〜</span>
                          <div className="relative">
                            <select
                              value={batchEndSmall}
                              onChange={(e) => setBatchEndSmall(Number(e.target.value))}
                              className="appearance-none bg-emerald-50 border border-emerald-300 text-emerald-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-emerald-500 font-bold"
                            >
                              {smallFormat === 'paren-alpha' ? (
                                [...Array(26)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>({String.fromCharCode(97 + i)})</option>
                                ))
                              ) : smallFormat === 'paren-number' ? (
                                [...Array(20)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>({i + 1})</option>
                                ))
                              ) : (
                                [...Array(20)].map((_, i) => (
                                  <option key={i + 1} value={i + 1}>問 {i + 1}</option>
                                ))
                              )}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-700">
                              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                              </svg>
                            </div>
                          </div>
                        </>
                      )}

                      {/* サブ番号（問1-2形式のみ） */}
                      {smallFormat === 'number-sub' && !isBatchMode && (
                        <>
                          <span className="text-slate-400 font-bold">-</span>
                          <div className="relative">
                            <select
                              value={currentSub}
                              onChange={(e) => setCurrentSub(Number(e.target.value))}
                              className="appearance-none bg-white border border-slate-200 text-slate-700 py-3 px-4 pr-8 rounded-xl leading-tight focus:outline-none focus:bg-white focus:border-indigo-500 font-bold"
                            >
                              {[...Array(10)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {/* 追加ボタン（単一 or 一括） */}
                  {isBatchMode && problemFormat !== 'free' ? (
                    <button
                      type="button"
                      onClick={addProblemsInBatch}
                      className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-5 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-200"
                      title="まとめて追加"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-sm">まとめて追加</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={addProblem}
                      className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-3 px-4 rounded-xl transition-colors flex items-center"
                      title="採点対象に追加"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* 選択された採点対象 */}
                <div className="mt-4">
                  {selectedProblems.length > 0 ? (
                    <>
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <p className="text-sm text-slate-600 font-medium">
                          📋 選択された採点対象: <span className="text-indigo-600 font-bold">{selectedProblems.length}問</span>
                        </p>
                        <button
                          type="button"
                          onClick={clearAllProblems}
                          className="text-xs text-slate-500 hover:text-red-500 underline transition-colors"
                        >
                          全てクリア
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {selectedProblems.map((label, index) => (
                          <div key={index} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full font-bold text-sm flex items-center shadow-sm border border-indigo-100">
                            {label}
                            <button
                              type="button"
                              onClick={() => removeProblem(index)}
                              className="ml-2 text-indigo-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-sm text-slate-600 font-medium">
                        問題が選択されていません
                      </p>
                      {problemFormat !== 'free' && (
                        <p className="text-xs text-slate-400 mt-1">
                          💡 一括追加モードで複数問題をまとめて追加できます
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* 採点の厳しさ（3段階） */}
                <div className="mt-6">
                  <label className="block text-sm font-bold text-slate-600 mb-3 text-center tracking-wide">
                    採点の厳しさ
                  </label>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      type="button"
                      onClick={() => setGradingStrictness('lenient')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        gradingStrictness === 'lenient'
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      甘め
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradingStrictness('standard')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        gradingStrictness === 'standard'
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      標準
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradingStrictness('strict')}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                        gradingStrictness === 'strict'
                          ? 'bg-rose-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      厳しめ
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2 text-center">
                    ※ 採点結果に納得できない場合、「もっと厳しく/甘く」で無料再採点できます
                  </p>
                </div>
              </div>

              {/* File Upload Section */}
              <div className="space-y-4">
                <div className="text-center">
                  <label className="block text-sm font-bold text-slate-600 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-2 shadow-[0_0_10px_rgba(99,102,241,0.5)] inline-block"></span>
                    答案・問題・模範解答のファイルをアップロード
                  </label>

                  {/* 必須確認事項 */}
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4 max-w-xl mx-auto">
                    <h4 className="text-sm font-bold text-amber-800 mb-2 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      アップロード前の確認事項
                    </h4>
                    <ul className="text-sm text-amber-700 space-y-1 text-left">
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">✓</span>
                        <span><strong>①本人の答案</strong>が含まれている</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">✓</span>
                        <span><strong>②模範解答</strong>が含まれている</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-amber-500 mr-2">✓</span>
                        <span><strong>③問題文</strong>が含まれている</span>
                      </li>
                      <li className="flex items-start mt-2 pt-2 border-t border-amber-200">
                        <span className="text-amber-500 mr-2">📷</span>
                        <span><strong>文字がはっきりと読み取れる</strong>画質であること</span>
                      </li>
                    </ul>
                  </div>

                  <p className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-lg inline-block border border-blue-200">
                    🔒 アップロードされた画像は採点完了後に自動削除され、AIの学習には一切利用されません
                  </p>
                </div>

                <div className="group relative">
                  <div className={clsx(
                    "relative min-h-48 sm:min-h-72 border-2 border-dashed rounded-2xl sm:rounded-3xl transition-all duration-500 ease-out cursor-pointer overflow-hidden",
                    isCompressing
                      ? "border-amber-400 bg-amber-50/50 ring-4 ring-amber-400/20"
                      : uploadedFiles.length > 0
                      ? "border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-500/10"
                      : "border-slate-300 bg-slate-50/50 hover:border-indigo-400 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/40 active:bg-indigo-50"
                  )}>
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>

                    <input
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                      id="file-upload"
                      disabled={isCompressing}
                    />
                    <label htmlFor="file-upload" className={clsx(
                      "absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-8 z-10",
                      isCompressing ? "cursor-wait" : "cursor-pointer"
                    )}>
                      {isCompressing ? (
                        <div className="animate-pulse text-center w-full">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 rounded-2xl sm:rounded-3xl flex items-center justify-center mx-auto mb-4 text-amber-600">
                            <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 animate-spin" />
                          </div>
                          <span className="text-base sm:text-lg text-amber-800 font-bold block mb-2">
                            画像を最適化中... {compressionProgress}%
                          </span>
                          <span className="text-xs sm:text-sm text-amber-600 block">
                            {compressionFileName}
                          </span>
                          <div className="w-48 sm:w-64 h-2 bg-amber-200 rounded-full mx-auto mt-3 overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 rounded-full transition-all duration-300"
                              style={{ width: `${compressionProgress}%` }}
                            />
                          </div>
                        </div>
                      ) : uploadedFiles.length > 0 ? (
                        <div className="animate-scale-in text-center w-full">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-indigo-100 flex items-center justify-center mx-auto mb-3 sm:mb-4 text-indigo-600 transform group-hover:scale-110 transition-transform duration-500 ring-1 ring-indigo-50">
                            <CheckCircle className="w-8 h-8 sm:w-10 sm:h-10" />
                          </div>
                          <span className="text-base sm:text-lg text-indigo-900 font-bold block mb-1 sm:mb-2">
                            {uploadedFiles.length}個のファイルを選択中
                          </span>
                          <span className="text-xs sm:text-sm text-indigo-600 block mb-2 sm:mb-3">
                            合計: {formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.size, 0))}
                          </span>
                          <span className="inline-flex items-center px-3 sm:px-4 py-2 bg-white text-indigo-600 text-xs sm:text-sm font-bold rounded-full shadow-sm border border-indigo-100 group-hover:bg-indigo-50 transition-colors">
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            追加する
                          </span>
                        </div>
                      ) : (
                        <div className="text-center group-hover:scale-105 active:scale-95 transition-transform duration-500">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-2xl sm:rounded-3xl shadow-lg shadow-slate-200/50 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-slate-400 group-hover:text-indigo-500 group-hover:shadow-2xl group-hover:shadow-indigo-200/50 transition-all duration-500 ring-1 ring-slate-100">
                            <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
                          </div>
                          <span className="text-base sm:text-lg text-slate-700 font-bold block mb-2">
                            📸 写真をアップロード
                          </span>
                          <span className="text-xs sm:text-sm text-slate-500 block bg-slate-100/50 px-3 sm:px-4 py-1 rounded-full mb-2">
                            タップして撮影 or 選択
                          </span>
                          <span className="text-xs text-slate-400 block">
                            複数枚OK・自動で圧縮されます
                          </span>
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* File List - スマホ対応 */}
                {uploadedFiles.length > 0 && (
                  <div className="bg-white/60 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <h3 className="text-sm font-bold text-slate-700 flex items-center">
                        <ImageIcon className="w-4 h-4 mr-2 text-indigo-500" />
                        ファイル一覧 ({uploadedFiles.length}件)
                      </h3>
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                        合計: {formatFileSize(uploadedFiles.reduce((sum, f) => sum + f.size, 0))}
                      </span>
                    </div>
                    
                    {/* クイック役割設定ボタン（スマホ向け） */}
                    <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          // 最初のファイルを答案、残りを問題+模範解答に設定
                          const newRoles: Record<number, FileRole> = {};
                          uploadedFiles.forEach((_, i) => {
                            newRoles[i] = i === 0 ? 'answer' : 'problem_model';
                          });
                          setFileRoles(newRoles);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-200 transition-colors"
                      >
                        📝 1枚目=答案 / 残り=問題
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // 全てを「全部入り」に設定
                          const newRoles: Record<number, FileRole> = {};
                          uploadedFiles.forEach((_, i) => {
                            newRoles[i] = 'all';
                          });
                          setFileRoles(newRoles);
                        }}
                        className="px-3 py-1.5 text-xs font-bold bg-rose-100 text-rose-700 rounded-lg border border-rose-200 hover:bg-rose-200 transition-colors"
                      >
                        📦 全て一括設定
                      </button>
                    </div>
                    
                    <p className="text-xs text-indigo-700 font-medium bg-indigo-50 px-3 py-2 rounded-xl mb-3 sm:mb-4 border border-indigo-100">
                      💡 各ファイルの内容を選択してください
                    </p>
                    
                    {/* ファイルグリッド - スマホ対応 */}
                    <div className="grid grid-cols-1 gap-2 sm:gap-3">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className={clsx(
                            "rounded-xl sm:rounded-2xl p-3 sm:p-4 border transition-all duration-300",
                            fileRoles[index] === 'answer' ? "bg-indigo-50/50 border-indigo-200" :
                            fileRoles[index] === 'problem' ? "bg-amber-50/50 border-amber-200" :
                            fileRoles[index] === 'model' ? "bg-emerald-50/50 border-emerald-200" :
                            fileRoles[index] === 'problem_model' ? "bg-cyan-50/50 border-cyan-200" :
                            fileRoles[index] === 'answer_problem' ? "bg-violet-50/50 border-violet-200" :
                            fileRoles[index] === 'all' ? "bg-rose-50/50 border-rose-200" :
                            "bg-white border-slate-100"
                          )}
                        >
                          {/* ファイル情報行 */}
                          <div className="flex items-center gap-2 sm:gap-3 mb-2">
                            <div className={clsx(
                              "w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                              file.type === 'application/pdf' ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
                            )}>
                              {file.type === 'application/pdf' ? (
                                <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                              ) : (
                                <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">{file.name}</p>
                              <p className="text-xs text-slate-500">
                                {formatFileSize(file.size)}
                                {file.type === 'application/pdf' && (
                                  <span className="ml-2 text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded text-[10px] font-bold">PDF</span>
                                )}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFile(index)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all flex-shrink-0"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* 役割選択ボタン（スマホ向けタップしやすい） */}
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            {[
                              { value: 'answer', label: '📝 答案', color: 'indigo' },
                              { value: 'problem', label: '📋 問題', color: 'amber' },
                              { value: 'model', label: '✅ 模範解答', color: 'emerald' },
                              { value: 'problem_model', label: '📋✅ 問題+模範解答', color: 'cyan' },
                              { value: 'all', label: '📦 全部', color: 'rose' },
                            ].map(({ value, label, color }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setFileRoles(prev => ({ ...prev, [index]: value as FileRole }))}
                                className={clsx(
                                  "px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-lg border transition-all",
                                  fileRoles[index] === value
                                    ? `bg-${color}-200 border-${color}-400 text-${color}-800 ring-2 ring-${color}-400/30`
                                    : `bg-white border-slate-200 text-slate-600 hover:border-${color}-300 hover:bg-${color}-50`
                                )}
                                style={{
                                  backgroundColor: fileRoles[index] === value 
                                    ? color === 'indigo' ? '#c7d2fe' : color === 'amber' ? '#fde68a' : color === 'emerald' ? '#a7f3d0' : color === 'cyan' ? '#a5f3fc' : '#fecdd3'
                                    : undefined,
                                  borderColor: fileRoles[index] === value
                                    ? color === 'indigo' ? '#818cf8' : color === 'amber' ? '#fbbf24' : color === 'emerald' ? '#34d399' : color === 'cyan' ? '#22d3ee' : '#fb7185'
                                    : undefined,
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* 全削除ボタン */}
                    {uploadedFiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedFiles([]);
                          setFileRoles({});
                          setAnswerFileIndex(null);
                        }}
                        className="mt-3 sm:mt-4 w-full py-2 text-xs sm:text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 inline mr-1" />
                        すべて削除
                      </button>
                    )}
                  </div>
                )}

                {/* PDFページ番号指定（複数ページPDF対応） */}
                {uploadedFiles.some(f => f.type === 'application/pdf') && (
                  <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
                    <h3 className="text-sm font-bold text-orange-800 mb-2 flex items-center">
                      <span className="mr-2">📑</span>
                      PDFのページ番号を指定（複数ページの場合）
                    </h3>
                    <p className="text-xs text-orange-700 mb-3">
                      PDFが複数ページある場合、各内容があるページ番号を入力すると読み取り精度が向上します。
                      <br />
                      <span className="font-medium">※ 空欄の場合は自動で全ページをスキャンします</span>
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-medium text-orange-700 block mb-1">
                          📝 答案のページ
                        </label>
                        <input
                          type="text"
                          placeholder="例: 5"
                          value={pdfPageInfo.answerPage}
                          onChange={(e) => setPdfPageInfo(prev => ({ ...prev, answerPage: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-orange-700 block mb-1">
                          📖 問題文のページ
                        </label>
                        <input
                          type="text"
                          placeholder="例: 1-3"
                          value={pdfPageInfo.problemPage}
                          onChange={(e) => setPdfPageInfo(prev => ({ ...prev, problemPage: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-orange-700 block mb-1">
                          ✅ 模範解答のページ
                        </label>
                        <input
                          type="text"
                          placeholder="例: 10-12"
                          value={pdfPageInfo.modelAnswerPage}
                          onChange={(e) => setPdfPageInfo(prev => ({ ...prev, modelAnswerPage: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-orange-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && session && user && (
                <div className="rounded-2xl bg-red-50 p-5 border border-red-100 animate-shake shadow-sm">
                  <div className="flex items-center mb-2">
                    <div className="bg-red-100 p-2 rounded-full mr-4">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <p className="text-sm text-red-700 font-bold">{error}</p>
                  </div>
                  {requirePlan && (
                    <div className="mt-3 ml-14">
                      <Link
                        href="/pricing"
                        className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-sm"
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        プランを購入する
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isLoading || ocrFlowStep !== 'idle'}
                  className="w-full group relative flex justify-center py-5 px-6 border-0 rounded-2xl shadow-[0_10px_30px_rgba(79,70,229,0.3)] text-lg font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-[length:200%_auto] hover:bg-[position:right_center] focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-500 transform hover:-translate-y-1"
                >
                  {ocrFlowStep === 'ocr-loading' ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin -ml-1 mr-3 h-6 w-6" />
                      {currentOcrLabel ? `「${currentOcrLabel}」を読み取り中...` : '読み取り中...'}
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <BookOpen className="mr-3 h-6 w-6" />
                      答案を読み取る
                      <ArrowRight className="ml-3 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* OCR確認UI */}
            {ocrFlowStep === 'confirm' && Object.keys(ocrResults).length > 0 && (
              <div className="mt-8 p-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl">
                <h3 className="text-lg font-bold text-amber-800 mb-4 flex items-center">
                  <Edit3 className="mr-2 h-5 w-5" />
                  読み取り結果を確認・修正してください
                </h3>
                <p className="text-sm text-amber-700 mb-6">
                  AIが読み取った内容に誤りがあれば、下のテキストを直接編集してから「採点を開始」を押してください。
                </p>

                {Object.entries(ocrResults).map(([label, result]) => (
                  <div key={label} className="mb-6 last:mb-0">
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-semibold text-slate-700">{label}</label>
                      <span className="text-sm text-slate-500">
                        {confirmedTexts[label]?.length || 0}文字
                      </span>
                    </div>
                    <textarea
                      value={confirmedTexts[label] || ''}
                      onChange={(e) => setConfirmedTexts(prev => ({ ...prev, [label]: e.target.value }))}
                      className="w-full h-40 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm leading-relaxed resize-y"
                      placeholder="読み取り結果がここに表示されます"
                    />
                    {result.charCount !== (confirmedTexts[label]?.length || 0) && (
                      <p className="mt-1 text-xs text-amber-600">
                        ※ 元の読み取り: {result.charCount}文字 → 修正後: {confirmedTexts[label]?.length || 0}文字
                      </p>
                    )}
                  </div>
                ))}

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handleOcrCancel}
                    className="flex-1 py-3 px-6 border border-slate-300 rounded-xl text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleGradeWithConfirmed}
                    disabled={isLoading}
                    className="flex-1 py-3 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center"
                  >
                    <CheckCircle className="mr-2 h-5 w-5" />
                    採点を開始
                  </button>
                </div>
              </div>
            )}

            {/* 採点中の大きな表示（独立） */}
            {ocrFlowStep === 'grading' && (
              <div className="mt-8 p-8 bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 rounded-2xl text-center">
                <Loader2 className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
                <p className="text-xl font-bold text-indigo-800 animate-pulse">AIが採点中...</p>
                <p className="text-sm text-indigo-600 mt-2">30秒〜2分程度かかる場合があります。<br />このままお待ちください。</p>
              </div>
            )}
          </div>
        </div>

        {/* Result Display */}
        {results && results.map((res, index) => {
          // grading_resultがない場合は、resultをそのままgrading_resultとして扱う（互換性対応）
          const rawResult = res.result?.grading_result || res.result;
          const gradingResult = rawResult as GradingResultPayload | undefined;

          // エラーの場合や結果がない場合
          if (!gradingResult || res.error) {
            if (res.error) {
              return (
                <div key={index} className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-red-800 mb-2">{res.label} - エラー</h3>
                  <p className="text-red-700">{res.error}</p>
                </div>
              );
            }
            console.warn(`[Page] No grading result for ${res.label}:`, res);
            return null;
          }

          const deductionDetails: DeductionDetail[] = gradingResult.deduction_details ?? [];
          const normalizedScore = normalizeScore(gradingResult.score);
          const totalDeduction = deductionDetails.reduce((sum: number, item: DeductionDetail) => {
            return sum + (Number(item?.deduction_percentage) || 0);
          }, 0);

          return (
            <div key={index} className="mt-24 animate-fade-in-up">
              <div className="bg-white/80 backdrop-blur-3xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.15)] rounded-[3rem] overflow-hidden border border-white/60 ring-1 ring-white/50 relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500"></div>

                {/* Result Header */}
                <div className="p-8 md:p-14 border-b border-slate-100">
                  {/* 問題番号を最上部に大きく表示 */}
                  <div className="mb-6 pb-4 border-b-2 border-indigo-500">
                    <div className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-md">
                      <span className="text-2xl font-bold tracking-wide">{res.label}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-start flex-wrap gap-4">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800 flex items-center mb-2">
                        <Sparkles className="mr-3 h-6 w-6 text-yellow-400 animate-pulse" />
                        採点レポート
                      </h2>
                      {(studentName || teacherName) && (
                        <div className="flex flex-wrap gap-4 text-sm text-slate-600 mt-2">
                          {studentName && (
                            <span className="flex items-center bg-slate-100 px-3 py-1 rounded-full">
                              <User className="w-4 h-4 mr-1 text-indigo-500" />
                              生徒: {studentName}
                            </span>
                          )}
                          {teacherName && (
                            <span className="flex items-center bg-slate-100 px-3 py-1 rounded-full">
                              <UserCheck className="w-4 h-4 mr-1 text-violet-500" />
                              添削: {teacherName}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <button
                        onClick={() => handlePrint(index)}
                        className="flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-lg"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        PDFで出力
                      </button>

                      {/* 厳しさ表示 + 無料再採点 */}
                      {res.strictness && (
                        <div className="text-right">
                          <div className="text-xs text-slate-500 mb-2">
                            厳しさ: <span className="font-bold text-slate-700">{strictnessLabel(res.strictness)}</span>
                            {regradeByLabel[res.label] && (
                              <span className="ml-2">
                                （無料再採点 残り <span className="font-bold">{regradeByLabel[res.label].remaining}</span> 回）
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => handleRegrade(res.label, 'lenient')}
                              disabled={isLoading || res.strictness === 'lenient' || !regradeByLabel[res.label]?.token || (regradeByLabel[res.label]?.remaining ?? 0) <= 0}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              もっと甘くで再採点（無料）
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegrade(res.label, 'strict')}
                              disabled={isLoading || res.strictness === 'strict' || !regradeByLabel[res.label]?.token || (regradeByLabel[res.label]?.remaining ?? 0) <= 0}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              もっと厳しくで再採点（無料）
                            </button>
                          </div>
                          {!regradeByLabel[res.label]?.token && (
                            <div className="text-[11px] text-slate-400 mt-1">
                              ※ 無料再採点が無効です（サーバ側の設定が未完了の可能性）
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Hidden Report Component for Printing */}
                <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden', width: '210mm' }}>
                  <div ref={getComponentRef(index)}>
                    <GradingReport
                      result={res.result ?? null}
                      targetLabel={res.label}
                      studentFile={(answerFileIndex !== null ? uploadedFiles[answerFileIndex] : uploadedFiles[0]) || null}
                      studentName={studentName || undefined}
                      teacherName={teacherName || undefined}
                      editedFeedback={editedFeedbacks[index]}
                    />
                  </div>
                </div>

                <div className="p-8 md:p-14">

                  {/* Original Answer & Correction Section */}
                  <div className="mb-16">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                      <span className="bg-indigo-100 text-indigo-600 rounded-lg w-8 h-8 flex items-center justify-center mr-3">📝</span>
                      あなたの答案
                    </h3>

                    {/* Image Preview (Full Width) - 選択した答案を表示 */}
                    <div className="bg-slate-100 rounded-2xl p-5 border border-slate-200 mb-8">
                      {uploadedFiles.length > 0 && answerFileIndex !== null && uploadedFiles[answerFileIndex] ? (
                        (() => {
                          const answerFile = uploadedFiles[answerFileIndex];
                          return (
                            <div className="bg-white rounded-xl p-2">
                              {answerFile.type === 'application/pdf' ? (
                                <iframe
                                  src={`${URL.createObjectURL(answerFile)}#page=1`}
                                  className="w-full h-[640px] rounded-lg"
                                  title="Student Answer"
                                  style={{ pointerEvents: 'none' }}
                                />
                              ) : (
                                <img
                                  src={URL.createObjectURL(answerFile)}
                                  alt="Student Answer"
                                  className="w-full h-auto rounded-lg object-contain max-h-[720px] mx-auto"
                                />
                              )}
                              <p className="text-center text-xs text-slate-400 mt-2">提出された答案</p>
                            </div>
                          );
                        })()
                      ) : (
                        <p className="text-center text-slate-400 py-8">ファイルがアップロードされていません</p>
                      )}
                    </div>

                    {/* Recognized Text Section */}
                    { (gradingResult.recognized_text || gradingResult.recognized_text_full) && (
                      <div className="mb-16">
                        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center">
                          <span className="bg-blue-100 text-blue-600 rounded-lg w-8 h-8 flex items-center justify-center mr-3">👁️</span>
                          AI読み取り結果（確認用）
                        </h3>
                        <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                          <p className="text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">
                            {gradingResult.recognized_text || gradingResult.recognized_text_full}
                          </p>
                          <p className="text-sm text-slate-500 mt-4 text-right">
                            ※文字数判定の基準となります。誤読がある場合は撮影し直してください。
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Deduction Details */}
                    {deductionDetails.length > 0 && (
                      <div className="bg-red-50 rounded-2xl p-6 border border-red-100">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="font-bold text-red-800 flex items-center">
                            <AlertCircle className="w-5 h-5 mr-2" />
                            減点ポイント
                          </h4>
                          <span className="text-red-700 font-bold bg-white px-3 py-1 rounded-full border border-red-100 text-sm">
                            合計 -{totalDeduction}%
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {deductionDetails.map((item: DeductionDetail, idx: number) => (
                            <li key={idx} className="flex items-start justify-between bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                              <span className="text-red-700 font-medium">{item.reason}</span>
                              <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-sm whitespace-nowrap ml-4">
                                -{item.deduction_percentage}%
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Score Section (Updated) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                    <div className="md:col-span-1 bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-700 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-150 transition-transform duration-1000 ease-out"></div>
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl -ml-10 -mb-10"></div>

                      <h3 className="text-indigo-100 font-bold mb-2 relative z-10 flex items-center text-sm tracking-wider uppercase">
                        <Sparkles className="w-4 h-4 mr-2" />
                        総合スコア
                      </h3>
                      <div className="flex items-baseline relative z-10 mb-6">
                        <span className="text-8xl font-black tracking-tighter drop-shadow-sm">
                          {normalizedScore}
                        </span>
                        <span className="text-2xl font-medium ml-2 opacity-80">%</span>
                      </div>

                      <div className="relative z-10">
                        <div className="flex justify-between text-xs font-bold text-indigo-200 mb-2">
                          <span>SCORE</span>
                          <span>{normalizedScore}/100</span>
                        </div>
                        <div className="w-full bg-black/20 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                          <div
                            className="bg-white h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(255,255,255,0.5)]"
                            style={{ width: `${normalizedScore}%` }}
                          ></div>
                        </div>
                      </div>

                      {totalDeduction > 0 && (
                        <div className="mt-6 pt-6 border-t border-white/10 relative z-10">
                          <p className="text-sm font-bold text-white/90 flex items-center">
                            <AlertCircle className="w-4 h-4 mr-2 text-pink-300" />
                            減点合計: <span className="text-pink-200 ml-1">-{totalDeduction}%</span>
                          </p>
                        </div>
                      )}
                      {deductionDetails.length > 0 && (
                        <ul className="mt-3 text-sm text-indigo-50/90 space-y-1">
                          {deductionDetails.map((item: DeductionDetail, idx: number) => (
                            <li key={`${item?.reason ?? 'deduction'}-${idx}`}>
                              ・{item?.reason} で -{item?.deduction_percentage}%
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Feedback Cards */}
                    <div className="md:col-span-2 grid grid-cols-1 gap-6">
                      {/* 良かった点 */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl p-8 border border-emerald-100 hover:shadow-xl hover:shadow-emerald-100/50 transition-all duration-300 group">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-emerald-900 flex items-center text-lg">
                            <span className="bg-white text-emerald-600 rounded-2xl w-10 h-10 flex items-center justify-center mr-4 shadow-sm group-hover:scale-110 transition-transform duration-300 text-xl">👍</span>
                            良かった点
                          </h3>
                          {!editingFields[index]?.good_point ? (
                            <button
                              type="button"
                              onClick={() => startEditing(index, 'good_point')}
                              className="text-emerald-600 hover:text-emerald-800 p-2 rounded-xl hover:bg-emerald-100/50 transition-colors opacity-0 group-hover:opacity-100"
                              title="編集"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditing(index, 'good_point')}
                                className="text-emerald-600 hover:text-emerald-800 p-2 rounded-xl hover:bg-emerald-100 transition-colors"
                                title="保存"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelEditing(index, 'good_point')}
                                className="text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 transition-colors"
                                title="キャンセル"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {editingFields[index]?.good_point ? (
                          <textarea
                            value={getDisplayFeedback(index, 'good_point')}
                            onChange={(e) => updateEditedFeedback(index, 'good_point', e.target.value)}
                            className="w-full min-h-[120px] p-4 border border-emerald-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 bg-white/80 text-slate-700 leading-relaxed resize-y shadow-inner"
                          />
                        ) : (
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
                            {getDisplayFeedback(index, 'good_point')}
                          </p>
                        )}
                      </div>

                      {/* 改善のアドバイス */}
                      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-3xl p-8 border border-indigo-100 hover:shadow-xl hover:shadow-indigo-100/50 transition-all duration-300 group">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-bold text-indigo-900 flex items-center text-lg">
                            <span className="bg-white text-indigo-600 rounded-2xl w-10 h-10 flex items-center justify-center mr-4 shadow-sm group-hover:scale-110 transition-transform duration-300 text-xl">💡</span>
                            改善のアドバイス
                          </h3>
                          {!editingFields[index]?.improvement_advice ? (
                            <button
                              type="button"
                              onClick={() => startEditing(index, 'improvement_advice')}
                              className="text-indigo-600 hover:text-indigo-800 p-2 rounded-xl hover:bg-indigo-100/50 transition-colors opacity-0 group-hover:opacity-100"
                              title="編集"
                            >
                              <Edit3 className="w-5 h-5" />
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => saveEditing(index, 'improvement_advice')}
                                className="text-indigo-600 hover:text-indigo-800 p-2 rounded-xl hover:bg-indigo-100 transition-colors"
                                title="保存"
                              >
                                <Save className="w-5 h-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => cancelEditing(index, 'improvement_advice')}
                                className="text-red-500 hover:text-red-700 p-2 rounded-xl hover:bg-red-50 transition-colors"
                                title="キャンセル"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {editingFields[index]?.improvement_advice ? (
                          <textarea
                            value={getDisplayFeedback(index, 'improvement_advice')}
                            onChange={(e) => updateEditedFeedback(index, 'improvement_advice', e.target.value)}
                            className="w-full min-h-[120px] p-4 border border-indigo-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/20 bg-white/80 text-slate-700 leading-relaxed resize-y shadow-inner"
                          />
                        ) : (
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
                            {getDisplayFeedback(index, 'improvement_advice')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Rewrite Example */}
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-[2.5rem] p-8 md:p-10 border border-amber-100 relative overflow-hidden shadow-lg shadow-amber-100/50 group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-200/20 to-orange-200/20 rounded-full blur-3xl -mr-20 -mt-20 group-hover:scale-110 transition-transform duration-700"></div>
                    <div className="flex items-center justify-between mb-8 relative z-10">
                      <h3 className="text-2xl font-bold text-amber-900 flex items-center">
                        <span className="bg-white text-amber-600 rounded-2xl w-12 h-12 flex items-center justify-center mr-4 shadow-md text-2xl group-hover:rotate-12 transition-transform duration-300">✨</span>
                        満点の書き直し例
                      </h3>
                      {!editingFields[index]?.rewrite_example ? (
                        <button
                          type="button"
                          onClick={() => startEditing(index, 'rewrite_example')}
                          className="text-yellow-700 hover:text-yellow-900 p-2 rounded-lg hover:bg-yellow-100 transition-colors"
                          title="編集"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => saveEditing(index, 'rewrite_example')}
                            className="text-yellow-700 hover:text-yellow-900 p-2 rounded-lg hover:bg-yellow-100 transition-colors"
                            title="保存"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => cancelEditing(index, 'rewrite_example')}
                            className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                            title="キャンセル"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-6 border border-yellow-200/50 shadow-sm relative z-10">
                      {editingFields[index]?.rewrite_example ? (
                        <textarea
                          value={getDisplayFeedback(index, 'rewrite_example')}
                          onChange={(e) => updateEditedFeedback(index, 'rewrite_example', e.target.value)}
                          className="w-full min-h-[150px] p-3 border border-yellow-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 bg-white text-slate-800 text-lg leading-loose font-medium font-serif resize-y"
                        />
                      ) : (
                        <p className="text-lg leading-loose text-slate-800 font-medium font-serif">
                          {getDisplayFeedback(index, 'rewrite_example')}
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })}

      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />

      {/* Device Limit Modal */}
      {deviceLimitInfo && deviceInfo && (
        <DeviceLimitModal
          isOpen={showDeviceLimitModal}
          onClose={() => setShowDeviceLimitModal(false)}
          devices={deviceLimitInfo.devices}
          currentFingerprint={deviceInfo.fingerprint}
          maxDevices={deviceLimitInfo.maxDevices}
          onRemoveDevice={removeDevice}
          onRetryRegistration={retryDeviceRegistration}
        />
      )}
    </main>
  );
}
