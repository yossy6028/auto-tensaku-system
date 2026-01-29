/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GradingReport } from '@/components/GradingReport';
import { FileText, CheckCircle, AlertCircle, AlertTriangle, Loader2, Sparkles, ArrowRight, BookOpen, PenTool, GraduationCap, Plus, Trash2, CreditCard, LogIn, UserPlus, Edit3, Save, X, User, UserCheck, ImageIcon, Camera } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/components/AuthProvider';
import { UserMenu } from '@/components/UserMenu';
import { AuthModal } from '@/components/AuthModal';
import { UsageStatus } from '@/components/UsageStatus';
import { DeviceLimitModal } from '@/components/DeviceLimitModal';
import Link from 'next/link';
import { compressMultipleImages, formatFileSize, isImageFile } from '@/lib/utils/imageCompressor';
import { extractPdfPages } from '@/lib/utils/pdfPageExtractor';
import { StudentCard } from '@/components/StudentCard';
import { BatchProgress } from '@/components/BatchProgress';
import { BatchResults } from '@/components/BatchResults';
import {
  StudentEntry,
  BatchState,
  BatchMode,
  createStudentEntry,
  MAX_STUDENTS,
  FileRole as BatchFileRole,
} from '@/lib/types/batch';
import { SaveProblemModal, SavedProblemsList } from '@/components/SavedProblems';
import type { SavedProblemSummary, SavedFileRole } from '@/lib/storage/types';
import {
  getAllProblems,
  getProblem,
  saveProblem,
  deleteProblem,
  restoreFilesFromProblem,
  generateDefaultTitle,
} from '@/lib/storage/savedProblems';
import { Users } from 'lucide-react';

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

  // バッチモード用の問題オプション
  const PROBLEM_OPTIONS = [
    { value: '問1', label: '問1' },
    { value: '問2', label: '問2' },
    { value: '問3', label: '問3' },
    { value: '(1)', label: '(1)' },
    { value: '(2)', label: '(2)' },
    { value: '(3)', label: '(3)' },
    { value: '大問1(1)', label: '大問1(1)' },
    { value: '大問1(2)', label: '大問1(2)' },
  ];

  // 問題形式タイプ: 'big-small' = 大問+小問, 'small-only' = 問のみ, 'free' = 自由入力
  const [problemFormat, setProblemFormat] = useState<'big-small' | 'small-only' | 'free'>('big-small');
  // 小問の表記形式: 'number' = 問1, 'paren-number' = (1), 'paren-alpha' = (a), 'number-sub' = 問1-2
  const [smallFormat, setSmallFormat] = useState<'number' | 'paren-number' | 'paren-alpha' | 'number-sub'>('number');

  const [selectedProblems, setSelectedProblems] = useState<string[]>([]);
  const [currentPoints, setCurrentPoints] = useState('');
  const [problemPoints, setProblemPoints] = useState<Record<string, number>>({});
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
  
  // ファイル役割選択ポップアップ用の状態
  const [showFileRoleModal, setShowFileRoleModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingFileRoles, setPendingFileRoles] = useState<Record<number, FileRole>>({});

  // 採点の厳しさ（3段階）
  const [gradingStrictness, setGradingStrictness] = useState<GradingStrictness>('standard');

  // 無料再採点トークン（labelごと）
  const [regradeByLabel, setRegradeByLabel] = useState<Record<string, { token: string; remaining: number }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [regradingLabel, setRegradingLabel] = useState<string | null>(null);  // 再採点中のラベル
  const [results, setResults] = useState<GradingResponseItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requirePlan, setRequirePlan] = useState(false);

  // 回数消費確認用の状態
  const [usageConsumed, setUsageConsumed] = useState<{
    consumed: boolean;
    previousCount: number | null;
    currentCount: number | null;
  } | null>(null);
  
  // 画像圧縮中の状態
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressionFileName, setCompressionFileName] = useState('');

  // ドラッグ＆ドロップ状態
  const [isDragging, setIsDragging] = useState(false);

  // OCR確認フロー用のステート
  type OcrFlowStep = 'idle' | 'ocr-loading' | 'confirm' | 'grading';
  const [ocrFlowStep, setOcrFlowStep] = useState<OcrFlowStep>('idle');
  const [ocrResults, setOcrResults] = useState<Record<string, { text: string; charCount: number }>>({});
  const [confirmedTexts, setConfirmedTexts] = useState<Record<string, string>>({});
  const [currentOcrLabel, setCurrentOcrLabel] = useState<string>('');
  const requestLockRef = useRef(false);
  const isMountedRef = useRef(true);

  // コンポーネントのマウント状態を追跡（メモリリーク防止）
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 保存済み問題を初期読み込み
  useEffect(() => {
    getAllProblems().then(setSavedProblems).catch(console.error);
  }, []);

  // OCR手動修正モーダル（問題条件オーバーライド対応）
  const [ocrEditModal, setOcrEditModal] = useState<{ 
    label: string; 
    text: string; 
    strictness: GradingStrictness;
    problemCondition: string;  // 字数制限などの問題条件（例: "40字以上50字以内"）
  } | null>(null);

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

  // 模範解答入力モード（画像 or テキスト）
  const [modelAnswerInputMode, setModelAnswerInputMode] = useState<'image' | 'text'>('image');
  const [modelAnswerText, setModelAnswerText] = useState('');

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

  // ========== 一括処理モード用の状態 ==========
  const [batchMode, setBatchMode] = useState<BatchMode>('single');
  const [batchStudents, setBatchStudents] = useState<StudentEntry[]>([createStudentEntry()]);
  const [batchState, setBatchState] = useState<BatchState>({
    students: [],
    currentIndex: -1,
    isProcessing: false,
    completedCount: 0,
    successCount: 0,
    errorCount: 0,
  });
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  // 共通ファイル（問題・模範解答）
  const [sharedFiles, setSharedFiles] = useState<File[]>([]);
  const [sharedFileRoles, setSharedFileRoles] = useState<Record<number, FileRole>>({});

  // 保存済み問題関連
  const [savedProblems, setSavedProblems] = useState<SavedProblemSummary[]>([]);
  const [showSaveProblemModal, setShowSaveProblemModal] = useState(false);
  const [showSavedProblemsList, setShowSavedProblemsList] = useState(false);
  const [loadedProblemId, setLoadedProblemId] = useState<string | null>(null);
  const [loadedProblemTitle, setLoadedProblemTitle] = useState<string | null>(null);

  // 一括OCR確認フロー用のステート
  type BatchOcrStep = 'idle' | 'ocr-loading' | 'confirm';
  const [batchOcrStep, setBatchOcrStep] = useState<BatchOcrStep>('idle');
  // studentId -> label -> { text, charCount, layout }
  type LayoutInfo = { total_lines: number; paragraph_count: number; indented_columns: number[] };
  const [batchOcrResults, setBatchOcrResults] = useState<Record<string, Record<string, { text: string; charCount: number; layout?: LayoutInfo }>>>({});
  // studentId -> label -> confirmedText
  const [batchConfirmedTexts, setBatchConfirmedTexts] = useState<Record<string, Record<string, string>>>({});
  // studentId -> label -> layout（採点時に渡す）
  const [batchLayouts, setBatchLayouts] = useState<Record<string, Record<string, LayoutInfo>>>({});
  const [currentBatchOcrIndex, setCurrentBatchOcrIndex] = useState<number>(0);

  // 一括処理: 重複ファイル検出
  // ファイル名+サイズで重複を検出（同じファイルが複数の生徒に割り当てられている場合に警告）
  const duplicateFileWarnings = useMemo(() => {
    const fileToStudents: Map<string, string[]> = new Map();

    for (const student of batchStudents) {
      for (const file of student.files) {
        // ファイル名とサイズの組み合わせでユニーク識別
        const fileKey = `${file.name}|${file.size}`;
        const studentName = student.name || `生徒${batchStudents.indexOf(student) + 1}`;

        if (!fileToStudents.has(fileKey)) {
          fileToStudents.set(fileKey, []);
        }
        fileToStudents.get(fileKey)!.push(studentName);
      }
    }

    // 2人以上の生徒に割り当てられているファイルを検出
    const duplicates: { fileName: string; students: string[] }[] = [];
    for (const [fileKey, students] of fileToStudents) {
      if (students.length > 1) {
        const fileName = fileKey.split('|')[0];
        duplicates.push({ fileName, students });
      }
    }

    return duplicates;
  }, [batchStudents]);

  // 一括処理: 生徒を追加
  const addBatchStudent = useCallback(() => {
    if (batchStudents.length >= MAX_STUDENTS) return;
    setBatchStudents((prev) => [...prev, createStudentEntry()]);
  }, [batchStudents.length]);

  // 一括処理: 生徒を削除
  const removeBatchStudent = useCallback((id: string) => {
    setBatchStudents((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.id !== id);
    });
  }, []);

  // 一括処理: 生徒を更新
  const updateBatchStudent = useCallback((id: string, updates: Partial<StudentEntry>) => {
    setBatchStudents((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  // 一括処理: バリデーション
  const validateBatchStudents = useCallback((): boolean => {
    // 共通ファイル（問題・模範解答）のチェック
    const hasProblem = Object.values(sharedFileRoles).some(
      (role) => role === 'problem' || role === 'problem_model' || role === 'all'
    );
    const hasModel = Object.values(sharedFileRoles).some(
      (role) => role === 'model' || role === 'problem_model' || role === 'all'
    );
    if (sharedFiles.length === 0 || (!hasProblem && !hasModel)) {
      setError('共通ファイル（問題または模範解答）をアップロードしてください');
      return false;
    }

    for (const student of batchStudents) {
      if (!student.name.trim()) {
        setError('すべての生徒に名前を入力してください');
        return false;
      }
      if (student.files.length === 0) {
        setError(`${student.name}の答案をアップロードしてください`);
        return false;
      }
    }
    return true;
  }, [batchStudents, sharedFiles, sharedFileRoles]);

  // 一括処理: 1人分の採点を実行
  const gradeOneStudent = async (
    student: StudentEntry,
    labels: string[],
    strictness: GradingStrictness
  ): Promise<{ success: boolean; results?: GradingResponseItem[]; error?: string }> => {
    try {
      const formData = new FormData();
      formData.append('targetLabels', JSON.stringify(labels));
      formData.append('strictness', strictness);

      // 共通ファイル（問題・模範解答）を追加
      sharedFiles.forEach((file) => {
        formData.append('files', file);
      });

      // 生徒の答案ファイルを追加
      student.files.forEach((file) => {
        formData.append('files', file);
      });

      // ファイル役割を結合（共通ファイル + 生徒ファイル）
      const combinedRoles: Record<number, FileRole> = {};
      // 共通ファイルの役割
      Object.entries(sharedFileRoles).forEach(([idx, role]) => {
        combinedRoles[parseInt(idx)] = role;
      });
      // 生徒ファイルの役割（インデックスをオフセット）
      const offset = sharedFiles.length;
      Object.entries(student.fileRoles).forEach(([idx, role]) => {
        combinedRoles[parseInt(idx) + offset] = role;
      });
      formData.append('fileRoles', JSON.stringify(combinedRoles));

      // デバイスフィンガープリント
      if (deviceInfo?.fingerprint) {
        formData.append('deviceFingerprint', deviceInfo.fingerprint);
      }

      const response = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || data.message || '採点に失敗しました' };
      }

      if (data.results && Array.isArray(data.results)) {
        return { success: true, results: data.results };
      }

      return { success: false, error: 'レスポンスの形式が不正です' };
    } catch (err) {
      console.error('[BatchGrade] Error grading student:', student.name, err);
      return { success: false, error: err instanceof Error ? err.message : '通信エラー' };
    }
  };

  // 一括OCR確認フロー: OCRを実行（採点前）
  const startBatchOcr = async () => {
    if (!validateBatchStudents()) return;
    if (selectedProblems.length === 0) {
      setError('採点する問題を選択してください');
      return;
    }

    // 重複ファイル警告チェック
    if (duplicateFileWarnings.length > 0) {
      const dupWarning = duplicateFileWarnings
        .map(d => `  ・${d.fileName} → ${d.students.join(', ')}`)
        .join('\n');
      const shouldContinue = window.confirm(
        `⚠️ 同じファイルが複数の生徒に割り当てられています:\n\n` +
        `${dupWarning}\n\n` +
        `同じファイルは同じ結果になります。続行しますか？`
      );
      if (!shouldContinue) {
        return;
      }
    }

    // 使用量チェック
    if (usageInfo && usageInfo.usageLimit !== null && usageInfo.usageCount !== null) {
      const requiredUsage = batchStudents.length;
      const remainingUsage = usageInfo.usageLimit - usageInfo.usageCount;
      if (remainingUsage < requiredUsage) {
        setError(`使用可能回数が不足しています（残り${remainingUsage}回、必要${requiredUsage}回）`);
        setRequirePlan(true);
        return;
      }

      // 使用回数消費の確認アラート
      const remainingAfter = remainingUsage - requiredUsage;
      const confirmMessage =
        `一括採点を開始します。\n\n` +
        `・採点人数: ${requiredUsage}名\n` +
        `・消費する回数: ${requiredUsage}回\n` +
        `・採点後の残り回数: ${remainingAfter}回\n\n` +
        `続行しますか？`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    } else {
      // 使用量情報がない場合も確認
      const confirmMessage =
        `一括採点を開始します。\n\n` +
        `・採点人数: ${batchStudents.length}名\n` +
        `・消費する回数: ${batchStudents.length}回\n\n` +
        `続行しますか？`;

      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setError(null);
    setBatchOcrStep('ocr-loading');
    setBatchOcrResults({});
    setBatchConfirmedTexts({});
    setBatchLayouts({});
    setCurrentBatchOcrIndex(0);

    const newOcrResults: Record<string, Record<string, { text: string; charCount: number; layout?: LayoutInfo }>> = {};
    const newConfirmedTexts: Record<string, Record<string, string>> = {};
    const newLayouts: Record<string, Record<string, LayoutInfo>> = {};

    // 各生徒に対してOCRを実行
    for (let i = 0; i < batchStudents.length; i++) {
      const student = batchStudents[i];
      setCurrentBatchOcrIndex(i);
      newOcrResults[student.id] = {};
      newConfirmedTexts[student.id] = {};

      // 各問題ラベルに対してOCR
      for (const label of selectedProblems) {
        try {
          const formData = new FormData();
          formData.append('targetLabel', label);
          formData.append('fileRoles', JSON.stringify({
            ...sharedFileRoles,
            ...Object.fromEntries(
              Object.entries(student.fileRoles).map(([idx, role]) => [
                parseInt(idx) + sharedFiles.length,
                role,
              ])
            ),
          }));

          // 共通ファイル（問題・模範解答）を追加
          sharedFiles.forEach((file) => {
            formData.append('files', file);
          });

          // 生徒の答案ファイルを追加
          student.files.forEach((file) => {
            formData.append('files', file);
          });

          const res = await fetch('/api/ocr', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });

          const data = await res.json();

          if (res.ok && data.ocrResult) {
            newOcrResults[student.id][label] = {
              text: data.ocrResult.text,
              charCount: data.ocrResult.charCount,
              layout: data.ocrResult.layout,  // layout情報を保存
            };
            newConfirmedTexts[student.id][label] = data.ocrResult.text;
            // layout情報があれば保存
            if (data.ocrResult.layout) {
              if (!newLayouts[student.id]) newLayouts[student.id] = {};
              newLayouts[student.id][label] = data.ocrResult.layout;
              console.log(`[BatchOCR] Layout for ${student.name}/${label}:`, data.ocrResult.layout);
            }
          } else {
            // OCRエラーの場合は空文字で初期化
            newOcrResults[student.id][label] = { text: '', charCount: 0 };
            newConfirmedTexts[student.id][label] = '';
            console.error(`[BatchOCR] Error for student ${student.name}, label ${label}:`, data.message);
          }
        } catch (err) {
          console.error(`[BatchOCR] Error for student ${student.name}, label ${label}:`, err);
          newOcrResults[student.id][label] = { text: '', charCount: 0 };
          newConfirmedTexts[student.id][label] = '';
        }
      }
    }

    setBatchOcrResults(newOcrResults);
    setBatchConfirmedTexts(newConfirmedTexts);
    setBatchLayouts(newLayouts);  // layout情報を保存
    setBatchOcrStep('confirm');
    setCurrentBatchOcrIndex(0);
  };

  // 一括OCR確認フロー: 確認済みテキストで採点を実行
  const executeBatchGradingWithConfirmed = async () => {
    if (!validateBatchStudents()) return;
    if (selectedProblems.length === 0) {
      setError('採点する問題を選択してください');
      return;
    }

    setBatchOcrStep('idle');
    setError(null);
    setIsLoading(true);

    // 状態を初期化
    const studentsWithStatus = batchStudents.map((s) => ({ ...s, status: 'pending' as const }));
    setBatchStudents(studentsWithStatus);
    setBatchState({
      students: studentsWithStatus,
      currentIndex: 0,
      isProcessing: true,
      completedCount: 0,
      successCount: 0,
      errorCount: 0,
    });

    let successCount = 0;
    let errorCount = 0;

    // 各生徒を順番に採点（確認済みテキストを使用）
    for (let i = 0; i < batchStudents.length; i++) {
      const student = batchStudents[i];

      setBatchStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, status: 'processing' } : s))
      );
      setBatchState((prev) => ({ ...prev, currentIndex: i }));

      // 確認済みテキストを取得
      const confirmedForStudent = batchConfirmedTexts[student.id] || {};
      // layout情報を取得（字下げ・行数・段落構成の判定に使用）
      const layoutsForStudent = batchLayouts[student.id] || {};

      // gradeOneStudentWithConfirmedText を呼び出す
      const result = await gradeOneStudentWithConfirmed(student, selectedProblems, gradingStrictness, confirmedForStudent, layoutsForStudent);

      if (result.success && result.results) {
        successCount++;
        setBatchStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, status: 'success', results: result.results } : s
          )
        );
      } else {
        errorCount++;
        setBatchStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, status: 'error', errorMessage: result.error } : s
          )
        );
      }

      setBatchState((prev) => ({
        ...prev,
        completedCount: i + 1,
        successCount,
        errorCount,
      }));
    }

    setBatchState((prev) => ({ ...prev, isProcessing: false }));
    setIsLoading(false);

    // 使用状況を更新
    void refreshUsageInfo();
  };

  // 確認済みテキストで1人の生徒を採点
  const gradeOneStudentWithConfirmed = async (
    student: StudentEntry,
    labels: string[],
    strictness: GradingStrictness,
    confirmedTexts: Record<string, string>,
    layouts?: Record<string, LayoutInfo>
  ): Promise<{ success: boolean; results?: GradingResponseItem[]; error?: string }> => {
    try {
      const formData = new FormData();
      formData.append('targetLabels', JSON.stringify(labels));
      formData.append('strictness', strictness);
      formData.append('confirmedTexts', JSON.stringify(confirmedTexts));
      // layout情報があれば渡す（字下げ・行数・段落構成の判定に使用）
      if (layouts && Object.keys(layouts).length > 0) {
        formData.append('layouts', JSON.stringify(layouts));
        console.log('[BatchGrade] Passing layouts:', layouts);
      }

      // 共通ファイル（問題・模範解答）を追加
      sharedFiles.forEach((file) => {
        formData.append('files', file);
      });

      // 生徒の答案ファイルを追加
      student.files.forEach((file) => {
        formData.append('files', file);
      });

      // ファイル役割を結合（共通ファイル + 生徒ファイル）
      const combinedRoles: Record<number, FileRole> = {};
      Object.entries(sharedFileRoles).forEach(([idx, role]) => {
        combinedRoles[parseInt(idx)] = role;
      });
      const offset = sharedFiles.length;
      Object.entries(student.fileRoles).forEach(([idx, role]) => {
        combinedRoles[parseInt(idx) + offset] = role;
      });
      formData.append('fileRoles', JSON.stringify(combinedRoles));

      // デバイスフィンガープリント
      if (deviceInfo?.fingerprint) {
        formData.append('deviceFingerprint', deviceInfo.fingerprint);
      }

      const response = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || data.message || '採点に失敗しました' };
      }

      if (data.results && Array.isArray(data.results)) {
        return { success: true, results: data.results };
      }

      return { success: false, error: 'レスポンスの形式が不正です' };
    } catch (err) {
      console.error('[BatchGrade] Error grading student with confirmed:', student.name, err);
      return { success: false, error: err instanceof Error ? err.message : '通信エラー' };
    }
  };

  // 一括OCR確認フロー: キャンセル
  const cancelBatchOcr = () => {
    setBatchOcrStep('idle');
    setBatchOcrResults({});
    setBatchConfirmedTexts({});
    setCurrentBatchOcrIndex(0);
  };

  // 一括処理: 全生徒の採点を実行（OCR確認なし、直接採点）
  const executeBatchGrading = async () => {
    if (!validateBatchStudents()) return;
    if (selectedProblems.length === 0) {
      setError('採点する問題を選択してください');
      return;
    }

    // 使用量チェック
    if (usageInfo && usageInfo.usageLimit !== null && usageInfo.usageCount !== null) {
      const requiredUsage = batchStudents.length;
      const remainingUsage = usageInfo.usageLimit - usageInfo.usageCount;
      if (remainingUsage < requiredUsage) {
        setError(`使用可能回数が不足しています（残り${remainingUsage}回、必要${requiredUsage}回）`);
        setRequirePlan(true);
        return;
      }
    }

    setError(null);
    setIsLoading(true);

    // 状態を初期化
    const studentsWithStatus = batchStudents.map((s) => ({ ...s, status: 'pending' as const }));
    setBatchStudents(studentsWithStatus);
    setBatchState({
      students: studentsWithStatus,
      currentIndex: 0,
      isProcessing: true,
      completedCount: 0,
      successCount: 0,
      errorCount: 0,
    });

    let successCount = 0;
    let errorCount = 0;

    // 順次処理
    for (let i = 0; i < batchStudents.length; i++) {
      const student = batchStudents[i];

      // 現在の生徒を処理中に設定
      setBatchStudents((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, status: 'processing' } : s))
      );
      setBatchState((prev) => ({ ...prev, currentIndex: i }));

      // 採点を実行
      const result = await gradeOneStudent(student, selectedProblems, gradingStrictness);

      if (result.success && result.results) {
        successCount++;
        setBatchStudents((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'success', results: result.results } : s
          )
        );
      } else {
        errorCount++;
        setBatchStudents((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: 'error', errorMessage: result.error } : s
          )
        );
      }

      setBatchState((prev) => ({
        ...prev,
        completedCount: i + 1,
        successCount,
        errorCount,
      }));
    }

    setBatchState((prev) => ({ ...prev, isProcessing: false }));
    setIsLoading(false);

    // 使用量を更新
    if (successCount > 0) {
      await refreshUsageInfo();
    }
  };

  // 一括処理: ZIPダウンロード
  const handleDownloadZip = async () => {
    const successStudents = batchStudents.filter((s) => s.status === 'success' && s.results);
    if (successStudents.length === 0) return;

    setIsGeneratingZip(true);

    try {
      // 動的にライブラリをインポート
      const [JSZip, jsPDF, html2canvas] = await Promise.all([
        import('jszip').then(m => m.default),
        import('jspdf').then(m => m.jsPDF),
        import('html2canvas').then(m => m.default),
      ]);
      const zip = new JSZip();

      // 一時的なコンテナを作成
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '210mm';
      container.style.background = 'white';
      document.body.appendChild(container);

      // 各生徒のPDFを生成してZIPに追加
      for (const student of successStudents) {
        if (!student.results) continue;

        for (const result of student.results) {
          if (!result.result?.grading_result) continue;

          const gr = result.result.grading_result;
          const score = gr.score <= 10 ? Math.round(gr.score * 10) : Math.round(gr.score);
          const today = new Date().toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const deductions = gr.deduction_details || [];
          const maxPoints = problemPoints[result.label];
          const earnedPoints = maxPoints ? Math.round((score / 100) * maxPoints) : null;

          // HTMLレポートを作成
          container.innerHTML = `
            <div style="padding: 32px; font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', sans-serif; color: #1e293b; line-height: 1.6;">
              <!-- ヘッダー -->
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 8px;"></div>
                <div>
                  <p style="font-size: 11px; color: #64748b; margin: 0;">auto-tensaku-system</p>
                  <p style="font-size: 14px; font-weight: bold; color: #1e293b; margin: 0;">EduShift</p>
                </div>
              </div>

              <!-- 問題番号 -->
              <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #6366f1;">
                <span style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; font-size: 20px; font-weight: bold;">
                  ${result.label}
                </span>
              </div>

              <!-- タイトルと情報 -->
              <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e293b; padding-bottom: 16px; margin-bottom: 24px;">
                <div>
                  <h1 style="font-size: 24px; font-weight: bold; margin: 0 0 8px 0;">採点レポート</h1>
                  <p style="font-size: 14px; color: #475569; margin: 0;">生徒名: ${student.name}</p>
                </div>
                <div style="text-align: right;">
                  <p style="font-size: 12px; color: #64748b; margin: 0;">実施日: ${today}</p>
                  ${teacherName ? `<p style="font-size: 12px; color: #475569; margin: 0;">添削担当: ${teacherName}</p>` : ''}
                </div>
              </div>

              <!-- スコアセクション -->
              <div style="display: flex; gap: 24px; margin-bottom: 24px;">
                <div style="width: 33%; background: #f8fafc; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0; text-align: center;">
                  <h2 style="color: #64748b; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">総合スコア</h2>
                  <div style="display: flex; align-items: baseline; justify-content: center;">
                    <span style="font-size: 48px; font-weight: 900; color: #1e293b;">${score}</span>
                    <span style="font-size: 18px; font-weight: bold; color: #94a3b8; margin-left: 4px;">%</span>
                  </div>
                  ${earnedPoints !== null ? `<p style="margin-top: 8px; font-size: 14px; color: #475569; font-weight: 600;">得点: ${earnedPoints} / ${maxPoints} 点</p>` : ''}
                  ${deductions.length > 0 ? `
                    <ul style="margin-top: 12px; font-size: 12px; color: #475569; list-style: none; padding: 0; text-align: left;">
                      ${deductions.map((d: { reason?: string; deduction_percentage?: number }) => `<li style="margin-bottom: 4px;">・${d.reason} で -${d.deduction_percentage}%</li>`).join('')}
                    </ul>
                  ` : ''}
                </div>
                <div style="width: 67%;">
                  <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; border: 1px solid #bbf7d0; margin-bottom: 16px;">
                    <h3 style="font-weight: bold; color: #166534; margin: 0 0 8px 0; font-size: 14px;">👍 良かった点</h3>
                    <p style="font-size: 13px; color: #475569; margin: 0;">${gr.feedback_content?.good_point || ''}</p>
                  </div>
                  <div style="background: #eef2ff; border-radius: 12px; padding: 16px; border: 1px solid #c7d2fe;">
                    <h3 style="font-weight: bold; color: #3730a3; margin: 0 0 8px 0; font-size: 14px;">💡 改善のアドバイス</h3>
                    <p style="font-size: 13px; color: #475569; margin: 0;">${gr.feedback_content?.improvement_advice || ''}</p>
                  </div>
                </div>
              </div>

              <!-- AI読み取り結果 -->
              ${gr.recognized_text || gr.recognized_text_full ? `
              <div style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; font-weight: bold; border-left: 4px solid #60a5fa; padding-left: 12px; margin: 0 0 16px 0;">AI読み取り結果（確認用）</h2>
                <div style="background: #eff6ff; border-radius: 12px; padding: 16px; border: 1px solid #bfdbfe;">
                  <p style="font-size: 13px; color: #475569; margin: 0; white-space: pre-wrap; font-family: monospace;">${gr.recognized_text || gr.recognized_text_full}</p>
                </div>
              </div>
              ` : ''}

              <!-- 減点ポイント -->
              ${deductions.length > 0 ? `
              <div style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; font-weight: bold; border-left: 4px solid #ef4444; padding-left: 12px; margin: 0 0 16px 0;">減点ポイント</h2>
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                  <thead style="background: #f1f5f9;">
                    <tr>
                      <th style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: left; font-weight: bold; color: #475569;">理由</th>
                      <th style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #475569; width: 100px;">減点幅</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${deductions.map((d: { reason?: string; deduction_percentage?: number }) => `
                      <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 12px; color: #475569;">${d.reason}</td>
                        <td style="padding: 12px; color: #ef4444; font-weight: bold; text-align: right;">-${d.deduction_percentage}%</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ` : ''}

              <!-- 書き直し例 -->
              <div style="margin-bottom: 24px;">
                <h2 style="font-size: 16px; font-weight: bold; border-left: 4px solid #facc15; padding-left: 12px; margin: 0 0 16px 0;">満点の書き直し例</h2>
                <div style="background: #fefce8; border-radius: 12px; padding: 24px; border: 1px solid #fef08a;">
                  <p style="font-size: 14px; color: #1e293b; margin: 0; line-height: 1.8;">${gr.feedback_content?.rewrite_example || ''}</p>
                </div>
              </div>
            </div>
          `;

          // html2canvasでキャンバスに変換
          const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          });

          // jspdfでPDFに変換
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
          });

          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
          const imgX = (pdfWidth - imgWidth * ratio) / 2;
          const scaledHeight = imgHeight * ratio;

          // 複数ページ対応
          let heightLeft = scaledHeight;
          let position = 0;
          let pageCount = 0;

          while (heightLeft > 0) {
            if (pageCount > 0) {
              pdf.addPage();
            }
            pdf.addImage(imgData, 'JPEG', imgX, position, imgWidth * ratio, scaledHeight);
            heightLeft -= pdfHeight;
            position -= pdfHeight;
            pageCount++;
          }

          const pdfBlob = pdf.output('blob');
          zip.file(`${student.name}_${result.label}.pdf`, pdfBlob);
        }
      }

      // 一時コンテナを削除
      document.body.removeChild(container);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `採点結果_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[BatchGrade] Error generating ZIP:', err);
      setError('ZIPファイルの生成に失敗しました');
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // 採点結果を更新するハンドラ（編集機能用）
  const handleUpdateResult = useCallback((studentId: string, label: string, updates: {
    score?: number;
    good_point?: string;
    improvement_advice?: string;
    rewrite_example?: string;
    recognized_text?: string;
  }) => {
    setBatchStudents((prev) =>
      prev.map((student) => {
        if (student.id !== studentId) return student;
        if (!student.results) return student;

        const updatedResults = student.results.map((result) => {
          if (result.label !== label) return result;

          // 現在のgrading_resultを取得、なければ空のオブジェクトを作成
          const currentGradingResult = result.result?.grading_result || {
            score: 0,
            feedback_content: {},
          };
          const currentFeedback = currentGradingResult.feedback_content || {};

          // 更新されたgrading_resultを作成
          const updatedGradingResult = {
            ...currentGradingResult,
            // スコアは0-100形式で保存（normalizeScoreが <= 10 を10倍するので、ここでは10で割る）
            score: updates.score !== undefined ? updates.score / 10 : currentGradingResult.score,
            recognized_text: updates.recognized_text ?? currentGradingResult.recognized_text,
            feedback_content: {
              ...currentFeedback,
              good_point: updates.good_point ?? currentFeedback.good_point,
              improvement_advice: updates.improvement_advice ?? currentFeedback.improvement_advice,
              rewrite_example: updates.rewrite_example ?? currentFeedback.rewrite_example,
            },
          };

          return {
            ...result,
            result: {
              ...result.result,
              grading_result: updatedGradingResult,
              incomplete_grading: false, // 手動編集したらincomplete_gradingをfalseに
            },
          };
        });

        return {
          ...student,
          results: updatedResults,
        };
      })
    );
  }, []);

  // 一括処理: 失敗した生徒を再試行
  const retryFailedStudents = async () => {
    const failedStudents = batchStudents.filter((s) => s.status === 'error');
    if (failedStudents.length === 0) return;

    setError(null);
    setIsLoading(true);

    // 失敗した生徒をpendingに戻す
    setBatchStudents((prev) =>
      prev.map((s) => (s.status === 'error' ? { ...s, status: 'pending', errorMessage: undefined } : s))
    );

    const currentSuccess = batchStudents.filter((s) => s.status === 'success').length;
    let successCount = currentSuccess;
    let errorCount = 0;

    setBatchState((prev) => ({
      ...prev,
      isProcessing: true,
      errorCount: 0,
    }));

    for (const student of failedStudents) {
      const idx = batchStudents.findIndex((s) => s.id === student.id);

      setBatchStudents((prev) =>
        prev.map((s) => (s.id === student.id ? { ...s, status: 'processing' } : s))
      );

      const result = await gradeOneStudent(student, selectedProblems, gradingStrictness);

      if (result.success && result.results) {
        successCount++;
        setBatchStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, status: 'success', results: result.results } : s
          )
        );
      } else {
        errorCount++;
        setBatchStudents((prev) =>
          prev.map((s) =>
            s.id === student.id ? { ...s, status: 'error', errorMessage: result.error } : s
          )
        );
      }

      setBatchState((prev) => ({
        ...prev,
        completedCount: successCount + errorCount + (batchStudents.length - failedStudents.length - currentSuccess),
        successCount,
        errorCount,
      }));
    }

    setBatchState((prev) => ({ ...prev, isProcessing: false }));
    setIsLoading(false);

    if (successCount > currentSuccess) {
      await refreshUsageInfo();
    }
  };

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

  const acquireRequestLock = (): boolean => {
    if (requestLockRef.current) return false;
    requestLockRef.current = true;
    return true;
  };

  const releaseRequestLock = (): void => {
    requestLockRef.current = false;
  };

  const handlePrint = async (index: number) => {
    const componentRef = getComponentRef(index);
    if (!componentRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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
    const maxPoints = problemPoints[res.label];
    const safeMaxPoints = Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : null;
    const earnedPoints = safeMaxPoints ? Math.round((score / 100) * safeMaxPoints) : null;
    
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
      .brand-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .brand-logo {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
        object-fit: cover;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
      .score-points {
        margin-top: 6px;
        font-size: 10pt;
        color: #475569;
        font-weight: 600;
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
      .page-break {
        page-break-before: always;
      }
      /* スマホ向け：印刷後の案内メッセージ（印刷時は非表示） */
      @media print {
        .mobile-back-hint {
          display: none !important;
        }
      }
      @media screen {
        .mobile-back-hint {
          margin-top: 40px;
          padding: 20px;
          background: #f0f9ff;
          border: 2px solid #0ea5e9;
          border-radius: 12px;
          text-align: center;
        }
        .mobile-back-hint p {
          margin: 0 0 12px 0;
          color: #0369a1;
          font-size: 14px;
        }
        .mobile-back-hint button {
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 50px;
          font-size: 15px;
          font-weight: bold;
          cursor: pointer;
        }
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
    <div class="brand-row">
      <img src="/logo.jpg" alt="EduShift" class="brand-logo" />
    </div>
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
        ${safeMaxPoints && earnedPoints !== null ? `<div class="score-points">得点: ${formatPointsValue(earnedPoints)} / ${formatPointsValue(safeMaxPoints)} 点</div>` : ''}
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

    <!-- スマホ向け：印刷/保存後の案内（印刷時は非表示） -->
    <div class="mobile-back-hint">
      <p>📱 PDF保存が完了したら、このタブを閉じて元の画面に戻ってください</p>
      <button onclick="window.close()">このタブを閉じる</button>
    </div>
  </div>
</body>
</html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    // 画像読み込みを待ってから印刷ダイアログを開く
    // スマホではprint()が非同期のため、close()は呼ばない（ユーザーが手動で閉じる）
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  const detectAnswerIndexByRole = (
    files: File[],
    roles: Record<number, FileRole>,
    currentAnswerIndex: number | null
  ): number | null => {
    if (files.length === 0) return null;

    // 答案として扱える役割
    const answerRoles: FileRole[] = ['answer', 'answer_problem', 'all'];

    // 現在のインデックスが有効かつ答案役割の場合のみ維持
    if (
      currentAnswerIndex !== null &&
      currentAnswerIndex < files.length &&
      answerRoles.includes(roles[currentAnswerIndex])
    ) {
      return currentAnswerIndex;
    }

    // 役割優先で探索: answer > answer_problem > all > (problem_modelは答案ではない)
    const priority: FileRole[] = ['answer', 'answer_problem', 'all'];
    for (const role of priority) {
      const idx = files.findIndex((_, i) => roles[i] === role);
      if (idx >= 0) {
        return idx;
      }
    }

    // 役割で見つからない場合はファイル名ヒューリスティック
    const hintRegex = /(answer|ans|student|解答|答案|生徒)/i;
    const foundIndex = files.findIndex(file => hintRegex.test(file.name));
    return foundIndex >= 0 ? foundIndex : 0;
  };

  const MAX_TOTAL_SIZE_BYTES = 4.2 * 1024 * 1024;
  const MAX_SINGLE_FILE_SIZE_BYTES = 4.3 * 1024 * 1024;
  const PDF_SIZE_ADVICE = 'PDFはページ番号を指定すると必要ページだけ抽出して軽くできます。難しい場合はオンライン圧縮ツール（iLovePDF等）で圧縮してから再度お試しください。';

  const parsePageRange = (input?: string): number[] => {
    if (!input) return [];
    const pages = new Set<number>();
    input.split(',').forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;
      const rangeParts = trimmed.split('-').map((token) => token.trim());
      if (rangeParts.length === 2) {
        const start = parseInt(rangeParts[0], 10);
        const end = parseInt(rangeParts[1], 10);
        if (Number.isFinite(start) && Number.isFinite(end)) {
          const from = Math.min(start, end);
          const to = Math.max(start, end);
          for (let i = from; i <= to; i += 1) pages.add(i);
        }
        return;
      }
      const single = parseInt(trimmed, 10);
      if (Number.isFinite(single)) pages.add(single);
    });
    return Array.from(pages).sort((a, b) => a - b);
  };

  const mergeUniquePages = (...lists: number[][]): number[] => {
    const merged = new Set<number>();
    lists.forEach((list) => list.forEach((page) => merged.add(page)));
    return Array.from(merged).sort((a, b) => a - b);
  };

  const getPdfPagesForRole = (
    role: FileRole | undefined,
    info: { answerPage?: string; problemPage?: string; modelAnswerPage?: string }
  ): number[] => {
    const answerPages = parsePageRange(info.answerPage);
    const problemPages = parsePageRange(info.problemPage);
    const modelPages = parsePageRange(info.modelAnswerPage);

    switch (role) {
      case 'answer':
        return answerPages;
      case 'problem':
        return problemPages;
      case 'model':
        return modelPages;
      case 'answer_problem':
        return mergeUniquePages(answerPages, problemPages);
      case 'problem_model':
        return mergeUniquePages(problemPages, modelPages);
      case 'all':
        return mergeUniquePages(answerPages, problemPages, modelPages);
      default:
        return [];
    }
  };

  const shouldCompressImages = (files: File[]): boolean => {
    const imageFiles = files.filter((file) => isImageFile(file));
    if (imageFiles.length === 0) return false;

    if (imageFiles.some((file) => file.size > MAX_SINGLE_FILE_SIZE_BYTES)) {
      return true;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const imageSize = imageFiles.reduce((sum, file) => sum + file.size, 0);
    const nonImageSize = totalSize - imageSize;
    if (nonImageSize >= MAX_TOTAL_SIZE_BYTES) {
      return false;
    }

    const imageBudget = MAX_TOTAL_SIZE_BYTES - nonImageSize;
    return imageSize > imageBudget;
  };

  // 圧縮タイムアウト: ファイル数に応じて動的に設定（PC版で高解像度画像が多い場合に対応）
  const getCompressionTimeout = (fileCount: number) => {
    // 基本: 1ファイルあたり6秒 + バッファ10秒（最低15秒、最大60秒）
    const baseTimeout = Math.min(60000, Math.max(15000, fileCount * 6000 + 10000));
    return baseTimeout;
  };

  const compressWithTimeout = async (
    files: File[],
    onProgress?: (progress: number, currentFile: string) => void
  ): Promise<File[]> => {
    const startTime = Date.now();
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const timeoutMs = getCompressionTimeout(files.length);
    console.log(`[Page] Compression start: ${files.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB, timeout: ${timeoutMs}ms`);

    try {
      // 外側タイムアウト（最終防衛線）
      const timeoutPromise = new Promise<File[]>((resolve) =>
        setTimeout(() => {
          console.warn(`[Page] Compression timeout after ${timeoutMs}ms, using original files`);
          resolve(files);
        }, timeoutMs)
      );

      const result = await Promise.race([
        compressMultipleImages(files, onProgress),
        timeoutPromise,
      ]);

      const compressedSize = result.reduce((sum, f) => sum + f.size, 0);
      const elapsed = Date.now() - startTime;
      console.log(`[Page] Compression done in ${elapsed}ms: ${(totalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB`);
      return result;
    } catch (err) {
      console.error('[Page] Compression error:', err);
      return files; // エラー時は元ファイル
    }
  };

  const prepareFilesForUpload = async (
    files: File[],
    options: {
      fileRoles: Record<number, FileRole>;
      pdfPageInfo: { answerPage?: string; problemPage?: string; modelAnswerPage?: string };
      onCompressionProgress?: (progress: number, currentFile: string) => void;
    }
  ): Promise<File[]> => {
    let processedFiles = files;
    const hasPdf = processedFiles.some((file) => file.type === 'application/pdf');
    const hasPdfPageInfo = !!(
      options.pdfPageInfo.answerPage ||
      options.pdfPageInfo.problemPage ||
      options.pdfPageInfo.modelAnswerPage
    );

    if (hasPdf && hasPdfPageInfo) {
      const extractedFiles: File[] = [];
      for (let i = 0; i < processedFiles.length; i += 1) {
        const file = processedFiles[i];
        if (file.type !== 'application/pdf') {
          extractedFiles.push(file);
          continue;
        }
        const role = options.fileRoles[i];
        const pages = getPdfPagesForRole(role, options.pdfPageInfo);
        if (pages.length === 0) {
          extractedFiles.push(file);
          continue;
        }
        const { file: extracted } = await extractPdfPages(file, pages);
        extractedFiles.push(extracted);
      }
      processedFiles = extractedFiles;
    }

    if (!shouldCompressImages(processedFiles)) {
      return processedFiles;
    }

    return compressWithTimeout(processedFiles, options.onCompressionProgress);
  };

  const openOcrEditModal = (label: string, initialText: string, strictness: GradingStrictness, problemCondition = '') => {
    setOcrEditModal({ label, text: initialText, strictness, problemCondition });
  };

  const runManualOcrRegrade = async () => {
    if (!ocrEditModal) return;
    const { label, text, strictness, problemCondition } = ocrEditModal;

    if (!user || !session) {
      openAuthModal('signin');
      return;
    }

    if (uploadedFiles.length === 0) {
      setError('ファイルをアップロードしてください。');
      return;
    }

    const hasImages = uploadedFiles.some(f => isImageFile(f));
    const hasPdf = uploadedFiles.some(f => f.type === 'application/pdf');
    const hasPdfPageInfo = !!(pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage);
    let filesToUse = uploadedFiles;

    if (hasImages || (hasPdf && hasPdfPageInfo)) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionFileName('');

      try {
        filesToUse = await prepareFilesForUpload(uploadedFiles, {
          fileRoles,
          pdfPageInfo,
          onCompressionProgress: (progress, fileName) => {
            setCompressionProgress(progress);
            setCompressionFileName(fileName);
          },
        });
      } catch (err) {
        console.error('[Page] Manual regrade compression error:', err);
        filesToUse = uploadedFiles;
      } finally {
        setIsCompressing(false);
        setCompressionProgress(0);
        setCompressionFileName('');
      }
    }

    const MAX_TOTAL_SIZE = MAX_TOTAL_SIZE_BYTES;
    const MAX_SINGLE_FILE_SIZE = MAX_SINGLE_FILE_SIZE_BYTES;
    const totalSize = filesToUse.reduce((sum, file) => sum + file.size, 0);

    const oversizedFile = filesToUse.find(file => file.size > MAX_SINGLE_FILE_SIZE);
    if (oversizedFile) {
      const isPdf = oversizedFile.type === 'application/pdf';
      const advice = isPdf 
        ? PDF_SIZE_ADVICE
        : '4.3MB以下のファイルをアップロードしてください。';
      setError(`ファイル「${oversizedFile.name}」が大きすぎます（${(oversizedFile.size / 1024 / 1024).toFixed(1)}MB）。${advice}`);
      return;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      const totalMB = (totalSize / 1024 / 1024).toFixed(1);
      const maxMB = (MAX_TOTAL_SIZE / 1024 / 1024).toFixed(1);
      const hasPdf = filesToUse.some(f => f.type === 'application/pdf');
      const advice = hasPdf 
        ? PDF_SIZE_ADVICE
        : `合計${maxMB}MB以下になるように、ファイルを分割するか、写真の枚数を減らしてください。`;
      setError(`ファイルの合計サイズが大きすぎます（${totalMB}MB）。${advice}`);
      return;
    }

    if (!acquireRequestLock()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setRequirePlan(false);

    const formData = new FormData();
    formData.append('targetLabels', JSON.stringify([label]));
    formData.append('confirmedTexts', JSON.stringify({ [label]: text }));
    formData.append('strictness', strictness);
    if (deviceInfo?.fingerprint) {
      formData.append('deviceFingerprint', deviceInfo.fingerprint);
    }
    if (pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage) {
      formData.append('pdfPageInfo', JSON.stringify(pdfPageInfo));
    }
    formData.append('fileRoles', JSON.stringify(fileRoles));
    // 問題条件のオーバーライド（AIが誤読した字数制限などを手動で指定）
    if (problemCondition.trim()) {
      formData.append('problemConditions', JSON.stringify({ [label]: problemCondition.trim() }));
    }
    // 模範解答テキスト入力モードの場合
    if (modelAnswerInputMode === 'text' && modelAnswerText.trim()) {
      formData.append('modelAnswerText', modelAnswerText.trim());
    }

    filesToUse.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.status === 'error') {
        setError(data.message);
        if (data.requirePlan) setRequirePlan(true);
      } else {
        // 既存の結果とマージ: 同じラベルの問題は新しい結果で上書き
        setResults((prev) => {
          const newItems = Array.isArray(data.results) ? data.results : [];
          if (!prev || prev.length === 0) return newItems;
          const byLabel = new Map(prev.map((x: GradingResponseItem) => [x.label, x]));
          for (const item of newItems) byLabel.set(item.label, item);
          return Array.from(byLabel.values());
        });
        if (Array.isArray(data.results)) ingestRegradeInfo(data.results);
        refreshUsageInfo().catch((err) => {
          console.warn('Failed to refresh usage info:', err);
        });
        setOcrEditModal(null);
      }
    } catch (err) {
      console.error('[Page] Manual regrade error:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('採点処理がタイムアウトしました（5分経過）。');
      } else {
        setError('採点処理中にエラーが発生しました。');
      }
    } finally {
      setIsLoading(false);
      releaseRequestLock();
    }
  };

  // ドラッグ＆ドロップ用のイベントハンドラー
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // ドロップゾーン内の子要素間を移動する際にleaveイベントが発火するのを防ぐ
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  }, []);

  // ファイル処理の共通ロジック
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_FILES = 10;
  const VALID_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|heic|heif|pdf)$/i;

  const processFiles = useCallback(async (files: File[]) => {
    console.log(`[Page] File selected: ${files.length} files`);

    // ファイル数の上限チェック
    if (files.length > MAX_FILES) {
      setError(`一度にアップロードできるファイルは${MAX_FILES}個までです。`);
      return;
    }

    // 画像またはPDFのみをフィルタリング（MIMEタイプ + 拡張子 + サイズ）
    const validFiles = files.filter(f => {
      const validMimeType = f.type.startsWith('image/') || f.type === 'application/pdf';
      const validExtension = VALID_EXTENSIONS.test(f.name);
      const validSize = f.size <= MAX_FILE_SIZE;
      return (validMimeType || validExtension) && validSize;
    });

    // フィルタリングされたファイル数をカウント
    const filteredCount = files.length - validFiles.length;

    if (validFiles.length === 0) {
      console.log('[Page] No valid files (image/PDF) found');
      if (isMountedRef.current) {
        setError('画像ファイル（JPG、PNG、HEIC等）またはPDFファイルのみアップロードできます。（最大50MB）');
      }
      return;
    }

    // 一部のファイルが除外された場合の警告
    if (filteredCount > 0) {
      console.warn(`[Page] ${filteredCount} invalid files filtered out`);
    }

    // 画像ファイルがある場合は圧縮処理
    const hasImages = validFiles.some(f => isImageFile(f));
    const shouldCompress = hasImages && shouldCompressImages(validFiles);
    let processedFiles = validFiles;

    if (shouldCompress) {
      if (isMountedRef.current) {
        setIsCompressing(true);
        setCompressionProgress(0);
        setCompressionFileName('');
      }

      try {
        processedFiles = await compressWithTimeout(
          validFiles,
          (progress, fileName) => {
            // 非同期コールバック内でのアンマウントチェック
            if (isMountedRef.current) {
              setCompressionProgress(progress);
              setCompressionFileName(fileName);
            }
          }
        );

        const totalSize = processedFiles.reduce((sum, f) => sum + f.size, 0);
        console.log(`[Page] Compression complete: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
      } catch (err) {
        console.error('[Page] Compression error:', err);
        processedFiles = validFiles;
      } finally {
        if (isMountedRef.current) {
          setIsCompressing(false);
          setCompressionProgress(0);
          setCompressionFileName('');
        }
      }
    }

    // 新しいファイルに対して役割を自動推定（初期値として）
    const initialRoles: Record<number, FileRole> = {};
    processedFiles.forEach((file, i) => {
      const idx = i; // モーダル内でのインデックス
      const name = file.name.toLowerCase();
      if (/(answer|ans|student|解答|答案|生徒)/.test(name)) {
        initialRoles[idx] = 'answer';
      } else if (/(problem|question|課題|設問|問題|本文)/.test(name)) {
        initialRoles[idx] = 'problem';
      } else if (/(model|key|模範|解説|正解|解答例)/.test(name)) {
        initialRoles[idx] = 'model';
      } else {
        // デフォルト: 1つ目は答案、2つ目以降は問題+模範解答
        const existingAnswers = Object.values(initialRoles).filter(r => r === 'answer' || r === 'answer_problem' || r === 'all').length;
        if (existingAnswers === 0) initialRoles[idx] = 'answer';
        else initialRoles[idx] = 'problem_model';  // 問題と模範解答が一緒のケースが多い
      }
    });

    // ポップアップを表示（アンマウント後の更新を防止）
    if (isMountedRef.current) {
      setPendingFiles(processedFiles);
      setPendingFileRoles(initialRoles);
      setShowFileRoleModal(true);
    }
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      await processFiles(files);
      // ファイル入力の値をクリア（同じファイルを再度選択できるように）
      e.target.value = '';
    }
  }, [processFiles]);

  // ドラッグ＆ドロップでファイルを受け取るハンドラー
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await processFiles(files);
    }
  }, [processFiles]);

  const removeFile = (index: number) => {
    setUploadedFiles(prev => {
      const next = prev.filter((_, i) => i !== index);
      const nextRoles: Record<number, FileRole> = {};
      Object.entries(fileRoles).forEach(([key, value]) => {
        const oldIdx = parseInt(key);
        if (oldIdx < index) nextRoles[oldIdx] = value;
        else if (oldIdx > index) nextRoles[oldIdx - 1] = value;
      });
      setFileRoles(nextRoles);

      const nextAnswerIndex = detectAnswerIndexByRole(next, nextRoles, null);
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

  const parsePointsValue = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    // 整数に丸める（小数点は不要）
    return Math.floor(parsed);
  };

  const formatPointsValue = (value: number): string => {
    // 整数のみを表示（小数点は不要）
    return String(Math.floor(value));
  };

  // 保存済み問題を読み込み
  const loadSavedProblem = useCallback(async (problemId: string) => {
    try {
      const problem = await getProblem(problemId);
      if (!problem) {
        setError('問題が見つかりませんでした');
        return;
      }

      const { files, fileRoles: roles } = restoreFilesFromProblem(problem);

      // 共通ファイルとして設定
      setSharedFiles(files);
      setSharedFileRoles(roles as Record<number, FileRole>);

      // 問題設定を復元
      setSelectedProblems(problem.selectedProblems);
      setProblemPoints(problem.problemPoints);
      setProblemFormat(problem.problemFormat);
      setSmallFormat(problem.smallFormat);

      // 模範解答テキストがあれば復元
      if (problem.modelAnswerText) {
        setModelAnswerText(problem.modelAnswerText);
        setModelAnswerInputMode('text');
      }

      setLoadedProblemId(problem.id);
      setLoadedProblemTitle(problem.title);
      setShowSavedProblemsList(false);
    } catch (e) {
      console.error('問題の読み込みに失敗:', e);
      setError('問題の読み込みに失敗しました');
    }
  }, []);

  // 現在の問題を保存
  const saveCurrentProblem = useCallback(async (title: string) => {
    // sharedFilesとsharedFileRolesから問題・模範解答のみ抽出
    const problemRoles: Record<number, SavedFileRole> = {};
    Object.entries(sharedFileRoles).forEach(([idx, role]) => {
      if (role === 'problem' || role === 'model' || role === 'problem_model') {
        problemRoles[parseInt(idx)] = role as SavedFileRole;
      }
    });

    const problemId = await saveProblem({
      title,
      selectedProblems,
      problemPoints,
      problemFormat,
      smallFormat,
      files: sharedFiles,
      fileRoles: problemRoles,
      modelAnswerText: modelAnswerInputMode === 'text' ? modelAnswerText : undefined,
    });

    // 一覧を更新
    const problems = await getAllProblems();
    setSavedProblems(problems);
    setLoadedProblemId(problemId);
    setLoadedProblemTitle(title);
  }, [sharedFiles, sharedFileRoles, selectedProblems, problemPoints, problemFormat, smallFormat, modelAnswerInputMode, modelAnswerText]);

  // 保存済み問題を削除
  const handleDeleteProblem = useCallback(async (problemId: string) => {
    await deleteProblem(problemId);
    const problems = await getAllProblems();
    setSavedProblems(problems);

    // 削除した問題が読み込み中だった場合はクリア
    if (loadedProblemId === problemId) {
      setLoadedProblemId(null);
      setLoadedProblemTitle(null);
    }
  }, [loadedProblemId]);

  // 読み込み済み問題をクリア
  const clearLoadedProblem = useCallback(() => {
    setLoadedProblemId(null);
    setLoadedProblemTitle(null);
  }, []);

  const addProblem = () => {
    const label = generateProblemLabel();
    if (!label || selectedProblems.includes(label)) {
      return; // 空または重複チェック
    }
    setSelectedProblems([...selectedProblems, label]);
    const parsedPoints = parsePointsValue(currentPoints);
    setProblemPoints((prev) => {
      if (parsedPoints === null) {
        return prev;
      }
      return { ...prev, [label]: parsedPoints };
    });
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
      const parsedPoints = parsePointsValue(currentPoints);
      if (parsedPoints !== null) {
        setProblemPoints((prev) => {
          const next = { ...prev };
          newLabels.forEach((label) => {
            next[label] = parsedPoints;
          });
          return next;
        });
      }
    }
  };

  // 全クリア
  const clearAllProblems = () => {
    setSelectedProblems([]);
    setProblemPoints({});
  };

  const removeProblem = (index: number) => {
    const newProblems = [...selectedProblems];
    const removedLabel = newProblems[index];
    newProblems.splice(index, 1);
    setSelectedProblems(newProblems);
    if (removedLabel) {
      setProblemPoints((prev) => {
        const next = { ...prev };
        delete next[removedLabel];
        return next;
      });
    }
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
    if (targetLabels.length === 1 && selectedProblems.length === 0) {
      const parsedPoints = parsePointsValue(currentPoints);
      if (parsedPoints !== null) {
        setProblemPoints((prev) => ({ ...prev, [targetLabels[0]]: parsedPoints }));
      }
    }
    
    // 画像ファイルを圧縮（10枚対応）
    const hasImages = uploadedFiles.some(f => isImageFile(f));
    const hasPdf = uploadedFiles.some(f => f.type === 'application/pdf');
    const hasPdfPageInfoForProcessing = !!(pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage);
    let filesToUse = uploadedFiles;
    
    if (hasImages || (hasPdf && hasPdfPageInfoForProcessing)) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionFileName('');
      
      try {
        filesToUse = await prepareFilesForUpload(uploadedFiles, {
          fileRoles,
          pdfPageInfo,
          onCompressionProgress: (progress, fileName) => {
            setCompressionProgress(progress);
            setCompressionFileName(fileName);
          },
        });
      } catch (err) {
        console.error('[Page] OCR compression error:', err);
        // 圧縮に失敗しても元のファイルで続行
        filesToUse = uploadedFiles;
      } finally {
        setIsCompressing(false);
        setCompressionProgress(0);
        setCompressionFileName('');
      }
    }

    // 圧縮後のファイルサイズチェック（413エラー対策）
    const totalFileSize = filesToUse.reduce((sum, file) => sum + file.size, 0);
    const MAX_REQUEST_SIZE = MAX_TOTAL_SIZE_BYTES;
    
    if (totalFileSize > MAX_REQUEST_SIZE) {
      const totalMB = (totalFileSize / 1024 / 1024).toFixed(1);
      const maxMB = (MAX_REQUEST_SIZE / 1024 / 1024).toFixed(1);
      const fileCount = filesToUse.length;
      const hasPdf = filesToUse.some(f => f.type === 'application/pdf');
      const baseMessage = `ファイルの合計サイズが大きすぎます（${totalMB}MB、${fileCount}枚）。合計${maxMB}MB以下になるように、ファイルを分割するか、写真の枚数を減らしてください。`;
      setError(hasPdf ? `${baseMessage} ${PDF_SIZE_ADVICE}` : baseMessage);
      return;
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
      
      // 圧縮後のファイルを使用
      filesToUse.forEach((file) => {
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
          let fallbackMessage: string;
          if (res.status === 413) {
            fallbackMessage = 'ファイルの合計サイズが大きすぎます。ファイルを圧縮するか、分割してください。';
          } else if (res.status === 504) {
            fallbackMessage = 'OCRサーバーがタイムアウトしました。時間をおいて再試行してください。';
          } else {
            fallbackMessage = `OCRサーバーの応答が不正です（status ${res.status}）。`;
          }
          setError(fallbackMessage);
          setOcrFlowStep('idle');
          return;
        }

        if (!res.ok) {
          let message: string;
          if (data?.message) {
            message = data.message;
          } else if (res.status === 413) {
            message = 'ファイルの合計サイズが大きすぎます。ファイルを圧縮するか、分割してください。';
          } else if (res.status === 504) {
            message = 'OCRサーバーがタイムアウトしました。時間をおいて再試行してください。';
          } else {
            message = `OCRリクエストが失敗しました（status ${res.status}）。`;
          }
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

    if (!acquireRequestLock()) {
      return;
    }

    setOcrFlowStep('grading');
    setIsLoading(true);
    setError(null);
    // 既存の結果は保持（nullにしない）- 再採点時に前の結果が消えないようにする

    const targetLabels = Object.keys(confirmedTexts);
    console.log('[Page] Starting grading with labels:', targetLabels);

    // 画像ファイルを圧縮（OCR時と同様）
    const hasImages = uploadedFiles.some(f => isImageFile(f));
    const hasPdf = uploadedFiles.some(f => f.type === 'application/pdf');
    const hasPdfPageInfoForProcessing = !!(pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage);
    let filesToUse = uploadedFiles;
    
    if (hasImages || (hasPdf && hasPdfPageInfoForProcessing)) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionFileName('');
      
      try {
        filesToUse = await prepareFilesForUpload(uploadedFiles, {
          fileRoles,
          pdfPageInfo,
          onCompressionProgress: (progress, fileName) => {
            setCompressionProgress(progress);
            setCompressionFileName(fileName);
          },
        });
      } catch (err) {
        console.error('[Page] Grading compression error:', err);
        // 圧縮に失敗しても元のファイルで続行
        filesToUse = uploadedFiles;
      } finally {
        setIsCompressing(false);
        setCompressionProgress(0);
        setCompressionFileName('');
      }
    }

    // 圧縮後のファイルサイズチェック
    const MAX_TOTAL_SIZE = MAX_TOTAL_SIZE_BYTES;
    const totalSize = filesToUse.reduce((sum, file) => sum + file.size, 0);
    
    if (totalSize > MAX_TOTAL_SIZE) {
      const totalMB = (totalSize / 1024 / 1024).toFixed(1);
      const maxMB = (MAX_TOTAL_SIZE / 1024 / 1024).toFixed(1);
      const hasPdf = filesToUse.some(f => f.type === 'application/pdf');
      const baseMessage = `ファイルの合計サイズが大きすぎます（${totalMB}MB）。合計${maxMB}MB以下になるように、ファイルを圧縮するか分割してください。`;
      setError(hasPdf ? `${baseMessage} ${PDF_SIZE_ADVICE}` : baseMessage);
      setIsLoading(false);
      setOcrFlowStep('idle');
      releaseRequestLock();
      return;
    }

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

    // 模範解答テキスト入力モードの場合
    if (modelAnswerInputMode === 'text' && modelAnswerText.trim()) {
      formData.append('modelAnswerText', modelAnswerText.trim());
    }

    // 圧縮後のファイルを使用
    filesToUse.forEach((file) => {
      formData.append('files', file);
    });

    try {
      console.log('[Page] Sending request to /api/grade...');
      
      // 5分のタイムアウトを設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);
      
      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      console.log('[Page] Response status:', res.status);

      const data = await res.json();
      console.log('[Page] Response data:', data);

      if (data.status === 'error') {
        setError(data.message);
        if (data.requirePlan) {
          setRequirePlan(true);
        }
      } else {
        // 既存の結果とマージ: 同じラベルの問題は新しい結果で上書き
        setResults((prev) => {
          const newItems = Array.isArray(data.results) ? data.results : [];
          if (!prev || prev.length === 0) return newItems;
          const byLabel = new Map(prev.map((x: GradingResponseItem) => [x.label, x]));
          for (const item of newItems) byLabel.set(item.label, item);
          return Array.from(byLabel.values());
        });
        if (Array.isArray(data.results)) ingestRegradeInfo(data.results);
        refreshUsageInfo().catch((err) => {
          console.warn('Failed to refresh usage info:', err);
        });
      }
    } catch (err) {
      console.error('[Page] Grading error:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('採点処理がタイムアウトしました（5分経過）。画像ファイルのサイズが大きい場合、圧縮してから再度お試しください。');
      } else {
        setError('採点処理中にエラーが発生しました。ネットワーク接続を確認し、再度お試しください。');
      }
    } finally {
      setIsLoading(false);
      setOcrFlowStep('idle');
      releaseRequestLock();
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

    // 画像ファイルを圧縮（10枚対応）
    const hasImages = uploadedFiles.some(f => isImageFile(f));
    const hasPdf = uploadedFiles.some(f => f.type === 'application/pdf');
    const hasPdfPageInfoForProcessing = !!(pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage);
    let filesToUse = uploadedFiles;
    
    if (hasImages || (hasPdf && hasPdfPageInfoForProcessing)) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionFileName('');
      
      try {
        filesToUse = await prepareFilesForUpload(uploadedFiles, {
          fileRoles,
          pdfPageInfo,
          onCompressionProgress: (progress, fileName) => {
            setCompressionProgress(progress);
            setCompressionFileName(fileName);
          },
        });
      } catch (err) {
        console.error('[Page] Grading compression error:', err);
        // 圧縮に失敗しても元のファイルで続行
        filesToUse = uploadedFiles;
      } finally {
        setIsCompressing(false);
        setCompressionProgress(0);
        setCompressionFileName('');
      }
    }

    // 圧縮後のファイルサイズチェック（Vercel Serverless Functions: 4.5MBペイロード上限）
    const MAX_TOTAL_SIZE = MAX_TOTAL_SIZE_BYTES;
    const MAX_SINGLE_FILE_SIZE = MAX_SINGLE_FILE_SIZE_BYTES;
    const totalSize = filesToUse.reduce((sum, file) => sum + file.size, 0);
    
    const oversizedFile = filesToUse.find(file => file.size > MAX_SINGLE_FILE_SIZE);
    if (oversizedFile) {
      const isPdf = oversizedFile.type === 'application/pdf';
      const advice = isPdf 
        ? PDF_SIZE_ADVICE
        : '4.3MB以下のファイルをアップロードしてください。';
      setError(`ファイル「${oversizedFile.name}」が大きすぎます（${(oversizedFile.size / 1024 / 1024).toFixed(1)}MB）。${advice}`);
      return;
    }
    
    if (totalSize > MAX_TOTAL_SIZE) {
      const totalMB = (totalSize / 1024 / 1024).toFixed(1);
      const maxMB = (MAX_TOTAL_SIZE / 1024 / 1024).toFixed(1);
      const hasPdf = filesToUse.some(f => f.type === 'application/pdf');
      const baseMessage = `ファイルの合計サイズが大きすぎます（${totalMB}MB）。合計${maxMB}MB以下になるように、ファイルを分割してください。`;
      setError(hasPdf ? `${baseMessage} ${PDF_SIZE_ADVICE}` : baseMessage);
      return;
    }

    if (!acquireRequestLock()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setRequirePlan(false);
    // 既存の結果は保持（nullにしない）- 再採点時に前の結果が消えないようにする

    console.log('[Page] Starting grading process...');
    console.log('[Page] Target labels:', targetLabels);
    console.log('[Page] Files count:', filesToUse.length);

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

    // 模範解答テキスト入力モードの場合
    if (modelAnswerInputMode === 'text' && modelAnswerText.trim()) {
      formData.append('modelAnswerText', modelAnswerText.trim());
      console.log('[Page] Model answer text mode enabled');
    }

    // 圧縮後のファイルを使用
    filesToUse.forEach((file, idx) => {
      formData.append(`files`, file);
      const role = fileRoles[idx] || 'other';
      console.log(`[Page] File ${idx}: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - Role: ${role}`);
    });

    try {
      console.log('[Page] Sending request to /api/grade...');

      // 5分のタイムアウトを設定
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      const res = await fetch('/api/grade', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
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
        // 既存の結果とマージ: 同じラベルの問題は新しい結果で上書き
        setResults((prev) => {
          const newItems = Array.isArray(data.results) ? data.results : [];
          if (!prev || prev.length === 0) return newItems;
          const byLabel = new Map(prev.map((x: GradingResponseItem) => [x.label, x]));
          for (const item of newItems) byLabel.set(item.label, item);
          return Array.from(byLabel.values());
        });
        if (Array.isArray(data.results)) ingestRegradeInfo(data.results);

        // 回数消費情報をログ出力・保存
        if (data.usageInfo) {
          console.log('[Page] Usage info from API:', data.usageInfo);
          console.log('[DEBUG] usageInfo details:', {
            remainingCount: data.usageInfo.remainingCount,
            usageCount: data.usageInfo.usageCount,
            usageLimit: data.usageInfo.usageLimit
          });
          // 現在の使用回数を保存（APIから返された最新情報）
          setUsageConsumed({
            consumed: true,
            previousCount: usageInfo?.usageCount ?? null,
            currentCount: data.usageInfo.usageCount ?? null,
          });
        } else {
          console.warn('[Page] No usageInfo returned from API');
        }

        // 利用情報を更新（エラーが発生しても続行、非同期で実行）
        refreshUsageInfo().then(() => {
        }).catch((err) => {
          console.warn('[Page] Failed to refresh usage info:', err);
        });
      }
    } catch (err: unknown) {
      console.error('[Page] Grading error:', err);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('採点処理がタイムアウトしました（5分経過）。画像ファイルのサイズが大きい場合、圧縮してから再度お試しください。');
      } else {
        const message = err instanceof Error ? err.message : '通信エラーが発生しました。';
        setError(message);
      }
    } finally {
      console.log('[Page] Grading process complete, clearing loading state');
      setIsLoading(false);
      releaseRequestLock();
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

    if (!acquireRequestLock()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setRequirePlan(false);
    setRegradingLabel(label);  // 再採点中のラベルをセット

    const hasImages = uploadedFiles.some(f => isImageFile(f));
    const hasPdf = uploadedFiles.some(f => f.type === 'application/pdf');
    const hasPdfPageInfo = !!(pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage);
    let filesToUse = uploadedFiles;

    if (hasImages || (hasPdf && hasPdfPageInfo)) {
      setIsCompressing(true);
      setCompressionProgress(0);
      setCompressionFileName('');

      try {
        filesToUse = await prepareFilesForUpload(uploadedFiles, {
          fileRoles,
          pdfPageInfo,
          onCompressionProgress: (progress, fileName) => {
            setCompressionProgress(progress);
            setCompressionFileName(fileName);
          },
        });
      } catch (err) {
        console.error('[Page] Regrade compression error:', err);
        filesToUse = uploadedFiles;
      } finally {
        setIsCompressing(false);
        setCompressionProgress(0);
        setCompressionFileName('');
      }
    }

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

    const hasPdfPageInfoForRequest = pdfPageInfo.answerPage || pdfPageInfo.problemPage || pdfPageInfo.modelAnswerPage;
    if (hasPdfPageInfoForRequest) {
      formData.append('pdfPageInfo', JSON.stringify(pdfPageInfo));
    }
    formData.append('fileRoles', JSON.stringify(fileRoles));
    filesToUse.forEach((file) => {
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
      setRegradingLabel(null);  // 再採点中のラベルをクリア
      releaseRequestLock();
    }
  };

  const normalizeScore = (score: number): number => {
    if (typeof score !== 'number' || Number.isNaN(score)) return 0;
    if (score <= 10) {
      const result = Math.min(100, Math.round(score * 10));
      return result;
    }
    return Math.min(100, Math.round(score));
  };

  // 次の問題へ進むためのリセット関数（ファイルも全てリセット）
  const handleNextProblem = () => {
    // リクエストロックをリセット
    requestLockRef.current = false;
    
    // フォーム状態をリセット
    setUploadedFiles([]);
    setAnswerFileIndex(null);
    setFileRoles({});
    setResults(null);
    setError(null);
    setRequirePlan(false);
    setOcrFlowStep('idle');
    setOcrResults({});
    setConfirmedTexts({});
    setCurrentOcrLabel('');
    setOcrEditModal(null);
    setRegradeByLabel({});
    setEditedFeedbacks({});
    setEditingFields({});
    setPdfPageInfo({ answerPage: '', problemPage: '', modelAnswerPage: '' });
    setUsageConsumed(null);
    setIsLoading(false);
    setRegradingLabel(null);
    
    // 問題選択もリセット
    setSelectedProblems([]);
    setProblemPoints({});
    setCurrentPoints('');
    setFreeInput('');

    // 使用情報を再取得（回数消費が確定したことを表示に反映）
    refreshUsageInfo().catch((err) => {
      console.warn('[Page] Failed to refresh usage info:', err);
    });

    // ページ上部にスクロール
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 同じファイルで別の設問を採点するためのリセット関数（ファイルは保持）
  const handleSameFilesNewProblem = () => {
    // リクエストロックをリセット
    requestLockRef.current = false;
    
    // 採点関連の状態のみリセット（ファイルは保持）
    setResults(null);
    setError(null);
    setRequirePlan(false);
    setOcrFlowStep('idle');
    setOcrResults({});
    setConfirmedTexts({});
    setCurrentOcrLabel('');
    setOcrEditModal(null);
    setRegradeByLabel({});
    setEditedFeedbacks({});
    setEditingFields({});
    setUsageConsumed(null);
    setIsLoading(false);
    setRegradingLabel(null);
    
    // 問題選択をリセット（別の設問を選ぶため）
    setSelectedProblems([]);
    setProblemPoints({});
    setCurrentPoints('');
    // 問題番号は維持（次の問題を連続して採点しやすいように）
    // ただしfreeInputはクリア
    setFreeInput('');
    
    // PDFページ情報はそのまま保持（同じファイルなので）

    // 使用情報を再取得
    refreshUsageInfo().catch((err) => {
      console.warn('[Page] Failed to refresh usage info:', err);
    });

    // フォームの位置にスクロール（問題選択セクションへ）
    window.scrollTo({ top: 400, behavior: 'smooth' });
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
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-800 tracking-tight mb-6 leading-tight">
              <span className="block sm:inline">中学・高校受験</span>
              <span className="block sm:inline">記述問題</span>
              <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 animate-gradient-x block sm:inline-block mt-1 sm:mt-0">
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

            {/* Batch Grading Feature Highlight */}
            <div className="mt-8 mb-12 relative group max-w-4xl mx-auto text-left">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-cyan-500/20 blur-xl rounded-3xl transform group-hover:scale-105 transition-transform duration-500"></div>
              <div className="relative bg-white/60 backdrop-blur-xl border border-white/60 rounded-3xl p-8 shadow-xl flex flex-col md:flex-row items-center gap-8">
                <div className="flex-shrink-0 relative">
                  <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-20 rounded-full animate-pulse-slow"></div>
                  <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3 group-hover:-rotate-6 transition-transform duration-300">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                </div>
                <div className="text-center md:text-left flex-1">
                  <h3 className="text-2xl font-bold text-slate-800 mb-3 flex items-center justify-center md:justify-start gap-2">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">塾の集団授業</span>
                    にも対応！
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    同じ問題なら<span className="font-bold text-emerald-600">10名まで連続採点</span>が可能です。<br className="hidden md:block" />
                    問題・模範解答は1回のアップロードでOK。各生徒の答案だけを追加すれば、まとめて採点できます。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="text-sm bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full border border-emerald-200 font-medium">
                      ⚡ 一括処理で時短
                    </span>
                    <span className="text-sm bg-teal-100 text-teal-700 px-3 py-1 rounded-full border border-teal-200 font-medium">
                      📊 全員分をZIPダウンロード
                    </span>
                    <span className="text-sm bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full border border-cyan-200 font-medium">
                      👨‍🏫 先生の業務効率化
                    </span>
                  </div>
                </div>
                <div className="hidden md:block flex-shrink-0">
                  <div className="bg-white rounded-xl p-4 transform rotate-2 group-hover:rotate-0 transition-transform duration-300 border border-slate-100 shadow-md w-48">
                    <div className="flex items-center gap-2 text-xs text-emerald-600 mb-3 border-b border-slate-100 pb-2 font-bold">
                      <Users className="w-4 h-4" />
                      一括採点モード
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px]">✓</div>
                        <span className="text-slate-600">生徒A 採点完了</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-white text-[8px]">✓</div>
                        <span className="text-slate-600">生徒B 採点完了</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <div className="w-4 h-4 rounded-full bg-indigo-500 animate-pulse flex items-center justify-center text-white text-[8px]">⋯</div>
                        <span className="text-slate-600">生徒C 採点中...</span>
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
                className="flex items-center text-sm font-bold text-indigo-700 bg-gradient-to-r from-indigo-50 to-violet-50 border-2 border-indigo-200 hover:border-indigo-400 hover:from-indigo-100 hover:to-violet-100 transition-all px-4 py-2 rounded-xl shadow-sm hover:shadow-md"
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
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-800 tracking-tight mb-8 leading-tight">
            <span className="block sm:inline">中学・高校受験</span>
            <span className="block sm:inline">記述問題</span>
            <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 animate-gradient-x pb-2 block sm:inline-block mt-1 sm:mt-0">
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

          {/* 信頼性とプライバシーの約束 */}
          <div className="mt-8 max-w-3xl mx-auto space-y-4">
            {/* プロ講師の採点基準アピール */}
            <div className="bg-gradient-to-r from-indigo-50 to-violet-50 backdrop-blur-sm border-2 border-indigo-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-indigo-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-indigo-900 mb-2">プロ講師の採点基準で設計</h3>
                  <p className="text-sm text-indigo-800 leading-relaxed">
                    <strong>20年以上の指導経験を持つプロ講師の採点ノウハウをAIに学習させています。</strong>入試本番を見据えた実践的なフィードバックで、「なぜ減点されるのか」「どう書けば満点になるのか」を具体的にアドバイスします。
                  </p>
                </div>
              </div>
            </div>

            {/* プライバシーの約束 */}
            <div className="bg-emerald-50/80 backdrop-blur-sm border-2 border-emerald-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-emerald-600 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-emerald-900 mb-2">プライバシーの約束</h3>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    <strong>お子様の答案データは採点完了後すぐに削除され、AIの学習には一切使用しません。</strong>安心してご利用いただけるよう、データ保護を徹底しています。<br />
                    <span className="text-emerald-700 mt-1 inline-block">💡 より安心のため、氏名部分を隠してアップロードすることもできます。</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ホーム画面に追加する案内 */}
            <div className="bg-sky-50/80 backdrop-blur-sm border-2 border-sky-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-start">
                <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center mr-3 flex-shrink-0">
                  <img src="/icons/icon-192.png" alt="アプリアイコン" className="w-8 h-8 rounded-lg" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-sky-900 mb-2">ホーム画面に追加</h3>
                  <p className="text-sm text-sky-800 leading-relaxed mb-3">
                    スマホ・タブレットのホーム画面にショートカットを追加すると、アプリのようにすぐ起動できます。
                  </p>
                  <details className="text-xs text-sky-700">
                    <summary className="cursor-pointer font-medium hover:text-sky-900">追加方法を見る</summary>
                    <div className="mt-3 space-y-3 pl-2 border-l-2 border-sky-200">
                      <div>
                        <p className="font-bold text-sky-800">iPhone / iPad（Safari）:</p>
                        <ol className="list-decimal list-inside mt-1 space-y-0.5 text-sky-700">
                          <li>画面下の<span className="inline-flex items-center mx-1 px-1 bg-sky-100 rounded">共有ボタン <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></span>をタップ</li>
                          <li>「ホーム画面に追加」を選択</li>
                          <li>名前を確認して「追加」をタップ</li>
                        </ol>
                      </div>
                      <div>
                        <p className="font-bold text-sky-800">Android（Chrome）:</p>
                        <ol className="list-decimal list-inside mt-1 space-y-0.5 text-sky-700">
                          <li>画面右上の<span className="inline-flex items-center mx-1 px-1 bg-sky-100 rounded">︙メニュー</span>をタップ</li>
                          <li>「ホーム画面に追加」または「アプリをインストール」を選択</li>
                          <li>「追加」をタップ</li>
                        </ol>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white/70 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden border border-white/60 ring-1 ring-white/60 transition-all duration-500 hover:shadow-[0_30px_70px_-15px_rgba(79,70,229,0.15)] relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500"></div>
          <div className="p-8 md:p-14">
            {/* ========== Mode Toggle Tabs ========== */}
            <div className="flex justify-center mb-8">
              <div className="inline-flex bg-slate-100 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setBatchMode('single')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                    batchMode === 'single'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  )}
                >
                  <User className="w-4 h-4" />
                  個別採点
                </button>
                <button
                  type="button"
                  onClick={() => setBatchMode('batch')}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all',
                    batchMode === 'batch'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'text-slate-600 hover:text-slate-800'
                  )}
                >
                  <Users className="w-4 h-4" />
                  一括採点 (最大{MAX_STUDENTS}名)
                </button>
              </div>
            </div>

            {batchMode === 'single' && (
            <>
            <form onSubmit={handleOcrStart} className="space-y-12">

              {/* 採点可能問題数の案内 */}
              <div className="max-w-2xl mx-auto">
                <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                      <span className="text-xl">✨</span>
                    </div>
                    <div className="text-center sm:text-left">
                      <p className="text-sm font-bold text-indigo-800">
                        1度に<span className="text-lg mx-1 text-violet-600">2問まで</span>添削可能です
                      </p>
                      <p className="text-xs text-indigo-600 mt-1">
                        1回の採点で最大2問まで。3問以上ある場合は、続けて同じファイルで採点できます
                      </p>
                    </div>
                  </div>
                </div>
              </div>

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

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={currentPoints}
                    onChange={(e) => {
                      const value = e.target.value;
                      // 小数点を含む場合は整数部分のみを取得
                      if (value.includes('.')) {
                        const intValue = value.split('.')[0];
                        setCurrentPoints(intValue);
                      } else {
                        setCurrentPoints(value);
                      }
                    }}
                    placeholder="配点"
                    className="w-24 text-center bg-white border border-slate-200 text-slate-700 py-3 px-3 rounded-xl leading-tight focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                  />

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
                            {Number.isFinite(problemPoints[label]) ? (
                              <span className="ml-2 text-xs text-indigo-500 font-semibold">配点{formatPointsValue(problemPoints[label])}点</span>
                            ) : null}
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
                      <li className="flex items-start mt-2 pt-2 border-t border-amber-200">
                        <span className="text-amber-500 mr-2">📝</span>
                        <span><strong>問題の文章は全て含める</strong>こと。該当問題と関係ない部分はできるだけ含めないこと</span>
                      </li>
                      <li className="flex items-start mt-2 pt-2 border-t border-amber-200">
                        <span className="text-amber-500 mr-2">⏱️</span>
                        <span><strong>ファイルの読み込みに時間がかかる場合は複数回に分けて処理してください</strong></span>
                      </li>
                    </ul>
                  </div>

                  <p className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-2 rounded-lg inline-block border border-blue-200">
                    🔒 アップロードされた画像は採点完了後に自動削除され、AIの学習には一切利用されません
                  </p>
                </div>

                {/* PDF圧縮ツール紹介セクション */}
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border-2 border-indigo-200 rounded-xl p-4 sm:p-6 mb-4 max-w-2xl mx-auto">
                  <h4 className="text-sm font-bold text-indigo-800 mb-3 flex items-center justify-center">
                    <FileText className="w-4 h-4 mr-2" />
                    PDFが重すぎる場合の圧縮ツール
                  </h4>
                  <p className="text-xs text-indigo-700 mb-4 text-center">
                    PDFファイルが4MBを超える場合は、以下の無料ツールで圧縮してからアップロードしてください
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                    {/* iLovePDF */}
                    <a
                      href="https://www.ilovepdf.com/ja/compress-pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded-lg p-3 sm:p-4 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-red-600" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-indigo-800">iLovePDF</span>
                        <span className="text-[10px] text-indigo-600 mt-1">無料</span>
                      </div>
                    </a>
                    {/* SmallPDF */}
                    <a
                      href="https://smallpdf.com/ja/compress-pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded-lg p-3 sm:p-4 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-orange-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-orange-600" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-indigo-800">SmallPDF</span>
                        <span className="text-[10px] text-indigo-600 mt-1">無料</span>
                      </div>
                    </a>
                    {/* PDF24 */}
                    <a
                      href="https://tools.pdf24.org/ja/compress-pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded-lg p-3 sm:p-4 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-indigo-800">PDF24</span>
                        <span className="text-[10px] text-indigo-600 mt-1">無料</span>
                      </div>
                    </a>
                    {/* Adobe Acrobat Online */}
                    <a
                      href="https://www.adobe.com/jp/acrobat/online/compress-pdf.html"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-white rounded-lg p-3 sm:p-4 border-2 border-indigo-200 hover:border-indigo-400 hover:shadow-lg transition-all duration-300 group"
                    >
                      <div className="flex flex-col items-center text-center">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-100 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                          <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-purple-600" />
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-indigo-800">Adobe</span>
                        <span className="text-[10px] text-indigo-600 mt-1">無料</span>
                      </div>
                    </a>
                  </div>
                  <p className="text-xs text-indigo-600 mt-3 text-center">
                    💡 各ツールのリンクをクリックすると、新しいタブで圧縮ページが開きます
                  </p>
                </div>

                <div className="group relative">
                  <div
                    className={clsx(
                      "relative min-h-48 sm:min-h-72 border-2 border-dashed rounded-2xl sm:rounded-3xl transition-all duration-500 ease-out cursor-pointer overflow-hidden",
                      isDragging
                        ? "border-indigo-500 bg-indigo-100/60 scale-[1.02] shadow-xl shadow-indigo-200/50 ring-4 ring-indigo-500/30"
                        : isCompressing
                          ? "border-amber-400 bg-amber-50/50 ring-4 ring-amber-400/20"
                          : uploadedFiles.length > 0
                            ? "border-indigo-500 bg-indigo-50/30 ring-4 ring-indigo-500/10"
                            : "border-slate-300 bg-slate-50/50 hover:border-indigo-400 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/40 active:bg-indigo-50"
                    )}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
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
                      {isDragging ? (
                        <div className="text-center animate-pulse">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-500 rounded-2xl sm:rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-white">
                            <Camera className="w-8 h-8 sm:w-10 sm:h-10" />
                          </div>
                          <span className="text-base sm:text-lg text-indigo-700 font-bold block mb-2">
                            ここにドロップ！
                          </span>
                          <span className="text-xs sm:text-sm text-indigo-500 block">
                            画像・PDFファイルを受け付けます
                          </span>
                        </div>
                      ) : isCompressing ? (
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
                            タップ or ドラッグ＆ドロップ
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
                          // 答案インデックスを再計算
                          setAnswerFileIndex(detectAnswerIndexByRole(uploadedFiles, newRoles, null));
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
                          // 答案インデックスを再計算
                          setAnswerFileIndex(detectAnswerIndexByRole(uploadedFiles, newRoles, null));
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
                                onClick={() => {
                                  const newRoles = { ...fileRoles, [index]: value as FileRole };
                                  setFileRoles(newRoles);
                                  // 答案インデックスを再計算
                                  setAnswerFileIndex(detectAnswerIndexByRole(uploadedFiles, newRoles, answerFileIndex));
                                }}
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
                          disabled={modelAnswerInputMode === 'text'}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 模範解答入力モード選択 */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-emerald-800 flex items-center">
                        <Edit3 className="w-4 h-4 mr-2" />
                        模範解答の入力方法
                      </h4>
                      <div className="flex bg-white rounded-lg p-1 border border-emerald-200">
                        <button
                          type="button"
                          onClick={() => setModelAnswerInputMode('image')}
                          className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            modelAnswerInputMode === 'image'
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-emerald-600 hover:bg-emerald-50"
                          )}
                        >
                          📷 画像から
                        </button>
                        <button
                          type="button"
                          onClick={() => setModelAnswerInputMode('text')}
                          className={clsx(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                            modelAnswerInputMode === 'text'
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "text-emerald-600 hover:bg-emerald-50"
                          )}
                        >
                          ✏️ 手入力
                        </button>
                      </div>
                    </div>

                    {modelAnswerInputMode === 'text' && (
                      <div className="mt-3">
                        <label className="text-xs font-medium text-emerald-700 block mb-2">
                          模範解答のテキストを入力してください
                        </label>
                        <textarea
                          value={modelAnswerText}
                          onChange={(e) => setModelAnswerText(e.target.value)}
                          placeholder="例: 主人公は友人との別れに対する悲しみと、新しい土地での生活に対する不安を感じているから。"
                          className="w-full h-32 p-3 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm leading-relaxed resize-y bg-white"
                        />
                        <p className="text-xs text-emerald-600 mt-2">
                          💡 採点対象の問題ごとに「大問○ 問○: 模範解答」の形式で入力できます。複数問題を採点する場合は改行して入力してください。
                        </p>
                      </div>
                    )}

                    {modelAnswerInputMode === 'image' && (
                      <p className="text-xs text-emerald-600">
                        アップロードした画像から模範解答を読み取ります。ファイルの役割設定で「模範解答」を指定してください。
                      </p>
                    )}
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
            </>
            )}
            {/* End of Single Mode UI (inside Main Card) */}

            {/* ========== Batch Mode UI ========== */}
            {batchMode === 'batch' && (
              <div className="space-y-6">
                {/* Batch Mode Warning */}
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-800">一括採点は全員同じ問題の場合のみ使用可能です</p>
                      <p className="text-sm text-amber-700 mt-1">
                        共通の問題・模範解答と、各生徒の答案をアップロードしてください。1名あたり1回分の使用回数がカウントされます。
                      </p>
                    </div>
                  </div>
                </div>

                {/* Problem Selection for Batch Mode - Same as Single Mode */}
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-indigo-800 mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    採点する問題を選択（最大2問）
                  </p>

                  {/* 問題形式の選択 */}
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    <button
                      type="button"
                      onClick={() => setProblemFormat('big-small')}
                      disabled={batchState.isProcessing}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${problemFormat === 'big-small'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                      大問＋小問
                    </button>
                    <button
                      type="button"
                      onClick={() => setProblemFormat('small-only')}
                      disabled={batchState.isProcessing}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${problemFormat === 'small-only'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                      問のみ
                    </button>
                    <button
                      type="button"
                      onClick={() => setProblemFormat('free')}
                      disabled={batchState.isProcessing}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${problemFormat === 'free'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                    >
                      自由入力
                    </button>
                  </div>

                  {/* 小問の表記形式（自由入力以外で表示） */}
                  {problemFormat !== 'free' && (
                    <div className="flex flex-wrap gap-2 justify-center mb-4">
                      <span className="text-xs font-bold text-slate-400 self-center mr-1">形式:</span>
                      {['number', 'paren-number', 'paren-alpha', 'number-sub'].map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => setSmallFormat(fmt as typeof smallFormat)}
                          disabled={batchState.isProcessing}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${smallFormat === fmt
                            ? 'bg-violet-600 text-white shadow-md'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'
                            }`}
                        >
                          {fmt === 'number' ? '問1' : fmt === 'paren-number' ? '(1)' : fmt === 'paren-alpha' ? '(a)' : '問1-2'}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 問題番号入力 */}
                  <div className="flex gap-2 items-center justify-center mb-4 flex-wrap">
                    {problemFormat === 'free' ? (
                      <input
                        type="text"
                        value={freeInput}
                        onChange={(e) => setFreeInput(e.target.value)}
                        placeholder="例: 問三、第2問(1)"
                        disabled={batchState.isProcessing}
                        className="flex-1 min-w-[150px] max-w-[200px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 text-sm text-center"
                      />
                    ) : (
                      <>
                        {problemFormat === 'big-small' && (
                          <select
                            value={currentBig}
                            onChange={(e) => setCurrentBig(Number(e.target.value))}
                            disabled={batchState.isProcessing}
                            className="bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-bold"
                          >
                            {[...Array(10)].map((_, i) => (
                              <option key={i + 1} value={i + 1}>大問{i + 1}</option>
                            ))}
                          </select>
                        )}
                        <select
                          value={currentSmall}
                          onChange={(e) => setCurrentSmall(Number(e.target.value))}
                          disabled={batchState.isProcessing}
                          className="bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-bold"
                        >
                          {problemFormat === 'big-small' && <option value={0}>なし</option>}
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
                              <option key={i + 1} value={i + 1}>問{i + 1}</option>
                            ))
                          )}
                        </select>
                        {smallFormat === 'number-sub' && (
                          <>
                            <span className="text-slate-400 font-bold">-</span>
                            <select
                              value={currentSub}
                              onChange={(e) => setCurrentSub(Number(e.target.value))}
                              disabled={batchState.isProcessing}
                              className="bg-white border border-slate-200 text-slate-700 py-2 px-3 rounded-lg text-sm font-bold"
                            >
                              {[...Array(10)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </>
                    )}
                    <input
                      type="number"
                      min="1"
                      value={currentPoints}
                      onChange={(e) => setCurrentPoints(e.target.value.split('.')[0])}
                      placeholder="配点"
                      disabled={batchState.isProcessing}
                      className="w-20 text-center bg-white border border-slate-200 text-slate-700 py-2 px-2 rounded-lg text-sm font-bold"
                    />
                    <button
                      type="button"
                      onClick={addProblem}
                      disabled={batchState.isProcessing || selectedProblems.length >= 2}
                      className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-300 text-white font-bold py-2 px-3 rounded-lg transition-colors flex items-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* 選択された問題 */}
                  {selectedProblems.length > 0 ? (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {selectedProblems.map((label, index) => (
                        <div key={index} className="bg-white text-indigo-700 px-3 py-1.5 rounded-full font-bold text-sm flex items-center border border-indigo-200">
                          {label}
                          {Number.isFinite(problemPoints[label]) && (
                            <span className="ml-1 text-xs text-indigo-500">({problemPoints[label]}点)</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeProblem(index)}
                            disabled={batchState.isProcessing}
                            className="ml-1 text-indigo-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={clearAllProblems}
                        disabled={batchState.isProcessing}
                        className="text-xs text-slate-500 hover:text-red-500 underline"
                      >
                        クリア
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-orange-500 text-center">※ 採点する問題を追加してください</p>
                  )}
                </div>

                {/* Shared Files Section (Problem & Model Answer) */}
                <div className="bg-violet-50 border-2 border-violet-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-violet-800 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      共通ファイル（問題・模範解答）
                    </p>
                    <button
                      onClick={() => setShowSavedProblemsList(true)}
                      disabled={batchState.isProcessing}
                      className="text-xs px-2 py-1 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                      保存済み問題を読み込み
                    </button>
                  </div>

                  {/* 読み込み済み問題の表示 */}
                  {loadedProblemTitle && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-violet-100 border border-violet-300 rounded-lg">
                      <span className="text-xs text-violet-700">読み込み中:</span>
                      <span className="text-sm font-medium text-violet-800">{loadedProblemTitle}</span>
                      <button
                        onClick={clearLoadedProblem}
                        className="ml-auto text-violet-500 hover:text-violet-700"
                        title="クリア"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <p className="text-xs text-violet-600 mb-3">
                    全生徒に共通する問題用紙や模範解答をここにアップロードしてください
                  </p>

                  {/* Shared File Upload Area */}
                  <div
                    className="border-2 border-dashed border-violet-300 rounded-lg p-4 bg-white/50"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (batchState.isProcessing) return;
                      const files = Array.from(e.dataTransfer.files);
                      setSharedFiles((prev) => [...prev, ...files]);
                      // Auto-detect file roles
                      const newRoles: Record<number, FileRole> = { ...sharedFileRoles };
                      files.forEach((file, i) => {
                        const idx = sharedFiles.length + i;
                        const lower = file.name.toLowerCase();
                        if (/problem|問題|mondai/.test(lower)) {
                          newRoles[idx] = 'problem';
                        } else if (/model|sample|模範|解答例|正答/.test(lower)) {
                          newRoles[idx] = 'model';
                        } else {
                          newRoles[idx] = 'problem_model';
                        }
                      });
                      setSharedFileRoles(newRoles);
                    }}
                  >
                    {sharedFiles.length === 0 ? (
                      <div className="text-center py-4">
                        <FileText className="w-8 h-8 mx-auto text-violet-400 mb-2" />
                        <p className="text-sm text-violet-600 mb-2">ファイルをドラッグ&ドロップ</p>
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors">
                            <Plus className="w-4 h-4" />
                            ファイルを選択
                          </span>
                          <input
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf"
                            onChange={(e) => {
                              if (!e.target.files) return;
                              const files = Array.from(e.target.files);
                              setSharedFiles((prev) => [...prev, ...files]);
                              const newRoles: Record<number, FileRole> = { ...sharedFileRoles };
                              files.forEach((file, i) => {
                                const idx = sharedFiles.length + i;
                                const lower = file.name.toLowerCase();
                                if (/problem|問題|mondai/.test(lower)) {
                                  newRoles[idx] = 'problem';
                                } else if (/model|sample|模範|解答例|正答/.test(lower)) {
                                  newRoles[idx] = 'model';
                                } else {
                                  newRoles[idx] = 'problem_model';
                                }
                              });
                              setSharedFileRoles(newRoles);
                              e.target.value = '';
                            }}
                            disabled={batchState.isProcessing}
                            className="hidden"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sharedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-white rounded border border-violet-200">
                            <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
                            <span className="flex-1 text-sm truncate">{file.name}</span>
                            <select
                              value={sharedFileRoles[idx] || 'problem_model'}
                              onChange={(e) => setSharedFileRoles((prev) => ({ ...prev, [idx]: e.target.value as FileRole }))}
                              disabled={batchState.isProcessing}
                              className="text-xs border rounded px-1 py-0.5 bg-white"
                            >
                              <option value="problem">問題</option>
                              <option value="model">模範解答</option>
                              <option value="problem_model">問題+模範解答</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                setSharedFiles((prev) => prev.filter((_, i) => i !== idx));
                                const newRoles: Record<number, FileRole> = {};
                                Object.entries(sharedFileRoles).forEach(([key, val]) => {
                                  const k = parseInt(key);
                                  if (k < idx) newRoles[k] = val;
                                  else if (k > idx) newRoles[k - 1] = val;
                                });
                                setSharedFileRoles(newRoles);
                              }}
                              disabled={batchState.isProcessing}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <label className="cursor-pointer block mt-2">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-violet-600 hover:text-violet-800 transition-colors">
                            <Plus className="w-3 h-3" />
                            ファイルを追加
                          </span>
                          <input
                            type="file"
                            multiple
                            accept=".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf"
                            onChange={(e) => {
                              if (!e.target.files) return;
                              const files = Array.from(e.target.files);
                              setSharedFiles((prev) => [...prev, ...files]);
                              const newRoles: Record<number, FileRole> = { ...sharedFileRoles };
                              files.forEach((file, i) => {
                                const idx = sharedFiles.length + i;
                                const lower = file.name.toLowerCase();
                                if (/problem|問題|mondai/.test(lower)) {
                                  newRoles[idx] = 'problem';
                                } else if (/model|sample|模範|解答例|正答/.test(lower)) {
                                  newRoles[idx] = 'model';
                                } else {
                                  newRoles[idx] = 'problem_model';
                                }
                              });
                              setSharedFileRoles(newRoles);
                              e.target.value = '';
                            }}
                            disabled={batchState.isProcessing}
                            className="hidden"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* 問題保存ボタン */}
                  {sharedFiles.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-violet-200">
                      <button
                        onClick={() => setShowSaveProblemModal(true)}
                        disabled={batchState.isProcessing}
                        className="w-full text-sm px-3 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Save className="w-4 h-4" />
                        この問題を保存（次回から再利用可能）
                      </button>
                    </div>
                  )}
                </div>

                {/* Student Section Header */}
                <div className="border-t-2 border-slate-200 pt-4">
                  <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    各生徒の答案をアップロード
                  </p>
                  <p className="text-xs text-slate-500 mt-1">各生徒には答案ファイルのみアップロードしてください</p>
                </div>

                {/* Progress */}
                {(batchState.isProcessing || batchState.completedCount > 0) && (
                  <BatchProgress batchState={batchState} students={batchStudents} />
                )}

                {/* Student Cards */}
                <div className="space-y-4">
                  {batchStudents.map((student, index) => (
                    <StudentCard
                      key={student.id}
                      student={student}
                      index={index}
                      onUpdate={updateBatchStudent}
                      onRemove={removeBatchStudent}
                      disabled={batchState.isProcessing}
                    />
                  ))}
                </div>

                {/* Duplicate File Warning */}
                {duplicateFileWarnings.length > 0 && !batchState.isProcessing && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-bold text-amber-800 mb-2">
                          ⚠️ 同じファイルが複数の生徒に割り当てられています
                        </h4>
                        <ul className="text-sm text-amber-700 space-y-1">
                          {duplicateFileWarnings.map((dup, idx) => (
                            <li key={idx}>
                              <span className="font-medium">{dup.fileName}</span>
                              <span className="text-amber-600"> → </span>
                              <span>{dup.students.join(', ')}</span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-xs text-amber-600 mt-2">
                          各生徒に異なる答案ファイルを割り当ててください。同じファイルだと同じ結果になります。
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Add Student Button */}
                {batchStudents.length < MAX_STUDENTS && !batchState.isProcessing && (
                  <button
                    type="button"
                    onClick={addBatchStudent}
                    className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    生徒を追加 ({batchStudents.length}/{MAX_STUDENTS})
                  </button>
                )}

                {/* Batch OCR Confirmation UI */}
                {batchOcrStep === 'ocr-loading' && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200">
                    <div className="flex items-center gap-3 mb-4">
                      <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                      <h3 className="font-bold text-lg text-blue-800">文字認識中...</h3>
                    </div>
                    <p className="text-blue-700 mb-2">
                      {batchStudents[currentBatchOcrIndex]?.name || `生徒${currentBatchOcrIndex + 1}`} の答案を読み取っています...
                    </p>
                    <div className="w-full bg-blue-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${((currentBatchOcrIndex + 1) / batchStudents.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-blue-600 mt-2">{currentBatchOcrIndex + 1} / {batchStudents.length} 名完了</p>
                  </div>
                )}

                {batchOcrStep === 'confirm' && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-6 border-2 border-amber-200 space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Camera className="w-6 h-6 text-amber-600" />
                        <h3 className="font-bold text-lg text-amber-800">読み取り結果の確認</h3>
                      </div>
                      <button
                        onClick={cancelBatchOcr}
                        className="px-4 py-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-amber-700 text-sm">
                      AIが読み取った答案テキストを確認・修正してください。修正後に採点が実行されます。
                    </p>

                    {/* 各生徒のOCR結果 */}
                    <div className="space-y-4 max-h-[500px] overflow-y-auto">
                      {batchStudents.map((student, studentIdx) => (
                        <div key={student.id} className="bg-white rounded-xl p-4 border border-amber-100">
                          <div className="flex items-center gap-2 mb-3">
                            <User className="w-5 h-5 text-amber-600" />
                            <span className="font-bold text-slate-800">
                              {student.name || `生徒${studentIdx + 1}`}
                            </span>
                          </div>
                          {selectedProblems.map((label) => {
                            const ocrResult = batchOcrResults[student.id]?.[label];
                            const confirmedText = batchConfirmedTexts[student.id]?.[label] || '';
                            return (
                              <div key={label} className="mb-3 last:mb-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm font-bold">
                                    {label}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {confirmedText.length}文字
                                  </span>
                                </div>
                                <textarea
                                  value={confirmedText}
                                  onChange={(e) => {
                                    setBatchConfirmedTexts((prev) => ({
                                      ...prev,
                                      [student.id]: {
                                        ...prev[student.id],
                                        [label]: e.target.value,
                                      },
                                    }));
                                  }}
                                  rows={3}
                                  className="w-full px-3 py-2 border-2 border-slate-200 rounded-lg focus:border-amber-400 focus:outline-none font-mono text-sm resize-none"
                                  placeholder={ocrResult?.text ? '読み取り結果を編集...' : '答案テキストを入力...'}
                                />
                                {!ocrResult?.text && (
                                  <p className="text-xs text-red-500 mt-1">⚠️ 読み取りに失敗しました。手動で入力してください。</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>

                    {/* 確認ボタン */}
                    <div className="flex gap-3">
                      <button
                        onClick={cancelBatchOcr}
                        className="flex-1 py-3 rounded-xl font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={executeBatchGradingWithConfirmed}
                        className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-5 h-5" />
                        確認して採点開始
                      </button>
                    </div>
                  </div>
                )}

                {/* Batch Grade Button - OCR確認フロー開始 */}
                {batchOcrStep === 'idle' && (
                  <button
                    type="button"
                    onClick={startBatchOcr}
                    disabled={isLoading || batchState.isProcessing || batchStudents.length === 0 || selectedProblems.length === 0 || sharedFiles.length === 0}
                    className={clsx(
                      'w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2',
                      isLoading || batchState.isProcessing || selectedProblems.length === 0 || sharedFiles.length === 0
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-lg hover:shadow-xl'
                    )}
                  >
                    {batchState.isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        採点中... ({batchState.completedCount}/{batchStudents.length})
                      </>
                    ) : (
                      <>
                        <Camera className="w-5 h-5" />
                        {batchStudents.length}名分の答案を読み取る
                      </>
                    )}
                  </button>
                )}

                {/* Retry Failed Button */}
                {batchStudents.some((s) => s.status === 'error') && !batchState.isProcessing && (
                  <button
                    type="button"
                    onClick={retryFailedStudents}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    失敗した{batchStudents.filter((s) => s.status === 'error').length}名を再試行
                  </button>
                )}

                {/* Batch Results */}
                {batchStudents.some((s) => s.status === 'success') && (
                  <BatchResults
                    students={batchStudents}
                    selectedProblems={selectedProblems}
                    problemPoints={problemPoints}
                    teacherName={teacherName}
                    onDownloadZip={handleDownloadZip}
                    isGeneratingZip={isGeneratingZip}
                    onUpdateResult={handleUpdateResult}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Result Display - Only for Single Mode */}
        {batchMode === 'single' && results && results.map((res, index) => {
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
          const maxPoints = problemPoints[res.label];
          const safeMaxPoints = Number.isFinite(maxPoints) && maxPoints > 0 ? maxPoints : null;
          const earnedPoints = safeMaxPoints ? Math.round((normalizedScore / 100) * safeMaxPoints) : null;
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
                          
                          {/* 再採点中の表示 */}
                          {regradingLabel === res.label && (
                            <div className="flex items-center justify-end gap-2 mb-3 px-4 py-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200 shadow-sm">
                              <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                              <span className="text-amber-700 font-bold text-sm">再採点中...</span>
                              <span className="text-amber-600 text-xs">AIが採点をやり直しています</span>
                            </div>
                          )}
                          
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
                            <button
                              type="button"
                              onClick={() => {
                                const initialText =
                                  res.result?.grading_result?.recognized_text_full ||
                                  res.result?.grading_result?.recognized_text ||
                                  confirmedTexts[res.label] ||
                                  '';
                                openOcrEditModal(res.label, initialText, res.strictness || gradingStrictness);
                              }}
                              disabled={isLoading}
                              className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-600 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              AI読み取り結果を修正して再採点（無料）
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
                      studentName={studentName || undefined}
                      teacherName={teacherName || undefined}
                      editedFeedback={editedFeedbacks[index]}
                      maxPoints={problemPoints[res.label] ?? null}
                    />
                  </div>
                </div>

                <div className="p-8 md:p-14">

                  {/* Recognized Text Section */}
                  <div className="mb-16">
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
                      {safeMaxPoints && earnedPoints !== null && (
                        <p className="mt-1 text-sm text-indigo-100/90 font-semibold">
                          得点: {formatPointsValue(earnedPoints)} / {formatPointsValue(safeMaxPoints)} 点
                        </p>
                      )}

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

        {/* 次の問題へボタン */}
        {results && results.length > 0 && (
          <div className="mt-16 mb-8 text-center">
            <div className="bg-gradient-to-r from-indigo-50 via-violet-50 to-purple-50 rounded-3xl p-8 border border-indigo-100 shadow-lg">
              <p className="text-slate-600 mb-4 text-lg">
                採点が完了しました。続けて採点しますか？
              </p>

              {/* 回数消費確認表示 - 常に表示 */}
              <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium border border-green-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                採点回数を1回消費しました
                {(() => {
                  return null;
                })()}
                {usageInfo && usageInfo.usageLimit !== null && usageInfo.usageLimit > 0 && (
                  <span className="ml-1">
                    （残り <span className="font-bold">{usageInfo.remainingCount ?? 0}</span>回 / {usageInfo.usageLimit}回）
                  </span>
                )}
                {usageInfo && (usageInfo.usageLimit === -1 || usageInfo.usageLimit === null) && (
                  <span className="ml-1">（無制限プラン）</span>
                )}
              </div>

              {/* 2つのボタン: 同じファイルで別の設問 / 別のファイルで採点 */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                {/* 同じファイルで別の設問を採点（メイン推奨） */}
                <button
                  onClick={handleSameFilesNewProblem}
                  className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold text-lg hover:from-indigo-700 hover:to-violet-700 transition-all shadow-xl hover:shadow-2xl hover:scale-105 transform"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  同じファイルで別の設問を採点
                </button>

                {/* 別のファイルで採点（サブ） */}
                <button
                  onClick={handleNextProblem}
                  className="inline-flex items-center px-6 py-3 bg-white text-indigo-600 rounded-xl font-bold text-base border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all shadow-md hover:shadow-lg"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  別のファイルで採点する
                </button>
              </div>

              {/* 説明テキスト */}
              <p className="text-xs text-slate-500 mt-4">
                💡 「同じファイルで別の設問を採点」を選ぶと、アップロードした問題用紙・答案・解答をそのまま使って別の設問を採点できます
              </p>
            </div>
          </div>
        )}

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

      {/* OCR Edit Modal */}
      {ocrEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <p className="text-xs text-slate-500">ラベル: {ocrEditModal.label}</p>
                <h2 className="text-lg font-bold text-slate-800">AI読み取り結果を修正して再採点</h2>
              </div>
              <button
                onClick={() => setOcrEditModal(null)}
                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-slate-600">
                読み取り結果に誤りがある場合、ここで修正して再採点できます（無料）。
              </p>
              
              {/* 生徒の答案テキスト入力 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  生徒の答案テキスト
                </label>
                <textarea
                  value={ocrEditModal.text}
                  onChange={(e) => setOcrEditModal(prev => prev ? { ...prev, text: e.target.value } : prev)}
                  className="w-full min-h-[180px] p-4 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800 leading-relaxed font-mono"
                  placeholder="ここに読み取り結果を修正してください"
                />
                <p className="mt-1 text-xs text-slate-500">
                  現在の文字数: {ocrEditModal.text.replace(/\s+/g, '').length}文字
                </p>
              </div>

              {/* 問題条件（字数制限など）のオーバーライド */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <label className="block text-sm font-bold text-amber-800 mb-2 flex items-center">
                  <span className="mr-2">📏</span>
                  問題条件の修正（オプション）
                </label>
                <p className="text-xs text-amber-700 mb-3">
                  AIが字数制限などの問題条件を誤読した場合、ここで正しい条件を入力してください。
                  空欄の場合は画像から読み取った条件をそのまま使用します。
                </p>
                <input
                  type="text"
                  value={ocrEditModal.problemCondition}
                  onChange={(e) => setOcrEditModal(prev => prev ? { ...prev, problemCondition: e.target.value } : prev)}
                  className="w-full p-3 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white text-slate-800"
                  placeholder="例: 40字以上50字以内、〜から始め〜で終わる形式"
                />
                <p className="mt-2 text-xs text-amber-600">
                  ※ 字数制限、形式要件、開始・終了の指定など、AIに採点時に適用してほしい条件を入力
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setOcrEditModal(null)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={runManualOcrRegrade}
                disabled={isLoading || !ocrEditModal.text.trim()}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                修正して再採点する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 問題保存モーダル */}
      <SaveProblemModal
        isOpen={showSaveProblemModal}
        onClose={() => setShowSaveProblemModal(false)}
        onSave={saveCurrentProblem}
        defaultTitle={generateDefaultTitle(selectedProblems)}
        selectedProblems={selectedProblems}
        fileCount={sharedFiles.length}
      />

      {/* 保存済み問題一覧モーダル */}
      <SavedProblemsList
        isOpen={showSavedProblemsList}
        onClose={() => setShowSavedProblemsList(false)}
        problems={savedProblems}
        onSelect={loadSavedProblem}
        onDelete={handleDeleteProblem}
        disabled={batchState.isProcessing}
      />

      {/* File Role Selection Modal */}
      {showFileRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-slate-800 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-indigo-500" />
                ファイルの種類を選択
              </h2>
              <button
                onClick={() => {
                  setShowFileRoleModal(false);
                  setPendingFiles([]);
                  setPendingFileRoles({});
                }}
                className="text-slate-400 hover:text-slate-600 transition-colors p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                各ファイルが「答案」「問題」「模範解答」のどれに該当するか選択してください。
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-700 flex items-start">
                  <span className="mr-2">💡</span>
                  <span><strong>注意：</strong>ファイルの読み込みに時間がかかる場合は、複数回に分けて処理してください。</span>
                </p>
              </div>

              {pendingFiles.map((file, index) => {
                const role = pendingFileRoles[index] || 'other';
                const roleOptions: { value: FileRole; label: string; icon: string }[] = [
                  { value: 'answer', label: '答案', icon: '📝' },
                  { value: 'problem', label: '問題', icon: '📄' },
                  { value: 'model', label: '模範解答', icon: '⭐' },
                  { value: 'problem_model', label: '問題+模範解答', icon: '📄⭐' },
                  { value: 'answer_problem', label: '答案+問題', icon: '📝📄' },
                  { value: 'all', label: '全部', icon: '📚' },
                  { value: 'other', label: 'その他', icon: '📎' },
                ];

                return (
                  <div key={index} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-700 truncate">
                          {file.name}
                        </span>
                        <span className="text-xs text-slate-500 flex-shrink-0">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {roleOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setPendingFileRoles(prev => ({
                              ...prev,
                              [index]: option.value,
                            }));
                          }}
                          className={clsx(
                            'px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                            'border-2 flex items-center justify-center space-x-1.5',
                            role === option.value
                              ? 'bg-indigo-500 text-white border-indigo-600 shadow-md'
                              : 'bg-white text-slate-700 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                          )}
                        >
                          <span className="text-base">{option.icon}</span>
                          <span>{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowFileRoleModal(false);
                  setPendingFiles([]);
                  setPendingFileRoles({});
                }}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  // ファイルを追加
                  const startIndex = uploadedFiles.length;
                  setUploadedFiles(prev => {
                    const next = [...prev, ...pendingFiles];
                    // 役割情報を追加
                    const newRoles: Record<number, FileRole> = { ...fileRoles };
                    pendingFiles.forEach((_, i) => {
                      newRoles[startIndex + i] = pendingFileRoles[i] || 'other';
                    });
                    setFileRoles(newRoles);

                    // 答案ファイルのインデックスを役割優先で更新
                    const newAnswerIdx = detectAnswerIndexByRole(next, newRoles, answerFileIndex);
                    setAnswerFileIndex(newAnswerIdx);
                    return next;
                  });

                  // モーダルを閉じる
                  setShowFileRoleModal(false);
                  setPendingFiles([]);
                  setPendingFileRoles({});
                }}
                className="px-6 py-2 bg-indigo-500 text-white rounded-lg font-bold hover:bg-indigo-600 transition-colors shadow-md"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
