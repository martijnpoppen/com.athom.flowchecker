function onHomeyReady(Homey) {
  const _settingsKey = `com.athom.flowchecker.settings`;

  Homey.get(_settingsKey, initializeSettings);
  Homey.on("settings.set", (key, data) => {
    if (key == _settingsKey) {
      Homey.get(_settingsKey, initializeSettings);
    }
  });

  Homey.ready();
}

function setPage(evt, method) {
  var pages = ["overview", "flows", "variable_per_flow", "logic_flow_map", "settings", "filters"];

  var currentPage = document.getElementsByClassName("tabcontent active")?.[0]?.id || pages[0];
  var tabPage = currentPage;

  if (method === "next") {
    let currentIndex = pages.indexOf(currentPage);
    if (currentIndex + 1 < pages.length) {
      tabPage = pages[currentIndex + 1];
    } else {
      tabPage = pages[0];
    }
  } else if (method === "previous") {
    let currentIndex = pages.indexOf(currentPage);
    if (currentIndex - 1 >= 0) {
      tabPage = pages[currentIndex - 1];
    } else {
      tabPage = pages[pages.length - 1];
    }
  }

  console.log("Switching to page:", { currentPage, tabPage });
  // Get all elements with class="tabcontent" and hide them
  let tabcontent = document.getElementsByClassName("tabcontent");
  for (let i = 0; i < tabcontent.length; i++) {
    tabcontent[i].className = tabcontent[i].className.replace(" active", "");
  }

  // Show the current tab, and add an "active" class to the button that opened the tab
  document.getElementById(tabPage).className += " active";
  document.getElementById("currentPage").innerText = Homey.__(`settings.menu.${tabPage}`);
}

function initializeSettings(err, data) {
  try {
    if (err || !data) {
      console.error(err, data);
      document.getElementById("error").innerHTML = err ? err : Homey.__("settings.general.load_error");
      showDialog();
      return;
    }

    initDialog();
    setPage(null, "");

    document.getElementById("notification_broken").checked = data["NOTIFICATION_BROKEN"];
    document.getElementById("check_broken").checked = data["CHECK_BROKEN"];
    document.getElementById("notification_disabled").checked = data["NOTIFICATION_DISABLED"];
    document.getElementById("check_disabled").checked = data["CHECK_DISABLED"];
    document.getElementById("notification_broken_variable").checked = data["NOTIFICATION_BROKEN_VARIABLE"];
    document.getElementById("check_broken_variable").checked = data["CHECK_BROKEN_VARIABLE"];
    document.getElementById("notification_unused_flows").checked = data["NOTIFICATION_UNUSED_FLOWS"];
    document.getElementById("check_unused_flows").checked = data["CHECK_UNUSED_FLOWS"];
    document.getElementById("notification_unused_logic").checked = data["NOTIFICATION_UNUSED_LOGIC"];
    document.getElementById("check_unused_logic").checked = data["CHECK_UNUSED_LOGIC"];
    document.getElementById("notification_fixed").checked = data["NOTIFICATION_FIXED"];
    document.getElementById("check_fixed").checked = data["CHECK_FIXED"];
    document.getElementById("notification_fixed_logic").checked = data["NOTIFICATION_FIXED_LOGIC"];
    document.getElementById("check_fixed_logic").checked = data["CHECK_FIXED_LOGIC"];
    document.getElementById("interval_enabled").checked = data["INTERVAL_ENABLED"];
    document.getElementById("check_on_startup").checked = data["CHECK_ON_STARTUP"];
    document.getElementById("flows.overview").innerHTML = `<tbody><tr><td>${Homey.__("settings.flows.broken")}</td><td>${data["BROKEN"].length}</td></tr>
                                                           <tr><td>${Homey.__("settings.flows.disabled")}</td><td>${data["DISABLED"].length}</td></tr>
                                                           <tr><td>${Homey.__("settings.flows.broken_variable")}</td><td>${data["BROKEN_VARIABLE"].length}</td></tr>
                                                           <tr><td>${Homey.__("settings.flows.unused_flows")}</td><td>${data["UNUSED_FLOWS"].length}</td></tr>
                                                           <tr><td>${Homey.__("settings.flows.unused_logic")}</td><td>${data["UNUSED_LOGIC"].length}</td></tr>
                                                           <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                                           <tr><td><hr></td><td><hr></td></tr>
                                                           <tr><td>${Homey.__("settings.all.flows")}</td><td>${data["ALL_FLOWS"]}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.screensavers")}</td><td>${data["ALL_SCREENSAVERS"]}</td></tr>
                                                           <tr><td>&nbsp;</td><td>&nbsp;</td></tr>
                                                           <tr><td><hr></td><td><hr></td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables")}</td><td>${data["ALL_VARIABLES"]}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables_logic")}</td><td>${data["ALL_VARIABLES_OBJ"]["logic"] || 0}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables_device")}</td><td>${data["ALL_VARIABLES_OBJ"]["device"] || 0}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables_app")}</td><td>${data["ALL_VARIABLES_OBJ"]["app"] || 0}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables_bl")}</td><td>${data["ALL_VARIABLES_OBJ"]["bl"] || 0}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables_fu")}</td><td>${data["ALL_VARIABLES_OBJ"]["fu"] || 0}</td></tr>
                                                           <tr><td>${Homey.__("settings.all.variables_screensavers")}</td><td>${data["ALL_VARIABLES_OBJ"]["screensavers"] || 0}</td></tr></tbody>`;
    document.getElementById("interval_flows").value = data["INTERVAL_FLOWS"];
    document.getElementById("interval_variables").value = data["INTERVAL_FLOWS"] * 10;
    if (data["BROKEN"]) document.getElementById("flows_broken").innerHTML = flowMapper(data, data["BROKEN"]);
    if (data["DISABLED"]) document.getElementById("flows_disabled").innerHTML = flowMapper(data, data["DISABLED"]);
    if (data["BROKEN_VARIABLE"]) document.getElementById("flows_broken_variable").innerHTML = flowMapper(data, data["BROKEN_VARIABLE"]);
    if (data["UNUSED_FLOWS"]) document.getElementById("flows_unused").innerHTML = flowMapper(data, data["UNUSED_FLOWS"]);
    if (data["UNUSED_LOGIC"]) document.getElementById("logic_unused").innerHTML = logicMapper(data, data["UNUSED_LOGIC"]);
    if (data["FOLDERS"]) document.getElementById("filtered_folders").innerHTML = filterMapper(data, data["FOLDERS"]);
    if (data["VARIABLES_PER_FLOW"]) document.getElementById("variable_per_flow_list").innerHTML = flowsWithVariables(data);
    if (data["FLOW_LOGIC_MAP"]) document.getElementById("logic_flow_map_list_string").innerHTML = flowLogicMap(data, "string");
    if (data["FLOW_LOGIC_MAP"]) document.getElementById("logic_flow_map_list_number").innerHTML = flowLogicMap(data, "number");
    if (data["FLOW_LOGIC_MAP"]) document.getElementById("logic_flow_map_list_boolean").innerHTML = flowLogicMap(data, "boolean");

    checkBoxToggles();
    initSave(data);
    initClear(data);
  } catch (error) {
    console.error("Error in initializeSettings:", error);
    showDialog(error);
  }
}

function updateValue() {
  document.getElementById("interval_variables").value = document.getElementById("interval_flows").value * 10;
}

function showHide(chkBox, rowId) {
  document.getElementById(rowId).style.display = chkBox.checked ? "table-row" : "none";
}

function enableDisable(chkBox, rowId) {
  document.getElementById(rowId).disabled = chkBox.checked === false;
}

function checkBoxToggles() {
  showHide(document.getElementById("interval_enabled"), "interval_flows_row");
  showHide(document.getElementById("interval_enabled"), "interval_variables_row");
  enableDisable(document.getElementById("check_broken"), "notification_broken");
  enableDisable(document.getElementById("check_disabled"), "notification_disabled");
  enableDisable(document.getElementById("check_broken_variable"), "notification_broken_variable");
  enableDisable(document.getElementById("check_unused_flows"), "notification_unused_flows");
  enableDisable(document.getElementById("check_unused_logic"), "notification_unused_logic");
  enableDisable(document.getElementById("check_fixed"), "notification_fixed");
  enableDisable(document.getElementById("check_fixed_logic"), "notification_fixed_logic");
}

function flowMapper(data, flows) {
  let html = `<span class="red">${Homey.__("settings.general.ctrl_click")}</span><br>`;
  const homey_id = data["HOMEY_ID"];
  let folder = null;
  flows
    .sort((a, b) => a.folder && a.folder.localeCompare(b.folder))
    .forEach((f) => {
      if (f.folder !== folder && f.folder !== null) {
        html += `<br><div class="row"><span class="flow-map"><strong>${escapeHtml(f.folder, 'folder', f)}</strong></span></div>`;
        folder = f.folder;
      } else if (f.folder !== folder && f.folder === null) {
        html += `<br><div class="row"><span class="flow-map"><strong>----</strong></span></div>`;
        folder = f.folder;
      }

      const advanced = f.advanced ? "/advanced" : "";
      html += `<div class="row"><span class="m-l flow-map"><a href='https://my.homey.app/homeys/${homey_id}/flows${advanced}/${f.id}' target='_top'>${escapeHtml(f.name, 'folderlink', f)}</a></span></div>`;
    });

  if (flows.length === 0) {
    html = `<div class="row"><span class="flow-map">${Homey.__("settings.general.none")}</span></div>`;
  }

  return html;
}

function logicMapper(data, flows) {
  let html = ``;

  if (flows.length === 0) {
    return `<div class="row"><span class="flow-map">${Homey.__("settings.general.none")}</span></div>`;
  }

  flows
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((f) => {
      html += `<div class="row"><span class="flow-map">${escapeHtml(f.name, 'logicmapper', f)}</span</div>`;
    });

  return html;
}

function flowLogicMap(data, type) {
  const homey_id = data["HOMEY_ID"];
  const flow_logic_map = data["FLOW_LOGIC_MAP"];

  let html = ``;

  const filteredLogic = flow_logic_map.filter((logic) => logic.type === type).sort((a, b) => a.token.localeCompare(b.token));

  filteredLogic.forEach((logic) => {
    html += `<tr><td>Logic variable: <strong>${escapeHtml(logic.token, 'flowlogicmap', logic)}</strong></td></tr>`;
    html += `<tr><td colspan="2">&nbsp;</td></tr>`;
    html += `<tr><td colspan="2">Flows:</td></tr>`;
    logic.flows
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((f, index) => {
        const advanced = f.advanced ? "/advanced" : "";
        html += `<tr class="row"><td><a href='https://my.homey.app/homeys/${homey_id}/flows${advanced}/${f.id}' target='_top' class="m-l flow-map">${escapeHtml(f.name, 'flowLogicMapfolderlink', f)}</a></td></tr>`;
      });

    html += `<tr><td colspan="2">&nbsp;</td></tr>`;
    html += `<tr><td colspan="2"><hr></td></tr>`;

    if (!logic.flows.length) {
      html += `<tr><td colspan="2">${Homey.__("settings.general.none")}</td></tr>`;
    }
  });

  return html;
}

function flowsWithVariables(data) {
  const flows_with_variables = data["VARIABLES_PER_FLOW"];
  const homey_id = data["HOMEY_ID"];

  let html = ``;

  flows_with_variables.forEach((entry) => {
    const flow = entry.flow;
    html += `<sl-card class="card"> <div slot="header">Flow: <a href='https://my.homey.app/homeys/${homey_id}/flows${flow.advanced}/${flow.id}' target='_top' class="m-l flow-map">${escapeHtml(flow.name, 'flowsWithVariables', flow)}</a></div>`;
    html += `<table width="100%"><tr>`;

    let emptyHtml = `<tr><td>${Homey.__("settings.general.none")}</td></tr>`;

    ["logic", "device", "app", "bl", "fu", "screensavers"].forEach((varType, index) => {
      const variables = entry[varType] || [];
      if (variables.length) {
        emptyHtml = ``;

        if (index > 0) {
          html += `<tr><td colspan="2">&nbsp;</td></tr>`;
          html += `<tr><td colspan="2"><hr></td></tr>`;
        }

        html += `<tr><td><strong>${escapeHtml(varType, 'vartype', { name: varType }).toUpperCase()} VARIABLES</strong></td></tr>`;
        variables.forEach((v) => {
          html += `<tr><td>${escapeHtml(v.name || v.id, 'variable', v)}</td><td>(${v.type ? v.type : "N/A"})</td></tr>`;
        });
      }
    });

    html += `${emptyHtml}</table></sl-card><br><br>`;
  });

  return html;
}

function filterMapper(data, filters) {
  let html = ``;

  const filtered_folders = data["FILTERED_FOLDERS"];

  filters
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((f) => {
      html += `<tr><td><span for="${f.id}">${escapeHtml(f.name)}</span></td><td><sl-checkbox class="filterMapper" id="${f.id}" ${checked(filtered_folders, f.id)} /></td></tr>`;
    });

  return html;
}

function checked(filtered_folders, id) {
  return filtered_folders.includes(id) ? "checked" : "";
}

function initSave(_settings) {
  document.getElementById("save").addEventListener("click", function (e) {
    const error = document.getElementById("error");
    const loading = document.getElementById("loading");
    const success = document.getElementById("success");
    const button = document.getElementById("save");

    const filtered_folders = [];
    let filteredInputed = document.querySelectorAll(".filterMapper");
    filteredInputed.forEach((f) => f.id && f.checked && filtered_folders.push(f.id));

    const settings = {
      NOTIFICATION_BROKEN: document.getElementById("notification_broken").checked,
      CHECK_BROKEN: document.getElementById("check_broken").checked,
      NOTIFICATION_DISABLED: document.getElementById("notification_disabled").checked,
      CHECK_DISABLED: document.getElementById("check_disabled").checked,
      NOTIFICATION_BROKEN_VARIABLE: document.getElementById("notification_broken_variable").checked,
      CHECK_BROKEN_VARIABLE: document.getElementById("check_broken_variable").checked,
      NOTIFICATION_UNUSED_FLOWS: document.getElementById("notification_unused_flows").checked,
      CHECK_UNUSED_FLOWS: document.getElementById("check_unused_flows").checked,
      NOTIFICATION_UNUSED_LOGIC: document.getElementById("notification_unused_logic").checked,
      CHECK_UNUSED_LOGIC: document.getElementById("check_unused_logic").checked,
      NOTIFICATION_FIXED: document.getElementById("notification_fixed").checked,
      CHECK_FIXED: document.getElementById("check_fixed").checked,
      NOTIFICATION_FIXED_LOGIC: document.getElementById("notification_fixed_logic").checked,
      CHECK_FIXED_LOGIC: document.getElementById("check_fixed_logic").checked,
      INTERVAL_ENABLED: document.getElementById("interval_enabled").checked,
      CHECK_ON_STARTUP: document.getElementById("check_on_startup").checked,
      BROKEN: _settings["BROKEN"],
      DISABLED: _settings["DISABLED"],
      BROKEN_VARIABLE: _settings["BROKEN_VARIABLE"],
      UNUSED_FLOWS: _settings["UNUSED_FLOWS"],
      UNUSED_LOGIC: _settings["UNUSED_LOGIC"],
      INTERVAL_FLOWS: document.getElementById("interval_flows").value,
      ALL_FLOWS: _settings["ALL_FLOWS"],
      ALL_SCREENSAVERS: _settings["ALL_SCREENSAVERS"],
      ALL_VARIABLES: _settings["ALL_VARIABLES"],
      ALL_VARIABLES_OBJ: _settings["ALL_VARIABLES_OBJ"],
      VARIABLES_PER_FLOW: _settings["VARIABLES_PER_FLOW"],
      FLOW_LOGIC_MAP: _settings["FLOW_LOGIC_MAP"],
      FOLDERS: _settings["FOLDERS"],
      FILTERED_FOLDERS: filtered_folders,
      HOMEY_ID: _settings["HOMEY_ID"]
    };

    // ----------------------------------------------

    button.disabled = true;
    loading.innerHTML = `<i class="fa fa-spinner fa-spin fa-fw"></i>${Homey.__("settings.general.saving")}`;
    error.innerHTML = "";
    success.innerHTML = "";

    Homey.api("PUT", "/settings", settings, function (err, result) {
      if (err) {
        console.error(err);
        error.innerHTML = err;
        loading.innerHTML = "";
        success.innerHTML = "";
        showDialog();
        return Homey.alert(err);
      } else {
        loading.innerHTML = "";
        error.innerHTML = "";
        success.innerHTML = `${Homey.__("settings.general.saved")}`;
        showDialog();
      }
    });
  });
}

function initClear(_settings) {
  document.getElementById("clear").addEventListener("click", async function (e) {
    e.preventDefault();

    if (await Homey.confirm("Are you sure you want to clear all stored configuration data?")) {
      error = document.getElementById("error");
      loading = document.getElementById("loading");
      success = document.getElementById("success");

      document.getElementById("flows.broken").innerHTML = "";
      document.getElementById("flows.disabled").innerHTML = "";
      document.getElementById("flows.broken_variable").innerHTML = "";
      document.getElementById("flows.overview").innerHTML = "";
      document.getElementById("flows.unused").innerHTML = "";
      document.getElementById("logic_unused").innerHTML = "";
      document.getElementById("filtered_folders").innerHTML = "";
      document.getElementById("notification_broken").checked = true;
      document.getElementById("notification_disabled").checked = false;
      document.getElementById("notification_broken_variable").checked = true;
      document.getElementById("notification_unused_flows").checked = false;
      document.getElementById("notification_unused_logic").checked = false;
      document.getElementById("notifcation_fixed").checked = false;
      document.getElementById("notification_fixed_logic").checked = false;
      document.getElementById("check_broken").checked = true;
      document.getElementById("check_disabled").checked = true;
      document.getElementById("check_broken_variable").checked = true;
      document.getElementById("check_unused_flows").checked = true;
      document.getElementById("check_unused_logic").checked = true;
      document.getElementById("check_fixed").checked = true;
      document.getElementById("check_fixed_logic").checked = true;
      document.getElementById("interval_enabled").checked = true;
      document.getElementById("check_on_startup").checked = false;
      document.getElementById("interval_flows").value = 5;
      document.getElementById("interval_variables").value = 50;

      const settings = {
        NOTIFICATION_BROKEN: true,
        CHECK_BROKEN: true,
        NOTIFICATION_DISABLED: false,
        CHECK_DISABLED: true,
        NOTIFICATION_BROKEN_VARIABLE: true,
        CHECK_BROKEN_VARIABLE: true,
        NOTIFICATION_UNUSED_FLOWS: false,
        CHECK_UNUSED_FLOWS: true,
        NOTIFICATION_UNUSED_LOGIC: false,
        CHECK_UNUSED_LOGIC: true,
        NOTIFICATION_FIXED: false,
        CHECK_FIXED: true,
        NOTIFICATION_FIXED_LOGIC: false,
        CHECK_FIXED_LOGIC: true,
        INTERVAL_ENABLED: true,
        CHECK_ON_STARTUP: false,
        BROKEN: [],
        DISABLED: [],
        BROKEN_VARIABLE: [],
        UNUSED_FLOWS: [],
        UNUSED_LOGIC: [],
        INTERVAL_FLOWS: 3,
        ALL_FLOWS: 0,
        ALL_SCREENSAVERS: 0,
        ALL_VARIABLES: 0,
        ALL_VARIABLES_OBJ: {},
        FOLDERS: [],
        FILTERED_FOLDERS: [],
        HOMEY_ID: _settings["HOMEY_ID"]
      };

      Homey.api("PUT", "/settings", settings, function (err, result) {
        if (err) {
          console.error(err);
          error.innerHTML = err;
          loading.innerHTML = "";
          success.innerHTML = "";
          showDialog();
          return Homey.alert(err);
        } else {
          loading.innerHTML = "";
          error.innerHTML = "";
          success.innerHTML = `${Homey.__("settings.general.clear_and_saved")}`;
          showDialog();
        }
      });
    }
  });
}

function escapeHtml(unsafe, context = '', flow = {}) {
  if (typeof unsafe !== "string") {
    console.warn("escapeHtml called with non-string:", unsafe, context, flow);
    return unsafe;
  }

  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function showDialog() {
  const dialog = document.querySelector(".dialog-overview");
  dialog.show();
}

function initDialog() {
  const dialog = document.querySelector(".dialog-overview");
  const closeButton = dialog.querySelector('sl-button[slot="footer"]');

  closeButton.addEventListener("click", () => dialog.hide());
}
