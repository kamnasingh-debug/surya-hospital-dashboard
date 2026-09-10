const periodFiles = { daily: [], weekly: [], monthly: [] };
    let uploadedFiles = periodFiles.daily;
    let dashboardWorkbook = null;
    let currentPeriod = "daily";
    let dashboardMode = "daily";
    let currentPatientRows = [];
    let allPatientRows = [];
    let currentSearchTerm = "";
    let dashboardSettings = {density: "comfortable", notifications: "on", chartDetail: "full", refresh: "off"};
    let refreshTimer = null;
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[character]));
    }

    const defaultData = {
      revenue: 692114.52,
      expenses: 39200,
      claims: 26400,
      admissions: 14,
      discharges: 9,
      opdCount: 64,
      activePatients: 62,
      averageRevenue: 76901.61,
      bedOccupancy: 40,
      patients: [
        { name: "Alina Brown", dept: "Cardiology", doctor: "Dr. R. Shah", status: "Recovered", bill: 1240, initials: "AB", color: "a" },
        { name: "John Parker", dept: "Orthopedic", doctor: "Dr. I. Roy", status: "Monitoring", bill: 2180, initials: "JP", color: "b" },
        { name: "Sonia Moore", dept: "Neurology", doctor: "Dr. A. Nair", status: "Consult", bill: 980, initials: "SM", color: "c" },
        { name: "Daniel Malik", dept: "Emergency", doctor: "Dr. T. Lee", status: "Critical", bill: 3520, initials: "DM", color: "d" }
      ],
      appointments: [
        { title: "Cardiology Review", time: "09:00 AM - 09:45 AM", doctor: "Dr. R. Shah", status: "Active" },
        { title: "Orthopedic Checkup", time: "11:15 AM - 11:50 AM", doctor: "Dr. I. Roy", status: "Confirmed" },
        { title: "Lab Diagnostics", time: "01:30 PM - 02:20 PM", doctor: "Radiology Team", status: "Pending" }
      ]
    };

    function currencyFormat(value, decimals = 0) {
      const amount = Number(value);
      return "₹" + amount.toLocaleString("en-IN", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }

    function renderStats(data) {
      const totalPatients = data.patients.length || 1284;
      const revenue = data.revenue ?? 0;
      const expenses = data.expenses ?? 0;
      const admissions = data.admissions ?? 0;
      const discharges = data.discharges ?? 0;
      const opdCount = data.opdCount ?? 0;
      const activePatients = data.activePatients ?? 0;
      const averageRevenue = data.averageRevenue ?? 0;
      const bedOccupancy = data.bedOccupancy ?? 0;

      const statsSection = document.getElementById("statsSection");
      statsSection.style.setProperty("--kpi-count", "7");
      statsSection.innerHTML = `
        <div class="card stat-card">
          <div class="stat-top">
            <div class="stat-meta">IPD Admissions</div>
            <div class="stat-icon a">💰</div>
          </div>
          <div class="stat-value">${admissions}</div>
          <div class="stat-bottom">
            <span>Admission Report</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-top">
            <div class="stat-meta">Today's Discharge</div>
            <div class="stat-icon b">🧑‍⚕️</div>
          </div>
          <div class="stat-value">${discharges}</div>
          <div class="stat-bottom">
            <span>Discharge Report</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-top">
            <div class="stat-meta">Total Revenue</div>
            <div class="stat-icon c">🏥</div>
          </div>
          <div class="stat-value">${currencyFormat(revenue)}</div>
          <div class="stat-bottom">
            <span>Discharge Report</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-top">
            <div class="stat-meta">Avg Revenue</div>
            <div class="stat-icon d">💸</div>
          </div>
          <div class="stat-value">${currencyFormat(averageRevenue, 2)}</div>
          <div class="stat-bottom">
            <span>per discharge</span>
          </div>
        </div>

        <div class="card stat-card">
          <div class="stat-top"><div class="stat-meta">Bed Occupancy</div><div class="stat-icon a">🛏️</div></div>
          <div class="stat-value">${Number(bedOccupancy).toFixed(2)}%</div>
          <div class="stat-bottom"><span>IPD List</span><span class="trend up">Live</span></div>
        </div>

        <div class="card stat-card">
          <div class="stat-top"><div class="stat-meta">OPD Consultation</div><div class="stat-icon b">👥</div></div>
          <div class="stat-value">${opdCount}</div>
          <div class="stat-bottom"><span>Service Report • all consultation rows</span><span class="trend up">Live</span></div>
        </div>

        <div class="card stat-card">
          <div class="stat-top"><div class="stat-meta">Active Patients</div><div class="stat-icon c">🏥</div></div>
          <div class="stat-value">${activePatients}</div>
          <div class="stat-bottom"><span>IPD List only</span><span class="trend up">Live</span></div>
        </div>
      `;
    }

    function renderPeriodKpis(kpis) {
      const cards = [
        ["IPD Admissions", kpis.admissions, "Admission Report • UHID count", "▲ 12.4%"],
        ["IPD Discharge", kpis.discharges, "Discharge Report • panel-wise File Id count", "▲ 8.2%"],
        ["Total Revenue", currencyFormat(kpis.revenue, 2), "Discharge + Service • Final Service Amt", "▲ 5.3%"],
        ["Cash Due", currencyFormat(kpis.cashDue, 2), "Discharge Report • Cash Due", "▼ 2.1%"],
        ["Credit Due", currencyFormat(kpis.creditDue, 2), "Discharge Report • Credit Due"],
        ["OPD Consultation", kpis.serviceRows, "Service Report • all consultation rows"],
        ["IPD Avg Revenue / Patient", currencyFormat(kpis.averageRevenue, 2), "Discharge Report • average Final Service Amt"],
        ["ALOS", `${kpis.alos.toFixed(2)} days`, "Discharge Report • average (DOD - Doa)"]
      ];
      const statsSection = document.getElementById("statsSection");
      statsSection.style.setProperty("--kpi-count", String(cards.length));
      statsSection.innerHTML = cards.map(([label, value, source, trend], index) => `
        <div class="card stat-card">
          <div class="stat-top"><div class="stat-meta">${label}</div><div class="stat-icon ${["a","b","c","d"][index % 4]}">📊</div></div>
          <div class="stat-value">${value}</div>
          <div class="stat-bottom"><span>${source}</span>${trend ? `<span class="trend ${trend.startsWith("▼") ? "down" : "up"}">${trend}</span>` : ""}</div>
        </div>
      `).join("");
    }

    function rowsForPeriod(rows, dateColumnNames) {
      if (currentPeriod === "monthly" || !rows.length) return rows;
      const dateColumn = findColumn(rows[0], dateColumnNames);
      if (!dateColumn) return rows;
      if (currentPeriod !== "weekly") return rows;
      const dates = rows.map(row => excelDate(row[dateColumn])).filter(Boolean);
      if (!dates.length) return rows;
      const latestDate = new Date(Math.max(...dates.map(date => date.getTime())));
      const start = new Date(latestDate.getFullYear(), latestDate.getMonth(), latestDate.getDate() <= 10 ? 1 : latestDate.getDate() <= 20 ? 11 : 21);
      start.setHours(0, 0, 0, 0);
      const end = latestDate.getDate() <= 10
        ? new Date(latestDate.getFullYear(), latestDate.getMonth(), 10)
        : latestDate.getDate() <= 20
          ? new Date(latestDate.getFullYear(), latestDate.getMonth(), 20)
          : new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return rows.filter(row => {
        const date = excelDate(row[dateColumn]);
        return date && date >= start && date <= end;
      });
    }

    function calculatePeriodKpis(admission, discharge, service, includeServiceRevenue = true) {
      const dischargeAmount = findColumn(discharge[0] || {}, ["Service Final Amt"]);
      const serviceAmount = findColumn(service[0] || {}, ["Service Final Amt"]);
      const cashDue = findColumn(discharge[0] || {}, ["Cash Due"]);
      const creditDue = findColumn(discharge[0] || {}, ["Credit Due"]);
      const dod = findColumn(discharge[0] || {}, ["DOD"]);
      const serviceName = findColumn(service[0] || {}, ["Service Name"]);
      const uhid = findColumn(service[0] || {}, ["UHID"]);
      const dischargeUhid = findColumn(discharge[0] || {}, ["UHID"]);
      const dischargeFileId = findColumn(discharge[0] || {}, ["File Id", "File ID"]);
      const dischargeDod = findColumn(discharge[0] || {}, ["DOD"]);
      const bedDays = findColumn(discharge[0] || {}, ["BED-DAYS", "BED DAYS"]);
      const admissionDate = findColumn(discharge[0] || {}, ["Doa", "DOA", "Admission Date"]);
      const dischargeCountColumn = dischargeFileId || dischargeUhid;
      const uniqueDischargeIds = new Set(discharge.map(row => String(row[dischargeCountColumn] || "").trim()).filter(Boolean));
      const dischargeFileCount = panelWiseDischargeCount(discharge) || uniqueDischargeIds.size;
      const dischargeAmounts = discharge.map(row => numericAmount(row[dischargeAmount])).filter(value => value !== null);
      const serviceAmounts = service.map(row => numericAmount(row[serviceAmount])).filter(value => value !== null);
      const dischargeRowsWithDod = discharge.filter(row => String(row[dischargeDod] || "").trim());
      const totalBedDays = dischargeRowsWithDod.reduce((sum, row) => {
        const bedDayValue = numericAmount(row[bedDays]);
        if (bedDayValue !== null) return sum + bedDayValue;
        const doa = excelDate(row[admissionDate]);
        const dod = excelDate(row[dischargeDod]);
        if (!doa || !dod) return sum;
        return sum + Math.max((dod - doa) / (1000 * 60 * 60 * 24), 0);
      }, 0);
      const dischargeDateCount = dischargeRowsWithDod.length;
      return {
        admissions: admissionUhidCount(admission),
        discharges: dischargeFileCount,
        revenue: [
          ...dischargeAmounts,
          ...(includeServiceRevenue ? serviceAmounts : [])
        ].reduce((sum, value) => sum + value, 0),
        cashDue: discharge.reduce((sum, row) => sum + (numericAmount(row[cashDue]) || 0), 0),
        creditDue: discharge.reduce((sum, row) => sum + (numericAmount(row[creditDue]) || 0), 0),
        serviceRows: consultationRowCount(service),
        averageRevenue: uniqueDischargeIds.size ? dischargeAmounts.reduce((sum, value) => sum + value, 0) / uniqueDischargeIds.size : 0,
        alos: dischargeDateCount ? totalBedDays / dischargeDateCount : 0
      };
    }

    function renderPatientRows(rows) {
      const body = document.getElementById("patientTableBody");
      const panelBody = document.getElementById("patientsPanelTable");
      if (!body || !panelBody) return;
      currentPatientRows = rows;
      const html = rows.map((p) => {
        const badgeClass = p.status === "Recovered" ? "green" : p.status === "Monitoring" ? "orange" : p.status === "Consult" ? "blue" : "red";
        return `
          <tr>
            <td>
              <div class="patient">
                <div class="img ${p.color || 'a'}">${p.initials || p.name.slice(0,2).toUpperCase()}</div>
                <div>
                  <strong>${escapeHtml(p.name)}</strong><br>
                  <small>ID: #${Math.floor(Math.random()*100000)}</small>
                </div>
              </div>
            </td>
            <td>${escapeHtml(p.dept)}</td>
            <td>${escapeHtml(p.doctor)}</td>
            <td><span class="badge ${badgeClass}">${escapeHtml(p.status)}</span></td>
            <td>${currencyFormat(p.bill || 0)}</td>
          </tr>
        `;
      }).join("");

      body.innerHTML = html;
      panelBody.innerHTML = html;
    }

    function filterPatients() {
      const term = currentSearchTerm.trim().toLowerCase();
      if (!term) {
        renderPatientRows(allPatientRows);
        return;
      }
      const filtered = allPatientRows.filter(patient =>
        [patient.name, patient.uhid, patient.dept, patient.doctor, patient.status, patient.panel]
          .some(value => String(value || "").toLowerCase().includes(term))
      );
      renderPatientRows(filtered);
    }

    function renderAppointments(rows) {
      const list = document.getElementById("appointmentList");
      const panel = document.getElementById("appointmentsPanel");
      if (!list || !panel) return;

      const html = rows.map(item => {
        const badgeClass = item.status === "Active" ? "blue" : item.status === "Confirmed" ? "green" : "orange";
        return `
          <div class="appt">
            <div class="appt-top">
              <h4>${escapeHtml(item.title)}</h4>
              <span class="badge ${badgeClass}">${escapeHtml(item.status)}</span>
            </div>
            <div class="time">${escapeHtml(item.time)}</div>
            <p>${escapeHtml(item.doctor)} with scheduled patient workflow</p>
          </div>
        `;
      }).join("");

      list.innerHTML = html;
      panel.innerHTML = html;
    }

    function renderEconomics(data) {
      if (!document.getElementById("netRevenueValue")) return;
      const revenue = data.revenue ?? 0;
      const expenses = data.expenses ?? 0;
      const claims = data.claims ?? 0;
      const profit = revenue - expenses;

      document.getElementById("netRevenueValue").textContent = currencyFormat(revenue);
      document.getElementById("opCostValue").textContent = currencyFormat(expenses);
      document.getElementById("claimValue").textContent = currencyFormat(claims);
      document.getElementById("ecoRevenue").textContent = currencyFormat(revenue);
      document.getElementById("ecoExpense").textContent = currencyFormat(expenses);
      document.getElementById("ecoProfit").textContent = currencyFormat(profit);

      document.getElementById("budgetBar").style.width = "68%";
    }

    function renderDefaultData() {
      renderStats(defaultData);
      allPatientRows = defaultData.patients;
      renderPatientRows(defaultData.patients);
      renderAppointments(defaultData.appointments);
      renderEconomics(defaultData);
    }

    function showSection(target) {
      document.querySelectorAll(".section-panel").forEach(panel => {
        panel.classList.toggle("hidden", panel.dataset.section !== target);
      });
    }

    function loadSettings() {
      try {
        dashboardSettings = {...dashboardSettings, ...JSON.parse(localStorage.getItem("horizonCareSettings") || "{}")};
      } catch (error) {
        console.error("Dashboard settings could not be restored:", error);
      }
      document.body.classList.toggle("dashboard-compact", dashboardSettings.density === "compact");
      document.body.classList.toggle("dashboard-clean", dashboardSettings.chartDetail === "clean");
      document.getElementById("notificationSetting").value = dashboardSettings.notifications;
      document.getElementById("dashboardDensitySetting").value = dashboardSettings.density;
      document.getElementById("chartDetailSetting").value = dashboardSettings.chartDetail;
      document.getElementById("refreshSetting").value = dashboardSettings.refresh;
      document.getElementById("notificationBtn").style.display = dashboardSettings.notifications === "off" ? "none" : "grid";
      scheduleRefresh();
    }

    function saveSettings() {
      dashboardSettings = {
        density: document.getElementById("dashboardDensitySetting").value,
        notifications: document.getElementById("notificationSetting").value,
        chartDetail: document.getElementById("chartDetailSetting").value,
        refresh: document.getElementById("refreshSetting").value
      };
      localStorage.setItem("horizonCareSettings", JSON.stringify(dashboardSettings));
      document.body.classList.toggle("dashboard-compact", dashboardSettings.density === "compact");
      document.body.classList.toggle("dashboard-clean", dashboardSettings.chartDetail === "clean");
      document.getElementById("notificationBtn").style.display = dashboardSettings.notifications === "off" ? "none" : "grid";
      scheduleRefresh();
      document.getElementById("settingsStatus").textContent = "Settings saved successfully.";
    }

    function scheduleRefresh() {
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = null;
      const minutes = Number(dashboardSettings.refresh);
      if (minutes > 0) {
        refreshTimer = setInterval(() => {
          if (dashboardMode === "daily" && !document.querySelector('[data-section="dashboard"].hidden')) loadDashboard();
        }, minutes * 60 * 1000);
      }
    }

    function selectPeriod(period) {
      const requestedPeriod = period;
      if (period === "multi-day") {
        dashboardMode = "multi-day";
        const availableFiles = [...new Map(
          [...periodFiles.weekly, ...periodFiles.monthly].map(file => [file.name, file])
        ).values()];
        period = availableFiles.length ? detectUploadedPeriod(availableFiles) : "weekly";
        if (period === "daily") period = "weekly";
        uploadedFiles = availableFiles;
      } else {
        dashboardMode = "daily";
      }
      const button = document.querySelector(`.period-button[data-period="${requestedPeriod === "multi-day" ? "multi-day" : period}"]`);
      if (!["daily", "weekly", "monthly"].includes(period)) return;
      document.querySelectorAll(".period-button").forEach(item => {
        const isMultiDay = item.dataset.period === "multi-day";
        const shouldBeActive = requestedPeriod === "multi-day"
          ? isMultiDay
          : item.dataset.period === "daily" && dashboardMode === "daily";
        item.classList.toggle("active", shouldBeActive);
      });
      if (button) button.classList.add("active");
      currentPeriod = period;
      localStorage.setItem("horizonCareLastView", JSON.stringify({dashboardMode, period: currentPeriod}));
      uploadedFiles = dashboardMode === "multi-day" ? uploadedFiles : periodFiles[currentPeriod];
      const label = dashboardMode === "daily"
        ? "Single-Day Dashboard"
        : period === "weekly"
          ? "Multi-Day Weekly Dashboard"
          : "Multi-Day Monthly Dashboard";
      document.getElementById("periodLabel").textContent = label;
      document.getElementById("uploadPeriodLabel").textContent = label;
      document.getElementById("periodUploadBtn").textContent = `Upload ${label} Files`;
      document.getElementById("dashboardTitle").textContent = `${label} | SURYA Hospital Multi Super Speciality`;
      document.getElementById("dashboardSubtitle").textContent = "A unit of Vedansh Medicare Pvt Ltd";
      document.querySelectorAll(".nav-item").forEach(item => {
        const isMultiDay = item.dataset.period === "multi-day" && (period === "weekly" || period === "monthly");
        item.classList.toggle("active", item.dataset.target === "dashboard" && (!item.dataset.period || item.dataset.period === period || (requestedPeriod === "multi-day" && isMultiDay)));
      });
      renderFileList();
      showSection("dashboard");
      if (uploadedFiles.length) generateMappedDashboardFromExcel();
      else loadDashboard(period);
    }

    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard");
        if (response.status === 401) {
          showLogin();
          return;
        }
        if (!response.ok) throw new Error("Dashboard API failed");

        const data = await response.json();
        if (dashboardMode === "multi-day") {
          renderPeriodKpis({
            admissions: 0, discharges: 0, revenue: 0, cashDue: 0, creditDue: 0,
            consultations: 0, averageRevenue: 0, alos: 0
          });
        } else {
          renderStats(data);
        }
        allPatientRows = data.patients || defaultData.patients;
        renderPatientRows(allPatientRows);
        renderAppointments(data.appointments || defaultData.appointments);
        renderEconomics(data);
      } catch (error) {
        console.error("Failed to load dashboard from backend:", error);
        const unavailableData = {
          revenue: 0, expenses: 0, claims: 0, admissions: 0, discharges: 0,
          opdCount: 0, activePatients: 0, averageRevenue: 0, bedOccupancy: 0,
          patients: [], appointments: []
        };
        renderStats(unavailableData);
        renderPatientRows([]);
        renderAppointments([]);
        renderEconomics(unavailableData);
        addNotification("Dashboard unavailable", "Live hospital data could not be loaded.", "error");
      }
    }

    async function uploadFileToBackend(file) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {"X-Dashboard-Period": currentPeriod},
          body: formData
        });

        if (response.status === 401) {
          showLogin();
          return null;
        }
        if (!response.ok) {
          throw new Error("Upload request failed");
        }

        const result = await response.json();
        console.log("Upload result:", result);
        return result;
      } catch (error) {
        console.error("Backend upload failed:", error);
        return null;
      }
    }

    document.querySelectorAll(".nav-item").forEach(item => {
      item.addEventListener("click", () => {
        document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
        item.classList.add("active");

        const target = item.dataset.target;
        if (item.dataset.period) {
          selectPeriod(item.dataset.period);
        }
        showSection(target);
      });

      document.querySelectorAll(".period-button").forEach(button => {
        button.addEventListener("click", () => {
          selectPeriod(button.dataset.period);
        });
      });
    });

    document.getElementById("periodUploadBtn").addEventListener("click", () => {
      showSection("upload");
      document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.target === "upload");
      });
    });

    function loadDataFromSelectedFile() {
      const fileData = uploadedFiles.map(file => {
        const sheetName = file.activeSheet;
        const sheet = file.workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        return { fileName: file.name, sheetName, rows };
      });

      if (!fileData.length) return null;
      return fileData;
    }

    function classifyFile(name) {
      const value = normalizeHeader(name);
      if (value.includes("admission")) return "admission";
      if (value.includes("discharge")) return "discharge";
      if (value.includes("bill")) return "bill";
      if (value.includes("service")) return "service";
      if (value.includes("ipd")) return "ipd";
      if (value.includes("helper")) return "helper";
      if (value.includes("finalmaster") || value.includes("master")) return "master";
      return "other";
    }

    function detectUploadedPeriod(files) {
      const dates = new Set();
      files.forEach(file => {
        const sheet = file.workbook.Sheets[file.activeSheet || file.workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, {defval: ""});
        if (!rows.length) return;
        const dateColumn = findColumn(rows[0], ["DATE", "Doa", "DOA", "DOD", "Bill Date", "Service Date"]);
        if (!dateColumn) return;
        rows.forEach(row => {
          const date = excelDate(row[dateColumn]);
          if (date) dates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
        });
      });
      if (dates.size <= 1) return "daily";
      return dates.size <= 7 ? "weekly" : "monthly";
    }

    function encodeFile(buffer) {
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let index = 0; index < bytes.length; index += 8192) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
      }
      return btoa(binary);
    }

    function savePeriodFiles() {
      const dailySaved = {daily: periodFiles.daily.map(file => ({name: file.name, data: file.data}))};
      const multiDaySaved = {weekly: periodFiles.weekly.map(file => ({name: file.name, data: file.data})), monthly: periodFiles.monthly.map(file => ({name: file.name, data: file.data}))};
      try {
        localStorage.setItem("horizonCareDailyDashboardFiles", JSON.stringify(dailySaved));
        localStorage.setItem("horizonCareMultiDayDashboardFiles", JSON.stringify(multiDaySaved));
      } catch (error) {
        console.warn("Large dashboard files will use IndexedDB persistence:", error);
      }
      const request = indexedDB.open("horizonCareDashboard", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files");
      request.onsuccess = () => {
        const transaction = request.result.transaction("files", "readwrite");
        transaction.objectStore("files").put({daily: dailySaved.daily, weekly: multiDaySaved.weekly, monthly: multiDaySaved.monthly}, "uploaded");
      };
    }

    async function restorePeriodFiles() {
      const savedFiles = await new Promise(resolve => {
        const request = indexedDB.open("horizonCareDashboard", 1);
        request.onupgradeneeded = () => request.result.createObjectStore("files");
        request.onerror = () => resolve(null);
        request.onsuccess = () => {
          const read = request.result.transaction("files", "readonly").objectStore("files").get("uploaded");
          read.onerror = () => resolve(null);
          read.onsuccess = () => resolve(read.result || null);
        };
      });
      const storageKeys = [
        ["daily", "horizonCareDailyDashboardFiles"],
        ["weekly", "horizonCareMultiDayDashboardFiles"],
        ["monthly", "horizonCareMultiDayDashboardFiles"]
      ];
      const restored = { daily: [], weekly: [], monthly: [] };

      for (const [period, storageKey] of storageKeys) {
        try {
          const savedData = savedFiles || JSON.parse(localStorage.getItem(storageKey) || "{}");
          const files = period === "daily" ? savedData.daily || [] : savedData[period] || [];
          for (const file of files) {
            const binary = atob(file.data);
            const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
            const workbook = XLSX.read(bytes, {type: "array"});
            restored[period].push({name: file.name, data: file.data, workbook, activeSheet: workbook.SheetNames[0]});
          }
        } catch (error) {
          console.error("Saved dashboard files could not be restored for", period, error);
        }
      }

      const legacySaved = {};
      try {
        const legacyData = JSON.parse(localStorage.getItem("horizonCarePeriodFiles") || "{}");
        Object.assign(legacySaved, legacyData);
      } catch (error) {
        console.error("Legacy saved dashboard files could not be restored:", error);
      }

      for (const period of Object.keys(periodFiles)) {
        const items = restored[period].length ? restored[period] : legacySaved[period] || [];
        periodFiles[period] = [];
        for (const file of items) {
          const binary = atob(file.data);
          const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
          const workbook = XLSX.read(bytes, {type: "array"});
          periodFiles[period].push({name: file.name, data: file.data, workbook, activeSheet: workbook.SheetNames[0]});
        }
      }

      dashboardMode = "daily";
      currentPeriod = "daily";
      let lastView = null;
      try {
        lastView = JSON.parse(localStorage.getItem("horizonCareLastView") || "null");
      } catch (error) {
        console.error("Saved dashboard view could not be restored:", error);
      }
      if (lastView && lastView.dashboardMode === "multi-day" && (periodFiles.weekly.length || periodFiles.monthly.length)) {
        dashboardMode = "multi-day";
        currentPeriod = lastView.period === "monthly" ? "monthly" : "weekly";
        uploadedFiles = [...periodFiles.weekly, ...periodFiles.monthly];
      } else {
        uploadedFiles = periodFiles.daily;
      }
      const restoredLabel = dashboardMode === "multi-day"
        ? currentPeriod === "monthly" ? "Multi-Day Monthly Dashboard" : "Multi-Day Weekly Dashboard"
        : "Single-Day Dashboard";
      document.getElementById("periodLabel").textContent = restoredLabel;
      document.getElementById("uploadPeriodLabel").textContent = restoredLabel;
      document.getElementById("periodUploadBtn").textContent = `Upload ${restoredLabel} Files`;
      document.getElementById("dashboardTitle").textContent = `${restoredLabel} | SURYA Hospital Multi Super Speciality`;
      renderFileList();
      if (uploadedFiles.length) {
        dashboardWorkbook = uploadedFiles[0].workbook;
        generateMappedDashboardFromExcel();
      }
    }

    function renderFileList() {
      const renderGroup = (containerId, title, items) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const files = items || [];
        container.classList.toggle("active", ["daily", "weekly", "monthly"].includes(currentPeriod) && (containerId === "dailyStorageGroup" ? currentPeriod === "daily" : currentPeriod !== "daily"));
        container.innerHTML = `
          <div class="storage-header">
            <h4>${title}</h4>
            <span class="storage-badge">${files.length} file${files.length === 1 ? "" : "s"}</span>
          </div>
          <div class="storage-list">
            ${files.length ? files.map(file => `
              <div class="file-item"><strong>${file.name}</strong>
              <button type="button" class="secondary-button remove-file" data-file="${file.name}" data-period="${file.period || "daily"}" style="float:right;padding:6px 10px">Remove</button>
              <br><small>${classifyFile(file.name).toUpperCase()} file • ${file.period ? file.period.toUpperCase() : "DAILY"}</small></div>
            `).join("") : '<div class="file-item"><small style="color:var(--muted)">No files uploaded yet.</small></div>'}
          </div>
        `;

        container.querySelectorAll(".remove-file").forEach(button => {
          button.addEventListener("click", () => {
            const period = button.dataset.period;
            const fileName = button.dataset.file;
            const periodFilesList = periodFiles[period] || [];
            const index = periodFilesList.findIndex(file => file.name === fileName);
            if (index >= 0) periodFilesList.splice(index, 1);
            savePeriodFiles();
            renderFileList();
            if (currentPeriod === period) {
              uploadedFiles = periodFilesList;
              if (uploadedFiles.length) generateMappedDashboardFromExcel();
              else renderDefaultData();
            }
          });
        });
      };

      const dailyFiles = (periodFiles.daily || []).map(file => ({...file, period: "daily"}));
      const multiDayFiles = [
        ...(periodFiles.weekly || []).map(file => ({...file, period: "weekly"})),
        ...(periodFiles.monthly || []).map(file => ({...file, period: "monthly"}))
      ];
      renderGroup("dailyStorageGroup", "Daily Dashboard Files", dailyFiles);
      renderGroup("multiDayStorageGroup", "Multi-Day Dashboard Files", multiDayFiles);
      const selectedPeriodFiles = periodFiles[currentPeriod] || [];
      if (selectedPeriodFiles.length) {
        const currentLabel = currentPeriod === "daily" ? "Daily" : currentPeriod === "weekly" ? "Weekly" : "Monthly";
        document.getElementById("uploadPeriodLabel").textContent = currentLabel;
      }
    }

    function fillMappingSelects(headers) {
      const selectIds = ["revenueColumn","expenseColumn","patientColumn","departmentColumn","doctorColumn","statusColumn","billColumn","appointmentColumn"];

      selectIds.forEach(id => {
        const select = document.getElementById(id);
        select.innerHTML = '<option value="">Choose column</option>' + headers.map(h => `<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join("");
      });
    }

    function updateLatestFileColumns() {
      const firstFile = uploadedFiles[0];
      if (!firstFile) return;

      const sheet = firstFile.workbook.Sheets[firstFile.activeSheet];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (!rows.length) return;

      const headers = Object.keys(rows[0]);
      fillMappingSelects(headers);
    }

    function setUploadActionStatus(message, isError = false) {
      const status = document.getElementById("uploadActionStatus");
      status.textContent = message;
      status.style.color = isError ? "var(--danger)" : "var(--muted)";
    }

    function applySelectedMapping() {
      if (!uploadedFiles.length || !dashboardWorkbook) {
        setUploadActionStatus("Upload at least one file before applying a mapping.", true);
        return;
      }
      updateLatestFileColumns();
      generateMappedDashboardFromExcel();
      setUploadActionStatus(`Mapping applied to ${currentPeriod} dashboard.`);
    }

    function loadDefaultDashboardData() {
      renderDefaultData();
      showSection("dashboard");
      setUploadActionStatus(`Default ${currentPeriod} dashboard data loaded.`);
    }

    document.getElementById("excelUpload").addEventListener("change", async (event) => {
      const files = Array.from(event.target.files);
      const storageFiles = periodFiles[currentPeriod];
      uploadedFiles = dashboardMode === "multi-day"
        ? [...periodFiles.weekly, ...periodFiles.monthly]
        : storageFiles;

      for (const file of files) {
        await uploadFileToBackend(file);

        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        const fileEntry = {
          name: file.name,
          data: encodeFile(arrayBuffer),
          workbook,
          sheetNames: workbook.SheetNames,
          activeSheet: workbook.SheetNames.find(sheet => normalizeHeader(sheet) === "finalmaster") || workbook.SheetNames[0]
        };

        const existing = storageFiles.findIndex(item => classifyFile(item.name) === classifyFile(file.name));
        if (existing >= 0) storageFiles.splice(existing, 1);
        storageFiles.push(fileEntry);
        uploadedFiles = dashboardMode === "multi-day"
          ? [...periodFiles.weekly, ...periodFiles.monthly]
          : storageFiles;
        savePeriodFiles();
      }
      localStorage.setItem("horizonCareLastView", JSON.stringify({dashboardMode, period: currentPeriod}));

      if (uploadedFiles.length && (currentPeriod === "daily" || currentPeriod === "weekly" || currentPeriod === "monthly")) {
        const masterFile = uploadedFiles.find(file => classifyFile(file.name) === "master");
        dashboardWorkbook = (masterFile && masterFile.workbook) || uploadedFiles[0].workbook;
        renderFileList();
        updateLatestFileColumns();
        generateMappedDashboardFromExcel();
        setUploadActionStatus(`${currentPeriod[0].toUpperCase() + currentPeriod.slice(1)} dashboard loaded from uploaded data.`);
        addNotification("Upload complete", `${files.length} file(s) processed for ${currentPeriod} dashboard.`, "success");
      }
    });

    function normalizeHeader(value) {
      return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function findColumn(row, names) {
      const wanted = names.map(normalizeHeader);
      return Object.keys(row).find(key => wanted.includes(normalizeHeader(key))) || "";
    }

    function nonEmptyCount(rows, columnNames) {
      if (!rows.length) return 0;
      const column = findColumn(rows[0], columnNames);
      return column ? rows.filter(row => String(row[column] || "").trim()).length : 0;
    }

    function numericValue(value) {
      return Number(String(value || "").replace(/[₹$,%\s,]/g, "")) || 0;
    }

    function numericAmount(value) {
      const text = String(value ?? "").replace(/[₹$,%\s,]/g, "");
      if (!text) return null;
      const amount = Number(text);
      return Number.isFinite(amount) ? amount : null;
    }

    function uniqueCount(rows, column) {
      return new Set(rows.map(row => String(row[column] || "").trim()).filter(Boolean)).size;
    }

    function admissionUhidCount(rows) {
      return uniqueCount(rows, findColumn(rows[0] || {}, ["UHID"]));
    }

    function consultationRowCount(rows) {
      if (!rows.length) return 0;
      const serviceColumn = findColumn(rows[0], ["Service Name"]);
      return rows.filter(row =>
        /\bconsult(ation)?\b/i.test(String(row[serviceColumn] || ""))
      ).length;
    }

    function aggregate(rows, labelColumn, valueColumn) {
      const values = new Map();
      rows.forEach(row => {
        const label = String(row[labelColumn] || "").trim();
        const id = String(row[valueColumn] || "").trim();
        if (!label) return;
        if (!values.has(label)) values.set(label, new Set());
        if (id) values.get(label).add(id);
      });
      return [...values.entries()].map(([label, ids]) => ({label, value: ids.size})).sort((a, b) => b.value - a.value);
    }

    function aggregateRowCount(rows, labelColumn) {
      const values = new Map();
      rows.forEach(row => {
        const label = String(row[labelColumn] || "").trim();
        if (label) values.set(label, (values.get(label) || 0) + 1);
      });
      return [...values.entries()].map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value);
    }

    function aggregatePanelDateUhid(rows, dateColumn, panelColumn, uhidColumn) {
      const values = new Map();
      rows.forEach(row => {
        const id = String(row[uhidColumn] || "").trim();
        if (!id) return;
        const date = excelDate(row[dateColumn]);
        const dateLabel = date ? date.toLocaleDateString("en-IN") : "Unknown date";
        const panel = String(row[panelColumn] || "").trim() || "Unknown panel";
        const key = `${dateLabel} • ${panel}`;
        if (!values.has(key)) values.set(key, new Set());
        values.get(key).add(id);
      });
      return [...values.entries()]
        .map(([label, ids]) => ({label, value: ids.size}))
        .sort((a, b) => b.value - a.value);
    }

    function panelWiseDischargeCount(rows) {
      const panelColumn = findColumn(rows[0] || {}, ["Panel Name"]);
      const countColumn = findColumn(rows[0] || {}, ["File Id", "File ID"]) || findColumn(rows[0] || {}, ["UHID"]);
      if (!panelColumn || !countColumn) return 0;
      return aggregateUhidByLabel(rows, panelColumn, countColumn)
        .reduce((sum, item) => sum + item.value, 0);
    }

    function aggregateUhidByLabel(rows, labelColumn, idColumn) {
      const values = new Map();
      rows.forEach(row => {
        const id = String(row[idColumn] || "").trim();
        if (!id) return;
        const label = String(row[labelColumn] || "").trim() || "Unknown";
        if (!values.has(label)) values.set(label, new Set());
        values.get(label).add(id);
      });
      return [...values.entries()]
        .map(([label, ids]) => ({label, value: ids.size}))
        .sort((a, b) => b.value - a.value);
    }

    function aggregateAdmissionByLabel(rows, labelColumn) {
      return aggregateUhidByLabel(rows, labelColumn, findColumn(rows[0] || {}, ["UHID"]));
    }

    function aggregateRevenue(rows, labelColumn, amountColumn) {
      const values = new Map();
      rows.forEach(row => {
        const label = String(row[labelColumn] || "").trim();
        const amount = numericAmount(row[amountColumn]);
        if (!label) return;
        if (amount !== null) values.set(label, (values.get(label) || 0) + amount);
      });
      return [...values.entries()].map(([label, value]) => ({label, value})).sort((a, b) => b.value - a.value);
    }

    function serviceCategory(value) {
      const name = String(value || "").trim();
      const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ");
      if (!normalized) return "";
      if (/\bconsult(ation)?\b/.test(normalized)) return "Consultation";
      if (/\b(x ray|xray|radiograph|roentgen)\b/.test(normalized)) return "X-Ray";
      if (/\b(usg|tvs|ultrasound|sonography)\b/.test(normalized)) return "Ultrasound";
      if (/\b(mlc|vaccination|vaccine)\b/.test(normalized)) return "Others";
      if (/\b(dialysis|injection|procedure|charge|catheter|dressing)\b/.test(normalized)) return "Procedure";
      if (/\b(cardiology|cardiac|ecg|echo|tmt|holter)\b/.test(normalized)) return "Cardiology";
      return "Lab Test";
    }

    function graphRows(items, type = "count", isCurrency = false, totalDisplay = "", showTotal = true) {
      if (!items.length) return '<div style="color:var(--muted);font-size:13px">No data uploaded for this period.</div>';
      const max = Math.max(...items.map(item => item.value), 1);
      const rows = items.slice(0, 20).map(item => `
        <div class="graph-row">
          <div class="graph-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
          <div class="graph-track"><div class="graph-bar ${type} ${item.value === 0 ? "empty" : ""}" style="width:${item.value / max * 100}%"></div></div>
          <div class="graph-value">${item.display || (isCurrency ? currencyFormat(item.value, 2) : item.value)}</div>
        </div>`).join("");
      return showTotal ? rows + `<div class="graph-total">Grand Total: <strong>${totalDisplay || (isCurrency ? currencyFormat(items.reduce((sum, item) => sum + item.value, 0), 2) : items.reduce((sum, item) => sum + item.value, 0))}</strong></div>` : rows;
    }

    function renderDailyCharts() {
      const discharge = sourceRows(["discharge"]);
      const bill = sourceRows(["bill"]);
      const service = sourceRows(["service"]);
      const ipd = sourceRows(["ipd"]);
      const helper = sourceRows(["helper"]);
      const dischargeSample = discharge[0] || {};
      const billSample = bill[0] || {};
      const serviceSample = service[0] || {};
      const ipdSample = ipd[0] || {};
      const dischargeUhid = findColumn(dischargeSample, ["UHID"]);
      const billUhid = findColumn(billSample, ["UHID"]);
      const serviceUhid = findColumn(serviceSample, ["UHID"]);
      const dischargePanel = findColumn(dischargeSample, ["Panel Name"]);
      const dischargeDoctor = findColumn(dischargeSample, ["Doctor Name"]);
      const dischargeDept = findColumn(dischargeSample, ["Dept. Name"]);
      const dischargeAmount = findColumn(dischargeSample, ["Service Final Amt"]);
      const billDoctor = findColumn(billSample, ["Doctor Name"]);
      const billAmount = findColumn(billSample, ["Service Final Amt"]);
      const serviceName = findColumn(serviceSample, ["Service Name"]);
      const ipdPanel = findColumn(ipdSample, ["Panel Name"]);
      const ipdUhid = findColumn(ipdSample, ["UHID"]);
      const ipdRoom = findColumn(ipdSample, ["Room Category"]);
      const ipdDod = findColumn(ipdSample, ["Dod", "DOD"]);
      const normalizedPanel = row => {
        const value = String(row[ipdPanel] || "").trim().toUpperCase();
        return ["ECHS", "CGHS", "CAPF", "DELHI POLICE", "AYUSHMAN BHARAT", "CASH"].includes(value) ? value : "TPA";
      };
      const panelActive = new Map();
      ipd.forEach(row => {
        const id = String(row[ipdUhid] || "").trim();
        if (id && (!ipdDod || !String(row[ipdDod] || "").trim() || String(row[ipdDod]).trim() === "-")) {
          const key = normalizedPanel(row);
          if (!panelActive.has(key)) panelActive.set(key, new Set());
          panelActive.get(key).add(id);
        }
      });
      const activeRoom = new Map();
      ipd.forEach(row => {
        const id = String(row[ipdUhid] || "").trim();
        const room = String(row[ipdRoom] || "").trim().toUpperCase();
        if (id && (!ipdDod || !String(row[ipdDod] || "").trim() || String(row[ipdDod]).trim() === "-") && (room === "ICU" || room === "NICU")) activeRoom.set(room, (activeRoom.get(room) || new Set()).add(id));
      });
      const ventilatorColumn = findColumn(helper[0] || {}, ["Ventilator Usage"]);
      const latestVentilator = helper.length ? numericAmount(helper[helper.length - 1][ventilatorColumn]) || 0 : 0;
      const doctorDept = row => {
        const doctor = String(row[dischargeDoctor] || "").trim();
        const dept = String(row[dischargeDept] || "").trim();
        return doctor || dept ? `${doctor || "Unknown"} - ${dept || "Unknown"}` : "";
      };
      const categorizedService = service
        .map(row => ({...row, serviceCategory: serviceCategory(row[serviceName])}))
        .filter(row => row.serviceCategory);
      const serviceCounts = aggregateRowCount(categorizedService, "serviceCategory");
      const serviceCategoryRevenue = new Map();
      categorizedService.forEach(row => {
        const amount = numericAmount(row[findColumn(row, ["Service Final Amt"])]);
        if (amount !== null) serviceCategoryRevenue.set(row.serviceCategory, (serviceCategoryRevenue.get(row.serviceCategory) || 0) + amount);
      });
      const serviceCountRevenue = serviceCounts.map(item => ({
        ...item,
        display: `${item.value} | ${currencyFormat(serviceCategoryRevenue.get(item.label) || 0, 2)}`
      }));
      const visitType = findColumn(serviceSample, ["Visit Type Name"]);
      const visitRows = service.filter(row => {
        const type = String(row[visitType] || "").trim().toLowerCase();
        return type === "dc" || type === "opd";
      });
      const visitCounts = aggregateRowCount(visitRows, visitType);
      const serviceRevenue = new Map();
      visitRows.forEach(row => {
        const label = String(row[visitType] || "").trim();
        const amount = numericAmount(row[findColumn(row, ["Service Final Amt"])]);
        if (label && amount !== null) serviceRevenue.set(label, (serviceRevenue.get(label) || 0) + amount);
      });
      const serviceCombined = visitCounts.map(item => ({
        label: item.label,
        value: item.value,
        display: `${item.value} | ${currencyFormat(serviceRevenue.get(item.label) || 0, 2)}`
      }));
      const doctorDeptCounts = aggregate(
        discharge.map(row => ({...row, doctorDept: doctorDept(row)})),
        "doctorDept",
        dischargeUhid
      );
      const serviceTotalRevenue = [...serviceRevenue.values()].reduce((sum, value) => sum + value, 0);
      const cards = [
        ["1. Panel-wise Patient Count", "Discharge Report • unique UHID", graphRows(aggregate(discharge, dischargePanel, dischargeUhid))],
        ["2. Doctor-Department Patient Count", "Discharge Report • unique UHID", graphRows(doctorDeptCounts)],
        ["3. Panel-wise Active Patients", "IPD List • non-standard panels grouped as TPA", graphRows([...panelActive].map(([label, ids]) => ({label, value: ids.size})), "purple")],
        ["4. Doctor-Department IPD Revenue", "Discharge Report • IPD Revenue", graphRows(aggregateRevenue(discharge.map(row => ({...row, doctorDept: doctorDept(row)})), "doctorDept", dischargeAmount), "red", true)],
        ["5. ICU / NICU + Ventilator", "IPD List + Helper Sheet", graphRows([{label:"ICU",value:(activeRoom.get("ICU") || new Set()).size},{label:"NICU",value:(activeRoom.get("NICU") || new Set()).size},{label:"Ventilator Usage",value:latestVentilator}], "count", false, "", false)],
        ["7. PATIENT COUNT & REVENUE BY SERVICE REPORT", "Service Report • DC and OPD unique UHID + Service Final Amt", graphRows(serviceCombined, "count", false, `${visitCounts.reduce((sum, item) => sum + item.value, 0)} patients | ${currencyFormat(serviceTotalRevenue, 2)}`)],
        ["8. Daily Service Count Analysis", "Service Report • service row count + sum of Final Service Amt", graphRows(serviceCountRevenue, "gold", false, `${serviceCounts.reduce((sum, item) => sum + item.value, 0)} rows | ${currencyFormat(serviceTotalRevenue, 2)}`)]
      ];
      document.getElementById("chartsSection").innerHTML = cards.map(card => `<div class="card graph-card"><h3>${card[0]}</h3><p>${card[1]}</p><div class="graph-list">${card[2]}</div></div>`).join("");
    }

    function periodDateRange(rows, dateColumnNames) {
      const dateColumn = findColumn(rows[0] || {}, dateColumnNames);
      const dates = rows.map(row => excelDate(row[dateColumn])).filter(Boolean);
      if (!dates.length) return {dateColumn, latest: null, start: null, end: null};
      const latest = new Date(Math.max(...dates.map(date => date.getTime())));
      const start = new Date(latest.getFullYear(), latest.getMonth(), 1);
      const end = new Date(latest.getFullYear(), latest.getMonth() + 1, 0, 23, 59, 59, 999);
      return {dateColumn, latest, start, end};
    }

    function rowsInDateRange(rows, dateColumn, start, end) {
      if (!dateColumn || !start || !end) return rows;
      return rows.filter(row => {
        const date = excelDate(row[dateColumn]);
        return date && date >= start && date <= end;
      });
    }

    function slotRows(rows, dateColumn, slot) {
      return rows.filter(row => {
        const date = excelDate(row[dateColumn]);
        if (!date) return false;
        const day = date.getDate();
        return slot === "1-10" ? day <= 10 : slot === "11-20" ? day >= 11 && day <= 20 : day >= 21;
      });
    }

    function periodLineChart(labels, actual, target) {
      const max = Math.max(...actual, ...target, 1);
      const points = values => values.map((value, index) => `${20 + index * (260 / Math.max(values.length - 1, 1))},${125 - (value / max * 105)}`).join(" ");
      const labelsHtml = labels.map((label, index) => `<span>${label}</span>`).join("");
      const valueHtml = labels.map((label, index) => `<span>${label}<strong><em class="actual-value">${currencyFormat(actual[index], 0)}</em><em class="target-value">${currencyFormat(target[index], 0)}</em></strong></span>`).join("");
      return `<div class="period-line-chart"><svg viewBox="0 0 300 145" role="img" aria-label="Revenue versus target revenue"><line x1="20" y1="125" x2="280" y2="125" stroke="#dfe5ef"/><polyline fill="none" stroke="#4285e8" stroke-width="3" points="${points(actual)}"/><polyline fill="none" stroke="#ef5a5a" stroke-width="3" points="${points(target)}"/>${actual.map((value, index) => `<circle cx="${20 + index * (260 / Math.max(actual.length - 1, 1))}" cy="${125 - (value / max * 105)}" r="3" fill="#4285e8"/>`).join("")}${target.map((value, index) => `<circle cx="${20 + index * (260 / Math.max(target.length - 1, 1))}" cy="${125 - (value / max * 105)}" r="3" fill="#ef5a5a"/>`).join("")}</svg><div class="line-labels">${labelsHtml}</div><div class="line-values">${valueHtml}</div><div class="line-legend"><span class="actual">Achieved Revenue</span><span class="target">Target</span></div></div>`;
    }

    function renderMultiDayCharts() {
      const discharge = sourceRows(["discharge"]);
      const admission = sourceRows(["admission"]);
      const service = sourceRows(["service"]);
      const sample = discharge[0] || admission[0] || service[0] || {};
      const dischargeUhid = findColumn(sample, ["UHID"]);
      const dischargeFileId = findColumn(discharge[0] || {}, ["File Id", "File ID"]);
      const serviceUhid = findColumn(service[0] || {}, ["UHID"]);
      const dischargeDate = findColumn(discharge[0] || {}, ["DOD"]);
      const admissionDate = findColumn(admission[0] || {}, ["DATE", "Doa", "DOA"]);
      const normalizedDischargePanel = row => {
        const value = String(row[dischargePanel] || "").trim().toUpperCase();
        if (!value) return "TPA";
        if (value.includes("AYUSHMAN")) return "AYUSHMAN";
        if (value === "CAPF") return "CAPF";
        if (value === "ECHS") return "ECHS";
        if (value === "ESIC" || value === "ESI") return "ESIC";
        if (value === "CGHS") return "CGHS";
        if (value.includes("DELHI POLICE")) return "DELHI POLICE";
        if (value === "CASH") return "CASH";
        return "TPA";
      };
      const serviceDate = findColumn(service[0] || {}, ["DATE", "Service Date"]);
      const range = periodDateRange(discharge, ["DOD"]);
      const monthDischarge = rowsInDateRange(discharge, dischargeDate, range.start, range.end);
      const monthAdmission = rowsInDateRange(admission, admissionDate, range.start, range.end);
      const slots = [
        {label: "1–10", key: "1-10"},
        {label: "11–20", key: "11-20"},
        {label: "21–month-end", key: "21-end"}
      ];
      const monthService = rowsInDateRange(service, serviceDate, range.start, range.end);
      const slotDischarge = slots.map(slot => slotRows(monthDischarge, dischargeDate, slot.key));
      const slotService = slots.map(slot => slotRows(monthService, serviceDate, slot.key));
      const dischargePanel = findColumn(discharge[0] || {}, ["Panel Name"]);
      const dischargeDoctor = findColumn(discharge[0] || {}, ["Doctor Name"]);
      const dischargeDept = findColumn(discharge[0] || {}, ["Dept. Name"]);
      const dischargeAmount = findColumn(discharge[0] || {}, ["Service Final Amt"]);
      const creditDue = findColumn(discharge[0] || {}, ["Credit Due"]);
      const admissionDoctor = findColumn(admission[0] || {}, ["Doctor Name"]);
      const admissionDept = findColumn(admission[0] || {}, ["Dept. Name"]);
      const serviceName = findColumn(service[0] || {}, ["Service Name"]);
      const serviceDept = findColumn(service[0] || {}, ["Dept. Name"]);
      const doctorDept = (row, doctorColumn, deptColumn) => {
        const doctor = String(row[doctorColumn] || "").trim();
        const dept = String(row[deptColumn] || "").trim();
        return doctor || dept ? `${doctor || "Unknown"} - ${dept || "Unknown"}` : "";
      };
      const consultationRows = monthService.filter(row => /\bconsult(ation)?\b/i.test(String(row[serviceName] || "")));
      const consultationByService = aggregateRowCount(consultationRows, serviceName);
      const consultationByDepartment = aggregateRowCount(consultationRows, serviceDept);
      const dischargeDoctorDept = monthDischarge.map(row => ({...row, doctorDept: doctorDept(row, dischargeDoctor, dischargeDept)}));
      const admissionDoctorDept = monthAdmission.map(row => ({...row, doctorDept: doctorDept(row, admissionDoctor, admissionDept)}));
      const dischargeCountColumn = dischargeFileId || dischargeUhid;
      const dischargeDoctorDeptCounts = aggregateUhidByLabel(dischargeDoctorDept, "doctorDept", dischargeCountColumn);
      const admissionDoctorDeptCounts = aggregateAdmissionByLabel(admissionDoctorDept, "doctorDept");
      const sumBySlot = (rows, amountColumn) => rows.map(slot => slot.reduce((sum, row) => sum + (numericAmount(row[amountColumn]) || 0), 0));
      const revenueSlots = sumBySlot(slotDischarge, dischargeAmount);
      const grandRevenue = revenueSlots.reduce((sum, value) => sum + value, 0);
      const countSlots = slotDischarge.map(rows => new Set(rows.map(row => String(row[dischargeCountColumn] || "").trim()).filter(Boolean)).size);
      const grandCount = countSlots.reduce((sum, value) => sum + value, 0);
      const labelsWithGrand = [...slots.map(slot => slot.label), "Grand Total"];
      const bars = (values, isCurrency = false, color = "") => graphRows(
        [...values, values.reduce((sum, value) => sum + value, 0)].map((value, index) => ({
          label: labelsWithGrand[index], value
        })),
        color, isCurrency, "", false
      );
      const panelItems = [];
      const panelGroups = [{label: "", rows: monthDischarge}];
      panelGroups.forEach(group => {
        const panelLabels = [...new Set(group.rows.map(row => normalizedDischargePanel(row)).filter(Boolean))];
        panelLabels.forEach(label => {
        const rows = group.rows.filter(row => normalizedDischargePanel(row) === label);
          const revenue = rows.reduce((sum, row) => sum + (numericAmount(row[dischargeAmount]) || 0), 0);
          const credit = rows.reduce((sum, row) => sum + (numericAmount(row[creditDue]) || 0), 0);
          panelItems.push({slot: group.label, panel: label, value: revenue, credit});
        });
      });
      panelItems.sort((a, b) => slots.findIndex(slot => slot.label === a.slot) - slots.findIndex(slot => slot.label === b.slot) || b.value - a.value);
      const revenueTrendItems = slots.map((slot, index) => ({
        label: slot.label,
        value: revenueSlots[index] + slotService[index].reduce((sum, row) => sum + (numericAmount(row[findColumn(row, ["Service Final Amt"])]) || 0), 0)
      }));
      const target = 50000000;
      const serviceRevenue = monthService.reduce((sum, row) => sum + (numericAmount(row[findColumn(row, ["Service Final Amt"])]) || 0), 0);
      const combinedRevenue = grandRevenue + serviceRevenue;
      const actualSlots = revenueSlots.map((value, index) => value + slotService[index].reduce((sum, row) => sum + (numericAmount(row[findColumn(row, ["Service Final Amt"])]) || 0), 0));
      const cumulativeActual = actualSlots.reduce((values, value) => values.concat((values[values.length - 1] || 0) + value), []);
      const targetValues = [target / 3, target * 2 / 3, target];
      const revenueValues = cumulativeActual;
      const targetLabels = slots.map(slot => slot.label);
      const categorizedService = monthService.map(row => ({...row, serviceCategory: serviceCategory(row[serviceName])})).filter(row => row.serviceCategory);
      const panelColumnMax = Math.max(...panelItems.flatMap(item => [item.value, item.credit]), 1);
      const panelColumnRows = panelItems.map(item => {
        const label = item.panel;
        const revenueHeight = Math.max(item.value / panelColumnMax * 100, item.value ? 4 : 0);
        const creditHeight = Math.max(item.credit / panelColumnMax * 100, item.credit ? 4 : 0);
        return `<div class="panel-column-group"><div class="panel-column-values"><span class="panel-value-tag panel-revenue-tag">${currencyFormat(item.value, 0)}</span><span class="panel-value-tag panel-credit-tag">${currencyFormat(item.credit, 0)}</span></div><div class="panel-column-bars"><span class="panel-revenue" style="height:${revenueHeight}%"></span><span class="panel-credit" style="height:${creditHeight}%"></span></div><div class="panel-column-label" title="${label}">${label}</div></div>`;
      }).join("");
      const panelGrandRevenue = panelItems.reduce((sum, item) => sum + item.value, 0);
      const panelGrandCredit = panelItems.reduce((sum, item) => sum + item.credit, 0);
      const dischargeSlotCountChart = dischargeFileId
        ? bars(countSlots, false, "purple")
        : '<div style="color:var(--muted);font-size:13px">File Id column not found in Discharge Report.</div>';
      const cards = [
        ["1. IPD Admission", "Admission Report • panel-wise unique UHID • duplicate records excluded", graphRows(aggregateAdmissionByLabel(monthAdmission, findColumn(admission[0] || {}, ["Panel Name"])), "count", false, admissionUhidCount(monthAdmission))],
        ["2. IPD Discharge", "Discharge Report • panel-wise File Id", graphRows(aggregateUhidByLabel(monthDischarge, dischargePanel, dischargeCountColumn))],
        ["3. Doc-Dept Wise Discharge", "Discharge Report • doctor + department File Id", graphRows(dischargeDoctorDeptCounts)],
        ["4. Doc-Dept Wise Admission", "Admission Report • doctor + department unique UHID • duplicate records excluded", graphRows(admissionDoctorDeptCounts, "count", false, admissionUhidCount(monthAdmission))],
        ["5. Department-wise Consultation", "Service Report • consultation row count grouped by department", graphRows(consultationByDepartment)],
        ["6. Consultation Service", "Service Report • consultation row count by service", graphRows(consultationByService)],
        ["7. Doc-Dept Wise IPD Revenue", "Discharge Report • sum of IPD Revenue", graphRows(aggregateRevenue(dischargeDoctorDept, "doctorDept", dischargeAmount), "red", true)],
        ["8. Discharge Count by 10-day Slot", "Discharge Report • unique File Id by 1–10, 11–20 and 21–month-end", dischargeSlotCountChart],
        ["9. IPD Revenue by 10-day Slot", "Discharge Report • IPD Revenue by slot", bars(revenueSlots, true, "red")],
        ["10. Revenue Trend", "IPD Revenue + Service Revenue • all three 10-day slots", graphRows(revenueTrendItems, "gold", true)],
        ["11. Total Services", `Service Report • all service rows by category (Total ${monthService.length})`, graphRows(aggregateRowCount(categorizedService, "serviceCategory"), "gold")],
        ["12. Target vs Revenue", `Target ₹5 crore • IPD Revenue + Service Revenue achieved ${currencyFormat(combinedRevenue, 0)} • Remaining ${currencyFormat(Math.max(target - combinedRevenue, 0), 0)}`, periodLineChart(targetLabels, revenueValues, targetValues)],
        ["13. Panel Revenue and Credit Due", "Discharge Report • panel-wise IPD Revenue and Credit Due", `<div class="panel-grand-total">Grand Total: <strong>${currencyFormat(panelGrandRevenue, 0)} IPD Revenue | ${currencyFormat(panelGrandCredit, 0)} Credit Due</strong></div><div class="panel-chart-legend"><span class="revenue-key">IPD Revenue</span><span class="credit-key">Credit Due</span></div>${panelColumnRows ? `<div class="panel-columns">${panelColumnRows}</div>` : '<div style="color:var(--muted)">No data uploaded for this period.</div>'}`]
      ];
      const wideCardIndex = cards.findIndex(([title]) => title.startsWith("13."));
      document.getElementById("chartsSection").innerHTML = cards.map((card, index) => {
        const isWide = index === wideCardIndex;
        const hasGrandTotal = [0, 1, 2, 3, 4, 6].includes(index);
        const hasLineChart = index === 11;
        return `<div class="card graph-card${isWide ? " wide" : ""}${hasGrandTotal ? " has-grand-total" : ""}${hasLineChart ? " has-line-chart" : ""}"><h3>${card[0]}</h3><p>${card[1]}</p><div class="graph-list">${card[2]}</div></div>`;
      }).join("");
    }

    function renderCharts() {
      if (dashboardMode === "daily") {
        renderDailyCharts();
        return;
      }
      renderMultiDayCharts();
    }

    function excelDate(value) {
      if (value instanceof Date) return value;
      if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);
        return parsed ? new Date(parsed.y, parsed.m - 1, parsed.d) : null;
      }
      const text = String(value ?? "").trim();
      if (!text) return null;
      const dayFirst = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s|$)/);
      if (dayFirst) {
        const date = new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
        return date.getFullYear() === Number(dayFirst[3])
          && date.getMonth() === Number(dayFirst[2]) - 1
          && date.getDate() === Number(dayFirst[1]) ? date : null;
      }
      const date = new Date(text);
      return Number.isNaN(date.getTime()) ? null : date;
    }

    function sourceRows(names) {
      const matches = uploadedFiles.filter(file => names.some(part => classifyFile(file.name) === part));
      const rows = matches.reduce((all, file) => {
        const sheet = file.workbook.Sheets[file.activeSheet || file.workbook.SheetNames[0]];
        return all.concat(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      }, []);
      return rows;
    }

    function rowsForCurrentPeriod(rows) {
      if (!rows.length) return rows;
      const dateColumn = findColumn(rows[0], ["DATE", "Service Date", "Bill Date", "Doa", "DOA"]);
      const dates = rows.map(row => excelDate(row[dateColumn])).filter(Boolean).sort((a, b) => a - b);
      if (!dates.length) return rows;
      const end = dates[dates.length - 1];
      const start = new Date(end);
      if (currentPeriod === "daily") start.setHours(0, 0, 0, 0);
      if (currentPeriod === "weekly") start.setDate(start.getDate() - 6);
      if (currentPeriod === "monthly") start.setDate(1);
      return rows.filter(row => {
        const date = excelDate(row[dateColumn]);
        return date && date >= start && date <= end;
      });
    }

    function generateMappedDashboardFromExcel() {
      if (!dashboardWorkbook) {
        renderDefaultData();
        return;
      }
      uploadedFiles = dashboardMode === "multi-day"
        ? uploadedFiles
        : periodFiles[currentPeriod];
      const masterFile = uploadedFiles.find(file => classifyFile(file.name) === "master");
      dashboardWorkbook = (masterFile && masterFile.workbook) || uploadedFiles[0]?.workbook || dashboardWorkbook;
      const admissionRows = rowsForPeriod(sourceRows(["admission"]), ["DATE"]);
      const dischargeRows = rowsForPeriod(sourceRows(["discharge"]), ["DATE"]);
      const billRows = sourceRows(["bill"]);
      const serviceRows = rowsForPeriod(sourceRows(["service"]), ["DATE"]);
      const ipdRows = sourceRows(["ipd"]);
      const helperRows = sourceRows(["helper"]);
      const sample = dischargeRows[0] || billRows[0] || serviceRows[0] || ipdRows[0] || {};
      const patient = findColumn(sample, ["Patient Name", "Name"]);
      const doctor = findColumn(sample, ["Doctor Name"]);
      const department = findColumn(sample, ["Dept. Name"]);
      const amount = findColumn(sample, ["Service Final Amt"]);
      const ipdCountColumn = findColumn(ipdRows[0] || {}, ["S No.", "UHID", "Name", "Patient Name"]);
      const activeDodColumn = findColumn(ipdRows[0] || {}, ["Dod", "DOD"]);
      const activeRows = ipdRows.filter(row =>
        ipdCountColumn &&
        String(row[ipdCountColumn] || "").trim() &&
        (!activeDodColumn || !String(row[activeDodColumn] || "").trim() || String(row[activeDodColumn]).trim() === "-")
      );
      const activeUhidColumn = findColumn(ipdRows[0] || {}, ["UHID"]);
      const activePatientIds = new Set(activeRows
        .map(row => String(row[activeUhidColumn] || "").trim())
        .filter(Boolean));
      const patientSource = dischargeRows.length ? dischargeRows : ipdRows;
      const patientRows = patientSource.filter(row => row[patient]).slice(-100).map((row, index) => ({
        name: row[patient], dept: row[department] || "General", doctor: row[doctor] || "Assigned",
        status: activeRows.includes(row) ? "Active" : "Discharged", bill: numericValue(row[amount]),
        uhid: row[findColumn(row, ["UHID"])] || "", panel: row[findColumn(row, ["Panel Name"])] || "",
        initials: String(row[patient]).split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase(),
        color: ["a", "b", "c", "d"][index % 4]
      }));
      const periodKpis = calculatePeriodKpis(
        admissionRows,
        dischargeRows,
        serviceRows,
        currentPeriod !== "daily"
      );
      const helper = helperRows[helperRows.length - 1] || {};
      const helperBed = findColumn(helper, ["Bed Occupancy"]);
      const helperAvg = findColumn(helper, ["Avg Rev/Patient"]);
      const data = {
        revenue: periodKpis.revenue, expenses: 0, claims: 0,
        admissions: periodKpis.admissions,
        discharges: periodKpis.discharges,
        opdCount: consultationRowCount(serviceRows),
        activePatients: activePatientIds.size,
        averageRevenue: periodKpis.averageRevenue,
        bedOccupancy: activeRows.length / 155 * 100,
        patients: patientRows.length ? patientRows : defaultData.patients,
        appointments: defaultData.appointments
      };
      if (dashboardMode === "multi-day") renderPeriodKpis(periodKpis);
      else renderStats(data);
      allPatientRows = data.patients;
      renderPatientRows(data.patients);
      renderAppointments(data.appointments);
      renderEconomics(data);
      renderCharts();
    }

    function showLogin() {
      document.getElementById("authOverlay").classList.remove("hidden");
      document.getElementById("loginPassword").focus();
    }

    async function login(event) {
      event.preventDefault();
      const error = document.getElementById("loginError");
      error.textContent = "";
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          username: document.getElementById("loginUsername").value.trim(),
          password: document.getElementById("loginPassword").value
        })
      });
      if (!response.ok) {
        error.textContent = "Invalid username or password.";
        return;
      }
      document.getElementById("authOverlay").classList.add("hidden");
      document.getElementById("loginPassword").value = "";
      await loadDashboard();
    }

    let notificationItems = [
      {title: "Dashboard synced", message: "Latest hospital data loaded successfully.", time: "Just now", type: "success"},
      {title: "Upload complete", message: "Daily files were processed and dashboard refreshed.", time: "5 min ago", type: "info"}
    ];

    function renderNotifications() {
      const list = document.getElementById("notificationList");
      const badge = document.getElementById("notificationBadge");
      if (!list) return;

      list.innerHTML = notificationItems.map(item => `
        <div class="notification-item ${item.type}">
          <small>${escapeHtml(item.time)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.message)}</p>
        </div>
      `).join("");

      if (badge) {
        const count = notificationItems.length;
        badge.textContent = String(count);
        badge.style.display = count > 0 ? "grid" : "none";
      }
    }

    function addNotification(title, message, type = "info") {
      notificationItems.unshift({ title, message, time: "Just now", type });
      notificationItems = notificationItems.slice(0, 6);
      renderNotifications();
    }

    function toggleNotifications(forceOpen) {
      const drawer = document.getElementById("notificationDrawer");
      if (!drawer) return;
      const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !drawer.classList.contains("open");
      drawer.classList.toggle("open", shouldOpen);
      drawer.setAttribute("aria-hidden", String(!shouldOpen));
    }

    document.getElementById("loginForm").addEventListener("submit", login);
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await fetch("/api/logout", {method: "POST"});
      showLogin();
    });
    document.getElementById("applyMappingBtn").addEventListener("click", applySelectedMapping);
    document.getElementById("loadDefaultBtn").addEventListener("click", loadDefaultDashboardData);
    document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
    document.getElementById("resetSettingsBtn").addEventListener("click", () => {
      dashboardSettings = {density: "comfortable", notifications: "on", chartDetail: "full", refresh: "off"};
      localStorage.removeItem("horizonCareSettings");
      loadSettings();
      document.getElementById("settingsStatus").textContent = "Settings reset to default.";
    });
    const notificationBtn = document.getElementById("notificationBtn");
    const notificationClose = document.getElementById("notificationClose");
    if (notificationBtn) {
      notificationBtn.addEventListener("click", () => toggleNotifications());
    }
    if (notificationClose) {
      notificationClose.addEventListener("click", () => toggleNotifications(false));
    }
    document.addEventListener("click", (event) => {
      const drawer = document.getElementById("notificationDrawer");
      const button = document.getElementById("notificationBtn");
      if (!drawer || !button) return;
      if (!drawer.contains(event.target) && event.target !== button && !button.contains(event.target)) {
        drawer.classList.remove("open");
        drawer.setAttribute("aria-hidden", "true");
      }
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") toggleNotifications(false);
    });
    document.getElementById("downloadDashboardBtn").addEventListener("click", () => {
      const period = currentPeriod.charAt(0).toUpperCase() + currentPeriod.slice(1);
      const copy = document.documentElement.cloneNode(true);
      copy.querySelectorAll("script").forEach(script => script.remove());
      const authOverlay = copy.querySelector("#authOverlay");
      if (authOverlay) authOverlay.classList.add("hidden");
      const blob = new Blob([`<!DOCTYPE html>\n${copy.outerHTML}`], {type: "text/html;charset=utf-8"});
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `SURYA-Hospital-${period}-Dashboard.html`;
      link.click();
      URL.revokeObjectURL(link.href);
    });

    renderNotifications();
    loadSettings();
    restorePeriodFiles().then(() => {
      if (!uploadedFiles.length) loadDashboard();
    });
