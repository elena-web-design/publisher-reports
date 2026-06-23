"use client";

import {
  useState,
  useEffect,
  useRef,
} from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx";
type ArchiveItem = {
  serviceYear: string;
  month: string;
  group: string;

  reports: number;

  unbaptized: number;
  unbaptizedStudies: number;

  publishers: number;
  publisherStudies: number;

  inactive: number;

  assistants: number;
  assistantHours: number;
  assistantStudies: number;

  regulars: number;
  regularHours: number;
  regularStudies: number;
  regularPioneerDetails?: {
    name: string;
    hours: number;
  }[];

  totalHours: number;
  totalStudies: number;

  date: string;
};
type Person = {
    id?: string;

    name: string;
    status: string;
    hours: number;
    participation: string;
    group: string;
  };
const people = [
  {
    name: "Иванова Мария",
    status: "publisher",
    hours: 30,
    participation: "Да",
    group: "Группа 1",
  },

  {
    name: "Петров Сергей",
    status: "regular_pioneer",
    hours: 72,
    participation: "",
    group: "Группа 1",
  },
];

const storage = {
  get<T>(key: string, fallback: T): T {
     if (typeof window === "undefined") return fallback;

    try {
       const item = localStorage.getItem(key);
       return item ? (JSON.parse(item) as T) : fallback;
     } catch {
       return fallback;
     }
   },

  set<T>(key: string, value: T) {
     if (typeof window === "undefined") return;

     localStorage.setItem(key, JSON.stringify(value));
   },
};

export default function Home() {
  const months = [
    "Сентябрь 2025",
    "Октябрь 2025",
    "Ноябрь 2025",
    "Декабрь 2025",
    "Январь 2026",
    "Февраль 2026",
    "Март 2026",
    "Апрель 2026",
    "Май 2026",
    "Июнь 2026",
    "Июль 2026",
    "Август 2026",
  ];
  const serviceYears = [
    "2025–2026",
    "2026–2027",
    "2027–2028",
    "2028–2029",
    "2029–2030",
    "2030–2031",
    "2031–2032",
    "2032–2033",
    "2033–2034",
    "2034–2035",
  ];
  const monthNames = [
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
];

const getMonthsForServiceYear = (
    serviceYear: string
  ) => {
    const startYear = Number(
      serviceYear.split("–")[0]
    );

    return monthNames.map((month, index) => {
      const year =
        index < 4
          ? startYear
          : startYear + 1;

      return `${month} ${year}`;
    });
  };
  const allMonths = serviceYears.flatMap((year) =>
    getMonthsForServiceYear(year).map((month) => ({
      year,
      month,
    }))
  );

  const [peopleList, setPeopleList] = useState<Person[]>(() =>
    storage.get<Person[]>("peopleList", people)
  );

  

  const [assistantMonth, setAssistantMonth] = useState<Record<string, boolean>>(() =>
    storage.get("assistantMonth", {})
  );

  const [notes, setNotes] = useState<Record<string, string>>(() =>
    storage.get("notes", {})
  );

  const [monthlyHours, setMonthlyHours] = useState<Record<string, number>>(() =>
    storage.get("monthlyHours", {})
  );

  const [bibleStudies, setBibleStudies] = useState<Record<string, number>>(() =>
    storage.get("bibleStudies", {})
  );

  const [participation, setParticipation] = useState<Record<string, string>>(() =>
    storage.get("participation", {})
  );

  const [newName, setNewName] = useState("");

  const [newStatus, setNewStatus] = useState<"publisher" | "regular_pioneer" | "unbaptized_publisher">(
    "publisher"
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    storage.get("selectedMonth", "Сентябрь 2025")
  );

  const [showPioneerReport, setShowPioneerReport] =
   useState(false);

  const normalizeYear = (year: string) =>
    year.replace("–", "-");

  const buildKey = (year: string, month: string, name: string) =>
    `${normalizeYear(year)}-${month}-${name}`;

  const monthKey = (name: string) =>
    buildKey(selectedYear, selectedMonth, name);

  const [selectedYear, setSelectedYear] = useState<string>(() =>
    storage.get("selectedYear", "2025–2026")
  );

  const availableMonths =
    getMonthsForServiceYear(
      selectedYear
    );


  const getRelevantMonths = () => {
    const now = new Date();

    return allMonths.filter((m) => {
      const date = new Date(`${m.year}-${m.month}-01`);
      return date <= now;
    });
  };

  const isInactive = (person: Person) => {
    if (
      person.status !== "publisher" &&
      person.status !== "unbaptized_publisher"
    ) {
      return false;
    }

    let consecutiveMissed = 0;
    let inactive = false;

    for (const item of allMonths) {
      const key = buildKey(
        item.year,
        item.month,
        person.name
      );

      const value = participation[key];

      if (value === "Да") {
        consecutiveMissed = 0;
        inactive = false;
        continue;
      }

      if (value === "Нет") {
        consecutiveMissed++;
      }

      if (consecutiveMissed >= 6) {
        inactive = true;
      }
    }

    return inactive;
  };

  const inactiveCount =
    peopleList.filter((person) =>
      isInactive(person)
    ).length;

  const [selectedGroup, setSelectedGroup] = useState<string>(() =>
    storage.get("selectedGroup", "Группа 1")
  );

  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [archiveSearch, setArchiveSearch] =
    useState("");

  const yearlyPioneers = peopleList
    .filter(
      (person) =>
        person.status === "regular_pioneer"
    )
    .map((person) => ({
      name: person.name,

      hours: archive
        .filter(
          (item) =>
            item.serviceYear === selectedYear
        )
        .reduce((sum, item) => {
          const pioneer =
            item.regularPioneerDetails?.find(
              (p: any) =>
                p.name === person.name
            );

          return (
            sum +
            (pioneer?.hours || 0)
          );
        }, 0),
    }));

  const [openMenu, setOpenMenu] =
    useState<number | null>(null);
  const [openStatusMenu, setOpenStatusMenu] =
    useState<string | null>(null);
  const [editingPerson, setEditingPerson] =
    useState<string | null>(null);
  const [groupMenu, setGroupMenu] =
    useState<number | null>(null);
  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const [statusMenu, setStatusMenu] =
    useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const USERS = [
    { login: "group1", password: "12345", name: "Группа 1" },
    { login: "group2", password: "12345", name: "Группа 2" },
    { login: "secretary", password: "12345", name: "Секретарь" },
  ];

  const [currentPage, setCurrentPage] = useState<
    "groups" | "people"
  >("groups");

  const [currentUser, setCurrentUser] = useState<null | {
    login: string;
    name: string;
  }>(null);

  const [activityLog, setActivityLog] = useState<
    { user: string; action: string; date: string }[]
  >([]);



  const logAction = (action: string) => {
    if (!currentUser) return;

    setActivityLog((prev) =>
      [
       ...prev,
       {
          user: currentUser.name,
          action,
          date: new Date().toISOString(),
       },
     ].slice(-300)
    );
  };

  useEffect(() => {
    localStorage.setItem(
      "peopleList",
      JSON.stringify(peopleList)
    );

    localStorage.setItem(
      "archive",
      JSON.stringify(archive)
    );

    localStorage.setItem(
      "activityLog",
      JSON.stringify(activityLog)
    );

    localStorage.setItem(
      "monthlyHours",
      JSON.stringify(monthlyHours)
    );

    localStorage.setItem(
      "bibleStudies",
      JSON.stringify(bibleStudies)
    );

    localStorage.setItem(
      "participation",
      JSON.stringify(participation)
    );

    localStorage.setItem(
      "assistantMonth",
      JSON.stringify(assistantMonth)
    );

    localStorage.setItem(
      "notes",
      JSON.stringify(notes)
    );
  }, [
    peopleList,
    archive,
    activityLog,
    monthlyHours,
    bibleStudies,
    participation,
    assistantMonth,
    notes,
  ]);

  const handleLogin = () => {
    const user = USERS.find(
      (u) => u.login === login && u.password === password
    );

    if (!user) {
      alert("Неверный логин или пароль");
      return;
    }

    setCurrentUser({
      login: user.login,
      name: user.name,
    });

    setIsLoggedIn(true);
  };

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const safeParticipation = participation ?? {};
  const safeAssistantMonth = assistantMonth ?? {};
  const safeHours = monthlyHours ?? {};
  const safeStudies = bibleStudies ?? {};

  const isFirstRender = useRef(true);

  useEffect(() => {
    try {
      const peopleLS = localStorage.getItem("peopleList");
      if (peopleLS) setPeopleList(JSON.parse(peopleLS));

      const assistantLS = localStorage.getItem("assistantMonth");
      if (assistantLS) setAssistantMonth(JSON.parse(assistantLS));

      const notesLS = localStorage.getItem("notes");
      if (notesLS) setNotes(JSON.parse(notesLS));

      const hoursLS = localStorage.getItem("monthlyHours");
      if (hoursLS) setMonthlyHours(JSON.parse(hoursLS));

      const studiesLS = localStorage.getItem("bibleStudies");
      if (studiesLS) setBibleStudies(JSON.parse(studiesLS));

      const participationLS = localStorage.getItem("participation");
      if (participationLS) setParticipation(JSON.parse(participationLS));

      const monthLS = localStorage.getItem("selectedMonth");
      if (monthLS) setSelectedMonth(monthLS);

      const yearLS = localStorage.getItem("selectedYear");
      if (yearLS) setSelectedYear(yearLS);

      const groupLS = localStorage.getItem("selectedGroup");
      if (groupLS) setSelectedGroup(groupLS);

      const archiveLS = localStorage.getItem("archive");
      if (archiveLS) setArchive(JSON.parse(archiveLS));
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    localStorage.setItem("peopleList", JSON.stringify(peopleList));
    localStorage.setItem("assistantMonth", JSON.stringify(assistantMonth));
    localStorage.setItem("notes", JSON.stringify(notes));
    localStorage.setItem("monthlyHours", JSON.stringify(monthlyHours));
    localStorage.setItem("bibleStudies", JSON.stringify(bibleStudies));
    localStorage.setItem("participation", JSON.stringify(participation));

    localStorage.setItem("selectedMonth", selectedMonth);
    localStorage.setItem("selectedYear", selectedYear);
    localStorage.setItem("selectedGroup", selectedGroup);

    localStorage.setItem("archive", JSON.stringify(archive));
    localStorage.setItem("activityLog", JSON.stringify(activityLog));
  }, [
    peopleList,
    assistantMonth,
    notes,
    monthlyHours,
    bibleStudies,
    participation,
    selectedMonth,
    selectedYear,
    selectedGroup,
    archive,
  ]);

  useEffect(() => {
    const savedLog =
      localStorage.getItem("activityLog");

    if (savedLog) {
      setActivityLog(JSON.parse(savedLog));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "activityLog",
      JSON.stringify(activityLog)
    );
  }, [activityLog]);

  useEffect(() => {
    const loadPeople = async () => {
      const { data, error } = await supabase
        .from("people")
        .select("*");

      if (error) {
        console.error(error);
        return;
      }


      if (data) {
        setPeopleList(data as Person[]);
      }
    };

    loadPeople();
  }, []);

  useEffect(() => {
    const loadArchive = async () => {
      const { data, error } = await supabase
        .from("archive")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        const archiveData = data.map((item) => ({
          serviceYear: item.service_year,
          month: item.month,
          group: item.group_name,

          reports: item.reports,

          publishers: item.publishers,
          publisherStudies: item.publisher_studies,
          inactive: item.inactive,

          unbaptized: item.unbaptized,
          unbaptizedStudies: item.unbaptized_studies,

          assistants: item.assistants,
          assistantHours: item.assistant_hours,
          assistantStudies: item.assistant_studies,

          regulars: item.regulars,
          regularHours: item.regular_hours,
          regularStudies: item.regular_studies,
          regularPioneerDetails:
            item.regular_pioneer_details ?? [],

          totalHours: item.total_hours,
          totalStudies: item.total_studies,

          date: item.date,
        }));
        console.log("ARCHIVE DATA", archiveData);
        setArchive(archiveData as ArchiveItem[]);
      }
    };

    loadArchive();
  }, []);

  const filteredGroupPeople = peopleList .filter(
    (person) =>
      (person.group || "Группа 1") === selectedGroup
  );

  const publishersCount = filteredGroupPeople.filter(
    (person) => {
      const key = monthKey(person.name);

      return (
        person.status === "publisher" &&
        safeParticipation[key] === "Да" &&
        !assistantMonth[key]
      );
    }
  ).length;

  const reportsSubmitted = filteredGroupPeople.filter(
    (person) => {
      const key = monthKey(person.name);
      const hours = Number(monthlyHours[key] ?? 0);

      const isPublisher =
        person.status === "publisher" &&
        safeParticipation[key] === "Да" &&
        !assistantMonth[key];

      const isAssistant =
        assistantMonth[key] && hours > 0;

      const isRegularPioneer =
        person.status === "regular_pioneer" &&
        hours > 0;

      const isUnbaptized =
         person.status === "unbaptized_publisher" &&
         safeParticipation[key] === "Да";

      return (
        isPublisher ||
        isAssistant ||
        isRegularPioneer ||
        isUnbaptized
      );
    }
  ).length;

  const notSubmitted = filteredGroupPeople.filter(
    (person) => {
      const key = monthKey(person.name);
      const hours = Number(monthlyHours[key] ?? 0);

      if (person.status === "regular_pioneer") {
        return hours <= 0;
      }

      if (assistantMonth[key]) {
        return hours <= 0;
      }

      return safeParticipation[key] !== "Да";
    }
  ).length;

  const groupMembersCount =
    peopleList.filter(
      (person) =>
        (person.group || "Группа 1") === selectedGroup
    ).length;

  const regularPioneersCount =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person.name);
      const hours = Number(monthlyHours[key] ?? 0);

      return (
        person.status === "regular_pioneer" &&
        hours > 0
      );
    }).length;

  const assistantPioneersCount =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person.name);

      return (
        assistantMonth[key] &&
        (monthlyHours[key] || 0) > 0
      );
    }).length;

  const totalGroupHours =
    filteredGroupPeople.reduce(
      (sum, person) =>
        sum +
        (monthlyHours[
          monthKey(person.name)
        ] || 0),
      0
    );

  const assistantHours = 
    filteredGroupPeople.reduce(
      (sum, person) => {
        if (
          assistantMonth[
            monthKey(person.name)
          ]
        ) {
          return (
            sum +
            (monthlyHours[
              monthKey(person.name)
            ] || 0)
          );
        }

      return sum;
    },
    0
  );


  const regularPioneerHours =
    filteredGroupPeople.reduce(
      (sum, person) => {
        if (
          person.status ===
          "regular_pioneer"
        ) {
          return (
            sum +
            (monthlyHours[
              monthKey(person.name)
            ] || 0)
          );
        }

        return sum;
      },
      0
    );
  
  const publisherStudies = peopleList
    .filter(
      (person) =>
        person.status === "publisher" &&
        participation[monthKey(person.name)] === "Да" &&
        !assistantMonth[monthKey(person.name)] &&
        (person.group || "Группа 1") === selectedGroup
    )
    .reduce(
      (sum, person) =>
        sum +
        (bibleStudies[
          monthKey(person.name)
        ] || 0),
      0
    );

  const assistantStudies = peopleList
    .filter(
      (person) =>
        assistantMonth[
          monthKey(person.name)
        ] &&
        (person.group || "Группа 1") === selectedGroup
    )
    .reduce(
      (sum, person) =>
        sum +
        (bibleStudies[
          monthKey(person.name)
        ] || 0),
      0
    );

  const regularStudies = peopleList
    .filter(
      (person) =>
        person.status ===
          "regular_pioneer" &&
        (person.group || "Группа 1") === selectedGroup
    )
    .reduce(
      (sum, person) =>
        sum +
        (bibleStudies[
          monthKey(person.name)
        ] || 0),
      0
    );
  const unbaptizedCount =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person.name);

      return (
        person.status === "unbaptized_publisher" &&
        participation[key] === "Да"
      );
    }).length;

  const unbaptizedReports =
    filteredGroupPeople.filter(
      (person) =>
        person.status === "unbaptized_publisher" &&
        participation[monthKey(person.name)] === "Да"
    ).length;

  const unbaptizedStudies =
    filteredGroupPeople.reduce(
      (sum, person) => {
        if (
          person.status ===
          "unbaptized_publisher"
        ) {
          return (
            sum +
            (bibleStudies[
              monthKey(person.name)
            ] || 0)
          );
        }

        return sum;
      },
      0
    );

  const yearlyCongregationStats =
    archive
      .filter(
        (item) =>
          item.serviceYear === selectedYear
      )
      .reduce(
        (acc, item) => ({
          reports:
            acc.reports + item.reports,
          
          publishers:
            acc.publishers +
            item.publishers,

          inactive:
             acc.inactive + (item.inactive ?? 0),

          unbaptized:
            acc.unbaptized +
            item.unbaptized,

          assistantHours:
            acc.assistantHours +
            item.assistantHours,

          assistantStudies:
            acc.assistantStudies +
            item.assistantStudies,
          
          assistants:
            acc.assistants +
            item.assistants,

          regulars:
            acc.regulars +
            item.regulars,

          regularHours:
            acc.regularHours +
            item.regularHours,

          regularStudies:
            acc.regularStudies +
            item.regularStudies,

          totalHours:
            acc.totalHours +
            item.totalHours,

          totalStudies:
            acc.totalStudies +
            item.totalStudies,
        }),
        {
          reports: 0,

          publishers: 0,
          unbaptized: 0,

          inactive: 0,

          assistants: 0,
          regulars: 0,

          assistantHours: 0,
          assistantStudies: 0,

          regularHours: 0,
          regularStudies: 0,

          totalHours: 0,
          totalStudies: 0,
        }
      );

  const getYearEndInactiveCount = (
    serviceYear: string
  ) => {
    const yearItems = archive.filter(
      (item) => item.serviceYear === serviceYear
    );

    if (yearItems.length === 0) {
      return 0;
    }

    const lastMonth = yearItems[yearItems.length - 1];

    return lastMonth.inactive ?? 0;
  };

  const monthsInYear = Math.max(
    archive.filter(
      (item) => item.serviceYear === selectedYear
    ).length,
    1
  );

  const yearEndInactive =
    getYearEndInactiveCount(selectedYear);

  const totalStudies =
    publisherStudies +
    assistantStudies +
    regularStudies+
    unbaptizedStudies;

  
  const saveMonthToArchive = async () => {
    const alreadyExists = archive.some(
      (item) =>
        item.serviceYear === selectedYear &&
        item.month === selectedMonth &&
        item.group === selectedGroup
    );

    if (alreadyExists) {
      alert(
        "Этот месяц уже сохранён в архиве для выбранной группы."
      );
      return;
    }
    const inactiveCount = filteredGroupPeople.filter((person) =>
      isInactive(person)
    ).length;

    const regularPioneerDetails =
      filteredGroupPeople
        .filter(
          (person) =>
            person.status === "regular_pioneer"
        )
        .map((person) => ({
          name: person.name,
          hours:
            monthlyHours[
              monthKey(person.name)
            ] || 0,
        }));

    const archiveItem = {
      serviceYear: selectedYear,
      month: selectedMonth,
      group: selectedGroup,

      reports: reportsSubmitted,

      publishers: publishersCount,
      publisherStudies: publisherStudies,
      inactive: inactiveCount,

      unbaptized: unbaptizedCount,
      unbaptizedStudies: unbaptizedStudies,

      assistants: assistantPioneersCount,
      assistantHours: assistantHours,
      assistantStudies: assistantStudies,

      regulars: regularPioneersCount,
      regularHours: regularPioneerHours,
      regularStudies: regularStudies,
      regularPioneerDetails,

      totalHours: totalGroupHours,
      totalStudies: totalStudies,

      date: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("archive")
      .insert([
        {
          service_year: selectedYear,
          month: selectedMonth,
          group_name: selectedGroup,

          reports: reportsSubmitted,

          publishers: publishersCount,
          publisher_studies: publisherStudies,
          inactive: inactiveCount,

          unbaptized: unbaptizedCount,
          unbaptized_studies: unbaptizedStudies,

          assistants: assistantPioneersCount,
          assistant_hours: assistantHours,
          assistant_studies: assistantStudies,

          regulars: regularPioneersCount,
          regular_hours: regularPioneerHours,
          regular_studies: regularStudies,
          regular_pioneer_details: regularPioneerDetails,

          total_hours: totalGroupHours,
          total_studies: totalStudies,

          date: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error(error);
      return;
    }

    setArchive((prev) => [...prev, archiveItem]);
  };
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      archive
        .filter(
          (item) =>
            item.serviceYear === selectedYear
        )
        .map((item) => ({
        "Служебный год":
          item.serviceYear,

        "Месяц":
          item.month,

        "Группа":
          item.group,

        "Сдали отчёт":
          item.reports,

        "Некрещёные возвещатели":
          item.unbaptized,

        "Изучения некрещёных":
          item.unbaptizedStudies,

        "Подсобные пионеры":
          item.assistants,

        "Часы подсобных":
          item.assistantHours,

        "Изучения подсобных":
          item.assistantStudies,

        "Общие пионеры":
          item.regulars,

        "Часы общих":
          item.regularHours,

        "Изучения общих":
          item.regularStudies,

        "Всего часов":
          item.totalHours,

        "Всего изучений":
          item.totalStudies,
        }))
    );

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Отчёты"
    );

    XLSX.writeFile(
      workbook,
      `Отчёт_${selectedYear}.xlsx`
    );
  };

  if (!mounted) return null;
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex w-full max-w-md flex-col items-center px-6">

          <img
            src="/logo.png"
            alt="Логотип"
            className="w-100 object-contain mb-0"
          />

          <img
            src="/image.png"
            alt="Иллюстрация"
            className="mb-2 w-full max-w-xl object-contain"
          />

          <div className="bg-white/95 p-5 rounded-[28px] shadow-sm max-w-md">

          <input
            className="w-full mb-3 px-7 py-4 rounded-full text-[#426B8E] bg-[#F3FAFF]"
            placeholder="Логин"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />

          <input
            className="w-full mb-3 px-7 py-4 rounded-full text-[#426B8E] bg-[#F3FAFF]"
            placeholder="Пароль"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
            onClick={handleLogin}
            className="mt-6 w-full max-w-md bg-[#4B84B6] text-white py-3 rounded-full shadow-sm"
          >
            Войти
          </button>
      </div>
      </div>
    );
  }

  if (currentPage === "groups") {
    return (
      <div>
        <div className="min-h-screen bg-[#EEF5FA] p-6">
         <div className="flex justify-center">
          <img
            src="/logo.png"
            alt="Логотип"
            className="w-100 object-contain mb-0"
          />
        </div>

          <p className="mb-8 text-center text-sm text-slate-500">
            Выберите группу для внесения отчёта
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              "Группа 1",
              "Группа 2",
              "Группа 3",
              "Группа 4",
              "Группа 5",
              "Группа 6",
            ].map((group) => (
              <button
                key={group}
                onClick={() => {
                  setSelectedGroup(group);
                  setCurrentPage("people");
                }}
                className="
                w-full
                rounded-[32px]
                bg-white
                p-6
                shadow-sm
                text-center
                font-semibold
                text-[#426B8E]
                transition-all
                hover:shadow-md"
              >
                <div className="text-xl font-semibold text-[#426B8E]">
                  {group}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const yearlyPioneerReport = peopleList
    .filter(
      (person) =>
        person.status === "regular_pioneer"
    )
    .map((person) => ({
      name: person.name,

      hours: archive
        .filter(
          (item) =>
            item.serviceYear === selectedYear
        )
        .reduce((sum, item) => {
          const pioneer =
            item.regularPioneerDetails?.find(
              (p) => p.name === person.name
            );

          return sum + (pioneer?.hours || 0);
        }, 0),
    }));
  
  if (showPioneerReport) {
    return (
      <main className="min-h-screen bg-[#EEF5FA] p-6">

        <button
          onClick={() =>
            setShowPioneerReport(false)
          }
          className="mb-4 rounded-2xl bg-white px-4 py-2 text-[#426B8E] shadow-sm"
        >
          ← Назад
        </button>

        <h1 className="mb-6 text-3xl font-semibold text-[#426B8E]">
          Годовой отчёт общих пионеров
        </h1>

        <div className="space-y-3">

          {yearlyPioneerReport.map((pioneer) => (
            <div
              key={pioneer.name}
              className="rounded-3xl bg-white p-5 shadow-sm"
            >
              <div className="font-semibold text-[#426B8E]">
                {pioneer.name}
              </div>

              <div className="mt-2 text-slate-500">
                Часы за год: {pioneer.hours}
              </div>
            </div>
          ))}

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EEF5FA] p-6">
      <div className="mb-4">
        <button
          onClick={() => setCurrentPage("groups")}
          className="rounded-2xl bg-white px-4 py-2 shadow-sm text-[#426B8E]"
        >
          ← К группам
        </button>
      </div>
      <div className="mx-auto max-w-6xl">
        
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4">
            <img
              src="/logo.png"
              alt="Логотип"
              className="w-100 object-contain mb-0"
            />

          </div>

          <div className="flex flex-wrap gap-3">
              <input
                   type="text"
                   placeholder="Имя и фамилия"
                   value={newName}
                   onChange={(e) => setNewName(e.target.value)}
                  className="flex-1 rounded-2xl bg-white px-4 py-3 shadow-sm outline-none text-[#426B8E] placeholder:text-[#7A96B3]"
                />

                  <select
                    value={newStatus}
                    onChange={(e) =>
                      setNewStatus(
                        e.target.value as
                          | "publisher"
                          | "regular_pioneer"
                          | "unbaptized_publisher"
                      )
                    }
                    className="flex-1 rounded-2xl bg-white px-4 py-3 shadow-sm outline-none text-[#426B8E] font-medium"
                  >  
                    <option value="unbaptized_publisher">
                      Некрещёный возвещатель
                    </option>

                   <option
                      value="publisher"
                      className="text-[#426B8E]"
                    >
                      Возвещатель
                    </option>

                    <option
                      value="regular_pioneer"
                      className="text-[#426B8E]"
                    >
                      Общий пионер
                    </option>
                </select>

                <button
                  onClick={async () => {
                     if (!newName) return;
                     const { error } = await supabase
                      .from("people")
                      .insert([
                        {
                          name: newName,
                          status: newStatus,
                          group_name: selectedGroup,
                        },
                      ]);

                    if (error) {
                      console.error(error);
                      return;
                    }

                    setPeopleList([
                       ...peopleList,
                       {
                        name: newName,
                        status: newStatus,
                        hours: 0,
                        participation: "Да",
                        group: selectedGroup,
                      },
                    ]);

                    setNewName("");
                    setNewStatus("publisher");
                  }}
                   className="flex-1 rounded-2xl bg-[#4B84B6] px-5 py-3 text-white shadow-sm"
                >
                  Добавить
                </button>

              </div>

        </div>

        
        <div className="grid gap-6 lg:grid-cols-2">

          <div 
            className="rounded-[32px] bg-white p-3 shadow-sm bg-cover bg-center"
            style={{
              backgroundImage: "url('/image.png')",
            }}
          >
           <div>
              <select
                value={selectedYear}
                onChange={(e) =>
                  setSelectedYear(e.target.value)
                }
                className="mb-3 rounded-2xl bg-white/80 px-4 py-2 text-base font-medium text-[#426B8E] outline-none"
              >
                {serviceYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-2xl bg-white/80 px-4 py-2 text-base font-medium text-[#426B8E] outline-none"
              >
                {availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {month}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 ml-5 flex items-center gap-6">
              <h2 className="font-medium text-[#426B8E]">
                {selectedGroup}
              </h2>

              <p className="text-sm text-slate-500">
                Текущий месяц
              </p>
            </div>

            <div className="mt-6 space-y-4">
             {peopleList
                .filter(
                  (person) =>
                    (person.group || "Группа 1") === selectedGroup
                )
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((person, index) => (

                <div
                  key={index}
                  className={`rounded-3xl backdrop-blur-sm p-3 ${
                    person.status === "regular_pioneer"
                      ? "bg-[#DDECF7]/55"
                      : "bg-white/70"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    
                    <div>
                      {editingPerson === person.name ? (
                        <input
                          type="text"
                          defaultValue={person.name}
                          onBlur={(e) => {
                            const updatedPeople = peopleList.map((p) =>
                              p.name === person.name
                                ? {
                                    ...p,
                                    name: e.target.value,
                                  }
                                : p
                            );

                            setPeopleList(updatedPeople);
                            setEditingPerson(null);
                          }}
                          autoFocus
                          className="rounded-2xl bg-white/70 px-3 py-2 text-lg font-semibold text-[#426B8E] outline-none"
                        />
                      ) : (
                        <h3 className="rounded-2xl bg-white/60 px-3 py-2 text-lg font-semibold text-[#426B8E] backdrop-blur-sm">
                          {person.name}
                        </h3>
                      )}
                      
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                          {person.group || "Группа 1"}
                        </div>

                        {person.status === "regular_pioneer" && (
                          <span className="rounded-full bg-[#D8ECFA] px-4 py-1 text-xs font-medium text-[#3F78A8]">
                            Общий пионер
                          </span>
                        )}

                        {person.status === "unbaptized_publisher" && (
                          <span className="rounded-full bg-[#ECEAE6] px-4 py-1 text-xs font-medium text-[#6B7280]">
                            Некрещёный возвещатель
                          </span>
                        )}

                        {isInactive(person) && (
                          <span className="rounded-full bg-[#FFE5E5] px-4 py-1 text-xs font-medium text-[#C74B50]">
                            Неактивный
                          </span>
                        )}
                      </div>
                     

                      <div className="mt-2 flex gap-2 flex-wrap">

                        <div className="mt-2 flex flex-col gap-2">
                          <div className="mt-2">
                            {person.status !== "regular_pioneer" && (
                              <div className="flex items-center gap-3">

                                <button
                                  onClick={() => {
                                    setParticipation({
                                      ...participation,
                                      [monthKey(person.name)]: "Да",
                                    });

                                    logAction(
                                      `${person.name}: отметил "Да" (${selectedMonth})`
                                    );
                                  }}
                                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                                    participation[monthKey(person.name)] === "Да"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-white text-slate-500"
                                  }`}
                                >
                                  Да
                                </button>

                                <button
                                  onClick={() => {
                                    setParticipation({
                                      ...participation,
                                      [monthKey(person.name)]: "Нет",
                                    });

                                    logAction(
                                      `${person.name}: отметил "Нет" (${selectedMonth})`
                                    );
                                  }}
                                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                                    participation[monthKey(person.name)] === "Нет"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-white text-slate-500"
                                  }`}
                                >
                                  Нет
                                </button>

                              </div>
                            )}

                            {person.status === "publisher" && (
                             <label
                               className={`mt-2 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                                 assistantMonth[monthKey(person.name)]
                                   ? "bg-[#EEE7FB]/90 text-[#6E5AA6]"
                                  : "bg-white/70 text-slate-600"
                               }`}
                              >
                            
                              <input
                                type="checkbox"
                                 checked={
                                    assistantMonth[monthKey(person.name)] || false
                                  }
                                 onChange={(e) => {
                                  const checked = e.target.checked;

                                  setAssistantMonth({
                                    ...assistantMonth,
                                    [monthKey(person.name)]: checked,
                                  });

                                  if (!checked) {
                                    setMonthlyHours({
                                      ...monthlyHours,
                                      [monthKey(person.name)]: 0,
                                    });
                                  }
                                }}
                                className="h-5 w-5 accent-[#6E5AA6]"
                              />

                               Служит подсобным пионером в этом месяце
                            </label>
                            )}

                            <textarea
                              placeholder="Примечание"
                              value={
                                notes[monthKey(person.name)] || ""
                              }
                              onChange={(e) =>
                                setNotes({
                                  ...notes,
                                  [monthKey(person.name)]: e.target.value,
                                })
                              }
                              className="mt-3 w-full rounded-2xl bg-white/70 p-3 text-sm text-[#426B8E] outline-none placeholder:text-[#7A96B3]"
                            ></textarea>

                          </div>
                        </div>

                      </div>
                    </div>
                    <div className="text-right">
                     <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenu(
                              openMenu === index ? null : index
                            )
                          }
                          className="rounded-xl bg-white px-3 py-1.5 text-lg text-[#426B8E] shadow-sm hover:bg-slate-50"
                        >
                          ⋮
                        </button>

                        {openMenu === index && (
                          <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white p-2 shadow-lg z-50">
                              <button
                                onClick={() => {
                                  setEditingPerson(person.name);
                                  setOpenMenu(null);
                                }}
                                className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100"
                              >
                                Редактировать
                              </button>
                              
                              {person.status === "unbaptized_publisher" && (
                                <>
                                  <button
                                    onClick={() => {
                                      const confirmChange = window.confirm(
                                        `Перевести "${person.name}" в возвещатели?`
                                      );

                                      if (!confirmChange) return;

                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name
                                          ? { ...p, status: "publisher" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);

                                      logAction(
                                        `${person.name}: крещён / переведён в возвещатели`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100"
                                  >
                                    Крестился
                                  </button>
                                </>
                              )}
                              <hr className="my-2" />
                              <button
                                onClick={() => {
                                  setGroupMenu(groupMenu === index ? null : index);
                                  setStatusMenu(null);
                                }}
                                className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                              >
                                Переместить в группу 
                              </button>
                              {groupMenu === index && (
                                <div className="ml-3 mt-1 border-l pl-2">
                                  <button
                                    onClick={() => {
                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name ? { ...p, group: "Группа 1" } : p
                                      );
                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      logAction(
                                        `${person.name}: перемещён в Группу 1`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 1
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name ? { ...p, group: "Группа 2" } : p
                                      );
                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      logAction(
                                        `${person.name}: перемещён в Группу 2`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 2
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name ? { ...p, group: "Группа 3" } : p
                                      );
                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      logAction(
                                        `${person.name}: перемещён в Группу 3`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 3
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name ? { ...p, group: "Группа 4" } : p
                                      );
                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      logAction(
                                        `${person.name}: перемещён в Группу 4`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 4
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name ? { ...p, group: "Группа 5" } : p
                                      );
                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);
                                      setOpenStatusMenu(null);
                                      setGroupMenu(null);
                                      logAction(
                                        `${person.name}: перемещён в Группу 5`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 5
                                  </button>
                                  <button
                                    onClick={() => {
                                      const updatedPeople = peopleList.map((p) =>
                                        p.name === person.name ? { ...p, group: "Группа 6" } : p
                                      );
                                      setPeopleList(updatedPeople);
                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      logAction(
                                        `${person.name}: перемещён в Группу 6`
                                      );
                                    }}
                                        className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                      >
                                        Группа 6
                                      </button>
                                    </div>
                                  )}
                                  
                                  <button
                                    onClick={() =>
                                      setOpenStatusMenu(
                                        openStatusMenu === person.name
                                          ? null
                                          : person.name
                                      )
                                    }
                                    className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                                  >
                                    Выбрать статус
                                  </button>

                                  {openStatusMenu === person.name && (
                                    <div className="ml-3 mt-1 space-y-1">

                                      <button
                                        onClick={() => {
                                          const confirmChange = window.confirm(
                                            `Перевести "${person.name}" в возвещатели?`
                                          );

                                          if (confirmChange) {
                                            const updatedPeople = peopleList.map((p) =>
                                              p.name === person.name
                                                ? {
                                                    ...p,
                                                    status: "publisher",
                                                  }
                                                : p
                                            );

                                            setPeopleList(updatedPeople);
                                            setOpenMenu(null);
                                            setOpenStatusMenu(null);
                                          }
                                        }}
                                        className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                                      >
                                        Перевести в возвещатели
                                      </button>

                                      <button
                                        onClick={() => {
                                          const confirmChange = window.confirm(
                                            `Перевести "${person.name}" в общие пионеры?`
                                          );

                                          if (confirmChange) {
                                            const updatedPeople = peopleList.map((p) =>
                                              p.name === person.name
                                                ? {
                                                    ...p,
                                                    status: "regular_pioneer",
                                                  }
                                                : p
                                            );

                                            setPeopleList(updatedPeople);
                                            setOpenMenu(null);
                                            setOpenStatusMenu(null);

                                            logAction(
                                              `${person.name}: переведён в общие пионеры`
                                            );
                                          }
                                        }}
                                        className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                                      >
                                        Перевести в общие пионеры
                                      </button>

                                    </div>
                                  )}
                                  <hr className="my-2" />
                                  <button
                                    onClick={async () => {
                                      const confirmDelete = window.confirm(
                                        `Удалить карточку "${person.name}"?`
                                      );
                                      if (confirmDelete) {
                                        const { error } = await supabase
                                          .from("people")
                                          .delete()
                                          .eq("id", person.id);

                                        if (error) {
                                          console.error(error);
                                          return;
                                        }

                                        setPeopleList(
                                          peopleList.filter(
                                            (p) => p.id !== person.id
                                          )
                                        );

                                        setOpenMenu(null);
                                      }
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50"
                                  >
                                    Удалить
                                  </button>
                                </div>
                         
                        )}
                        </div>
                        
                        {(assistantMonth[monthKey(person.name)] ||
                            person.status === "regular_pioneer") && (
                            <>
                              <div className="mt-2 text-sm font-medium text-slate-500">
                                Часы
                              </div>

                              <input
                                type="number"
                                value={
                                  monthlyHours[
                                    monthKey(person.name)
                                  ] || 0
                                }
                                onChange={(e) => {
                                  const value = Number(e.target.value);

                                  setMonthlyHours({
                                    ...monthlyHours,
                                    [monthKey(person.name)]: value,
                                  });

                                  logAction(
                                    `${person.name}: изменил часы на ${value} (${selectedMonth})`
                                  );
                                }}
                                className={`mt-2 w-20 rounded-full px-4 py-2 text-center text-lg font-semibold outline-none ${
                                assistantMonth[monthKey(person.name)]
                                    ? "bg-[#EEE7FB]/80 text-[#6E5AA6]"
                                    : "bg-[#DDECF7]/80 text-[#3F78A8]"
                                }`}
                              />
                             
                            </>
                          )}
                          <div className="mt-2">
                            <div className="text-sm font-medium text-slate-500">
                              Изучения Библии
                            </div>

                            <input
                              type="number"
                              value={
                                bibleStudies[
                                  monthKey(person.name)
                                ] || 0
                              }
                             onChange={(e) => {
                                const value = Number(e.target.value);

                                setBibleStudies({
                                  ...bibleStudies,
                                  [monthKey(person.name)]: value,
                                });

                                logAction(
                                  `${person.name}: изменил изучения на ${value} (${selectedMonth})`
                                );
                              }}
                              className="mt-2 w-20 rounded-full bg-[#F3FAFF] px-4 py-2 text-center text-lg font-semibold text-[#426B8E] outline-none"
                            />
                          </div>

                    </div>

                  </div>
                </div>
              ))}
            </div>
            </div>

          <div className="space-y-6">

            <div className="rounded-[32px] bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-2xl text-[#426B8E] font-semibold">
                Статистика
              </h2>

              <div className="grid gap-4 sm:grid-cols-3">
              
              <div className="rounded-3xl bg-[#FAFCFE] p-5">
                <div className="text-sm text-slate-500">
                  В группе
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#426B8E]">
                  {groupMembersCount}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  человек
                </div>
              </div>

              <div className="rounded-3xl bg-[#FAFCFE] p-5">
                <div className="text-sm text-slate-500">
                  Возвещатели
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#426B8E]">
                  {publishersCount}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  Изучений: {publisherStudies}
                </div>
              </div>

              <div className="rounded-3xl bg-[#F4F2EE] p-5">
                <div className="text-sm text-[#6B7280]">
                  Некрещёные возвещатели
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#6B7280]">
                  {unbaptizedCount}
                </div>

                <div className="mt-1 text-sm text-[#6B7280]">
                  Изучений: {unbaptizedStudies}
                </div>
              </div>

              <div className="rounded-3xl bg-[#FFF5F5] p-5">
                <div className="text-sm text-[#C74B50]">
                   Неактивные
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#C74B50]">
                  {inactiveCount}
                </div>

                <div className="mt-1 text-sm text-[#C74B50]">
                   на данный месяц
                </div>
              </div>

              <div className="rounded-3xl bg-[#EEE7FB]/70 p-5">
                <div className="text-sm text-[#6E5AA6]">
                  Подсобные пионеры
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#6E5AA6]">
                  {assistantPioneersCount}
                </div>

                <div className="mt-1 text-sm text-[#6E5AA6]">
                  {assistantHours} ч
                </div>

                <div className="mt-1 text-sm text-[#6E5AA6]">
                  Изучений: {assistantStudies}
                </div>
              </div>

              <div className="rounded-3xl bg-[#F3FAFF] p-5">
                <div className="text-sm text-[#4B84B6]">
                  Общие пионеры
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#4B84B6]">
                  {regularPioneersCount}
                </div>

                <div className="mt-1 text-sm text-[#4B84B6]">
                  {regularPioneerHours} ч
                </div>

                <div className="mt-1 text-sm text-[#4B84B6]">
                  Изучений: {regularStudies}
                </div>
              </div>
            </div>
            </div>
              
              <h2 className="mb-4 text-2xl text-[#426B8E] font-semibold">
                Возможности
              </h2>

              <div className="flex flex-col gap-3">
                <button
                  onClick={saveMonthToArchive}
                  className="rounded-2xl bg-[#4B84B6] px-4 py-3 text-white"
                >
                  Сохранить месяц в архив
                </button>

                <div className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4">
                  Автосохранение
                </div>

                <div className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4">
                  Работа без интернета
                </div>

                <button
                  onClick={exportToExcel}
                  className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left hover:bg-[#EEF5FA]"
                >
                  Excel экспорт
                </button>

                <button
                  onClick={() => {
                    const data = JSON.stringify(
                      archive,
                      null,
                      2
                    );

                    const blob = new Blob(
                      [data],
                      {
                        type: "application/json",
                      }
                    );

                    const url =
                      URL.createObjectURL(blob);

                    const a =
                      document.createElement("a");

                    a.href = url;
                    a.download =
                      `Архив_${selectedYear}.json`;

                    a.click();

                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left"
                >
                  Резервная копия архива
                </button>
                <button
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                  className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left"
                >
                  Восстановить архив
                </button>
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const file =
                      e.target.files?.[0];

                    if (!file) return;

                    const reader =
                      new FileReader();

                    reader.onload = (event) => {
                      try {
                        const data = JSON.parse(
                          event.target?.result as string
                        );

                        setArchive(data);

                        alert(
                          "Архив успешно восстановлен"
                        );
                      } catch {
                        alert(
                          "Ошибка чтения файла"
                        );
                      }
                    };

                    reader.readAsText(file);
                  }}
                />

              </div>



              <div className="rounded-[32px] bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-2xl text-[#426B8E] font-semibold">
                  Последние действия
                </h2>

                <div className="space-y-2">
                  {activityLog
                    .slice()
                    .reverse()
                    .slice(0, 20)
                    .map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl bg-[#FAFCFE] p-3 text-sm"
                      >
                        <div className="font-medium text-[#426B8E]">
                          {item.user}
                        </div>

                        <div className="text-sm text-slate-500">
                          {item.action}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {new Date(item.date).toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-[32px] bg-white p-6 shadow-sm">
                <select
                  value={selectedYear}
                  onChange={(e) =>
                    setSelectedYear(e.target.value)
                  }
                  className="mb-4 rounded-2xl bg-[#FAFCFE] px-4 py-2 text-[#426B8E]"
                >
                  {serviceYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setShowPioneerReport(true)}
                  className="rounded-full bg-[#D8ECFA] px-5 py-2 text-sm font-medium text-[#3F78A8]"
                >
                  Годовой отчёт пионеров
                </button>

                <h2 className="mb-4 text-2xl text-[#426B8E] font-semibold">
                  Архив
                </h2>
                <input
                  type="text"
                  placeholder="Поиск по архиву..."
                  value={archiveSearch}
                  onChange={(e) =>
                    setArchiveSearch(e.target.value)
                  }
                  className="mb-4 w-full rounded-2xl bg-[#FAFCFE] px-4 py-3 text-[#426B8E] outline-none placeholder:text-slate-400"
                />

                <div className="space-y-3">
                  {archive
                    .filter((item) =>
                      (item.month ?? "")
                        .toLowerCase()
                        .includes(archiveSearch.toLowerCase()) ||
                      (item.group ?? "")
                        .toLowerCase()
                        .includes(archiveSearch.toLowerCase()) ||
                      (item.serviceYear ?? "")
                        .toLowerCase()
                        .includes(archiveSearch.toLowerCase())
                    )
                    .map((item, index) => (
                      <div
                        key={index}
                        className="rounded-2xl bg-[#FAFCFE] p-4"
                      >
                        <div className="font-medium text-[#426B8E]">
                          {item.serviceYear}
                        </div>

                        <div className="text-xs text-slate-400">
                          Сохранено: {item.month}
                        </div>

                        <div className="text-sm text-slate-500">
                          {item.group}
                        </div>

                        <hr className="my-2" />

                        <div className="text-sm text-slate-500">
                          Возвещатели: {item.publishers}
                           {" "}
                            ({item.publisherStudies} изуч.)
                        </div>

                        <div className="text-sm text-slate-500">
                          Неактивные: {item.inactive}
                        </div>

                        <div className="text-sm text-slate-500">
                          Некрещёные: {item.unbaptized}
                          ({item.unbaptizedStudies} изуч.)
                        </div>

                        <div className="text-sm text-slate-500">
                          Подсобные: {item.assistants}
                          {" "}
                          ({item.assistantHours} ч, {item.assistantStudies} изуч.)
                        </div>

                        <div className="text-sm text-slate-500">
                          Общие: {item.regulars}
                          {" "}
                          ({item.regularHours} ч, {item.regularStudies} изуч.)
                        </div>

                        <button
                          onClick={() => {
                            if (window.confirm("Удалить запись из архива?")) {
                              setArchive(
                                archive.filter((_, i) => i !== index)
                              );
                            }
                          }}
                          className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600"
                        >
                          Удалить запись
                        </button>
                      </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}