function onHomeyReady(Homey) {
    const _settingsKey = `com.athom.flowchecker.settings`;

    Homey.get(_settingsKey, initializeSettings);
    Homey.on('settings.set', (key, data) => {
        if (key == _settingsKey) {
            Homey.get(_settingsKey, initializeSettings);
        }
    });

    Homey.ready();
}

function setPage(evt, tabPage)
{
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].className = tabcontent[i].className.replace(" active", "");
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabPage).className += " active";
    evt.currentTarget.className += " active";
}

function initializeSettings (err, data) {
    if (err || !data) {
        document.getElementById('error').innerHTML = err;
        return;
    }

    console.log(Homey);

    document.getElementById('notification_broken').checked = data['NOTIFICATION_BROKEN'];
    document.getElementById('notification_disabled').checked = data['NOTIFICATION_DISABLED'];
    document.getElementById('notification_broken_variable').checked = data['NOTIFICATION_BROKEN_VARIABLE'];
    document.getElementById('notification_unused_flows').checked = data['NOTIFICATION_UNUSED_FLOWS'];
    document.getElementById('notification_unused_logic').checked = data['NOTIFICATION_UNUSED_LOGIC'];
    document.getElementById('interval_enabled').checked = data['INTERVAL_ENABLED'];
    document.getElementById('check_on_startup').checked = data['CHECK_ON_STARTUP'];
    document.getElementById("flows_overview").innerHTML = `<div class="row"><label>${Homey.__("settings.flows_broken")}</label><label>${data["BROKEN"].length}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.flows_disabled")}</label><label>${data["DISABLED"].length}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.flows_broken_variable")}</label><label>${data["BROKEN_VARIABLE"].length}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.unused_flows")}</label><label>${data["UNUSED_FLOWS"].length}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.unused_logic")}</label><label>${data["UNUSED_LOGIC"].length}<label></div>
                                                           <hr />
                                                           <div class="row"><label>${Homey.__("settings.all_flows")}</label><label>${data["ALL_FLOWS"]}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.all_variables")}</label><label>${data["ALL_VARIABLES"]}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.all_variables_logic")}</label><label>${data["ALL_VARIABLES_OBJ"]["logic"] || 0}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.all_variables_device")}</label><label>${data["ALL_VARIABLES_OBJ"]["device"] || 0}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.all_variables_app")}</label><label>${data["ALL_VARIABLES_OBJ"]["app"] || 0}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.all_variables_bl")}</label><label>${data["ALL_VARIABLES_OBJ"]["bl"] || 0}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.all_variables_fu")}</label><label>${data["ALL_VARIABLES_OBJ"]["fu"] || 0}<label></div>`;
    document.getElementById('interval_flows').value = data['INTERVAL_FLOWS'];
    document.getElementById('interval_variables').value = (data['INTERVAL_FLOWS'] * 10);
    if(data['BROKEN'].length) document.getElementById('flows_broken').innerHTML =  flowMapper(data, data['BROKEN'])
    if(data['DISABLED'].length) document.getElementById('flows_disabled').innerHTML =  flowMapper(data, data['DISABLED'])
    if(data['BROKEN_VARIABLE'].length) document.getElementById('flows_broken_variable').innerHTML =  flowMapper(data, data['BROKEN_VARIABLE'])
    if(data['UNUSED_FLOWS'].length) document.getElementById('flows_unused').innerHTML = flowMapper(data, data['UNUSED_FLOWS'])
    if(data['UNUSED_LOGIC'].length) document.getElementById('logic_unused').innerHTML = logicMapper(data, data['UNUSED_LOGIC'])
    if(data['FOLDERS'].length) document.getElementById('filtered_folders').innerHTML = filterMapper(data, data['FOLDERS'])

    showHide(document.getElementById('interval_enabled'));
    initSave(data);
    initClear(data);
}


function updateValue() {
    document.getElementById('interval_variables').value = (document.getElementById('interval_flows').value * 10);
}

function showHide(chkBox) {
    var interval_flows = document.getElementById("interval_flows_row");
    var interval_variables = document.getElementById("interval_variables_row");
    interval_flows.style.display = chkBox.checked ? "flex" : "none";
    interval_variables.style.display = chkBox.checked ? "flex" : "none";
}

function flowMapper(data, flows) {
    let html = `<label class="red">${Homey.__("settings.ctrl_click")}</label>`;
    const homey_id = data['HOMEY_ID'];
    let folder = null;
    flows.sort((a,b) => a.folder && a.folder.localeCompare(b.folder)).forEach((f) => {
        if(f.folder !== folder && f.folder !== null) {
            html += `<br><div class="row"><label class="flow-map"><strong>${escapeHtml(f.folder)}</strong></label></div>`;
            folder = f.folder;
        } else if(f.folder !== folder && f.folder === null) {
            html += `<br><div class="row"><label class="flow-map"><strong>----</strong></label></div>`;
            folder = f.folder;
        }

        html += `<div class="row"><label class="m-l flow-map"><a href='https://my.homey.app/homeys/${homey_id}/flows/${f.id}' target='_top'>${escapeHtml(f.name)}</a></label></div>`;
    });

    return html;
}

function logicMapper(data, flows) {
    let html = ``;
    flows.sort((a,b) =>  a.name.localeCompare(b.name)).forEach((f) => {
        html += `<div class="row"><label class="flow-map">${escapeHtml(f.name)}</label</div>`;
    });

    return html;
}


function filterMapper(data, filters) {
    let html = ``;

    const filtered_folders = data['FILTERED_FOLDERS'];

    filters.sort((a,b) =>  a.name.localeCompare(b.name)).forEach((f) => {
        html += `<div class="field row"><label for="${f.id}">${escapeHtml(f.name)}</label><input id="${f.id}" type="checkbox" ${checked(filtered_folders, f.id)} /></div>`;
    });

    return html;
}

function checked(filtered_folders, id) {
    return filtered_folders.includes(id) ? 'checked' : '';
}

function initSave(_settings) {
    document.getElementById('save').addEventListener('click', function (e) {
        const error = document.getElementById('error');
        const loading = document.getElementById('loading');
        const success = document.getElementById('success');
        const button = document.getElementById('save');

        const filtered_folders = [];
        const filtered_folders_inputs = document.querySelectorAll('#filtered_folders input:checked');
        filtered_folders_inputs.forEach(f => f.id && filtered_folders.push(f.id));

        const settings = {
            NOTIFICATION_BROKEN: document.getElementById('notification_broken').checked,
            NOTIFICATION_DISABLED: document.getElementById('notification_disabled').checked,
            NOTIFICATION_BROKEN_VARIABLE: document.getElementById('notification_broken_variable').checked,
            NOTIFICATION_UNUSED_FLOWS: document.getElementById('notification_unused_flows').checked,
            NOTIFICATION_UNUSED_LOGIC: document.getElementById('notification_unused_logic').checked,
            INTERVAL_ENABLED: document.getElementById('interval_enabled').checked,
            CHECK_ON_STARTUP: document.getElementById('check_on_startup').checked,
            BROKEN: _settings['BROKEN'],
            DISABLED: _settings['DISABLED'],
            BROKEN_VARIABLE: _settings['BROKEN_VARIABLE'],
            UNUSED_FLOWS: _settings['UNUSED_FLOWS'],
            UNUSED_LOGIC: _settings['UNUSED_LOGIC'],
            INTERVAL_FLOWS: document.getElementById('interval_flows').value,
            ALL_FLOWS: _settings['ALL_FLOWS'],
            ALL_VARIABLES: _settings['ALL_VARIABLES'],
            ALL_VARIABLES_OBJ: _settings['ALL_VARIABLES_OBJ'],
            FOLDERS: _settings['FOLDERS'],
            FILTERED_FOLDERS: filtered_folders,
            HOMEY_ID: _settings['HOMEY_ID']
        }
        
        // ----------------------------------------------

        button.disabled = true;
        loading.innerHTML = `<i class="fa fa-spinner fa-spin fa-fw"></i>${Homey.__("settings.config_saving")}`;
        error.innerHTML = "";
        success.innerHTML = "";

        Homey.api('PUT', '/settings', settings, function (err, result) {
            if (err) {
                error.innerHTML = err;
                loading.innerHTML = "";
                success.innerHTML = "";
                return Homey.alert(err);
            } else {
                loading.innerHTML = "";
                error.innerHTML = "";
                success.innerHTML = `${Homey.__("settings.config_saved")}`;
            }
        });
    });
}


function initClear(_settings) {
    document.getElementById('clear').addEventListener('click', function (e) {
        error = document.getElementById('error');
        loading = document.getElementById('loading');
        success = document.getElementById('success');

        document.getElementById('flows_broken').innerHTML = '';
        document.getElementById('flows_disabled').innerHTML = '';
        document.getElementById('flows_broken_variable').innerHTML = '';
        document.getElementById('flows_overview').innerHTML = '';
        document.getElementById('flows_unused').innerHTML = '';
        document.getElementById('logic_unused').innerHTML = '';
        document.getElementById('filtered_folders').innerHTML = '';
        document.getElementById('notification_broken').checked = true;
        document.getElementById('notification_disabled').checked = false;
        document.getElementById('notification_broken_variable').checked = true;
        document.getElementById('notification_unused_flows').checked = false;
        document.getElementById('notification_unused_logic').checked = false;
        document.getElementById('interval_enabled').checked = true;
        document.getElementById('check_on_startup').checked = false;
        document.getElementById('interval_flows').value = 5;
        document.getElementById('interval_variables').value = 50;

        const settings = {
            NOTIFICATION_BROKEN: true,
            NOTIFICATION_DISABLED: false,
            NOTIFICATION_BROKEN_VARIABLE: true,
            NOTIFICATION_UNUSED_FLOWS: false,
            NOTIFICATION_UNUSED_LOGIC: false,
            INTERVAL_ENABLED: true,
            CHECK_ON_STARTUP: false,
            BROKEN: [],
            DISABLED: [],
            BROKEN_VARIABLE: [],
            UNUSED_FLOWS: [],
            UNUSED_LOGIC: [],
            INTERVAL_FLOWS: 3,
            ALL_FLOWS: 0,
            ALL_VARIABLES: 0,
            ALL_VARIABLES_OBJ: {},
            FOLDERS: [],
            FILTERED_FOLDERS: [],
            HOMEY_ID: _settings['HOMEY_ID']
        }

        Homey.api('PUT', '/settings', settings, function (err, result) {
            if (err) {
                error.innerHTML = err;
                loading.innerHTML = "";
                success.innerHTML = "";
                return Homey.alert(err);
            } else {
                loading.innerHTML = "";
                error.innerHTML = "";
                success.innerHTML = `${Homey.__("settings.config_clear_and_saved")}`;
            }
        });
    });
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }
