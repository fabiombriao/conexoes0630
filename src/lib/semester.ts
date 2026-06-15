// Calendar-based semesters (per the Termo de Compromisso: up to 3 absences per semester).
// 1st semester = January–June, 2nd semester = July–December.

export interface Semester {
  /** e.g. "2026-1" */
  key: string;
  /** 1 or 2 */
  half: 1 | 2;
  year: number;
  /** First day of the semester, ISO date "YYYY-MM-DD" */
  start: string;
  /** Last day of the semester, ISO date "YYYY-MM-DD" */
  end: string;
  /** e.g. "1º semestre/2026" */
  label: string;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function build(year: number, half: 1 | 2): Semester {
  const start = half === 1 ? `${year}-01-01` : `${year}-07-01`;
  const end = half === 1 ? `${year}-06-30` : `${year}-12-31`;
  return {
    key: `${year}-${half}`,
    half,
    year,
    start,
    end,
    label: `${half}º semestre/${year}`,
  };
}

/** Semester containing the given ISO date (defaults to "today"). */
export function getSemester(isoDate: string): Semester {
  const [yearStr, monthStr] = isoDate.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  return build(year, month <= 6 ? 1 : 2);
}

/** The current semester based on the local date. */
export function currentSemester(): Semester {
  const now = new Date();
  const iso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return getSemester(iso);
}

/** Parse a semester key ("2026-1") back into a Semester. */
export function semesterFromKey(key: string): Semester {
  const [yearStr, halfStr] = key.split("-");
  return build(Number(yearStr), halfStr === "2" ? 2 : 1);
}

/** List of recent semesters (current first), for a selector. */
export function recentSemesters(count = 6): Semester[] {
  const current = currentSemester();
  const list: Semester[] = [];
  let year = current.year;
  let half: 1 | 2 = current.half;
  for (let i = 0; i < count; i++) {
    list.push(build(year, half));
    if (half === 1) {
      half = 2;
      year -= 1;
    } else {
      half = 1;
    }
  }
  return list;
}

/** Max unexcused absences allowed per semester before a member may be suspended. */
export const ABSENCE_LIMIT = 3;
