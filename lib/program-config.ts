export const PROGRAMS = ['SEMPOA', 'AHE', 'EFK', 'EYL', 'EFE', 'CALISTUNG', 'ENGLISH'] as const
export type ProgramKey = (typeof PROGRAMS)[number]

export const PROGRAM_LABELS: Record<ProgramKey, string> = {
  SEMPOA:    'Sempoa',
  AHE:       'AHE (Aritmatika Hitung Ekspres)',
  EFK:       'English For Kids',
  EYL:       'English Young Learner',
  EFE:       'English Everyday',
  CALISTUNG: 'Calistung',
  ENGLISH:   'English',
}

export const PROGRAM_SHORT_LABELS: Record<ProgramKey, string> = {
  SEMPOA:    'Sempoa',
  AHE:       'AHE',
  EFK:       'EFK',
  EYL:       'EYL',
  EFE:       'EFE',
  CALISTUNG: 'Calistung',
  ENGLISH:   'English',
}

export const PROGRAM_DESCRIPTIONS: Record<ProgramKey, string> = {
  SEMPOA:    'Teknik berhitung cepat menggunakan sempoa mental. Melatih konsentrasi dan kemampuan aritmatika.',
  AHE:       'Metode berhitung ekspres untuk meningkatkan kecepatan dan akurasi perhitungan matematis.',
  EFK:       'Program bahasa Inggris untuk anak-anak usia dini dengan pendekatan bermain dan menyenangkan.',
  EYL:       'Bahasa Inggris untuk pelajar muda dengan kurikulum terstruktur dan interaktif.',
  EFE:       'Bahasa Inggris untuk komunikasi sehari-hari, fokus pada percakapan praktis.',
  CALISTUNG: 'Program membaca, menulis, dan berhitung untuk anak usia pra-sekolah dan SD awal.',
  ENGLISH:   'Program bahasa Inggris umum mencakup reading, writing, listening, dan speaking.',
}

export const PROGRAM_GRADIENTS: Record<ProgramKey, string> = {
  SEMPOA:    'from-violet-500 to-purple-600',
  AHE:       'from-blue-500 to-indigo-600',
  EFK:       'from-emerald-500 to-green-600',
  EYL:       'from-teal-500 to-cyan-600',
  EFE:       'from-sky-500 to-blue-600',
  CALISTUNG: 'from-orange-500 to-amber-600',
  ENGLISH:   'from-rose-500 to-pink-600',
}

export const PROGRAM_BADGE_COLORS: Record<ProgramKey, string> = {
  SEMPOA:    'bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-300',
  AHE:       'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  EFK:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  EYL:       'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300',
  EFE:       'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  CALISTUNG: 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300',
  ENGLISH:   'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300',
}

export const PROGRAM_ICONS: Record<ProgramKey, string> = {
  SEMPOA:    '🔢',
  AHE:       '⚡',
  EFK:       '🌟',
  EYL:       '📚',
  EFE:       '💬',
  CALISTUNG: '✏️',
  ENGLISH:   '🌐',
}
