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
    if(data['BROKEN'].length) document.getElementById('flows_broken').innerHTML =  '<li>' + data['BROKEN'].map(f => f.name).sort().join('</li><li>') + '</li>'
    if(data['DISABLED'].length) document.getElementById('flows_disabled').innerHTML =  '<li>' + data['DISABLED'].map(f => f.name).sort().join('</li><li>') + '</li>'
    if(data['BROKEN_VARIABLE'].length) document.getElementById('flows_broken_variable').innerHTML =  '<li>' + data['BROKEN_VARIABLE'].map(f => f.name).sort().join('</li><li>') + '</li>'

    initSave(data);
    initClear(data);
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
            BROKEN_VARIABLE: _settings['BROKEN_VARIABLE']
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
        document.getElementById('notification_broken').checked = true;
        document.getElementById('notification_disabled').checked = false;
        document.getElementById('notification_broken_variable').checked = true;

        const settings = {
            NOTIFICATION_BROKEN: true,
            NOTIFICATION_DISABLED: false,
            NOTIFICATION_BROKEN_VARIABLE: true,
            BROKEN: [],
            DISABLED: [],
            BROKEN_VARIABLE: []
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