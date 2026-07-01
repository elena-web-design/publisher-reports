"use client";

import {
  useState,
  useEffect,
  useRef,
} from "react";
import { supabase } from "../lib/supabase";
import * as XLSX from "xlsx-js-style";
type ArchiveItem = {
  id?: string;

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
    event?: string;

    name: string;
    status: string;
    hours: number;
    participation: string;
    group: string;
  };


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

const [selectedPerson, setSelectedPerson] =
  useState<Person | null>(null);

const [showExportModal, setShowExportModal] =
  useState(false);

const [exportType, setExportType] = useState<
  "serviceYear" | "lastSixMonths"
>("serviceYear");

const [personHistory, setPersonHistory] = useState<any[]>([]);
const [allPersonHistory, setAllPersonHistory] = useState<any[]>([]);

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

  const isArchiveMonth = (
    selectedMonth: string
  ) => {
    const monthNames = [
      "Январь",
      "Февраль",
      "Март",
      "Апрель",
      "Май",
      "Июнь",
      "Июль",
      "Август",
      "Сентябрь",
      "Октябрь",
      "Ноябрь",
      "Декабрь",
    ];

    const [monthName, yearString] = selectedMonth.split(" ");
    const reportDate = new Date(
      Number(yearString),
      monthNames.indexOf(monthName),
      1
    );

    const now = new Date();

    const currentMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const previousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );

    if (
      reportDate.getTime() === currentMonth.getTime() ||
      reportDate.getTime() === previousMonth.getTime()
    ) {
      return false;
    }

    return reportDate < previousMonth;
  };

  const allMonths = serviceYears.flatMap((year) =>
    getMonthsForServiceYear(year).map((month) => ({
      year,
      month,
    }))
  );

  const [peopleList, setPeopleList] = useState<Person[]>([]);

  

  const [assistantMonth, setAssistantMonth] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [monthlyHours, setMonthlyHours] = useState<Record<string, number>>({});
  const [bibleStudies, setBibleStudies] = useState<Record<string, number>>({});
  const [participation, setParticipation] = useState<Record<string, string>>({});

  const [newName, setNewName] = useState("");

  const [newStatus, setNewStatus] = useState<"publisher" | "regular_pioneer" | "unbaptized_publisher">(
    "publisher"
  );

  const [selectedMonth, setSelectedMonth] = useState<string>(() =>
    storage.get("selectedMonth", "Сентябрь 2025")
  );

  const normalizeYear = (year: string) =>
    year.replace("–", "-");

  const getPersonKey = (person: Person) => {
    if (!person.id) {
      console.warn("У человека нет id:", person);
      return person.name;
    }

    return person.id;
  };

  const buildKey = (year: string, month: string, personId: string) =>
    `${normalizeYear(year)}-${month}-${personId}`;

  const monthKey = (person: Person) =>
    buildKey(selectedYear, selectedMonth, getPersonKey(person));

  const INACTIVE_AFTER_MISSED_MONTHS = 7;

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

  const isInactive = (
    person: Person,
    serviceYear = selectedYear,
    month = selectedMonth
  ) => {
    if (
      person.status !== "publisher" &&
      person.status !== "unbaptized_publisher"
    ) {
      return false;
    }

    if (!person.id) {
      return false;
    }

    const targetIndex = allMonths.findIndex(
      (item) =>
        item.year === serviceYear &&
        item.month === month
    );

    if (targetIndex === -1) {
      return false;
    }

    const participationByMonth = new Map<string, string>();

    allPersonHistory
      .filter((item) => item.person_id === person.id)
      .forEach((item) => {
        const key = buildKey(
          item.service_year,
          item.month,
          item.person_id
        );

        participationByMonth.set(
          key,
          item.participation || "Нет"
        );
      });

    const currentKey = buildKey(
      selectedYear,
      selectedMonth,
      person.id
    );

    if (participation[currentKey] !== undefined) {
      participationByMonth.set(
        currentKey,
        participation[currentKey]
      );
    }

    let missed = 0;

    for (let index = 0; index <= targetIndex; index++) {
      const item = allMonths[index];

      const key = buildKey(
        item.year,
        item.month,
        person.id
      );

      const value = participationByMonth.get(key);

      if (value === undefined) {
        continue;
      }

      if (value === "Нет") {
        missed++;
      } else {
        missed = 0;
      }
    }

    return missed >= INACTIVE_AFTER_MISSED_MONTHS;
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

  const [mounted, setMounted] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const USERS = [
    { login: "Группа 1", password: "12345", name: "Группа 1" },
    { login: "Группа 2", password: "12345", name: "Группа 2" },
    { login: "Группа 3", password: "12345", name: "Группа 3" },
    { login: "Группа 4", password: "12345", name: "Группа 4" },
    { login: "Группа 5", password: "12345", name: "Группа 5" },
    { login: "Группа 6", password: "12345", name: "Группа 6" },

    { login: "Секретарь", password: "12345", name: "Секретарь" },
  ];

  const [currentPage, setCurrentPage] = useState<
    "groups" | "people"| "journal"
  >("groups");

  const [groups, setGroups] = useState<
    { id: string; name: string }[]
  >([]);

  const [currentUser, setCurrentUser] = useState<null | {
    login: string;
    name: string;
  }>(null);

  const isSecretary =
    currentUser?.name === "Секретарь";

  const [activityLog, setActivityLog] = useState<
    { user: string; action: string; date: string }[]
  >([]);

  const [openGroupMenu, setOpenGroupMenu] =
    useState<string | null>(null);

 const logAction = async (action: string) => {
    if (!currentUser) return;

    const logItem = {
      user: currentUser.name,
      action,
      date: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("activity_log")
      .insert([
        {
          user_name: logItem.user,
          action: logItem.action,
          date: logItem.date,
        },
      ]);

    if (error) {
      console.error(error);
      return;
    }

    setActivityLog((prev) => [...prev, logItem]);
  };

  const savePersonHistory = async (
    person: Person,
    month: string,
    serviceYear: string
  ) => {
    if (!person.id) {
      console.error("Нельзя сохранить историю: у человека нет id", person);
      return;
    }

    const key = buildKey(serviceYear, month, person.id);
    const { data: previousRecord } = await supabase
    .from("person_history")
    .select(`
      status,
      assistant_pioneer,
      inactive
    `)
    .eq("person_id", person.id)
    .eq("service_year", serviceYear)
    .eq("month", month)
    .maybeSingle();

    const previousStatus = previousRecord?.status ?? null;

    let event: string | null = null;

    if (
      previousStatus === "unbaptized_publisher" &&
      person.status === "publisher"
    ) {
      event = "Крестился";
    }

   
    else if (
      previousStatus !== "regular_pioneer" &&
      person.status === "regular_pioneer"
    ) {
      event = "Стал О П";
    }

   
    else if (
      previousStatus === "regular_pioneer" &&
      person.status !== "regular_pioneer"
    ) {
      event = "Перестал быть О П";
    }

    const historyItem = {
      person_id: person.id,
      person_name: person.name,

      group_name: person.group || "Группа 1",

      service_year: serviceYear,
      month,

      status: person.status,

      participation:
        participation[key] || "Нет",

      hours:
        monthlyHours[key] || 0,

      studies:
        bibleStudies[key] || 0,

      assistant_pioneer:
        assistantMonth[key] || false,

      inactive:
        isInactive(person),

      note:
        notes[key] || "",

      event,
    };

    const { error } = await supabase
      .from("person_history")
      .upsert(
        [historyItem],
        {
          onConflict:
            "person_id,service_year,month",
        }
      );

   if (error) {
      console.error(
        "Ошибка сохранения истории:",
        JSON.stringify(error, null, 2)
      );

      return;
    }
  };

  const loadPersonHistory = async (
    personId: string
  ) => {

  const { data, error } = await supabase
    .from("person_history")
    .select("*")
    .eq("person_id", personId)
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "Ошибка загрузки истории:",
      error
    );
    return;
  }

  setPersonHistory(data || []);
};

const loadAllPersonHistoryFromSupabase = async () => {
  const { data, error } = await supabase
    .from("person_history")
    .select("*");

  if (error) {
    console.error("Ошибка загрузки всей истории:", error);
    return;
  }

  setAllPersonHistory(data || []);
};

const getExportMonthOrder = () => {
  const yearMonths = getMonthsForServiceYear(selectedYear);

  if (exportType === "serviceYear") {
    return yearMonths;
  }

  const currentIndex = yearMonths.indexOf(selectedMonth);

  if (currentIndex === -1) {
    return yearMonths.slice(-6);
  }

  return yearMonths.slice(
    Math.max(0, currentIndex - 5),
    currentIndex + 1
  );
};

const loadHistoryForExport = async () => {
  const exportMonths = getExportMonthOrder();

  const { data, error } = await supabase
    .from("person_history")
    .select("*")
    .eq("service_year", selectedYear)
    .in("month", exportMonths);

  if (error) {
    console.error(
      "Ошибка загрузки истории для экспорта:",
      error
    );
    return [];
  }

  return data || [];
};

const loadMonthCardsFromSupabase = async (
    serviceYear: string,
    month: string,
    groupName: string
  ) => {
    const { data, error } = await supabase
      .from("person_history")
      .select("*")
      .eq("service_year", serviceYear)
      .eq("month", month)
      .eq("group_name", groupName);

    if (error) {
      console.error("Ошибка загрузки карточек месяца:", error);
      return;
    }

    const nextParticipation: Record<string, string> = {};
    const nextHours: Record<string, number> = {};
    const nextStudies: Record<string, number> = {};
    const nextAssistant: Record<string, boolean> = {};
    const nextNotes: Record<string, string> = {};

    (data || []).forEach((item) => {
      const key = buildKey(serviceYear, month, item.person_id);

      nextParticipation[key] = item.participation || "Нет";
      nextHours[key] = Number(item.hours) || 0;
      nextStudies[key] = Number(item.studies) || 0;
      nextAssistant[key] = Boolean(item.assistant_pioneer);
      nextNotes[key] = item.note || "";
    });

    setParticipation(nextParticipation);
    setMonthlyHours(nextHours);
    setBibleStudies(nextStudies);
    setAssistantMonth(nextAssistant);
    setNotes(nextNotes);
  };

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

    localStorage.setItem(
      "currentUser",
      JSON.stringify({
        login: user.login,
        name: user.name,
      })
    );

    setIsLoggedIn(true);
  };

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const safeParticipation = participation ?? {};

  const isFirstRender = useRef(true);

  useEffect(() => {
    try {
      const monthLS = localStorage.getItem("selectedMonth");
      if (monthLS) setSelectedMonth(monthLS);

      const yearLS = localStorage.getItem("selectedYear");
      if (yearLS) setSelectedYear(yearLS);

      const groupLS = localStorage.getItem("selectedGroup");
      if (groupLS) setSelectedGroup(groupLS);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    localStorage.setItem("selectedMonth", selectedMonth);
    localStorage.setItem("selectedYear", selectedYear);
    localStorage.setItem("selectedGroup", selectedGroup);
  }, [selectedMonth, selectedYear, selectedGroup]);

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
        const formattedPeople = data.map((person) => ({
          id: person.id,
          name: person.name,
          status: person.status,
          hours: person.hours || 0,
          participation: person.participation || "Да",
          group: person.group_name,
        }));

        setPeopleList(formattedPeople);
      }
    };

    loadPeople();
  }, []);

  useEffect(() => {
    if (!selectedYear || !selectedMonth || !selectedGroup) {
      return;
    }

    loadMonthCardsFromSupabase(
      selectedYear,
      selectedMonth,
      selectedGroup
    );
  }, [selectedYear, selectedMonth, selectedGroup]);

  const loadArchiveFromSupabase = async () => {
    const { data, error } = await supabase
      .from("archive")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Ошибка загрузки архива:", error);
      return;
    }

    const archiveData = (data || []).map((item) => ({
      id: item.id,

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
      regularPioneerDetails: item.regular_pioneer_details ?? [],

      totalHours: item.total_hours,
      totalStudies: item.total_studies,

      date: item.date,
    }));

    setArchive(archiveData as ArchiveItem[]);
  };

  useEffect(() => {
    loadAllPersonHistoryFromSupabase();
  }, []);

  useEffect(() => {
    loadArchiveFromSupabase();
  }, []);

  useEffect(() => {
    const loadActivityLog = async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .order("date", { ascending: false });

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setActivityLog(
          data.map((item) => ({
            user: item.user_name,
            action: item.action,
            date: item.date,
          }))
        );
      }
    };

    loadActivityLog();
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("*")
        .order("created_at");

      if (error) {
        console.error(error);
        return;
      }

      if (data) {
        setGroups(data);
      }
    };

    loadGroups();
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem("currentUser");

    if (!savedUser) return;

    const user = JSON.parse(savedUser);

    setCurrentUser(user);
    setIsLoggedIn(true);
  }, []);

  const filteredGroupPeople = peopleList .filter(
    (person) =>
      (person.group || "Группа 1") === selectedGroup
  );

  const publishersCount = filteredGroupPeople.filter(
    (person) => {
      const key = monthKey(person);

      return (
        person.status === "publisher" &&
        safeParticipation[key] === "Да" &&
        !assistantMonth[key]
      );
    }
  ).length;

  const [saveMessage, setSaveMessage] = useState("");

  const reportsSubmitted = filteredGroupPeople.filter(
    (person) => {
      const key = monthKey(person);
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

  const notSubmitted =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person);
      const hours = Number(monthlyHours[key] ?? 0);

      // Общие пионеры обязаны сдать часы
      if (person.status === "regular_pioneer") {
        return hours <= 0;
      }

      // Подсобные пионеры обязаны сдать часы
      if (assistantMonth[key]) {
        return hours <= 0;
      }

      // Возвещатели и некрещёные должны отметить участие
      return participation[key] !== "Да";
    }).length;

  const groupMembersCount =
    peopleList.filter(
      (person) =>
        (person.group || "Группа 1") === selectedGroup
    ).length;

  const regularPioneersCount =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person);
      const hours = Number(monthlyHours[key] ?? 0);

      return (
        person.status === "regular_pioneer" &&
        hours > 0
      );
    }).length;

  const assistantPioneersCount =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person);

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
          monthKey(person)
        ] || 0),
      0
    );

  const assistantHours = 
    filteredGroupPeople.reduce(
      (sum, person) => {
        if (
          assistantMonth[
            monthKey(person)
          ]
        ) {
          return (
            sum +
            (monthlyHours[
              monthKey(person)
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
              monthKey(person)
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
        participation[monthKey(person)] === "Да" &&
        !assistantMonth[monthKey(person)] &&
        (person.group || "Группа 1") === selectedGroup
    )
    .reduce(
      (sum, person) =>
        sum +
        (bibleStudies[
          monthKey(person)
        ] || 0),
      0
    );

  const assistantStudies = peopleList
    .filter(
      (person) =>
        assistantMonth[
          monthKey(person)
        ] &&
        (person.group || "Группа 1") === selectedGroup
    )
    .reduce(
      (sum, person) =>
        sum +
        (bibleStudies[
          monthKey(person)
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
          monthKey(person)
        ] || 0),
      0
    );
  const unbaptizedCount =
    filteredGroupPeople.filter((person) => {
      const key = monthKey(person);

      return (
        person.status === "unbaptized_publisher" &&
        participation[key] === "Да"
      );
    }).length;

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
              monthKey(person)
            ] || 0)
          );
        }

        return sum;
      },
      0
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

  const totalStudies =
    publisherStudies +
    assistantStudies +
    regularStudies+
    unbaptizedStudies;

  const saveMonthToArchive = async () => {  
    const existingRecord = archive.find(
    (item) =>
    item.serviceYear === selectedYear &&
    item.month === selectedMonth &&
    item.group === selectedGroup
    );

    const { data: existingDbRecord } = await supabase
      .from("archive")
      .select("id")
      .eq("service_year", selectedYear)
      .eq("month", selectedMonth)
      .eq("group_name", selectedGroup)
      .maybeSingle();

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
              monthKey(person)
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
    if (existingRecord) {

      if (isArchiveMonth(selectedMonth)) {

        const shouldUpdate = window.confirm(
          `Вы изменяете архивный отчёт.

        Это может повлиять на историю возвещателей, статистику и экспорт.

        Продолжить?`
        );

        if (!shouldUpdate) {
          return;
        }

      } else {

        const shouldUpdate = window.confirm(
          `Отчёт за ${selectedMonth} уже существует.

        Хотите заменить его новыми данными?`
        );

        if (!shouldUpdate) {
          return;
        }

      }

    }

    const continueSave = async () => {

      let error = null;

      if (existingDbRecord) {
        const { error: updateError } = await supabase
          .from("archive")
          .update({
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
          })
          .eq("id", existingDbRecord.id);

        error = updateError;
      } else {
        const { error: insertError } = await supabase
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

        error = insertError;
      }

      if (error) {
        console.error(
          "Ошибка архива:",
          JSON.stringify(error, null, 2)
        );
        return;
      }

      for (const person of filteredGroupPeople) {
        await savePersonHistory(
          person,
          selectedMonth,
          selectedYear
        );
      }

      const clearedPeople = peopleList.map((p) => ({
        ...p,
        event: undefined,
      }));

      setPeopleList(clearedPeople);

      if (existingDbRecord) {
        await logAction(
          `Изменил отчёт: ${selectedMonth} (${selectedGroup})`
        );
      } else {
        await logAction(
          `Сохранил отчёт: ${selectedMonth} (${selectedGroup})`
        );
      }

      await loadArchiveFromSupabase();

      await loadAllPersonHistoryFromSupabase();

      await loadMonthCardsFromSupabase(
        selectedYear,
        selectedMonth,
        selectedGroup
      );

      if (selectedPerson?.id) {
        await loadPersonHistory(selectedPerson.id);
      }

      setSaveMessage("Сохранено");

      setTimeout(() => {
        setSaveMessage("");
      }, 2000);
    };

    await continueSave();

  }

  const createWorkbook = async (
    history: any[],
    exportType: "serviceYear" | "lastSixMonths",
    peopleList: Person[]
  ) => {

    const workbook = XLSX.utils.book_new();

    const rows: any[][] = [];

    rows.push([
      exportType === "serviceYear"
        ? "ОТЧЁТ ЗА СЛУЖЕБНЫЙ ГОД"
        : "ОТЧЁТ ЗА ПОСЛЕДНИЕ 6 МЕСЯЦЕВ"
    ]);

    rows.push([
      exportType === "serviceYear"
        ? selectedYear
        : ""
    ]);

    rows.push([
      "Собрание:",
      ""
    ]);

    rows.push([
      "Дата создания:",
      new Date().toLocaleDateString("ru-RU")
    ]);

    rows.push([]);

    const groupedByGroup = history.reduce(
      (acc: Record<string, any[]>, item: any) => {

        if (!acc[item.group_name]) {
          acc[item.group_name] = [];
        }

        acc[item.group_name].push(item);

        return acc;

      },
      {}
    );

    const monthOrder = getExportMonthOrder();

    rows.push([
      "ФИО",
      ...monthOrder.map(m => m.split(" ")[0]),
    ]);

    const rowColors = new Map<number, "op" | "nv">();

    for (const groupName of Object.keys(groupedByGroup).sort()) {

      rows.push([]);

      const people = new Map<string, any>();

      groupedByGroup[groupName].forEach((item: any) => {

        if (!people.has(item.person_id)) {
          people.set(item.person_id, {
            id: item.person_id,
            name: item.person_name,
            status: item.status,
            inactive: item.inactive,
            months: {},
          });
        }

        people.get(item.person_id).months[item.month] = item;

        const inactiveForMonth = isInactive(
          {
            id: item.person_id,
            name: item.person_name,
            status: item.status,
            hours: item.hours || 0,
            participation: item.participation || "Нет",
            group: item.group_name,
          },
          item.service_year,
          item.month
        );

        if (inactiveForMonth) {
          people.get(item.person_id).inactive = true;
        }

      });

      rows.push([
        `${groupName.toUpperCase()} (${people.size})`
      ]);

      for (const person of people.values()) {

        const badges: string[] = [];

      if (person.status === "regular_pioneer") {
        badges.push("ОП");
      }

      if (person.status === "unbaptized_publisher") {
        badges.push("НВ");
      }

      if (person.inactive) {
        badges.push("НЕАКТ.");
      }

      const status = badges.join(" • ");

        const row = [
          status
            ? `${person.name}\n${status}`
            : person.name,
        ];

        const rowIndex = rows.length;

        if (person.status === "regular_pioneer") {
          rowColors.set(rowIndex, "op");
        }

        if (person.status === "unbaptized_publisher") {
          rowColors.set(rowIndex, "nv");
        }

        monthOrder.forEach((month) => {
          const report = person.months[month];

          if (!report) {
            row.push("");
            return;
          }

          const studies =
            report.studies && report.studies > 0
              ? ` (${report.studies})`
              : "";

          const note = report.note?.trim();

          let cellValue = "";

          if (
            report.status === "regular_pioneer" ||
            report.assistant_pioneer
          ) {
            cellValue = `${report.hours || 0}ч${studies}`;
          } else if (report.participation === "Да") {
            cellValue = `Да${studies}`;
          } else {
            cellValue = "Нет";
          }

          if (note) {
            cellValue += `\n${note}`;
          }

          row.push(cellValue);
        });

        rows.push(row);

      }

    }

    const uniquePeople = new Map<string, any>();

    history.forEach((item: any) => {

      if (!uniquePeople.has(item.person_id)) {
        uniquePeople.set(item.person_id, {
          status: item.status,
        });
      }

    });

    const totalPeople = uniquePeople.size;

    const unbaptizedCount = [...uniquePeople.values()].filter(
      (p) => p.status === "unbaptized_publisher"
    ).length;

    const inactiveCount = [...uniquePeople.values()].filter(
      (p) => p.status === "inactive"
    ).length;

    const regularPioneers = [...uniquePeople.values()].filter(
      (p) => p.status === "regular_pioneer"
    ).length;

    const regularHours = history
      .filter((r: any) => r.status === "regular_pioneer")
      .reduce(
        (sum: number, r: any) => sum + (Number(r.hours) || 0),
        0
      );

    const assistantHours = history
      .filter((r: any) => r.assistant_pioneer)
      .reduce(
        (sum: number, r: any) => sum + (Number(r.hours) || 0),
        0
      );

      rows.push([]);

      rows.push(["ИТОГИ"]);

      rows.push([]);

      rows.push([
        "Всего человек",
        totalPeople,
      ]);

      rows.push([
        "Некрещёных",
        unbaptizedCount,
      ]);

      rows.push([
        "Неактивных",
        inactiveCount,
      ]);

      rows.push([
        "Общих пионеров",
        regularPioneers,
      ]);

      rows.push([
        "Часы общих пионеров",
        regularHours,
      ]);

      rows.push([
        "Часы подсобных",
        assistantHours,
      ]);

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 30 }, 
      ...monthOrder.map(() => ({ wch: 18 })),
      { wch: 14 },
    ];

    worksheet["!rows"] = rows.map((row, index) => {
      if (index === 0) return { hpt: 26 };
      if (index === 1) return { hpt: 22 };
      if (index === 2) return { hpt: 22 };
      if (index === 3) return { hpt: 22 };
      if (index === 4) return { hpt: 10 };

      const maxLineCount = Math.max(
        1,
        ...row.map((cell) =>
          String(cell || "").split("\n").length
        )
      );

      return {
        hpt: Math.max(32, maxLineCount * 18),
      };
    });

    for (const [rowIndex, colorType] of rowColors.entries()) {

      for (let C = 0; C <= monthOrder.length; C++) {

        const address = XLSX.utils.encode_cell({
          r: rowIndex,
          c: C,
        });

        if (!worksheet[address]) continue;

        worksheet[address].s = {
          ...(worksheet[address].s || {}),

          fill: {
            fgColor: {
              rgb:
                colorType === "op"
                  ? "EAF5FF"
                  : "FFF8E8",
            },
          },
        };

      }

    }

    worksheet["!merges"] = [
      {
        s: { r: 0, c: 0 },
        e: { r: 0, c: 8 },
      },

      {
        s: { r: 1, c: 0 },
        e: { r: 1, c: 8 },
      },

      {
        s: { r: 0, c: 9 },
        e: { r: 1, c: 12 },
      },
    ];

    

    const titleStyle = {
      font: {
        bold: true,
        sz: 18,
        color: { rgb: "426B8E" },
        name: "Calibri",
      },

      alignment: {
        horizontal: "center",
        vertical: "center",
      },
    };

    const subTitleStyle = {
      font: {
        bold: true,
        sz: 13,
        color: { rgb: "426B8E" },
        name: "Calibri",
      },

      alignment: {
        horizontal: "center",
        vertical: "center",
      },
    };

    const infoStyle = {
      font: {
        bold: true,
        color: { rgb: "426B8E" },
      },
    };

    worksheet["A1"].s = titleStyle;
    worksheet["A2"].s = subTitleStyle;
    worksheet["A3"].s = infoStyle; 
    worksheet["A4"].s = infoStyle;

    worksheet["J1"] = {
      t: "s",
      v: "JW\nPublisher Reports",
    };

    worksheet["J1"].s = {
      font: {
        bold: true,
        sz: 26,
        color: {
          rgb: "4B84B6",
        },
        name: "Calibri",
      },

      alignment: {
        horizontal: "center",
        vertical: "center",
        wrapText: true,
      },
    };

    const range = XLSX.utils.decode_range(
      worksheet["!ref"] || "A1"
    );

    worksheet["!freeze"] = {
      xSplit: 0,
      ySplit: 5,
    };

    worksheet["!autofilter"] = {
      ref: XLSX.utils.encode_range({
        s: { r: 4, c: 0 },
        e: {
          r: range.e.r,
          c: range.e.c,
        },
      }),
    };



    worksheet["!pageSetup"] = {
      orientation: "landscape", 
      fitToWidth: 1,
      fitToHeight: 0,
    };

    worksheet["!margins"] = {
      left: 0.3,
      right: 0.3,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    };

    for (let R = range.s.r; R <= range.e.r; R++) {

      const firstAddress = XLSX.utils.encode_cell({
        r: R,
        c: 0,
      });

      const firstCell = worksheet[firstAddress];

      if (!firstCell) continue;

      const isHeader = R === 5;

      const isGroup =
        typeof firstCell.v === "string" &&
        String(firstCell.v).startsWith("ГРУППА");

      const isSummary =
        typeof firstCell.v === "string" &&
        String(firstCell.v) === "ИТОГИ";

      for (let C = range.s.c; C <= range.e.c; C++) {

        const address = XLSX.utils.encode_cell({
          r: R,
          c: C,
        });

        if (!worksheet[address]) {
          worksheet[address] = {
            t: "s",
            v: "",
          };
        }

        const cell = worksheet[address];

        cell.s = {
          font: {
            name: "Calibri",
            sz: 11,
            color: { rgb: "000000" },
          },

          alignment: {
            horizontal: C === 0 ? "left" : "center",
            vertical: "center",
            wrapText: true,
          },

          border: {
            top: {
              style: "thin",
              color: { rgb: "D9D9D9" },
            },
            bottom: {
              style: "thin",
              color: { rgb: "D9D9D9" },
            },
            left: {
              style: "thin",
              color: { rgb: "D9D9D9" },
            },
            right: {
              style: "thin",
              color: { rgb: "D9D9D9" },
            },
          },
        };

        if (isHeader) {

          cell.s.fill = {
            fgColor: {
              rgb: "FFFFFF",
            },
          };

          cell.s.font = {
            bold: true,
            color: {
              rgb: "426B8E",
            },
            sz: 11,
          };

        }

        if (isGroup) {

          cell.s.fill = {
            fgColor: {
              rgb: "4B84B6",
            },
          };

          cell.s.font = {
            bold: true,
            color: {
              rgb: "FFFFFF",
            },
            sz: 11,
          };

          cell.s.alignment = {
            horizontal: "center",
            vertical: "center",
          };

        }

        if (isSummary) {

          cell.s.fill = {
            fgColor: {
              rgb: "4B84B6",
            },
          };

          cell.s.font = {
            bold: true,
            color: {
              rgb: "FFFFFF",
            },
            sz: 12,
          };

          cell.s.alignment = {
            horizontal: "center",
            vertical: "center",
          };

        }

      }

    }

    for (const [rowIndex, colorType] of rowColors.entries()) {

      for (let C = range.s.c; C <= range.e.c; C++) {

        const address = XLSX.utils.encode_cell({
          r: rowIndex,
          c: C,
        });

        if (!worksheet[address]) continue;

        worksheet[address].s = {
          ...worksheet[address].s,

          fill: {
            fgColor: {
              rgb:
                colorType === "op"
                  ? "EAF5FF"
                  : "FFF8E8",
            },
          },
        };

      }

    }

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      exportType === "serviceYear"
        ? "Служебный год"
        : "Последние 6 месяцев"
    );

    return {
      workbook,
      worksheet,
    };

  };

  const exportReport = async () => {

    await loadArchiveFromSupabase();

    const history = await loadHistoryForExport();

    const {
      workbook,
    } = await createWorkbook(
      history,
      exportType,
      peopleList
    );

    setShowExportModal(false);

    const fileName =
      exportType === "serviceYear"
        ? `Отчёт_${selectedYear}.xlsx`
        : "Отчёт_последние_6_месяцев.xlsx";

    XLSX.writeFile(
      workbook,
      fileName
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
            className="bg-white/95 p-5 rounded-[28px] shadow-sm max-w-md"
          >
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

            <button
              type="submit"
              className="mt-6 w-full bg-[#4B84B6] text-white py-3 rounded-full shadow-sm"
            >
              Войти
            </button>
          </form>
      </div>
      </div>
    );
  }

  const getStatusBadge = (
    item: any
  ) => {
    if (item.assistant_pioneer) {
      return "bg-[#EEE6FF] text-[#7A58B5]";
    }

    switch (item.status) {
      case "regular_pioneer":
        return "bg-[#D8ECFA] text-[#3F78A8]";

      case "unbaptized_publisher":
        return "bg-[#ECEAE6] text-[#6B7280]";

      default:
        return "";
    }
  };

  const getEventBadge = (
    event: string
  ) => {
    switch (event) {
      case "Крестился":
        return "bg-[#ECEAE6] text-[#6B7280]";

      case "Стал О П":
        return "bg-[#D8ECFA] text-[#3F78A8]";

      case "Перестал быть О П":
        return "bg-slate-100 text-slate-600";

      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  if (selectedPerson) {
    const getStatusLabel = (
      item: any
    ) => {
      if (item.assistant_pioneer) {
        return "П П";
      }

      switch (item.status) {
        case "unbaptized_publisher":
          return "Н В";

        case "regular_pioneer":
          return "О П";

        default:
          return "";
      }
    };

    const monthOrder = [
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

    const groupedHistory = personHistory.reduce(
      (acc: any, item) => {
        if (!acc[item.service_year]) {
          acc[item.service_year] = [];
        }

        acc[item.service_year].push(item);

        return acc;
      },
      {}
    );

    Object.values(groupedHistory).forEach((items: any) => {
      items.sort((a: any, b: any) => {
        const monthA = a.month.split(" ")[0];
        const monthB = b.month.split(" ")[0];

        return (
          monthOrder.indexOf(monthA) -
          monthOrder.indexOf(monthB)
        );
      });
    });

    const yearlyHours = Object.fromEntries(
      Object.entries(groupedHistory).map(
        ([serviceYear, items]) => [
          serviceYear,
          (items as any[]).reduce(
            (sum, item) => sum + (item.hours || 0),
            0
          ),
        ]
      )
    );
    
    return (
      <div className="min-h-screen bg-[#EEF5FA] p-6">

        <div className="mb-4 flex items-start justify-between">
          <button
            onClick={() => setSelectedPerson(null)}
            className="rounded-full bg-white px-4 py-2 text-sm text-[#426B8E] shadow-sm hover:bg-slate-50 transition"
          >
            ← Назад
          </button>

          {(
            selectedPerson.status === "regular_pioneer" ||
            personHistory.some((item) => item.assistant_pioneer)
          ) && (

          <div className="min-w-[170px] rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Годовой отчёт
            </div>

            <div className="mt-2 text-sm font-medium text-[#426B8E]">
              {selectedYear}
            </div>

            <div className="mt-3 text-3xl font-bold text-[#426B8E]">
              {yearlyHours[selectedYear] || 0}
            </div>

            <div className="text-xs text-slate-400">
              часов
            </div>
          </div>
          )}
        </div>

        <div
          className={`mb-6 ${
            selectedPerson.status === "regular_pioneer" ||
            personHistory.some((item) => item.assistant_pioneer)
              ? "-mt-20"
              : "-mt-2"
          }`}
        >
          <h1 className="text-2xl font-bold text-[#426B8E]">
            {selectedPerson.name}
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            История служения
          </p>
        </div>

        <div className="space-y-3">
          {Object.entries(groupedHistory).map(
            ([serviceYear, items]) => (
              <div key={serviceYear} className="space-y-3">

                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-300" />

                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {serviceYear}
                  </div>

                  <div className="h-px flex-1 bg-slate-300" />
                </div>

                
                {(items as any[]).map((item) => {
                  const yearHours = yearlyHours[item.service_year];

                  return (
                  <div key={item.id}>
                    <div className="rounded-2xl bg-white px-5 py-4 shadow-sm border border-slate-100">

                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-sm font-semibold tracking-wide text-[#426B8E]">
                          {item.month}
                        </div>

                        <div className="flex flex-col items-end gap-1">

                          {(item.assistant_pioneer ||
                            item.status === "regular_pioneer" ||
                            item.status === "unbaptized_publisher") && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getStatusBadge(item)}`}
                            >
                              {getStatusLabel(item)}
                            </span>
                          )}

                          {isInactive(
                            {
                              id: item.person_id,
                              name: item.person_name,
                              status: item.status,
                              hours: item.hours || 0,
                              participation: item.participation || "Нет",
                              group: item.group_name,
                            },
                            item.service_year,
                            item.month
                          ) && (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                              Неактивный
                            </span>
                          )}

                        </div>
                      </div>

                      {item.status === "regular_pioneer" ||
                      item.assistant_pioneer ? (
                        <>
                          <div className="text-sm text-slate-600">
                            Часы:{" "}
                            <span className="font-medium">
                              {item.hours}
                            </span>
                          </div>

                          {item.month.includes("Август") && (
                            <div className="mt-1 text-sm font-semibold text-[#426B8E]">
                              Итого за служебный год: {yearHours} ч
                            </div>
                          )}

                          <div className="text-sm text-slate-600">
                            Изучения:{" "}
                            <span className="font-medium">
                              {item.studies}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium">
                              {item.participation}
                            </span>
                          </div>

                          <div className="text-sm text-slate-600">
                            Изучения:{" "}
                            <span className="font-medium">
                              {item.studies}
                            </span>
                          </div>
                        </>
                      )}

                      {item.event &&
                        item.event !== "Стал П П" && (
                          <div className="mt-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getEventBadge(item.event)}`}
                            >
                              {item.event}
                            </span>
                          </div>
                        )}

                      {item.note && (
                        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                          {item.note}
                        </div>
                      )}
                    </div>
                  </div>
                  );
               })}
              </div>
            )
          )}
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
            {groups.map((group) => (
              <div
                key={group.id}
                className="
                  relative
                  w-full
                  rounded-[32px]
                  bg-white
                  p-6
                  shadow-sm
                  transition-all
                  hover:shadow-md
                "
              >
                <button
                  onClick={() => {
                    setSelectedGroup(group.name);
                    setCurrentPage("people");
                  }}
                  className="w-full text-center"
                >
                  <div className="text-xl font-semibold text-[#426B8E]">
                    {group.name}
                  </div>
                </button>

                {isSecretary && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      setOpenGroupMenu(
                        openGroupMenu === group.id
                          ? null
                          : group.id
                      );
                    }}
                    className="
                      absolute
                      right-3
                      top-3
                      flex
                      h-8
                      w-8
                      items-center
                      justify-center
                      rounded-xl
                      bg-[#F3FAFF]
                      text-[#426B8E]
                      transition
                      hover:bg-[#D8ECFA]
                    "
                      

                  >
                    ⋮
                  </button>
                )}
                {isSecretary &&
                  openGroupMenu === group.id && (
                    <div
                      className="
                        absolute
                        right-3
                        top-12
                        z-50
                        w-36
                        rounded-2xl
                        bg-white
                        shadow-lg
                        border
                        border-slate-100
                        overflow-hidden
                      "
                    >
                      <button
                        onClick={async () => {
                          const newName = prompt(
                            "Новое название группы",
                            group.name
                          );

                          if (!newName || newName === group.name) {
                            return;
                          }

                          const { error } = await supabase
                            .from("groups")
                            .update({
                              name: newName,
                            })
                            .eq("id", group.id);

                          if (error) {
                            console.error(error);
                            alert("Ошибка редактирования");
                            return;
                          }

                          const { data } = await supabase
                            .from("groups")
                            .select("*")
                            .order("created_at");

                          if (data) {
                            setGroups(data);
                          }

                          setOpenGroupMenu(null);
                        }}
                        className="
                          w-full
                          px-3
                          py-2
                          text-left
                          text-xs
                          text-[#426B8E]
                          hover:bg-[#F3FAFF]
                        "
                      >
                        Редактировать
                      </button>

                      <div className="h-px bg-slate-100" />

                      <button
                        onClick={async () => {
                          const peopleInGroup = peopleList.filter(
                            (person) =>
                              (person.group || "Группа 1") === group.name
                          );

                          if (peopleInGroup.length > 0) {
                            alert(
                              `В группе "${group.name}" есть люди (${peopleInGroup.length} чел.). Сначала перенесите или удалите их.`
                            );

                            return;
                          }

                          const confirmed = window.confirm(
                            `Удалить группу "${group.name}"?`
                          );

                          if (!confirmed) {
                            return;
                          }

                          const { error } = await supabase
                            .from("groups")
                            .delete()
                            .eq("id", group.id);

                          if (error) {
                            console.error(error);
                            alert("Ошибка удаления");
                            return;
                          }

                          setGroups(
                            groups.filter((g) => g.id !== group.id)
                          );

                          setOpenGroupMenu(null);
                        }}
                        className="
                          w-full
                          px-3
                          py-2
                          text-left
                          text-xs
                          text-red-600
                          hover:bg-red-50
                        "
                      >
                        Удалить
                      </button>
                    </div>
                )}
              </div>
            ))}
            
          </div>
          {isSecretary && (
            <button
              onClick={async () => {
                const name = prompt("Название новой группы");

                if (!name) return;

                const { error } = await supabase
                  .from("groups")
                  .insert([{ name }]);

                if (error) {
                  console.error(error);
                  alert("Ошибка создания группы");
                  return;
                }

                const { data } = await supabase
                  .from("groups")
                  .select("*")
                  .order("created_at");

                if (data) {
                  setGroups(data);
                }
              }}
              className="
                fixed
                bottom-6
                right-6
                h-14
                w-14
                rounded-2xl
                bg-[#D8ECFA]
                text-[#426B8E]
                text-3xl
                shadow-lg
                transition-all
                hover:bg-[#4B84B6]
                hover:text-white
                hover:scale-105
                z-50
              "
            >
              +
            </button>
          )}
        </div>
      </div>
    );
  }

  if (currentPage === "journal") {
    return (
      <main className="min-h-screen bg-[#EEF5FA] p-6">
        <div className="mb-4">
          <button
            onClick={() => setCurrentPage("people")}
            className="rounded-2xl bg-white px-4 py-2 shadow-sm text-[#426B8E]"
          >
            ← Назад
          </button>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="rounded-[32px] bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-2xl font-semibold text-[#426B8E]">
              Журнал действий
            </h2>

            <div className="space-y-3">
              {activityLog.length === 0 ? (
                <div className="rounded-2xl bg-[#FAFCFE] p-6 text-center text-slate-400">
                  Журнал действий пока пуст
                </div>
              ) : (
                activityLog.map((item, index) => (
               <div
                  key={index}
                  className="rounded-2xl bg-[#FAFCFE] p-4 border border-slate-100"
                >
                  <div className="text-xs text-slate-400">
                    {new Date(item.date).toLocaleString("ru-RU")}
                  </div>

                  <div className="mt-2 font-semibold text-[#426B8E]">
                    👤 {item.user}
                  </div>

                  <div className="mt-2 text-sm text-slate-600">
                    {item.action}
                  </div>
                </div>
              ))
             )
            }
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#EEF5FA] p-6">
      <div className="mb-4">
       <div className="mb-4 flex items-center justify-between">
        <button
          onClick={() => setCurrentPage("groups")}
          className="rounded-2xl bg-white px-4 py-2 shadow-sm text-[#426B8E]"
        >
          ← К группам
        </button>

       <div className="flex items-center gap-2">
          <div className="rounded-2xl bg-white px-4 py-2 shadow-sm text-[#426B8E]">
            👤 {currentUser?.name}
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("currentUser");

              setCurrentUser(null);
              setIsLoggedIn(false);

              setCurrentPage("groups");
            }}
            className="rounded-2xl bg-white px-4 py-2 shadow-sm text-[#426B8E] hover:bg-[#F3FAFF]"
          >
            ↩ Выход
          </button>
        </div>
      </div>
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

                    const { data: refreshedPeople } = await supabase
                      .from("people")
                      .select("*");

                    if (refreshedPeople) {
                      const formattedPeople = refreshedPeople.map((person) => ({
                        id: person.id,
                        name: person.name,
                        status: person.status,
                        hours: person.hours || 0,
                        participation: person.participation || "Да",
                        group: person.group_name,
                      }));

                      setPeopleList(formattedPeople);
                    }

                    let statusText = "";

                    if (newStatus === "publisher") {
                      statusText = "возвещатель";
                    }

                    if (newStatus === "unbaptized_publisher") {
                      statusText = "некрещёный возвещатель";
                    }

                    if (newStatus === "regular_pioneer") {
                      statusText = "общий пионер";
                    }

                    await logAction(
                      `Добавлен: ${statusText} ${newName} в ${selectedGroup}`
                    );

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
                  className={`relative ${
                    openMenu === index ? "z-[999]" : "z-0"
                  } rounded-3xl backdrop-blur-sm p-3 ${
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
                        <button
                          onClick={async () => {
                            setSelectedPerson(person as any);

                            if (person.id) {
                              await loadPersonHistory(person.id);
                            }
                          }}
                          className="w-full text-left"
                        >
                          <h3 className="rounded-2xl bg-white/60 px-3 py-2 text-lg font-semibold text-[#426B8E] backdrop-blur-sm hover:bg-white/80 transition">
                            {person.name}
                          </h3>
                        </button>
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
                                      [monthKey(person)]: "Да",
                                    });

                                  }}
                                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                                    participation[monthKey(person)] === "Да"
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
                                      [monthKey(person)]: "Нет",
                                    });

                                  }}
                                  className={`rounded-xl px-4 py-2 text-sm font-medium ${
                                    participation[monthKey(person)] === "Нет"
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
                                 assistantMonth[monthKey(person)]
                                   ? "bg-[#EEE7FB]/90 text-[#6E5AA6]"
                                  : "bg-white/70 text-slate-600"
                               }`}
                              >
                            
                              <input
                                type="checkbox"
                                 checked={
                                    assistantMonth[monthKey(person)] || false
                                  }
                                 onChange={(e) => {
                                  const checked = e.target.checked;

                                  setAssistantMonth({
                                    ...assistantMonth,
                                    [monthKey(person)]: checked,
                                  });

                                  if (!checked) {
                                    setMonthlyHours({
                                      ...monthlyHours,
                                      [monthKey(person)]: 0,
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
                                notes[monthKey(person)] || ""
                              }
                              onChange={(e) =>
                                setNotes({
                                  ...notes,
                                  [monthKey(person)]: e.target.value,
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
                          <div className="absolute right-0 top-10 z-[9999] w-52 rounded-2xl bg-white p-2 shadow-2xl border border-slate-200">
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
                                    onClick={async () => {
                                      const confirmChange = window.confirm(
                                        `Перевести "${person.name}" в возвещатели?`
                                      );

                                      if (!confirmChange) return;

                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          status: "publisher",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }
                                      
                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? {
                                              ...p,
                                              status: "publisher",
                                              event: "Крестился",
                                            }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setOpenStatusMenu(null);
                                    

                                      await logAction(
                                        `${person.name}: переведён в возвещатели в ${selectedGroup}`
                                      );

                                      await logAction(
                                        `${person.name}: крещён / переведён в возвещатели в ${selectedGroup}`
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
                                  setOpenStatusMenu(null);
                                }}
                                className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                              >
                                Переместить в группу 
                              </button>
                              {groupMenu === index && (
                                <div className="ml-3 mt-1 border-l pl-2">
                                  <button
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          group_name: "Группа 1",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }


                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? { ...p, group: "Группа 1" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      setOpenStatusMenu(null);

                                      await logAction(
                                        `${person.name}: перемещён из ${person.group} в Группу 1`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 1
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          group_name: "Группа 2",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }

                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? { ...p, group: "Группа 2" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      setOpenStatusMenu(null);

                                      await logAction(
                                        `${person.name}: перемещён из ${person.group} в Группу 2`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 2
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          group_name: "Группа 3",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }

                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? { ...p, group: "Группа 3" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      setOpenStatusMenu(null);

                                      await logAction(
                                        `${person.name}: перемещён из ${person.group} в Группу 3`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 3
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          group_name: "Группа 4",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }

                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? { ...p, group: "Группа 4" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      setOpenStatusMenu(null);

                                      await logAction(
                                        `${person.name}: перемещён из ${person.group} в Группу 4`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 4
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          group_name: "Группа 5",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }

                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? { ...p, group: "Группа 5" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      setOpenStatusMenu(null);

                                      await logAction(
                                        `${person.name}: перемещён из ${person.group} в Группу 5`
                                      );
                                    }}
                                    className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                  >
                                    Группа 5
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const { error } = await supabase
                                        .from("people")
                                        .update({
                                          group_name: "Группа 6",
                                        })
                                        .eq("id", person.id);

                                      if (error) {
                                        console.error(error);
                                        return;
                                      }

                                      const updatedPeople = peopleList.map((p) =>
                                        p.id === person.id
                                          ? { ...p, group: "Группа 6" }
                                          : p
                                      );

                                      setPeopleList(updatedPeople);

                                      setOpenMenu(null);
                                      setGroupMenu(null);
                                      setOpenStatusMenu(null);

                                      await logAction(
                                        `${person.name}: перемещён из ${person.group} в Группу 6`
                                      );
                                    }}
                                        className="w-full rounded-xl px-3 py-1.5 text-left text-xs text-[#426B8E] hover:bg-slate-100"
                                      >
                                        Группа 6
                                      </button>
                                    </div>
                                  )}
                                  
                                  {person.status !== "unbaptized_publisher" && (
                                    <>
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
                                                        event: "Перестал быть О П",
                                                      }
                                                    : p
                                                );

                                                setPeopleList(updatedPeople);

                                                setOpenMenu(null);
                                                setOpenStatusMenu(null);
                                                setGroupMenu(null);
                                              }
                                            }}
                                            className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                                          >
                                            Перевести в возвещатели
                                          </button>

                                          <button
                                            onClick={async () => {
                                              const confirmChange = window.confirm(
                                                `Перевести "${person.name}" в общие пионеры?`
                                              );

                                              if (confirmChange) {
                                                const { error } = await supabase
                                                  .from("people")
                                                  .update({
                                                    status: "regular_pioneer",
                                                  })
                                                  .eq("id", person.id);

                                                if (error) {
                                                  console.error(error);
                                                  return;
                                                }

                                                const updatedPeople = peopleList.map((p) =>
                                                  p.id === person.id
                                                    ? {
                                                        ...p,
                                                        status: "regular_pioneer",
                                                        event: "Стал О П",
                                                      }
                                                    : p
                                                );

                                                setPeopleList(updatedPeople);

                                                setAssistantMonth((prev) => ({
                                                  ...prev,
                                                  [monthKey(person)]: false,
                                                }));

                                                setOpenMenu(null);
                                                setOpenStatusMenu(null);
                                                setGroupMenu(null);

                                                await logAction(
                                                  `${person.name}: переведён в общие пионеры в (${selectedGroup})`
                                                );
                                              }
                                            }}
                                            className="w-full rounded-xl px-3 py-2 text-left text-xs text-slate-600 hover:bg-slate-100"
                                          >
                                            Перевести в общие пионеры
                                          </button>

                                        </div>
                                      )}
                                    </>
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
                        
                        {(assistantMonth[monthKey(person)] ||
                            person.status === "regular_pioneer") && (
                            <>
                              <div className="mt-2 text-sm font-medium text-slate-500">
                                Часы
                              </div>

                              <input
                                type="number"
                                value={
                                  monthlyHours[
                                    monthKey(person)
                                  ] || 0
                                }
                                onChange={(e) => {
                                  const value = Number(e.target.value);

                                  setMonthlyHours({
                                    ...monthlyHours,
                                    [monthKey(person)]: value,
                                  });

                                }}
                                className={`mt-2 w-20 rounded-full px-4 py-2 text-center text-lg font-semibold outline-none ${
                                person.status === "regular_pioneer"
                                  ? "bg-[#DDECF7]/80 text-[#3F78A8]"
                                  : assistantMonth[monthKey(person)]
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
                                  monthKey(person)
                                ] || 0
                              }
                             onChange={(e) => {
                                const value = Number(e.target.value);

                                setBibleStudies({
                                  ...bibleStudies,
                                  [monthKey(person)]: value,
                                });

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

              <div className="rounded-3xl bg-[#FAFCFE] p-5">
                <div className="text-sm text-slate-500">
                  Не сдали отчёт
                </div>

                <div className="mt-2 text-3xl font-semibold text-[#426B8E]">
                  {notSubmitted}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  человек
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

                {isSecretary && (
                  <button
                    onClick={() => setShowExportModal(true)}
                    className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left hover:bg-[#EEF5FA] transition"
                  >
                    Экспорт XLS
                  </button>
                )}

                {isSecretary && (
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
                    className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left hover:bg-[#EEF5FA] transition"
                  >
                    Резервная копия архива
                  </button>
                )}
                
               {isSecretary && (
                  <>
                    <button
                      onClick={() =>
                        fileInputRef.current?.click()
                      }
                      className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left hover:bg-[#EEF5FA] transition"
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
                  </>
                )}
                {isSecretary && (
                  <button
                    onClick={() => setCurrentPage("journal")}
                    className="rounded-2xl bg-[#FAFCFE] text-[#426B8E] px-4 py-4 text-left hover:bg-[#EEF5FA] transition"
                  >
                    Журнал действий
                  </button>
                )}

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
                          onClick={async () => {
                            if (!window.confirm("Удалить запись из архива?")) {
                              return;
                            }
                            
                            const archiveId = item.id;

                            if (!archiveId) {
                              return;
                            }

                            const { error } = await supabase
                              .from("archive")
                              .delete()
                              .eq("id", archiveId);

                            if (error) {
                              console.error(error);
                              alert("Ошибка удаления");
                              return;
                            }

                            await logAction(
                              `Сохранил отчёт: ${selectedMonth}`
                            );

                            setArchive(
                              archive.filter((a) => a.id !== archiveId)
                            );
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
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[250px] sm:w-[300px] rounded-2xl bg-white p-5 shadow-xl">

            <h2 className="mb-4 text-lg font-semibold text-[#426B8E]">
              Экспорт XLS
            </h2>

            <div className="space-y-3">

              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={exportType === "serviceYear"}
                  onChange={() =>
                    setExportType("serviceYear")
                  }
                />

                <span>Служебный год</span>
              </label>

              <label className="flex items-center gap-3 text-sm cursor-pointer">
                <input
                  type="radio"
                  checked={exportType === "lastSixMonths"}
                  onChange={() =>
                    setExportType("lastSixMonths")
                  }
                />

                <span>Последние 6 месяцев</span>
              </label>

            </div>

            <div className="mt-6 flex justify-end gap-2">

              <button
                onClick={() =>
                  setShowExportModal(false)
                }
                className="rounded-xl border px-4 py-2 text-slate-600 text-sm hover:bg-slate-100"
              >
                Отмена
              </button>

              <button
                onClick={exportReport}
                className="rounded-xl bg-[#4B84B6] px-4 py-2 text-sm text-white hover:bg-[#3F78A8]"
              >
                Скачать
              </button>

            </div>

          </div>
        </div>
      )}

      {saveMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="rounded-xl border border-[#D6E3EE] bg-white px-8 py-4 text-sm font-medium text-[#426B8E] shadow-xl">
            {saveMessage}
          </div>
        </div>
      )}

    </main>
  );
}