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

function initializeSettings (err, data) {
    if (err || !data) {
        document.getElementById('error').innerHTML = err;
        return;
    }

    document.getElementById('notification_broken').checked = data['NOTIFICATION_BROKEN'];
    document.getElementById('notification_disabled').checked = data['NOTIFICATION_DISABLED'];
    document.getElementById('notification_broken_variable').checked = data['NOTIFICATION_BROKEN_VARIABLE'];
    document.getElementById('interval_enabled').checked = data['INTERVAL_ENABLED'];
    document.getElementById("flows_overview").innerHTML = `<div class="row"><label>${Homey.__("settings.flows_broken")}</label><label>${data["BROKEN"].length}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.flows_disabled")}</label><label>${data["DISABLED"].length}<label></div>
                                                           <div class="row"><label>${Homey.__("settings.flows_broken_variable")}</label><label>${data["BROKEN_VARIABLE"].length}<label></div>
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
    flows.sort((a,b) =>  a.name.localeCompare(b.name)).forEach((f) => {
        html += `<div class="row"><label><a href='https://my.homey.app/homeys/${homey_id}/flows/${f.id}' target='_top'>${escapeHtml(f.name)}</a></label</div>`;
    });

    return html;
}

function initSave(_settings) {
    document.getElementById('save').addEventListener('click', function (e) {
        const error = document.getElementById('error');
        const loading = document.getElementById('loading');
        const success = document.getElementById('success');
        const button = document.getElementById('save');

        const settings = {
            NOTIFICATION_BROKEN: document.getElementById('notification_broken').checked,
            NOTIFICATION_DISABLED: document.getElementById('notification_disabled').checked,
            NOTIFICATION_BROKEN_VARIABLE: document.getElementById('notification_broken_variable').checked,
            INTERVAL_ENABLED: document.getElementById('interval_enabled').checked,
            BROKEN: _settings['BROKEN'],
            DISABLED: _settings['DISABLED'],
            BROKEN_VARIABLE: _settings['BROKEN_VARIABLE'],
            INTERVAL_FLOWS: document.getElementById('interval_flows').value,
            ALL_FLOWS: _settings['ALL_FLOWS'],
            ALL_VARIABLES: _settings['ALL_VARIABLES'],
            ALL_VARIABLES_OBJ: _settings['ALL_VARIABLES_OBJ'],
            HOMEY_ID: _settings['HOMEY_ID']
        }
        
        // ----------------------------------------------

        button.disabled = true;
        loading.innerHTML = '<i class="fa fa-spinner fa-spin fa-fw"></i>Saving...';
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
                success.innerHTML = "Saved.";
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
        document.getElementById('notification_broken').checked = true;
        document.getElementById('notification_disabled').checked = false;
        document.getElementById('notification_broken_variable').checked = true;
        document.getElementById('interval_enabled').checked = false;
        document.getElementById('interval_flows').value = 3;
        document.getElementById('interval_variables').value = 30;

        const settings = {
            NOTIFICATION_BROKEN: true,
            NOTIFICATION_DISABLED: false,
            NOTIFICATION_BROKEN_VARIABLE: true,
            INTERVAL_ENABLED: false,
            BROKEN: [],
            DISABLED: [],
            BROKEN_VARIABLE: [],
            INTERVAL_FLOWS: 3,
            ALL_FLOWS: 0,
            ALL_VARIABLES: 0,
            ALL_VARIABLES_OBJ: {},
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
                success.innerHTML = "Cleared & Saved.";
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
