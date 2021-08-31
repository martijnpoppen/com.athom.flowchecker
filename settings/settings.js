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
    if(data['BROKEN'].length) document.getElementById('flows_broken').innerHTML =  '<li>' + data['BROKEN'].map(f => f.name).sort().join('</li><li>') + '</li>'
    if(data['DISABLED'].length) document.getElementById('flows_disabled').innerHTML =  '<li>' + data['DISABLED'].map(f => f.name).sort().join('</li><li>') + '</li>'

    initSave(data);
    initClear(data);
}

function setInterval(data) {
    const refresh = document.getElementById('niu_refresh');
    for(let i = 0; i < refresh.options.length; i++) {
        if(refresh.options[i].value == `${data['REFRESH']}`) {
            refresh.options[i].selected = true;
        }
    }
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
            BROKEN: _settings['BROKEN'],
            DISABLED: _settings['DISABLED']
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

        document.getElementById('notification_broken').innerHTML = '';
        document.getElementById('notification_disabled').innerHTML = '';
        document.getElementById('flows_broken').checked = true;
        document.getElementById('flows_disabled').checked = false;

        const settings = {
            NOTIFICATION_BROKEN: true,
            NOTIFICATION_DISABLED: false,
            BROKEN: [],
            DISABLED: []
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