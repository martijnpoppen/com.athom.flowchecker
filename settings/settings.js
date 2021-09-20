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
    document.getElementById('flows_overview').innerHTML =  `<div class="row"><label>${Homey.__("settings.flows_broken")}</label><div>${data['BROKEN'].length}</div></div><div class="row"><label>${Homey.__("settings.flows_disabled")}</label><div>${data['DISABLED'].length}</div></div><div class="row"><label>${Homey.__("settings.flows_broken_variable")}</label><div>${data['BROKEN_VARIABLE'].length}</div></div><div class="row"><label>${Homey.__("settings.all_flows")}</label><div>${data['ALL_FLOWS']}</div></div><div class="row"><label>${Homey.__("settings.all_variables")}</label><div>${data['ALL_VARIABLES']}</div></div>`;
    document.getElementById('interval_flows').value = data['INTERVAL_FLOWS'];
    document.getElementById('interval_variables').value = (data['INTERVAL_FLOWS'] * 10);
    if(data['BROKEN'].length) document.getElementById('flows_broken').innerHTML =  '<li>' + data['BROKEN'].map(f => f.name).sort().join('</li><li>') + '</li>';
    if(data['DISABLED'].length) document.getElementById('flows_disabled').innerHTML =  '<li>' + data['DISABLED'].map(f => f.name).sort().join('</li><li>') + '</li>';
    if(data['BROKEN_VARIABLE'].length) document.getElementById('flows_broken_variable').innerHTML =  '<li>' + data['BROKEN_VARIABLE'].map(f => f.name).sort().join('</li><li>') + '</li>';

    initSave(data);
    initClear(data);
}


function updateValue() {
    document.getElementById('interval_variables').value = (document.getElementById('interval_flows').value * 10);
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
            BROKEN: _settings['BROKEN'],
            DISABLED: _settings['DISABLED'],
            BROKEN_VARIABLE: _settings['BROKEN_VARIABLE'],
            INTERVAL_FLOWS: document.getElementById('interval_flows').value
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
        document.getElementById('interval_flows').value = 3;
        document.getElementById('interval_variables').value = 30;

        const settings = {
            NOTIFICATION_BROKEN: true,
            NOTIFICATION_DISABLED: false,
            NOTIFICATION_BROKEN_VARIABLE: true,
            BROKEN: [],
            DISABLED: [],
            BROKEN_VARIABLE: [],
            INTERVAL_FLOWS: 3,
            ALL_FLOWS: 0,
            ALL_VARIABLES: 0
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